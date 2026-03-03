import type { FC } from 'react'
import { useZkIdentity } from '../../hooks/useZkIdentity'
import VaultPanel from './VaultPanel'
import ChainStatePanel from './ChainStatePanel'
import SecurityPanel from './SecurityPanel'

interface IdentityTabProps {
  address: string
  isConnected: boolean
}

const IdentityTab: FC<IdentityTabProps> = ({ address, isConnected }) => {
  const {
    // Identity
    secret,
    commitment,
    showSecret,
    setShowSecret,

    // Voting
    voteContext,
    setVoteContext,
    voteStatus,

    // Network
    nodeStatus,
    leafCount,
    ledger,
    logs,
    lastPayload,

    // Actions
    generateIdentity,
    registerOnChain,
    castVote,
    testDoubleSpend,
    addLog,
  } = useZkIdentity(address, isConnected)

  return (
    <div className="identity-grid">
      {/* Left Column: Vault */}
      <VaultPanel
        address={address}
        isConnected={isConnected}
        secret={secret}
        commitment={commitment}
        showSecret={showSecret}
        setShowSecret={setShowSecret}
        voteContext={voteContext}
        setVoteContext={setVoteContext}
        voteStatus={voteStatus}
        generateIdentity={generateIdentity}
        registerOnChain={registerOnChain}
        castVote={castVote}
        ledger={ledger}
      />

      {/* Center Column: Chain State */}
      <ChainStatePanel
        nodeStatus={nodeStatus}
        leafCount={leafCount}
        ledger={ledger}
        lastPayload={lastPayload}
      />

      {/* Right Column: Security Analyzer */}
      <SecurityPanel
        leafCount={leafCount}
        logs={logs}
        testDoubleSpend={testDoubleSpend}
        addLog={addLog}
      />
    </div>
  )
}

export default IdentityTab
