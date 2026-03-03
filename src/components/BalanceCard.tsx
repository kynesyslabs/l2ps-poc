import type { FC } from 'react'

interface BalanceCardProps {
  address: string
  balance: string
  l2psHistoryCount: number
  l1HistoryCount: number
  l2psMempoolInfo: any
  refreshData: () => void
  addLog: (msg: string) => void
  l2psUid: string
}

const BalanceCard: FC<BalanceCardProps> = ({
  address,
  balance,
  l2psHistoryCount,
  l1HistoryCount,
  l2psMempoolInfo,
  refreshData,
  addLog,
  l2psUid,
}) => {
  return (
    <>
      {/* Network Status Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.5rem 1rem',
        background: 'rgba(74, 222, 128, 0.1)',
        borderRadius: '8px',
        marginBottom: '1rem',
        fontSize: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{
            width: '8px',
            height: '8px',
            background: '#4ade80',
            borderRadius: '50%',
            boxShadow: '0 0 8px #4ade80'
          }}></span>
          <span style={{ color: '#4ade80' }}>Connected</span>
        </div>
        <div style={{ color: '#64748b' }}>
          L2PS: <span style={{ color: '#a855f7' }}>{l2psUid}</span>
        </div>
      </div>

      {/* Balance Card */}
      <div className="card balance-card">
        {/* Address with copy button */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          marginBottom: '0.5rem'
        }}>
          <p className="address-display" title={address} style={{ margin: 0 }}>
            {address.slice(0, 10)}...{address.slice(-8)}
          </p>
          <button
            onClick={() => {
              navigator.clipboard.writeText(address)
              addLog('📋 Address copied!')
            }}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '0.25rem',
              cursor: 'pointer',
              opacity: 0.6
            }}
            title="Copy address"
          >
            📋
          </button>
        </div>

        {/* Balance */}
        <div className="balance-display">
          <span className="balance-value">{balance}</span>
          <span className="balance-unit">DEM</span>
        </div>

        {/* Quick stats */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '1.5rem',
          marginTop: '1rem',
          paddingTop: '1rem',
          borderTop: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#a855f7' }}>
              {l2psHistoryCount}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>L2PS Txs</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#646cff' }}>
              {l1HistoryCount}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>L1 Txs</div>
          </div>
          {l2psMempoolInfo && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fbbf24' }}>
                {l2psMempoolInfo.transactionCount || 0}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Pending</div>
            </div>
          )}
        </div>

        <button
          className="refresh-btn"
          onClick={refreshData}
          style={{
            marginTop: '1rem',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '0.5rem 1rem',
            fontSize: '0.8rem',
            width: '100%'
          }}
        >
          🔄 Refresh Data
        </button>
      </div>
    </>
  )
}

export default BalanceCard
