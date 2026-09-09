import { useState, type FC } from 'react'
import type { LedgerEntry, VoteStatus } from '../../hooks/useZkIdentity'
import ChainStatePanel from './ChainStatePanel'

interface IdentityFlowProps {
  address: string
  isConnected: boolean
  secret: string
  commitment: string
  showSecret: boolean
  setShowSecret: (v: boolean) => void
  voteContext: string
  setVoteContext: (v: string) => void
  voteStatus: VoteStatus
  nodeStatus: 'online' | 'offline'
  leafCount: number
  ledger: LedgerEntry[]
  lastPayload: Record<string, unknown> | null
  generateIdentity: () => void
  registerOnChain: () => void
  castVote: () => void
  testDoubleSpend: () => void
}

function short(h: string): string {
  if (!h) return '—'
  return h.length > 18 ? `${h.slice(0, 10)}…${h.slice(-6)}` : h
}

const IdentityFlow: FC<IdentityFlowProps> = ({
  address,
  isConnected,
  secret,
  commitment,
  showSecret,
  setShowSecret,
  voteContext,
  setVoteContext,
  voteStatus,
  nodeStatus,
  leafCount,
  ledger,
  lastPayload,
  generateIdentity,
  registerOnChain,
  castVote,
  testDoubleSpend,
}) => {
  const [showTech, setShowTech] = useState(false)

  const hasIdentity = !!commitment
  const registeredCount = ledger.filter(e => e.type === 'commitment').length
  const isRegistered = registeredCount > 0
  const hasVoted = ledger.some(e => e.type === 'nullifier') || voteStatus === 'success'
  // The node's merkle count can lag; never show "0 members" once you've joined.
  const memberCount = Math.max(leafCount, registeredCount, 1)

  const voting = voteStatus === 'generating' || voteStatus === 'verifying'

  // Which step is the current one to act on.
  const current = !hasIdentity ? 1 : !isRegistered ? 2 : 3

  const stepState = (n: number, done: boolean) =>
    done ? 'done' : n === current ? 'active' : 'todo'

  return (
    <div className="idflow">
      <header className="idflow-head">
        <h3>Anonymous Identity</h3>
        <p>
          Prove you belong to a group and act once — without revealing which member you are.
          Follow the three steps; the chain only ever sees a valid proof, never your wallet.
        </p>
      </header>

      <ol className="idflow-steps">
        {/* Step 1 — create */}
        <li className={`idflow-step ${stepState(1, hasIdentity)}`}>
          <span className="idflow-num">{hasIdentity ? '✓' : 1}</span>
          <div className="idflow-body">
            <strong>Create your anonymous identity</strong>
            <p>A secret is generated and kept on your device. Only a one-way commitment is published — it can't be traced back to you.</p>

            {!hasIdentity ? (
              <button
                className="idflow-btn primary"
                onClick={generateIdentity}
                disabled={!isConnected}
              >
                Generate identity
              </button>
            ) : (
              <div className="idflow-result">
                <div className="idflow-kv">
                  <span>Secret (stays on device)</span>
                  <code>
                    {showSecret ? short(secret) : '•••••••••••'}
                    <button className="idflow-eye" onClick={() => setShowSecret(!showSecret)}>
                      {showSecret ? '🙈' : '👁'}
                    </button>
                  </code>
                </div>
                <div className="idflow-kv">
                  <span>Commitment (public)</span>
                  <code>{short(commitment)}</code>
                </div>
              </div>
            )}
          </div>
        </li>

        {/* Step 2 — join */}
        <li className={`idflow-step ${stepState(2, isRegistered)}`}>
          <span className="idflow-num">{isRegistered ? '✓' : 2}</span>
          <div className="idflow-body">
            <strong>Join the anonymity set</strong>
            <p>Publish your commitment into the on-chain group. The bigger the group, the more you blend in.</p>

            {current === 2 && !isRegistered && (
              <button className="idflow-btn primary" onClick={registerOnChain}>
                Join the set
              </button>
            )}
            {isRegistered && (
              <div className="idflow-result">
                <div className="idflow-note ok">
                  You're a member — <strong>{memberCount}</strong> identit{memberCount === 1 ? 'y' : 'ies'} in the set.
                </div>
              </div>
            )}
          </div>
        </li>

        {/* Step 3 — act */}
        <li className={`idflow-step ${stepState(3, hasVoted)}`}>
          <span className="idflow-num">{hasVoted ? '✓' : 3}</span>
          <div className="idflow-body">
            <strong>Act without revealing who</strong>
            <p>Vote on a proposal. The chain verifies you're in the set and haven't acted before — using a nullifier that hides which member you are.</p>

            {current === 3 && (
              <>
                <div className="idflow-voterow">
                  <input
                    className="idflow-input"
                    value={voteContext}
                    onChange={e => setVoteContext(e.target.value)}
                    placeholder="proposal_1"
                    disabled={voting}
                  />
                  <button
                    className="idflow-btn primary"
                    onClick={castVote}
                    disabled={voting}
                  >
                    {voting ? 'Proving…' : 'Vote anonymously'}
                  </button>
                </div>

                {voteStatus === 'success' && (
                  <div className="idflow-note ok">
                    ✓ Vote counted. Your wallet was never revealed — only a proof of membership.
                  </div>
                )}
                {voteStatus === 'double_spend' && (
                  <div className="idflow-note blocked">
                    ⛔ Blocked — you already acted on this proposal. The reused nullifier is rejected (no double-voting), still without exposing who you are.
                  </div>
                )}
                {voteStatus === 'failed' && (
                  <div className="idflow-note blocked">Proof failed — try again.</div>
                )}

                {hasVoted && (
                  <button className="idflow-btn ghost" onClick={testDoubleSpend}>
                    Try to vote again (see it blocked) →
                  </button>
                )}
              </>
            )}
          </div>
        </li>
      </ol>

      {/* Technical detail, collapsed by default */}
      <div className="idflow-tech">
        <button
          className="idflow-tech-toggle"
          onClick={() => setShowTech(v => !v)}
          aria-expanded={showTech}
        >
          <span>⚙ Under the hood — Merkle tree, ledger &amp; node state</span>
          <span className="idflow-node">
            <span className={`idflow-dot ${nodeStatus}`} />
            {nodeStatus}
          </span>
          <span className="idflow-caret">{showTech ? '▲' : '▼'}</span>
        </button>
        {showTech && (
          <div className="idflow-tech-body">
            <ChainStatePanel
              nodeStatus={nodeStatus}
              leafCount={leafCount}
              ledger={ledger}
              lastPayload={lastPayload}
            />
          </div>
        )}
      </div>

      {!isConnected && (
        <p className="idflow-warn">Connect your wallet to begin.</p>
      )}
      <span hidden>{address}</span>
    </div>
  )
}

export default IdentityFlow
