import { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useToast } from './hooks/useToast'
import { useWallet } from './hooks/useWallet'
import { useTransactions } from './hooks/useTransactions'
import LoginScreen from './components/LoginScreen'
import BalanceCard from './components/BalanceCard'
import TabBar from './components/TabBar'
import SendTab from './components/SendTab'
import HistoryTab from './components/HistoryTab'
import LearnTab from './components/LearnTab'
import IdentityTab from './components/identity/IdentityTab'
import MessagingTab from './components/MessagingTab'
import './index.css'

type TabId = 'send' | 'history' | 'learn' | 'identity' | 'messaging'

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('send')
  const [logs, setLogs] = useState<string[]>([])

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev])
  }, [])

  const { toasts, showToast, dismissToast } = useToast()
  const wallet = useWallet(showToast, addLog)
  const tx = useTransactions({
    demos: wallet.demos,
    address: wallet.address,
    isConnected: wallet.isConnected,
    nodeUrl: wallet.nodeUrl,
    showToast,
    addLog,
    fetchBalance: wallet.fetchBalance,
  })

  // Connect wallet with post-connect data fetch
  const handleConnect = async () => {
    await wallet.connectWallet(async (demosInstance, addr) => {
      await tx.fetchL1Transactions(demosInstance, addr)
      await tx.fetchL2PSMempoolInfo(demosInstance)
      await tx.fetchL2PSTransactions(demosInstance, addr)
    })
  }

  return (
    <div className="App">
      {/* Toast Notifications */}
      {toasts.length > 0 && createPortal(
        <div className="toast-container">
          {toasts.map(toast => (
            <div key={toast.id} className={`toast toast-${toast.type}`}>
              <div className="toast-icon">
                {toast.type === 'success' ? '✓' : toast.type === 'error' ? '!' : 'i'}
              </div>
              <div className="toast-body">
                <div className="toast-title">{toast.title}</div>
                {toast.message && <div className="toast-message" style={{ whiteSpace: 'pre-line' }}>{toast.message}</div>}
              </div>
              <button className="toast-close" onClick={() => dismissToast(toast.id)}>×</button>
            </div>
          ))}
        </div>,
        document.body
      )}

      <h1 className="main-title">L2PS Wallet</h1>

      {!wallet.isConnected ? (
        <LoginScreen
          mnemonic={wallet.mnemonic}
          setMnemonic={wallet.setMnemonic}
          nodeUrl={wallet.nodeUrl}
          setNodeUrl={wallet.setNodeUrl}
          generateMnemonic={wallet.generateMnemonic}
          connectWallet={handleConnect}
        />
      ) : (
        <div className="dashboard">
          <BalanceCard
            address={wallet.address}
            balance={wallet.balance}
            l2psHistoryCount={tx.l2psHistory.length}
            l1HistoryCount={tx.l1History.length}
            l2psMempoolInfo={tx.l2psMempoolInfo}
            refreshData={tx.refreshData}
            addLog={addLog}
            l2psUid={tx.l2psUid}
          />

          <TabBar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            historyCount={tx.history.length}
          />

          {activeTab === 'send' && (
            <div className="tab-content-narrow">
              <SendTab
                mode={tx.mode}
                setMode={tx.setMode}
                recipient={tx.recipient}
                setRecipient={tx.setRecipient}
                amount={tx.amount}
                setAmount={tx.setAmount}
                txCount={tx.txCount}
                setTxCount={tx.setTxCount}
                txMessage={tx.txMessage}
                setTxMessage={tx.setTxMessage}
                sending={tx.sending}
                sendTransaction={tx.sendTransaction}
                showSettings={tx.showSettings}
                setShowSettings={tx.setShowSettings}
                l2psUid={tx.l2psUid}
                setL2psUid={tx.setL2psUid}
                aesKey={tx.aesKey}
                setAesKey={tx.setAesKey}
                iv={tx.iv}
                setIv={tx.setIv}
                addLog={addLog}
                showToast={showToast}
              />
            </div>
          )}

          {activeTab === 'history' && (
            <div className="tab-content-narrow">
              <HistoryTab
                history={tx.history}
                l2psHistory={tx.l2psHistory}
                l1History={tx.l1History}
                historyFilter={tx.historyFilter}
                setHistoryFilter={tx.setHistoryFilter}
                revealedTxs={tx.revealedTxs}
                setRevealedTxs={tx.setRevealedTxs}
                addLog={addLog}
              />
            </div>
          )}

          {activeTab === 'learn' && (
            <div className="tab-content-narrow">
              <LearnTab
                demos={wallet.demos}
                address={wallet.address}
                l2psUid={tx.l2psUid}
                mode={tx.mode}
                addLog={addLog}
              />
            </div>
          )}

          {activeTab === 'identity' && (
            <div className="tab-content-wide">
              <IdentityTab
                address={wallet.address}
                isConnected={wallet.isConnected}
              />
            </div>
          )}

          {activeTab === 'messaging' && (
            <div className="tab-content-narrow">
              <MessagingTab
                demos={wallet.demos}
                nodeUrl={wallet.nodeUrl}
                l2psUid={tx.l2psUid}
              />
            </div>
          )}

          {/* Status Log */}
          <div className="card" style={{ marginTop: '1rem' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#94a3b8' }}>Activity Log</h3>
            <div className="status-log">
              {logs.length === 0
                ? <p className="placeholder-text">No activity yet</p>
                : logs.map((log, i) => <div key={i} className="log-entry">{log}</div>)
              }
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
