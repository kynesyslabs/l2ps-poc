import type { FC } from 'react'
import { Shield, Key, Eye, EyeOff, Database } from 'lucide-react'
import Hint from '../Hint'
import type { LedgerEntry, VoteStatus } from '../../hooks/useZkIdentity'

interface VaultPanelProps {
  address: string
  isConnected: boolean
  secret: string
  commitment: string
  showSecret: boolean
  setShowSecret: (s: boolean) => void
  voteContext: string
  setVoteContext: (c: string) => void
  voteStatus: VoteStatus
  generateIdentity: () => Promise<void>
  registerOnChain: () => Promise<void>
  castVote: (isDoubleSpend?: boolean) => Promise<void>
  ledger: LedgerEntry[]
}

const VaultPanel: FC<VaultPanelProps> = ({
  address,
  isConnected,
  secret,
  commitment,
  showSecret,
  setShowSecret,
  voteContext,
  setVoteContext,
  voteStatus,
  generateIdentity,
  registerOnChain,
  castVote,
  ledger,
}) => {
  const isRegistered = ledger.some(e => e.hash === commitment && e.type === 'commitment')
  const isProofBusy = voteStatus === 'generating' || voteStatus === 'verifying'

  return (
    <div className="identity-column">
      {/* Section Label */}
      <div className="identity-section-title private">
        <Key size={12} /> CLIENT SIDE (PRIVATE)
      </div>

      {/* Wallet Identity Card */}
      <div className="wallet-identity-card">
        <div className="avatar">
          <Shield size={16} color="white" />
        </div>
        <div className="info">
          <div className="name">{address.slice(0, 10)}...{address.slice(-6)}</div>
          <div className="addr">Ed25519 Address</div>
        </div>
        {isConnected && (
          <div className="badge">VERIFIED</div>
        )}
      </div>

      {/* Identity Vault Card */}
      <div className="vault-card">
        <h4>
          Identity Vault
          <span className="vault-badge">Local Storage</span>
          <Hint text="Your secret and commitment are generated client-side and never leave your browser." />
        </h4>

        {!secret ? (
          <div style={{ textAlign: 'center', padding: '0.75rem 0' }}>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
              Generate a zero-knowledge identity from your wallet.
            </p>
            <p style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.75rem', lineHeight: 1.5 }}>
              This creates a <strong style={{ color: '#f87171' }}>private secret</strong> and a <strong style={{ color: '#22d3ee' }}>public commitment</strong> — proving you exist without revealing who you are.
            </p>
            <button
              onClick={generateIdentity}
              disabled={!isConnected}
              className="identity-btn generate"
            >
              <Key size={13} /> Generate ZK-ID
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {/* Private Secret */}
            <div>
              <div className="data-row" style={{ paddingBottom: '0.25rem' }}>
                <span className="data-label">
                  <span style={{ color: '#f87171' }}>Private Secret</span>
                  <Hint text="This random secret is mixed with your wallet address to create the commitment. It never leaves your browser. NEVER share it." />
                </span>
                <button className="eye-toggle" onClick={() => setShowSecret(!showSecret)} style={{ background: 'none', border: 'none', padding: '0.15rem', flex: 'none' }}>
                  {showSecret ? <EyeOff size={11} /> : <Eye size={11} />}
                </button>
              </div>
              <div className="secret-box">
                {showSecret ? secret : '\u2022'.repeat(32)}
              </div>
            </div>

            {/* Public Commitment */}
            <div>
              <div className="data-row" style={{ paddingBottom: '0.25rem' }}>
                <span className="data-label">
                  <span style={{ color: '#22d3ee' }}>Public Commitment</span>
                  <Hint text="Hash of (wallet_address + secret). This is the only value submitted on-chain. It proves you exist without revealing who you are." />
                </span>
                <Database size={10} style={{ color: 'var(--accent-purple)', flexShrink: 0 }} />
              </div>
              <div className="commitment-box">
                {commitment}
              </div>
            </div>

            {/* Step indicator */}
            <div style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'center', lineHeight: 1.5 }}>
              {!isRegistered
                ? 'Next step: Register your commitment on the ledger to join the anonymity set.'
                : 'Your identity is on-chain. You can now perform anonymous actions.'
              }
            </div>

            {/* Register / Status */}
            {isRegistered ? (
              <div className="identity-status-badge active" style={{ alignSelf: 'center' }}>
                <Shield size={12} /> Identity Active On-Chain
              </div>
            ) : (
              <button onClick={registerOnChain} className="identity-btn register">
                <Database size={13} /> Register on Ledger
              </button>
            )}
          </div>
        )}
      </div>

      {/* Vote Action Card */}
      {secret && (
        <div className="vault-card">
          <h4>
            Test Action
            <Hint text="Cast an anonymous vote using your ZK identity. The node verifies you are registered without knowing WHO you are." />
          </h4>

          <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0 0 0.5rem', lineHeight: 1.5 }}>
            Submit an anonymous vote. The node verifies you are registered without knowing <em>who</em> you are. Each identity can only vote once per proposal.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Proposal Name</label>
            <input
              type="text"
              value={voteContext}
              onChange={e => setVoteContext(e.target.value)}
              style={{
                padding: '0.4rem 0.5rem',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                color: '#e2e8f0',
                fontSize: '0.8rem',
                marginBottom: '0',
              }}
            />

            <button
              onClick={() => castVote(false)}
              disabled={isProofBusy}
              className={`identity-btn ${voteStatus === 'success' ? 'vote' : voteStatus === 'double_spend' ? 'register' : 'generate'}`}
            >
              {isProofBusy ? 'Generating Proof...' : <><Shield size={13} /> Vote Anonymously</>}
            </button>

            {voteStatus === 'success' && (
              <div className="vote-result success">Proof Verified! Ledger Updated.</div>
            )}
            {voteStatus === 'double_spend' && (
              <div className="vote-result double_spend">Blocked: Already voted here.</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default VaultPanel
