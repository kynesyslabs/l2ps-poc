import type { FC } from 'react'
import Hint from './Hint'

interface TxHistoryItem {
  hash: string
  outerHash?: string
  l1BatchHash?: string
  timestamp: number
  type: 'l1' | 'l2ps'
  amount?: number
  status: 'pending' | 'in_mempool' | 'confirmed' | 'failed'
  message?: string
  from?: string
  to?: string
  l1_block_number?: number
}

interface TxCardProps {
  tx: TxHistoryItem
  revealed: boolean
  onToggleReveal: () => void
  addLog: (msg: string) => void
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'confirmed': return '#4ade80'
    case 'in_mempool': return '#fbbf24'
    case 'pending': return '#a855f7'
    case 'failed': return '#f87171'
    default: return '#94a3b8'
  }
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'confirmed': return '✓ Confirmed'
    case 'in_mempool': return '📦 Batched'
    case 'pending': return '⚡ Executed'
    case 'failed': return '✗ Failed'
    default: return status
  }
}

const TxCard: FC<TxCardProps> = ({ tx, revealed, onToggleReveal, addLog }) => {
  const isL2PS = tx.type === 'l2ps'

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    addLog(`📋 Copied ${label}`)
  }

  return (
    <div
      className={`tx-card ${isL2PS ? 'tx-l2ps' : 'tx-l1'} ${isL2PS && !revealed ? 'tx-blurred' : ''}`}
    >
      {/* Header Row */}
      <div className="tx-header">
        <div
          className={`tx-type-badge ${isL2PS ? 'clickable' : ''}`}
          title={isL2PS ? (revealed ? 'Click to hide details' : 'Click to reveal details') : 'L1 Public Transaction'}
          onClick={isL2PS ? onToggleReveal : undefined}
          style={isL2PS ? { cursor: 'pointer' } : undefined}
        >
          {isL2PS ? (revealed ? '🔓 L2PS' : '🔒 L2PS') : '📤 L1'}
        </div>
        <div
          className="tx-status"
          style={{ color: getStatusColor(tx.status) }}
          title={`Status: ${tx.status}`}
        >
          {getStatusLabel(tx.status)}
        </div>
      </div>

      {/* Transaction Details */}
      <div className={`tx-body ${isL2PS && !revealed ? 'blurred' : ''}`}>

        {/* Amount */}
        {tx.amount !== undefined && tx.amount > 0 && (
          <div className="tx-row tx-row-amount">
            <span className="tx-amount-big">{tx.amount.toLocaleString()} DEM</span>
            {isL2PS && <span className="tx-fee-hint" title="L2PS privacy fee is automatically deducted">+ 1 DEM fee</span>}
          </div>
        )}

        {/* From */}
        {tx.from && (
          <div className="tx-row">
            <span className="tx-label">Sender <Hint text="Wallet address that initiated this transaction" /></span>
            <div className="tx-value-group">
              <span
                className="tx-address"
                onClick={(e) => { e.stopPropagation(); copyToClipboard(tx.from!, 'sender address') }}
                title={`Full address: ${tx.from}\nClick to copy`}
              >
                {tx.from?.slice(0, 10)}...{tx.from?.slice(-6)}
              </span>
              <button
                className="copy-btn"
                onClick={(e) => { e.stopPropagation(); copyToClipboard(tx.from!, 'sender address') }}
                title="Copy full sender address"
              >
                📋
              </button>
            </div>
          </div>
        )}

        {/* To */}
        {tx.to && (
          <div className="tx-row">
            <span className="tx-label">Recipient <Hint text="Wallet address that received this transaction" /></span>
            <div className="tx-value-group">
              <span
                className="tx-address"
                onClick={(e) => { e.stopPropagation(); copyToClipboard(tx.to!, 'recipient address') }}
                title={`Full address: ${tx.to}\nClick to copy`}
              >
                {tx.to?.slice(0, 10)}...{tx.to?.slice(-6)}
              </span>
              <button
                className="copy-btn"
                onClick={(e) => { e.stopPropagation(); copyToClipboard(tx.to!, 'recipient address') }}
                title="Copy full recipient address"
              >
                📋
              </button>
            </div>
          </div>
        )}

        {/* Status message */}
        {tx.message && (
          <div className="tx-row">
            <span className="tx-label">Status <Hint text="Current state of this transaction on the network" /></span>
            <span className="tx-message">{tx.message}</span>
          </div>
        )}

        {/* Timestamp */}
        <div className="tx-row">
          <span className="tx-label">Time <Hint text="When this transaction was created and signed" /></span>
          <span className="tx-time" title={new Date(tx.timestamp).toISOString()}>
            {new Date(tx.timestamp).toLocaleString()}
          </span>
        </div>

        {/* On-chain details -- collapsible section */}
        <details className="tx-details-section">
          <summary className="tx-details-toggle">On-chain details</summary>
          <div className="tx-details-content">

            {/* Transaction Hash */}
            <div className="tx-row">
              <span className="tx-label">Transaction ID <Hint text="Unique cryptographic hash identifying this transaction" /></span>
              <div className="tx-value-group">
                <span
                  className="tx-hash"
                  title={`Full hash: ${tx.hash}\nClick to copy`}
                  onClick={(e) => { e.stopPropagation(); copyToClipboard(tx.hash, 'transaction ID') }}
                >
                  {tx.hash?.slice(0, 16)}...{tx.hash?.slice(-6)}
                </span>
                <button
                  className="copy-btn"
                  onClick={(e) => { e.stopPropagation(); copyToClipboard(tx.hash, 'transaction ID') }}
                  title="Copy full transaction ID"
                >
                  📋
                </button>
              </div>
            </div>

            {/* Encrypted ID for L2PS */}
            {tx.outerHash && (
              <div className="tx-row">
                <span className="tx-label">Privacy ID <Hint text="Encrypted version visible on the public chain. Only you can see the real content." /></span>
                <div className="tx-value-group">
                  <span
                    className="tx-hash encrypted"
                    title={`Full encrypted hash: ${tx.outerHash}\nThis is what validators and public observers see on-chain`}
                    onClick={(e) => { e.stopPropagation(); copyToClipboard(tx.outerHash!, 'privacy ID') }}
                  >
                    {tx.outerHash?.slice(0, 16)}...
                  </span>
                  <button
                    className="copy-btn"
                    onClick={(e) => { e.stopPropagation(); copyToClipboard(tx.outerHash!, 'privacy ID') }}
                    title="Copy privacy ID"
                  >
                    📋
                  </button>
                </div>
              </div>
            )}

            {/* L1 Block / Batch for confirmed L2PS */}
            {(tx.l1BatchHash || tx.l1_block_number) && (
              <>
                {tx.l1_block_number && (
                  <div className="tx-row">
                    <span className="tx-label">Confirmed in block <Hint text="The L1 block where this transaction's ZK proof was finalized" /></span>
                    <span className="tx-block">#{tx.l1_block_number}</span>
                  </div>
                )}
                {tx.l1BatchHash && (
                  <div className="tx-row">
                    <span className="tx-label">Batch proof <Hint text="ZK proof batch that includes this transaction. Multiple private txs are batched into one proof." /></span>
                    <div className="tx-value-group">
                      <span
                        className="tx-hash mini"
                        title={`Full batch hash: ${tx.l1BatchHash}\nClick to copy`}
                        onClick={(e) => { e.stopPropagation(); copyToClipboard(tx.l1BatchHash!, 'batch proof hash') }}
                      >
                        {tx.l1BatchHash?.slice(0, 12)}...
                      </span>
                      <button
                        className="copy-btn"
                        onClick={(e) => { e.stopPropagation(); copyToClipboard(tx.l1BatchHash!, 'batch proof hash') }}
                        title="Copy batch hash"
                      >
                        📋
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

          </div>
        </details>

      </div>

      {/* Privacy Notice / Toggle Button */}
      {isL2PS && (
        <div
          className="tx-privacy-notice"
          onClick={onToggleReveal}
          style={{ cursor: 'pointer' }}
        >
          {revealed ? '🔒 Click to hide details' : '🔐 Click to reveal private transaction details'}
        </div>
      )}

      {/* Type indicator bar */}
      <div className={`tx-type-bar ${isL2PS ? 'bar-l2ps' : 'bar-l1'}`}></div>
    </div>
  )
}

export default TxCard
