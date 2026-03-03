import type { FC } from 'react'
import { Database, Shield } from 'lucide-react'
import Hint from '../Hint'
import type { LedgerEntry } from '../../hooks/useZkIdentity'

/* ---------- Sub-components ---------- */

const MerkleTreeVisual: FC<{ leafCount: number }> = ({ leafCount }) => {
  const activeLeaves = Math.min(leafCount, 8)
  const emptyLeaves = Math.max(0, 4 - leafCount)

  return (
    <div className="merkle-visual">
      <div className="merkle-stats" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
        Merkle Tree State
      </div>

      {/* Root */}
      <div style={{
        width: '28px',
        height: '28px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--accent-purple), var(--primary-500))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 0 10px rgba(168, 85, 247, 0.35)',
      }}>
        <Database size={12} color="white" />
      </div>

      <div className="merkle-stem" />
      <div className="merkle-branch" />

      {/* Leaves */}
      <div className="merkle-leaves">
        {Array.from({ length: activeLeaves }).map((_, i) => (
          <div key={i} className="merkle-leaf active" title={`Leaf ${i}`} />
        ))}
        {Array.from({ length: emptyLeaves }).map((_, i) => (
          <div key={`p-${i}`} className="merkle-leaf" />
        ))}
      </div>

      <div className="merkle-stats">
        <strong style={{ color: 'var(--primary-500)' }}>{leafCount}</strong> identities registered
      </div>
    </div>
  )
}

const LedgerEntryRow: FC<{ entry: LedgerEntry }> = ({ entry }) => (
  <div className="ledger-entry">
    <span className={`entry-icon ${entry.type}`}>
      {entry.type === 'commitment'
        ? <Database size={11} style={{ color: 'var(--primary-500)' }} />
        : <Shield size={11} style={{ color: 'var(--accent-purple)' }} />
      }
    </span>
    <span className="entry-hash" title={entry.hash}>{entry.hash}</span>
    <span className="entry-time">{entry.time}</span>
  </div>
)

const PayloadInspector: FC<{ label: string; payload: Record<string, unknown> }> = ({ label, payload }) => (
  <div>
    <div style={{
      fontSize: '0.65rem',
      fontWeight: 600,
      color: '#94a3b8',
      marginBottom: '0.35rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.3rem',
    }}>
      <Database size={10} /> {label}
    </div>
    <div className="payload-inspector">
      {JSON.stringify(payload, null, 2)}
    </div>
  </div>
)

/* ---------- Main Component ---------- */

interface ChainStatePanelProps {
  nodeStatus: 'online' | 'offline'
  leafCount: number
  ledger: LedgerEntry[]
  lastPayload: Record<string, unknown> | null
}

const ChainStatePanel: FC<ChainStatePanelProps> = ({
  nodeStatus,
  leafCount,
  ledger,
  lastPayload,
}) => {
  return (
    <div className="identity-column">
      {/* Section Label */}
      <div className="identity-section-title public">
        <Database size={12} /> PUBLIC NETWORK (NODE)
        <span className={`node-status ${nodeStatus}`} style={{ marginLeft: 'auto' }}>
          <span className="dot" />
          {nodeStatus.toUpperCase()}
        </span>
      </div>

      {/* Blockchain State Card */}
      <div className="vault-card">
        <h4>
          Blockchain State
          <Hint text="The Merkle tree stores identity commitments. Each leaf is one registered identity." />
          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace', fontWeight: 400 }}>
            Height: #{Math.floor(Date.now() / 10000)}
          </span>
        </h4>

        <MerkleTreeVisual leafCount={leafCount} />

        <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.5rem 0 0', lineHeight: 1.5, textAlign: 'center' }}>
          Each leaf is an identity commitment. The tree root changes with every new registration, proving the full set without exposing individual identities.
        </p>

        {/* Ledger List */}
        <div style={{ marginTop: '0.75rem' }}>
          <div style={{
            fontSize: '0.78rem',
            fontWeight: 600,
            color: '#94a3b8',
            marginBottom: '0.35rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
          }}>
            Identities & Action Nullifiers
            <Hint text="Commitments prove someone registered. Nullifiers prevent double-actions without revealing identity." />
          </div>

          {ledger.length === 0 ? (
            <div style={{
              padding: '0.75rem',
              textAlign: 'center',
              fontSize: '0.8rem',
              color: '#64748b',
              background: 'rgba(0,0,0,0.1)',
              borderRadius: '6px',
            }}>
              Waiting for registrations...
            </div>
          ) : (
            <div className="ledger-list">
              {ledger.map((entry, i) => (
                <LedgerEntryRow key={i} entry={entry} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Payload Inspector */}
      {lastPayload && (
        <div className="vault-card">
          <PayloadInspector label="Last RPC Payload" payload={lastPayload} />
        </div>
      )}
    </div>
  )
}

export default ChainStatePanel
