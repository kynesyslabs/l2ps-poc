import type { FC } from 'react'
import { useZkIdentity } from '../../hooks/useZkIdentity'
import IdentityFlow from './IdentityFlow'

interface IdentityTabProps {
  address: string
  isConnected: boolean
  nodeUrl: string
}

const IdentityTab: FC<IdentityTabProps> = ({ address, isConnected, nodeUrl }) => {
  const {
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
  } = useZkIdentity(address, isConnected, nodeUrl)

  return (
    <IdentityFlow
      address={address}
      isConnected={isConnected}
      secret={secret}
      commitment={commitment}
      showSecret={showSecret}
      setShowSecret={setShowSecret}
      voteContext={voteContext}
      setVoteContext={setVoteContext}
      voteStatus={voteStatus}
      nodeStatus={nodeStatus}
      leafCount={leafCount}
      ledger={ledger}
      lastPayload={lastPayload}
      generateIdentity={generateIdentity}
      registerOnChain={registerOnChain}
      castVote={castVote}
      testDoubleSpend={testDoubleSpend}
    />
  )
}

export default IdentityTab
