import { useCallback, useEffect, useRef, useState } from 'react'
import type { Demos } from '@kynesyslabs/demosdk/websdk'

// Minimal client for the L2PS instant-messaging server (node feature
// `l2ps-messaging`, default ws://<node>:3006). Implements the wire protocol
// directly — register with an ed25519 proof, then send/receive — so the POC
// can exercise the messaging server without pulling the newer SDK's
// L2PSMessagingPeer. See src/features/l2ps-messaging/L2PS_MESSAGING_QUICKSTART.md.
//
// NOTE: this is a transport TEST harness. Messages are base64-wrapped, NOT
// end-to-end encrypted — it proves register/send/receive/offline-queue work.
// Real x25519+AES-GCM e2e lives in the SDK's L2PSMessagingPeer.

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
function b64encode(s: string): string {
  return btoa(unescape(encodeURIComponent(s)))
}
function b64decode(s: string): string {
  try {
    return decodeURIComponent(escape(atob(s)))
  } catch {
    return s
  }
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
          const enc = (p.encrypted as { ciphertext?: string }) ?? {}
          setMessages((m) => [
            ...m,
            {
              direction: 'in',
              peer: String(p.from ?? ''),
              text: b64decode(enc.ciphertext ?? ''),
              hash: String(p.messageHash ?? ''),
              ts: msg.timestamp ?? Date.now(),
              offline: Boolean(p.offline),
            },
          ])
          break
        }
        case 'message_sent':
        case 'message_queued':
          setMessages((m) =>
            m.map((cm) =>
              cm.hash === p.messageHash && cm.direction === 'out'
                ? { ...cm, state: msg.type === 'message_queued' ? 'queued' : 'sent' }
                : cm,
            ),
          )
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
    const messageHash = await sha256hex(text)
    const timestamp = Date.now()
    // The server requires a non-empty ciphertext + nonce. This is a transport
    // test, so the plaintext is base64'd into ciphertext and the nonce/ephemeral
    // key are random fillers (not a real x25519+AES-GCM envelope).
    const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(12))))
    const ephemeralKey = toHex(crypto.getRandomValues(new Uint8Array(32)))
    ws.send(
      JSON.stringify({
        type: 'send',
        payload: {
          to: recipient,
          encrypted: { ciphertext: b64encode(text), nonce, ephemeralKey },
          messageHash,
        },
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
