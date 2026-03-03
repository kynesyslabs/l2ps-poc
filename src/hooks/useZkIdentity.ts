import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import {
  hashCommitment,
  hashNullifier,
  simulateProof,
  fetchMerkleRoot,
  submitCommitment,
  submitProof,
} from '../utils/zk'

export interface LedgerEntry {
  hash: string
  type: 'commitment' | 'nullifier'
  time: string
}

export interface LogEntry {
  time: string
  msg: string
  type: 'info' | 'err' | 'success'
}

export type VoteStatus =
  | 'idle'
  | 'generating'
  | 'verifying'
  | 'success'
  | 'failed'
  | 'double_spend'

export function useZkIdentity(address: string, isConnected: boolean) {
  // Identity State
  const [secret, setSecret] = useState('')
  const [commitment, setCommitment] = useState('')
  const [showSecret, setShowSecret] = useState(false)

  // Voting State
  const [voteContext, setVoteContext] = useState('proposal_1')
  const [voteStatus, setVoteStatus] = useState<VoteStatus>('idle')

  // Network State
  const [nodeStatus, setNodeStatus] = useState<'online' | 'offline'>('offline')
  const [leafCount, setLeafCount] = useState(0)
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])

  // Proof inspection
  const [lastPayload, setLastPayload] = useState<Record<string, unknown> | null>(null)

  // Double-spend tracking
  const [usedNullifiers, setUsedNullifiers] = useState<Set<string>>(new Set())

  // --- Helpers ---

  const addLog = useCallback((msg: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev =>
      [{ time: new Date().toLocaleTimeString().split(' ')[0], msg, type }, ...prev].slice(0, 50)
    )
  }, [])

  const addToLedger = useCallback((hash: string, type: LedgerEntry['type']) => {
    setLedger(prev => [{ hash, type, time: new Date().toLocaleTimeString() }, ...prev])
  }, [])

  // --- Network Polling ---

  const syncNetwork = useCallback(async () => {
    const result = await fetchMerkleRoot('/zk')
    if (result) {
      setNodeStatus('online')
      setLeafCount(result.leafCount)
    } else {
      setNodeStatus('offline')
    }
  }, [])

  useEffect(() => {
    const interval = setInterval(syncNetwork, 5000)
    syncNetwork()
    return () => clearInterval(interval)
  }, [syncNetwork])

  // --- Actions ---

  const generateIdentity = useCallback(async () => {
    if (!address || !isConnected) {
      addLog('Wallet must be connected first.', 'err')
      return
    }

    const newSecret = ethers.hexlify(ethers.randomBytes(32))
    setSecret(newSecret)

    // Calculate Commitment: H("wallet:" + address + ":" + secret)
    const comm = hashCommitment(address, newSecret)
    setCommitment(comm)

    addLog('Identity generated locally. Secret stored in Vault.', 'info')
  }, [address, isConnected, addLog])

  const registerOnChain = useCallback(async () => {
    if (!commitment || !address) {
      addLog('Generate an identity first.', 'err')
      return
    }

    const payload = {
      method: 'identity_commitment',
      params: [
        {
          commitment_hash: commitment,
          provider: 'wallet',
          timestamp: Date.now(),
        },
      ],
    }
    setLastPayload(payload)
    addLog('Broadcasting Commitment to Node...', 'info')

    if (nodeStatus === 'online') {
      const result = await submitCommitment(commitment, '/rpc')
      if (result.success) {
        addLog('Commitment accepted by Node.', 'success')
        addToLedger(commitment, 'commitment')
        setLeafCount(prev => prev + 1)
      } else {
        addLog(`Failed to register: ${result.message}`, 'err')
      }
    } else {
      // Offline fallback (simulated)
      await new Promise(r => setTimeout(r, 1000))
      addToLedger(commitment, 'commitment')
      setLeafCount(prev => prev + 1)
      addLog('Commitment mined (Simulated)! Added to Merkle Tree.', 'success')
    }
  }, [commitment, address, nodeStatus, addLog, addToLedger])

  const castVote = useCallback(
    async (isDoubleSpendAttempt = false) => {
      if (!commitment || !secret || !address) {
        addLog('Incomplete setup! Need Wallet + Identity.', 'err')
        return
      }

      setVoteStatus('generating')
      addLog(`Generating ZK Proof for "${voteContext}"...`, 'info')

      try {
        await new Promise(r => setTimeout(r, 1500))

        // Nullifier = H("wallet:" + address + ":" + context + ":" + (secret if not double spend))
        const computedNullifier = hashNullifier(
          address,
          voteContext,
          isDoubleSpendAttempt ? '' : secret
        )

        setVoteStatus('verifying')

        // Simulate a proof
        const merkleRootHex = ethers.keccak256(ethers.toUtf8Bytes(`merkle_root_${leafCount}`))
        const { proof, publicSignals } = simulateProof(computedNullifier, merkleRootHex, voteContext)

        const payload = {
          method: 'verifyProof',
          params: [
            {
              proof,
              publicSignals,
              provider: 'wallet',
            },
          ],
        }
        setLastPayload(payload)
        addLog('Proof generated. Sending to Node Relayer...', 'info')

        await new Promise(r => setTimeout(r, 1000))

        // Check for double spend locally
        const isAlreadySpent =
          usedNullifiers.has(computedNullifier) ||
          ledger.some(e => e.type === 'nullifier' && e.hash === computedNullifier)

        if (isAlreadySpent) {
          setVoteStatus('double_spend')
          addLog('REJECTED: Double Spend Detected! Nullifier already exists on-chain.', 'err')
          return
        }

        // Try submitting to node if online
        if (nodeStatus === 'online') {
          const result = await submitProof(proof, publicSignals, '/rpc')
          if (!result.success) {
            addLog(`Node rejected proof: ${result.message}`, 'err')
            // Still record locally for the demo
          }
        }

        addToLedger(computedNullifier, 'nullifier')
        setUsedNullifiers(prev => new Set(prev).add(computedNullifier))
        setVoteStatus('success')
        addLog('Vote Verified! Identity hidden, action persistent.', 'success')
      } catch (e: unknown) {
        setVoteStatus('failed')
        const err = e as Error
        addLog(`Proof generation failed: ${err.message || 'Unknown'}`, 'err')
      }
    },
    [commitment, secret, address, voteContext, leafCount, nodeStatus, usedNullifiers, ledger, addLog, addToLedger]
  )

  const testDoubleSpend = useCallback(() => {
    return castVote(true)
  }, [castVote])

  return {
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
    usedNullifiers,

    // Actions
    generateIdentity,
    registerOnChain,
    castVote,
    testDoubleSpend,
    syncNetwork,
    addLog,
  }
}
