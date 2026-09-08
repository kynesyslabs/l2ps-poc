import type { FC } from 'react'
import { useZkIdentity } from '../../hooks/useZkIdentity'
import IdentityGuide from './IdentityGuide'
import VaultPanel from './VaultPanel'
import ChainStatePanel from './ChainStatePanel'
import SecurityPanel from './SecurityPanel'

interface IdentityTabProps {
  address: string
  isConnected: boolean
  nodeUrl: string
}

const IdentityTab: FC<IdentityTabProps> = ({ address, isConnected, nodeUrl }) => {
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
  } = useZkIdentity(address, isConnected, nodeUrl)

  const hasIdentity = !!commitment
  const isRegistered = ledger.some(e => e.type === 'commitment')
  const hasActed = ledger.some(e => e.type === 'nullifier') || voteStatus === 'success'

  return (
    <>
    <IdentityGuide hasIdentity={hasIdentity} isRegistered={isRegistered} hasActed={hasActed} />
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
    </>
  )
}

export default IdentityTab
