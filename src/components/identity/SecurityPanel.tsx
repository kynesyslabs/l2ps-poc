import type { FC } from 'react'
import { AlertTriangle, Activity, Shield } from 'lucide-react'
import Hint from '../Hint'
import type { LogEntry } from '../../hooks/useZkIdentity'

interface SecurityPanelProps {
  leafCount: number
  logs: LogEntry[]
  testDoubleSpend: () => Promise<void>
  addLog: (msg: string, type?: 'info' | 'err' | 'success') => void
}

const SecurityPanel: FC<SecurityPanelProps> = ({
  leafCount,
  logs,
  testDoubleSpend,
  addLog,
}) => {
  return (
    <div className="identity-column">
      {/* Section Label */}
      <div className="identity-section-title security">
        <AlertTriangle size={12} /> SECURITY ANALYZER
      </div>

      {/* Anonymity Analytics Card */}
      <div className="analytics-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.88rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '0.5rem' }}>
          <Activity size={13} style={{ color: 'var(--primary-500)' }} />
          Anonymity Set
          <Hint text="The more commitments in the Merkle tree, the harder it is to de-anonymize any single user." />
        </div>

        <div className="analytics-value" style={{ fontSize: '1.6rem' }}>{leafCount}</div>
        <div className="analytics-label">Commitments in tree</div>

        <div className="analytics-bar">
          <div
            className="analytics-bar-fill"
            style={{
              width: `${Math.min(100, leafCount * 10)}%`,
              background: leafCount >= 5
                ? 'linear-gradient(90deg, var(--primary-500), var(--accent-green))'
                : leafCount >= 2
                  ? 'linear-gradient(90deg, #fbbf24, var(--primary-500))'
                  : 'var(--accent-red)',
            }}
          />
        </div>

        <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.4rem', lineHeight: 1.5 }}>
          Mixed with <strong style={{ color: '#e2e8f0' }}>{leafCount}</strong> commitments.
          {leafCount >= 5
            ? <span style={{ color: '#4ade80' }}> Strong privacy.</span>
            : leafCount >= 2
              ? <span style={{ color: '#fbbf24' }}> Moderate — more users help.</span>
              : <span style={{ color: '#f87171' }}> Low — more users needed.</span>
          }
        </div>
      </div>

      {/* Interactive Tests Card */}
      <div className="vault-card">
        <h4>
          Interactive Tests
          <Hint text="Attempt attacks against the protocol to see how it defends against abuse." />
        </h4>

        <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0 0 0.5rem', lineHeight: 1.5 }}>
          Simulate attacks to see how the protocol defends against exploits.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <button onClick={testDoubleSpend} className="hack-btn danger">
            <AlertTriangle size={11} /> Test Double Spend
            <div style={{ fontSize: '0.72rem', fontWeight: 400, color: '#94a3b8', marginTop: '0.15rem' }}>
              Reuse your identity — the node detects the duplicate Nullifier and rejects it.
            </div>
          </button>

          <button
            onClick={() => addLog('Data Leak Test: All proofs are zero-knowledge. No identity data leaked to the verifier.', 'success')}
            className="hack-btn danger"
            style={{ background: 'rgba(168, 85, 247, 0.1)', borderColor: 'rgba(168, 85, 247, 0.2)' }}
          >
            <Shield size={11} style={{ color: '#c084fc' }} /> Data Leak Test
            <div style={{ fontSize: '0.72rem', fontWeight: 400, color: '#94a3b8', marginTop: '0.15rem' }}>
              Trace a proof back to a wallet — ZK proofs reveal nothing.
            </div>
          </button>
        </div>
      </div>

      {/* Activity Log */}
      <div className="vault-card" style={{ flex: 1 }}>
        <h4>
          <Activity size={13} /> Node Activity
        </h4>

        <div className="identity-log">
          {logs.length === 0 ? (
            <div style={{ color: '#64748b', textAlign: 'center', padding: '0.75rem 0', fontSize: '0.78rem' }}>
              No activity yet...
            </div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className={`identity-log-entry ${log.type}`}>
                <span style={{ color: '#64748b' }}>[{log.time}]</span> {log.msg}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default SecurityPanel
