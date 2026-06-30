import { useState, type FC } from 'react'
import type { Demos } from '@kynesyslabs/demosdk/websdk'
import { useMessaging } from '../hooks/useMessaging'

interface MessagingTabProps {
  demos: Demos | null
  nodeUrl: string
  l2psUid: string
}

const short = (k: string) => (k && k.length > 16 ? `${k.slice(0, 10)}…${k.slice(-6)}` : k)

const MessagingTab: FC<MessagingTabProps> = ({ demos, nodeUrl, l2psUid }) => {
  const m = useMessaging(demos, nodeUrl, l2psUid)
  const [to, setTo] = useState('')
  const [text, setText] = useState('')

  const statusColor: Record<string, string> = {
    idle: '#888',
    connecting: '#f59e0b',
    registered: '#4ade80',
    error: '#f87171',
    closed: '#888',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h2 style={{ margin: '0 0 4px' }}>💬 L2PS Messaging</h2>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.7 }}>
          Register on the L2PS instant-messaging server with your ed25519 key and
          exchange messages with another peer. Transport test (not e2e encrypted).
        </p>
      </div>

      {/* Connection */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <input
          value={m.wsUrl}
          onChange={(e) => m.setWsUrl(e.target.value)}
          placeholder="ws://localhost:3006"
          disabled={m.status === 'registered' || m.status === 'connecting'}
          style={{ flex: '1 1 240px', padding: '8px 10px', borderRadius: 8 }}
        />
        {m.status === 'registered' ? (
          <button onClick={m.disconnect} style={{ padding: '8px 16px', borderRadius: 8 }}>
            Disconnect
          </button>
        ) : (
          <button
            onClick={m.connect}
            disabled={!demos || m.status === 'connecting'}
            style={{ padding: '8px 16px', borderRadius: 8 }}
          >
            {m.status === 'connecting' ? 'Connecting…' : 'Connect & Register'}
          </button>
        )}
        <span style={{ fontSize: 12, color: statusColor[m.status] ?? '#888' }}>
          ● {m.status}
        </span>
      </div>

      {!demos && (
        <div style={{ fontSize: 13, color: '#f59e0b' }}>
          Connect your wallet first (Login screen) — messaging registers with that key.
        </div>
      )}
      {m.error && (
        <div style={{ fontSize: 13, color: '#f87171' }}>⚠ {m.error}</div>
      )}

      {m.myKey && (
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          You: <code>{short(m.myKey)}</code> · L2PS: <code>{l2psUid}</code> ·{' '}
          peers online: {m.onlinePeers.length}
        </div>
      )}

      {/* Online peers — click to set as recipient */}
      {m.onlinePeers.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {m.onlinePeers
            .filter((k) => k !== m.myKey)
            .map((k) => (
              <button
                key={k}
                onClick={() => setTo(k)}
                title={k}
                style={{ padding: '4px 10px', borderRadius: 999, fontSize: 12 }}
              >
                {short(k)}
              </button>
            ))}
        </div>
      )}

      {/* Conversation */}
      <div
        style={{
          minHeight: 160,
          maxHeight: 320,
          overflowY: 'auto',
          padding: 10,
          borderRadius: 10,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {m.messages.length === 0 ? (
          <div style={{ fontSize: 13, opacity: 0.5, margin: 'auto' }}>
            No messages yet — register, paste a peer's key, and send.
          </div>
        ) : (
          m.messages.map((cm, i) => (
            <div
              key={i}
              style={{
                alignSelf: cm.direction === 'out' ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                padding: '6px 10px',
                borderRadius: 10,
                fontSize: 14,
                background:
                  cm.direction === 'out'
                    ? 'rgba(124,58,237,0.25)'
                    : 'rgba(74,222,128,0.18)',
              }}
            >
              <div style={{ fontSize: 11, opacity: 0.6 }}>
                {cm.direction === 'out' ? `→ ${short(cm.peer)}` : `← ${short(cm.peer)}`}
                {cm.offline ? ' · from queue' : ''}
                {cm.state ? ` · ${cm.state}` : ''}
              </div>
              <div>{cm.text}</div>
            </div>
          ))
        )}
      </div>

      {/* Composer */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="recipient ed25519 public key (hex)"
          style={{ padding: '8px 10px', borderRadius: 8 }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && m.status === 'registered') {
                m.send(to, text)
                setText('')
              }
            }}
            placeholder="message…"
            style={{ flex: 1, padding: '8px 10px', borderRadius: 8 }}
          />
          <button
            onClick={() => {
              m.send(to, text)
              setText('')
            }}
            disabled={m.status !== 'registered' || !to.trim() || !text}
            style={{ padding: '8px 18px', borderRadius: 8 }}
          >
            Send
          </button>
        </div>
      </div>

      <p style={{ fontSize: 11, opacity: 0.5, margin: 0 }}>
        Tip: open this POC in two browsers with two different mnemonics, register
        both, copy one's key into the other's recipient field. Offline peers get the
        message from the queue on next register.
      </p>
    </div>
  )
}

export default MessagingTab
