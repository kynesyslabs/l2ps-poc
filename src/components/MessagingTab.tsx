import { useState, useRef, useEffect, type FC } from 'react'
import * as forge from 'node-forge'
import type { Demos } from '@kynesyslabs/demosdk/websdk'

/**
 * L2PS Messaging tab.
 *
 * Talks directly to a node's L2PS messaging WebSocket server (port 3006 by
 * default). The protocol — register-with-proof, send/queue, peer-joined, etc.
 * — is defined in kynesyslabs/node:src/features/l2ps-messaging/types.ts and
 * the matching SDK types in @kynesyslabs/demosdk/instant_messaging. We talk
 * to it via a raw `WebSocket` here (no SDK bump needed in this poc) so the
 * verification path stays decoupled from the demosdk version pin.
 *
 * Prerequisite for end-to-end testing: a Demos node running with
 * `L2PS_MESSAGING_ENABLED=true L2PS_MESSAGING_PORT=3006`. Until
 * kynesyslabs/node#936 lands and the dev nodes are restarted with that flag,
 * the WS connection will refuse here — which itself is a useful smoke test
 * for whether the feature is deployed at all.
 *
 * Encryption uses the same L2PS subnet AES-GCM key the rest of the poc already
 * loads from env (`VITE_L2PS_AES_KEY`) so a payload encrypted in the poc can
 * be decrypted on the other end without per-recipient key exchange — matches
 * what the node-side `processMessage` does on its end.
 */

type ConnectionState = 'idle' | 'connecting' | 'registering' | 'connected' | 'error'

interface IncomingMessage {
    id: string
    from: string
    plaintext: string
    timestamp: number
    offline?: boolean
}

interface MessagingTabProps {
    publicKeyHex: string
    demos: Demos | null
    showToast: (type: 'success' | 'error' | 'info', title: string, message?: string) => void
    addLog: (msg: string) => void
}

const DEFAULT_WS = 'ws://localhost:3006'
const DEFAULT_UID = import.meta.env.VITE_L2PS_UID ?? 'testnet_l2ps_001'
const AES_KEY = import.meta.env.VITE_L2PS_AES_KEY ?? ''

// AES-GCM encrypt / decrypt under the shared subnet key. Matches the
// pattern the node-side messaging service uses internally so the wire
// format is consistent with what the server delivers.
function encryptForSubnet(plaintext: string, keyHex: string): {
    ciphertext: string
    nonce: string
} {
    const keyBytes = forge.util.binary.hex.decode(keyHex)
    const cipher = forge.cipher.createCipher(
        'AES-GCM',
        forge.util.createBuffer(keyBytes as unknown as forge.util.ByteBuffer),
    )
    const nonce = forge.random.getBytesSync(12)
    cipher.start({ iv: nonce, additionalData: nonce })
    cipher.update(forge.util.createBuffer(forge.util.encodeUtf8(plaintext)))
    if (!cipher.finish()) throw new Error('AES-GCM encrypt failed')
    return {
        ciphertext: forge.util.encode64(
            cipher.output.getBytes() + cipher.mode.tag.getBytes(),
        ),
        nonce: forge.util.encode64(nonce),
    }
}

function decryptForSubnet(envelope: { ciphertext: string; nonce: string }, keyHex: string): string {
    const keyBytes = forge.util.binary.hex.decode(keyHex)
    const combined = forge.util.decode64(envelope.ciphertext)
    // AES-GCM tag is 16 bytes appended at the end.
    const ct = combined.slice(0, combined.length - 16)
    const tag = combined.slice(combined.length - 16)
    const iv = forge.util.decode64(envelope.nonce)
    const decipher = forge.cipher.createDecipher(
        'AES-GCM',
        forge.util.createBuffer(keyBytes as unknown as forge.util.ByteBuffer),
    )
    decipher.start({
        iv,
        tag: forge.util.createBuffer(tag),
        additionalData: iv,
    })
    decipher.update(forge.util.createBuffer(ct))
    if (!decipher.finish()) throw new Error('AES-GCM decrypt failed (auth mismatch)')
    return forge.util.decodeUtf8(decipher.output.getBytes())
}

function sha256Hex(input: string): string {
    const md = forge.md.sha256.create()
    md.update(input)
    return md.digest().toHex()
}

