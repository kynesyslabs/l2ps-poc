import type { FC } from 'react'

interface LoginScreenProps {
  mnemonic: string
  setMnemonic: (m: string) => void
  nodeUrl: string
  setNodeUrl: (u: string) => void
  generateMnemonic: () => void
  connectWallet: () => void
}

const LoginScreen: FC<LoginScreenProps> = ({
  mnemonic,
  setMnemonic,
  nodeUrl,
  setNodeUrl,
  generateMnemonic,
  connectWallet,
}) => {
  return (
    <div className="login-container">
      {/* Hero Banner */}
      <div className="hero-banner" style={{
        background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(100, 108, 255, 0.2) 100%)',
        borderRadius: '16px',
        padding: '2rem',
        marginBottom: '1.5rem',
        border: '1px solid rgba(168, 85, 247, 0.3)',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🔐</div>
        <h2 style={{ margin: '0 0 0.5rem 0', color: '#c084fc' }}>Private Transactions Demo</h2>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>
          Experience Layer 2 Privacy Subnets with encrypted transactions
        </p>
      </div>

      {/* Feature pills */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.5rem',
        justifyContent: 'center',
        marginBottom: '1.5rem'
      }}>
        <span style={{ padding: '0.4rem 0.8rem', background: 'rgba(168, 85, 247, 0.2)', borderRadius: '20px', fontSize: '0.75rem', color: '#c084fc' }}>
          🔒 Client-side Encryption
        </span>
        <span style={{ padding: '0.4rem 0.8rem', background: 'rgba(74, 222, 128, 0.2)', borderRadius: '20px', fontSize: '0.75rem', color: '#4ade80' }}>
          ⚡ Batch Rollups
        </span>
        <span style={{ padding: '0.4rem 0.8rem', background: 'rgba(100, 108, 255, 0.2)', borderRadius: '20px', fontSize: '0.75rem', color: '#8b93ff' }}>
          🛡️ ZK Proofs
        </span>
      </div>

      {/* Connection Card */}
      <div className="card login-card">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>🔌</span> Connect Wallet
        </h2>
        <div style={{ textAlign: 'left' }}>
          {/* Node URL with status indicator */}
          <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Node URL
            <span style={{
              fontSize: '0.7rem',
              padding: '0.15rem 0.4rem',
              background: 'rgba(74, 222, 128, 0.2)',
              borderRadius: '4px',
              color: '#4ade80'
            }}>
              Local
            </span>
          </label>
          <input
            value={nodeUrl}
            onChange={e => setNodeUrl(e.target.value)}
            placeholder="http://127.0.0.1:53550"
          />

          <label className="label">Mnemonic Phrase</label>
          <textarea
            rows={3}
            value={mnemonic}
            onChange={e => setMnemonic(e.target.value)}
            placeholder="Enter your 24-word recovery phrase..."
            style={{ resize: 'none' }}
          />
          <p style={{
            fontSize: '0.75rem',
            color: '#64748b',
            margin: '0.25rem 0 1rem',
            fontStyle: 'italic'
          }}>
            💡 Click "Generate New" for a fresh test wallet
          </p>

          <div className="flex-row">
            <button className="secondary-btn" onClick={generateMnemonic}>
              🎲 Generate New
            </button>
            <button className="primary-btn" onClick={connectWallet} disabled={!mnemonic}>
              🔗 Connect Wallet
            </button>
          </div>
        </div>
      </div>

      {/* Quick Info */}
      <div style={{
        marginTop: '1.5rem',
        padding: '1rem',
        background: 'rgba(0, 0, 0, 0.2)',
        borderRadius: '12px',
        fontSize: '0.8rem',
        color: '#64748b'
      }}>
        <strong style={{ color: '#94a3b8' }}>ℹ️ About this Demo:</strong>
        <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
          <li>Send private (L2PS) or public (L1) transactions</li>
          <li>L2PS transactions are encrypted in your browser</li>
          <li>Each L2PS transaction costs 1 DEM (burned)</li>
          <li>View the "Learn" tab for interactive explanations</li>
        </ul>
      </div>
    </div>
  )
}

export default LoginScreen
