import type { FC } from 'react'

interface SendTabProps {
  mode: 'l1' | 'l2ps'
  setMode: (m: 'l1' | 'l2ps') => void
  recipient: string
  setRecipient: (r: string) => void
  amount: string
  setAmount: (a: string) => void
  txCount: number
  setTxCount: (c: number) => void
  txMessage: string
  setTxMessage: (m: string) => void
  sending: boolean
  showSettings: boolean
  setShowSettings: (s: boolean) => void
  sendTransaction: () => void
  l2psUid: string
  setL2psUid: (u: string) => void
  aesKey: string
  setAesKey: (k: string) => void
  iv: string
  setIv: (v: string) => void
  addLog: (msg: string) => void
  showToast: (type: 'success' | 'error' | 'info', title: string, message?: string) => void
}

const SendTab: FC<SendTabProps> = ({
  mode,
  setMode,
  recipient,
  setRecipient,
  amount,
  setAmount,
  txCount,
  setTxCount,
  txMessage,
  setTxMessage,
  sending,
  showSettings,
  setShowSettings,
  sendTransaction,
  l2psUid,
  setL2psUid,
  aesKey,
  setAesKey,
  iv,
  setIv,
}) => {
  return (
    <div className="card send-card">
      <div className="send-form">

        {/* Mode Selector with descriptions */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="flex-row" style={{ marginBottom: '0.5rem' }}>
            <button
              className={`mode-btn ${mode === 'l2ps' ? 'active' : ''}`}
              onClick={() => setMode('l2ps')}
              style={{
                background: mode === 'l2ps' ? 'linear-gradient(135deg, #a855f7, #8b5cf6)' : '#333',
                fontWeight: mode === 'l2ps' ? 'bold' : 'normal',
                border: mode === 'l2ps' ? '1px solid rgba(255,255,255,0.3)' : '1px solid transparent'
              }}
            >
              🔒 L2PS (Private)
            </button>
            <button
              className={`mode-btn ${mode === 'l1' ? 'active' : ''}`}
              onClick={() => setMode('l1')}
              style={{
                background: mode === 'l1' ? 'linear-gradient(135deg, #646cff, #535bf2)' : '#333',
                fontWeight: mode === 'l1' ? 'bold' : 'normal',
                border: mode === 'l1' ? '1px solid rgba(255,255,255,0.3)' : '1px solid transparent'
              }}
            >
              📤 L1 (Public)
            </button>
          </div>
          {/* Mode description */}
          <div style={{
            padding: '0.5rem 0.75rem',
            borderRadius: '6px',
            fontSize: '0.75rem',
            background: mode === 'l2ps' ? 'rgba(168, 85, 247, 0.1)' : 'rgba(100, 108, 255, 0.1)',
            color: mode === 'l2ps' ? '#c084fc' : '#8b93ff'
          }}>
            {mode === 'l2ps'
              ? '🔐 Encrypted in browser -> Only you and recipient know the details'
              : '📢 Public transaction -> Visible to everyone on the network'
            }
          </div>
        </div>

        <label className="label">Recipient Address</label>
        <input
          value={recipient}
          onChange={e => setRecipient(e.target.value)}
          placeholder="0x..."
        />
        <p style={{ fontSize: '0.7rem', color: '#64748b', margin: '0.25rem 0 0.5rem' }}>
          💡 Paste any valid address or use your own for testing
        </p>

        <label className="label">Amount (DEM)</label>
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="0.0"
        />

        <label className="label">Message</label>
        <input
          value={txMessage}
          onChange={e => setTxMessage(e.target.value)}
          placeholder="Enter message..."
        />

        <label className="label">Count</label>
        <input
          type="number"
          min={1}
          max={100}
          value={txCount}
          onChange={e => setTxCount(parseInt(e.target.value) || 1)}
        />

        {/* Fee Notice for L2PS */}
        {mode === 'l2ps' && (
          <div className="fee-notice" style={{
            background: 'rgba(168, 85, 247, 0.1)',
            border: '1px solid rgba(168, 85, 247, 0.3)',
            borderRadius: '8px',
            padding: '0.75rem',
            marginTop: '0.5rem',
            fontSize: '0.85rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ color: '#94a3b8' }}>Transaction Fee (burned)</span>
            <span style={{ fontWeight: 'bold', color: '#a855f7' }}>1 DEM</span>
          </div>
        )}

        <button
          className="primary-btn send-btn"
          onClick={sendTransaction}
          disabled={sending}
          style={{
            background: mode === 'l2ps' ? '#a855f7' : '#646cff'
          }}
        >
          {sending ? 'Sending...' : `Send ${mode === 'l2ps' ? 'Private' : 'Public'} Transaction`}
        </button>
      </div>

      {mode === 'l2ps' && (
        <div className="settings-section">
          <button
            className="settings-toggle"
            onClick={() => setShowSettings(!showSettings)}
          >
            {showSettings ? 'Hide Advanced Settings' : 'Show Advanced Settings'}
          </button>

          {showSettings && (
            <div className="settings-content">
              <p className="info-text">
                <strong>Why are keys here?</strong><br />
                L2PS uses <em>Client-Side Encryption</em>. Transaction is encrypted
                <strong> in your browser</strong> before it reaches the node.
              </p>
              <label className="label">Network UID</label>
              <input value={l2psUid} onChange={e => setL2psUid(e.target.value)} />

              <label className="label">AES Key (Hex)</label>
              <input value={aesKey} onChange={e => setAesKey(e.target.value)} type="password" />

              <label className="label">IV (Hex)</label>
              <input value={iv} onChange={e => setIv(e.target.value)} type="password" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default SendTab
