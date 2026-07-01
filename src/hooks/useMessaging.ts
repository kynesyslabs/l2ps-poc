import { useCallback, useEffect, useRef, useState } from 'react'
import type { Demos } from '@kynesyslabs/demosdk/websdk'
import { sealTo, openFrom, type EncryptedEnvelope } from '../crypto/e2eMessaging'

// Client for the L2PS instant-messaging server (node feature `l2ps-messaging`,
// default ws://<node>:3006). Implements the wire protocol directly — register
// with an ed25519 proof, then send/receive — so the POC can exercise the server
// without pulling a newer SDK peer. See node:
// src/features/l2ps-messaging/L2PS_MESSAGING_QUICKSTART.md.
//
// Messages are end-to-end encrypted: the body is sealed to the recipient's
// identity ed25519 key (X25519 ECDH + AES-256-GCM — see ./crypto/e2eMessaging).
// The server only relays the { ciphertext, nonce, ephemeralKey } envelope and
// never sees plaintext.

export type MsgStatus = 'idle' | 'connecting' | 'registered' | 'error' | 'closed'

export interface ChatMessage {
  direction: 'in' | 'out'
  peer: string
  text: string
  hash: string
  ts: number
  offline?: boolean
  state?: 'sent' | 'queued'
}

function toHex(u8: Uint8Array): string {
  return Array.from(u8)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return toHex(new Uint8Array(buf))
}

