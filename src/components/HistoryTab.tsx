import { type FC } from 'react'
import TxCard from './TxCard'

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

interface HistoryTabProps {
  history: TxHistoryItem[]
  l2psHistory: TxHistoryItem[]
  l1History: TxHistoryItem[]
  historyFilter: 'all' | 'l2ps' | 'l1'
  setHistoryFilter: (f: 'all' | 'l2ps' | 'l1') => void
  revealedTxs: Set<string>
  setRevealedTxs: (fn: (prev: Set<string>) => Set<string>) => void
  addLog: (msg: string) => void
}

const HistoryTab: FC<HistoryTabProps> = ({
  history,
  l2psHistory,
  l1History,
  historyFilter,
  setHistoryFilter,
  revealedTxs,
  setRevealedTxs,
  addLog,
}) => {
  const filteredHistory = historyFilter === 'all'
    ? history
    : historyFilter === 'l2ps'
      ? [...l2psHistory].sort((a, b) => b.timestamp - a.timestamp)
      : [...l1History].sort((a, b) => b.timestamp - a.timestamp)

  const toggleRevealed = (hash: string) => {
    setRevealedTxs((prev: Set<string>) => {
      const next = new Set(prev)
      if (next.has(hash)) {
        next.delete(hash)
      } else {
        next.add(hash)
      }
      return next
    })
  }

  return (
    <div className="card history-card">
      {/* History Filter Tabs */}
      <div className="history-filter-tabs" style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '1rem',
        padding: '0.5rem',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '8px'
      }}>
        <button
          onClick={() => setHistoryFilter('all')}
          style={{
            flex: 1,
            padding: '0.5rem',
            border: 'none',
            borderRadius: '6px',
            background: historyFilter === 'all' ? 'rgba(168, 85, 247, 0.3)' : 'transparent',
            color: historyFilter === 'all' ? '#c084fc' : '#94a3b8',
            fontWeight: historyFilter === 'all' ? '600' : '400',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          All ({history.length})
        </button>
        <button
          onClick={() => setHistoryFilter('l2ps')}
          style={{
            flex: 1,
            padding: '0.5rem',
            border: 'none',
            borderRadius: '6px',
            background: historyFilter === 'l2ps' ? 'rgba(168, 85, 247, 0.3)' : 'transparent',
            color: historyFilter === 'l2ps' ? '#c084fc' : '#94a3b8',
            fontWeight: historyFilter === 'l2ps' ? '600' : '400',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          🔒 L2PS ({l2psHistory.length})
        </button>
        <button
          onClick={() => setHistoryFilter('l1')}
          style={{
            flex: 1,
            padding: '0.5rem',
            border: 'none',
            borderRadius: '6px',
            background: historyFilter === 'l1' ? 'rgba(100, 108, 255, 0.3)' : 'transparent',
            color: historyFilter === 'l1' ? '#8b93ff' : '#94a3b8',
            fontWeight: historyFilter === 'l1' ? '600' : '400',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          📤 L1 ({l1History.length})
        </button>
      </div>

      {/* Filtered History */}
      {filteredHistory.length === 0 ? (
        <p className="placeholder-text">
          No {historyFilter === 'all' ? '' : historyFilter.toUpperCase() + ' '}transactions found
        </p>
      ) : (
        <div className="history-list">
          {filteredHistory.map((tx, i) => (
            <TxCard
              key={tx.hash || i}
              tx={tx}
              revealed={revealedTxs.has(tx.hash)}
              onToggleReveal={() => toggleRevealed(tx.hash)}
              addLog={addLog}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default HistoryTab
