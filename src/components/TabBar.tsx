import type { FC } from 'react'

type TabType = 'send' | 'history' | 'learn' | 'identity' | 'messaging'

interface TabBarProps {
  activeTab: TabType
  setActiveTab: (tab: TabType) => void
  historyCount?: number
}

const TabBar: FC<TabBarProps> = ({ activeTab, setActiveTab, historyCount = 0 }) => {
  return (
    <div className="tabs">
      <button
        className={`tab ${activeTab === 'send' ? 'active' : ''}`}
        onClick={() => setActiveTab('send')}
      >
        Send
      </button>
      <button
        className={`tab ${activeTab === 'history' ? 'active' : ''}`}
        onClick={() => setActiveTab('history')}
      >
        History ({historyCount})
      </button>
      <button
        className={`tab ${activeTab === 'learn' ? 'active' : ''}`}
        onClick={() => setActiveTab('learn')}
      >
        📚 Learn
      </button>
      <button
        className={`tab ${activeTab === 'identity' ? 'active' : ''}`}
        onClick={() => setActiveTab('identity')}
      >
        🛡️ Identity
      </button>
      <button
        className={`tab ${activeTab === 'messaging' ? 'active' : ''}`}
        onClick={() => setActiveTab('messaging')}
      >
        💬 Messaging
      </button>
    </div>
  )
}

export default TabBar