export function deriveWsUrl(nodeUrl: string): string {
  const env = import.meta.env.VITE_MSG_WS_URL as string | undefined
  if (env) return env
  try {
    const u = new URL(nodeUrl, window.location.origin)
    const proto = u.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${u.hostname}:3006`
  } catch {
    return 'ws://localhost:3006'
  }
}

export function useMessaging(
  demos: Demos | null,
  nodeUrl: string,
  l2psUid: string,
) {
  const [wsUrl, setWsUrl] = useState<string>(() => deriveWsUrl(nodeUrl))
  const [status, setStatus] = useState<MsgStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [onlinePeers, setOnlinePeers] = useState<string[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [myKey, setMyKey] = useState<string>('')
  const wsRef = useRef<WebSocket | null>(null)
  // The wallet's ed25519 private key, kept in a ref to decrypt inbound messages.
  const myPrivRef = useRef<Uint8Array | null>(null)

  const connect = useCallback(async () => {
    if (!demos) {
      setError('Connect a wallet first')
      return
    }
    setError(null)
    setStatus('connecting')
    let pubKey: string
    try {
      pubKey = await demos.getEd25519Address()
    } catch (e) {
      setError(`could not read ed25519 key: ${(e as Error).message}`)
      setStatus('error')
      return
    }
    setMyKey(pubKey)

    // demos.keypair is the connected wallet's ed25519 keypair (public getter).
    // A missing key is non-fatal: outbound encryption only needs the recipient's
    // public key, so register/send still work — only inbound messages won't
    // decrypt (they render as [unable to decrypt]).
    try {
      myPrivRef.current = Uint8Array.from(demos.keypair.privateKey)
    } catch {
      myPrivRef.current = null
    }
    if (!myPrivRef.current) {
      setError('Could not read the wallet key — inbound messages will not decrypt.')
    }

    let ws: WebSocket
    try {
      ws = new WebSocket(wsUrl)
    } catch (e) {
      // An invalid URL throws synchronously here — release 'connecting' so the
      // URL field + reconnect button don't stay disabled.
      setError(`invalid WebSocket URL: ${(e as Error).message}`)
      setStatus('error')
      return
    }
    wsRef.current = ws

    ws.onopen = async () => {
      try {
        const timestamp = Date.now()
        const proofString = `register:${pubKey}:${timestamp}`
        // demos.crypto.sign("ed25519", bytes) -> { signature: Uint8Array }
        const signed = await (
          demos as unknown as {
            crypto: {
              sign: (a: string, d: Uint8Array) => Promise<{ signature: Uint8Array }>
            }
          }
        ).crypto.sign('ed25519', new TextEncoder().encode(proofString))
        const proof = toHex(signed.signature)
        ws.send(
          JSON.stringify({
            type: 'register',
            payload: { publicKey: pubKey, l2psUid, proof },
            timestamp,
          }),
        )
      } catch (e) {
        setError(`register failed: ${(e as Error).message}`)
        setStatus('error')
      }
    }

    ws.onmessage = (ev) => {
      let msg: { type?: string; payload?: Record<string, unknown>; timestamp?: number }
      try {
        msg = JSON.parse(ev.data as string)
      } catch {
        return
      }
      const p = (msg.payload ?? {}) as Record<string, unknown>
      switch (msg.type) {
        case 'registered':
          setStatus('registered')
          setOnlinePeers((p.onlinePeers as string[]) ?? [])
          break
        case 'message': {
          const enc = p.encrypted as EncryptedEnvelope | undefined
          const from = String(p.from ?? '')
          const hash = String(p.messageHash ?? '')
          const ts = msg.timestamp ?? Date.now()
          const offline = Boolean(p.offline)
          const priv = myPrivRef.current
          // Append synchronously so rows keep arrival order, then fill in the
          // decrypted text — decryption is async and would otherwise let a
          // faster-decrypting later message jump ahead of an earlier one.
          const decrypting = '[decrypting…]'
          setMessages((m) => [
            ...m,
            { direction: 'in', peer: from, text: decrypting, hash, ts, offline },
          ])
          void (async () => {
            let text: string
            try {
              if (!enc || !priv) throw new Error('missing envelope or key')
              text = await openFrom(enc, priv)
            } catch {
              text = '[unable to decrypt]'
            }
            setMessages((m) => {
              const idx = m.findIndex(
                (cm) => cm.direction === 'in' && cm.hash === hash && cm.text === decrypting,
              )
              return idx === -1 ? m : m.map((cm, i) => (i === idx ? { ...cm, text } : cm))
            })
          })()
          break
        }
        case 'message_sent':
        case 'message_queued':
          // Match only the first still-unacked outgoing row for this hash. The
          // hash is per-ciphertext (unique per send), but a resent identical
          // envelope could repeat it, so still guard on the first un-acked row.
          setMessages((m) => {
            const idx = m.findIndex(
              (cm) => cm.direction === 'out' && cm.hash === p.messageHash && !cm.state,
            )
            if (idx === -1) return m
            return m.map((cm, i) =>
              i === idx
                ? { ...cm, state: msg.type === 'message_queued' ? 'queued' : 'sent' }
                : cm,
            )
          })
          break
        case 'peer_online':
          setOnlinePeers((ps) =>
            [...new Set([...ps, String(p.publicKey ?? '')])].filter(Boolean),
          )
          break
        case 'peer_offline':
          setOnlinePeers((ps) => ps.filter((k) => k !== String(p.publicKey ?? '')))
          break
        case 'error':
          setError(`${p.code ?? 'ERROR'}: ${p.message ?? ''}`)
          // A register/auth error arrives before 'registered' — release
          // 'connecting' or the UI stays locked.
          setStatus((s) => (s === 'connecting' ? 'error' : s))
          break
      }
    }

    ws.onerror = () => {
      setError('WebSocket error — is the messaging server reachable on this URL?')
      setStatus('error')
    }
    ws.onclose = () => {
      setStatus((s) => (s === 'error' ? s : 'closed'))
    }
  }, [demos, wsUrl, l2psUid])

  const send = useCallback(async (to: string, text: string): Promise<boolean> => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setError('Not connected')
      return false
    }
    const recipient = to.trim()
    if (!recipient || !text) return false
    const timestamp = Date.now()
    // Seal the body to the recipient's identity key — real X25519+AES-GCM e2e.
    // The server relays this envelope opaquely and never sees plaintext.
    let encrypted: EncryptedEnvelope
    try {
      encrypted = await sealTo(recipient, text)
    } catch (e) {
      setError(`could not encrypt for recipient: ${(e as Error).message}`)
      return false
    }
    // Hash the ciphertext, not the plaintext: the server only needs this for
    // ack/dedup correlation, and hashing plaintext would leak message equality
    // (and allow dictionary guessing of short messages) to the relay.
    const messageHash = await sha256hex(encrypted.ciphertext)
    ws.send(
      JSON.stringify({
        type: 'send',
        payload: { to: recipient, encrypted, messageHash },
        timestamp,
      }),
    )
    setMessages((m) => [
      ...m,
      { direction: 'out', peer: recipient, text, hash: messageHash, ts: timestamp },
    ])
    return true
  }, [])

  const disconnect = useCallback(() => {
    wsRef.current?.close()
    wsRef.current = null
    setStatus('closed')
  }, [])

  useEffect(() => () => wsRef.current?.close(), [])

  return {
    wsUrl,
    setWsUrl,
    status,
    error,
    onlinePeers,
    messages,
    myKey,
    connect,
    send,
    disconnect,
  }
}