const MessagingTab: FC<MessagingTabProps> = ({
    publicKeyHex,
    demos,
    showToast,
    addLog,
}) => {
    const [serverUrl, setServerUrl] = useState(DEFAULT_WS)
    const [l2psUid, setL2psUid] = useState(DEFAULT_UID)
    const [state, setState] = useState<ConnectionState>('idle')
    const [error, setError] = useState<string | null>(null)
    const [peers, setPeers] = useState<string[]>([])
    const [recipient, setRecipient] = useState('')
    const [draft, setDraft] = useState('')
    const [conversation, setConversation] = useState<IncomingMessage[]>([])
    const wsRef = useRef<WebSocket | null>(null)

    useEffect(() => {
        return () => {
            wsRef.current?.close()
            wsRef.current = null
        }
    }, [])

    const onWireFrame = (raw: string) => {
        let frame: { type: string; payload: any; timestamp?: number }
        try { frame = JSON.parse(raw) } catch { return }
        switch (frame.type) {
            case 'registered': {
                setState('connected')
                setPeers(frame.payload.onlinePeers ?? [])
                addLog(`[L2PS-IM] registered, ${frame.payload.onlinePeers?.length ?? 0} online peers`)
                showToast('success', 'Connected to messaging server')
                break
            }
            case 'peer_joined':
                setPeers(prev => [...new Set([...prev, frame.payload.publicKey])])
                addLog(`[L2PS-IM] peer joined: ${frame.payload.publicKey.slice(0, 12)}…`)
                break
            case 'peer_left':
                setPeers(prev => prev.filter(p => p !== frame.payload.publicKey))
                addLog(`[L2PS-IM] peer left: ${frame.payload.publicKey.slice(0, 12)}…`)
                break
            case 'message': {
                try {
                    const plaintext = decryptForSubnet(frame.payload.encrypted, AES_KEY)
                    const msg: IncomingMessage = {
                        id: frame.payload.messageHash,
                        from: frame.payload.from,
                        plaintext,
                        timestamp: frame.timestamp ?? Date.now(),
                        offline: frame.payload.offline,
                    }
                    setConversation(prev => [...prev, msg])
                    addLog(`[L2PS-IM] message from ${msg.from.slice(0, 12)}…: ${plaintext.slice(0, 40)}${frame.payload.offline ? ' (offline)' : ''}`)
                } catch (e) {
                    addLog(`[L2PS-IM] decrypt failed: ${(e as Error).message}`)
                }
                break
            }
            case 'message_sent':
                addLog(`[L2PS-IM] message delivered: ${frame.payload.messageHash.slice(0, 12)}…`)
                break
            case 'message_queued':
                addLog(`[L2PS-IM] message queued (recipient offline): ${frame.payload.messageHash.slice(0, 12)}…`)
                break
            case 'error':
                setError(`${frame.payload.code}: ${frame.payload.message}`)
                showToast('error', 'Messaging error', frame.payload.message)
                break
        }
    }

    const connect = async () => {
        if (!demos) {
            showToast('error', 'Wallet not connected', 'Messaging needs the ed25519 signing key — connect your wallet first.')
            return
        }
        if (!AES_KEY) {
            showToast('error', 'AES key missing', 'VITE_L2PS_AES_KEY is not set — messages cannot be encrypted.')
            return
        }
        setState('connecting')
        setError(null)
        try {
            const ws = new WebSocket(serverUrl)
            wsRef.current = ws

            ws.addEventListener('open', async () => {
                setState('registering')
                const ts = Date.now()
                const proofMsg = `register:${publicKeyHex}:${ts}`
                // Use the SDK's own `signMessage` rather than reaching into the
                // private key directly. The wallet hook intentionally doesn't
                // expose the raw key, and signMessage handles the keypair-init
                // step (`getIdentity` → `generateIdentity` if missing) that
                // calling `crypto.sign` directly would skip. The server's
                // hexToUint8Array tolerates the `0x` prefix the SDK adds.
                try {
                    const { data: proof } = await demos.signMessage(proofMsg, { algorithm: 'ed25519' })
                    ws.send(JSON.stringify({
                        type: 'register',
                        payload: {
                            publicKey: publicKeyHex,
                            l2psUid,
                            proof,
                        },
                        timestamp: ts,
                    }))
                } catch (e) {
                    setState('error')
                    setError(`Sign-proof failed: ${(e as Error).message}`)
                }
            })

            ws.addEventListener('message', e => onWireFrame(String(e.data)))
            ws.addEventListener('error', () => {
                setState('error')
                setError(`WebSocket error connecting to ${serverUrl}. Is the messaging server running with L2PS_MESSAGING_ENABLED=true?`)
            })
            ws.addEventListener('close', () => {
                setState('idle')
                setPeers([])
                wsRef.current = null
            })
        } catch (e) {
            setState('error')
            setError((e as Error).message)
        }
    }

    const disconnect = () => {
        wsRef.current?.close()
        wsRef.current = null
        setState('idle')
        setPeers([])
    }

    const send = async () => {
        if (state !== 'connected' || !wsRef.current) return
        if (!recipient || !draft) {
            showToast('error', 'Cannot send', 'Recipient and message both required.')
            return
        }
        const ts = Date.now()
        let encrypted
        try {
            encrypted = encryptForSubnet(draft, AES_KEY)
        } catch (e) {
            showToast('error', 'Encryption failed', (e as Error).message)
            return
        }
        const messageHash = sha256Hex(JSON.stringify({ from: publicKeyHex, to: recipient, content: draft, timestamp: ts }))
        wsRef.current.send(JSON.stringify({
            type: 'send',
            payload: { to: recipient, encrypted, messageHash },
            timestamp: ts,
        }))
        // Echo locally so the sender sees their own message in the conversation pane.
        setConversation(prev => [...prev, {
            id: messageHash,
            from: publicKeyHex,
            plaintext: draft,
            timestamp: ts,
        }])
        setDraft('')
    }

    return (
        <div className="messaging-tab" style={{ padding: '1rem' }}>
            <h2>L2PS Messaging</h2>
            <p style={{ fontSize: '0.9em', opacity: 0.8 }}>
                Real-time encrypted messaging over an L2PS subnet. Requires a node
                with <code>L2PS_MESSAGING_ENABLED=true</code> reachable at the server URL below.
                See <a href="https://github.com/kynesyslabs/node/pull/936" target="_blank" rel="noreferrer">node#936</a>.
            </p>

            <div style={{ display: 'grid', gap: '0.5rem', maxWidth: 500 }}>
                <label>
                    Server URL
                    <input
                        type="text"
                        value={serverUrl}
                        onChange={e => setServerUrl(e.target.value)}
                        disabled={state !== 'idle' && state !== 'error'}
                    />
                </label>
                <label>
                    L2PS UID
                    <input
                        type="text"
                        value={l2psUid}
                        onChange={e => setL2psUid(e.target.value)}
                        disabled={state !== 'idle' && state !== 'error'}
                    />
                </label>
                {state === 'idle' || state === 'error' ? (
                    <button onClick={connect}>Connect</button>
                ) : (
                    <button onClick={disconnect}>Disconnect</button>
                )}
                <div>Status: <strong>{state}</strong></div>
                {error && <div style={{ color: 'crimson' }}>{error}</div>}
            </div>

            {state === 'connected' && (
                <>
                    <h3 style={{ marginTop: '1.5rem' }}>Online peers ({peers.length})</h3>
                    <ul style={{ fontSize: '0.85em', fontFamily: 'monospace', maxHeight: 120, overflowY: 'auto' }}>
                        {peers.map(p => (
                            <li key={p}>
                                <button
                                    style={{ all: 'unset', cursor: 'pointer', textDecoration: 'underline' }}
                                    onClick={() => setRecipient(p)}
                                >
                                    {p.slice(0, 16)}…
                                </button>
                            </li>
                        ))}
                        {peers.length === 0 && <li style={{ opacity: 0.6 }}>None — waiting for another peer to join</li>}
                    </ul>

                    <h3 style={{ marginTop: '1rem' }}>Conversation</h3>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: 4, maxHeight: 240, overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.85em' }}>
                        {conversation.map(m => (
                            <div key={m.id + m.timestamp} style={{ marginBottom: '0.25rem' }}>
                                <span style={{ color: m.from === publicKeyHex ? '#a0e0a0' : '#a0c0e0' }}>
                                    {m.from === publicKeyHex ? 'me' : m.from.slice(0, 12) + '…'}
                                </span>
                                {m.offline && <span style={{ opacity: 0.6 }}> (offline)</span>}: {m.plaintext}
                            </div>
                        ))}
                        {conversation.length === 0 && <div style={{ opacity: 0.6 }}>No messages yet</div>}
                    </div>

                    <div style={{ marginTop: '1rem', display: 'grid', gap: '0.5rem' }}>
                        <input
                            type="text"
                            placeholder="Recipient public key (hex)"
                            value={recipient}
                            onChange={e => setRecipient(e.target.value)}
                            style={{ fontFamily: 'monospace' }}
                        />
                        <textarea
                            placeholder="Message text"
                            value={draft}
                            onChange={e => setDraft(e.target.value)}
                            rows={3}
                        />
                        <button onClick={send}>Send</button>
                    </div>
                </>
            )}
        </div>
    )
}

export default MessagingTab
