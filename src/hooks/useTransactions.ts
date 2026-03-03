import { useState, useEffect, useCallback } from 'react'
import { Demos } from '@kynesyslabs/demosdk/websdk'
import {
  buildInnerTransaction,
  buildL2PSTransaction,
  createL2PSInstance,
  normalizeHex,
} from '../utils/l2ps'
import type { TxPayload, L2PSEncryptedPayload } from '../utils/l2ps'
import friendlyError from '../utils/friendlyError'

// Default L2PS configuration constants
export const DEFAULT_L2PS_UID = import.meta.env.VITE_L2PS_UID || 'testnet_l2ps_001'
export const DEFAULT_AES_KEY = import.meta.env.VITE_L2PS_AES_KEY || 'b9346ff30a8202cd46caa7b4b0142bfc727c99cc0f8667580af945b493038055'
export const DEFAULT_IV = import.meta.env.VITE_L2PS_IV || 'f5405674114eb2adea5774d36b701a6d'

// Transaction status type
export interface TxHistoryItem {
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

type ShowToastFn = (type: 'success' | 'error' | 'info', title: string, message?: string) => void
type AddLogFn = (msg: string) => void

interface UseTransactionsParams {
  demos: Demos | null
  address: string
  isConnected: boolean
  nodeUrl: string
  showToast: ShowToastFn
  addLog: AddLogFn
  fetchBalance: (demosInstance: Demos, addr: string) => Promise<void>
}

export function useTransactions({
  demos,
  address,
  isConnected,
  nodeUrl,
  showToast,
  addLog,
  fetchBalance,
}: UseTransactionsParams) {
  // Configuration State
  const [mode, setMode] = useState<'l1' | 'l2ps'>('l2ps')
  const [l2psUid, setL2psUid] = useState<string>(DEFAULT_L2PS_UID)
  const [aesKey, setAesKey] = useState<string>(DEFAULT_AES_KEY)
  const [iv, setIv] = useState<string>(DEFAULT_IV)
  const [showSettings, setShowSettings] = useState<boolean>(false)

  // Transaction State
  const [recipient, setRecipient] = useState<string>('')
  const [amount, setAmount] = useState<string>('0')
  const [txCount, setTxCount] = useState<number>(1)
  const [txMessage, setTxMessage] = useState<string>('Hello L2PS')
  const [sending, setSending] = useState<boolean>(false)

  // History & L2PS Status
  const [l1History, setL1History] = useState<TxHistoryItem[]>([])
  const [l2psHistory, setL2psHistory] = useState<TxHistoryItem[]>([])
  const [history, setHistory] = useState<TxHistoryItem[]>([])
  const [revealedTxs, setRevealedTxs] = useState<Set<string>>(new Set())
  const [l2psMempoolInfo, setL2psMempoolInfo] = useState<Record<string, unknown> | null>(null)
  const [historyFilter, setHistoryFilter] = useState<'all' | 'l2ps' | 'l1'>('all')

  // Set default recipient to own address once connected
  useEffect(() => {
    if (address && !recipient) {
      setRecipient(address)
    }
  }, [address, recipient])

  // Combine history whenever L1 or L2PS history changes, deduplicate by hash
  useEffect(() => {
    // Create a map to deduplicate - L2PS takes priority over L1
    const txMap = new Map<string, TxHistoryItem>()

    // Add L1 first (lower priority)
    for (const tx of l1History) {
      if (tx.hash) txMap.set(tx.hash, tx)
    }

    // Add L2PS (higher priority - will overwrite L1 if same hash)
    for (const tx of l2psHistory) {
      if (tx.hash) txMap.set(tx.hash, tx)
    }

    // Convert back to array and sort by timestamp descending
    const combined = Array.from(txMap.values()).sort((a, b) => b.timestamp - a.timestamp)
    setHistory(combined)

    console.log(`[History] Combined: ${l1History.length} L1 + ${l2psHistory.length} L2PS = ${combined.length} unique`)
  }, [l1History, l2psHistory])

  // Fetch L2PS mempool status
  const fetchL2PSMempoolInfo = useCallback(async (demosInstance: Demos) => {
    try {
      const response = await demosInstance.rpcCall({
        method: 'nodeCall',
        params: [{
          message: 'getL2PSMempoolInfo',
          data: { l2psUid },
          muid: `l2ps_info_${Date.now()}`
        }]
      }, false)

      if (response?.result === 200 && response?.response) {
        setL2psMempoolInfo(response.response as Record<string, unknown>)
      }
    } catch (e) {
      console.error('Failed to fetch L2PS mempool info', e)
    }
  }, [l2psUid])

  // Fetch L2PS transactions for current account (using new endpoint with signature auth)
  const fetchL2PSTransactions = useCallback(async (demosInstance: Demos, addr: string) => {
    try {
      // Create message to sign for authentication
      const timestamp = Date.now().toString()
      const messageToSign = `getL2PSHistory:${addr}:${timestamp}`

      // Sign the message using the SDK's signMessage method
      let signature: string
      try {
        const signResult = await demosInstance.signMessage(messageToSign)
        // signMessage returns { type: SigningAlgorithm, data: string }
        signature = typeof signResult === 'string' ? signResult : signResult.data
      } catch (signErr) {
        console.error('[L2PS History] Failed to sign message:', signErr)
        addLog('Auth error: Could not sign history request')
        return
      }

      const response = await demosInstance.rpcCall({
        method: 'nodeCall',
        params: [{
          message: 'getL2PSAccountTransactions',
          data: {
            l2psUid,
            address: addr,
            timestamp,
            signature,
            limit: 50
          },
          muid: `l2ps_account_txs_${Date.now()}`
        }]
      }, false)

      console.log('[L2PS History] Response:', response)

      if (response?.result === 401) {
        addLog('History auth failed: ' + (response?.response || 'Unknown'))
        return
      }

      if (response?.result === 403) {
        addLog('Access denied: Invalid signature')
        return
      }

      if (response?.result === 200 && response?.response) {
        const txsData = response.response as Record<string, unknown>
        const transactions = txsData.transactions
        if (Array.isArray(transactions)) {
          // Convert server data to our format
          const l2psTxs: TxHistoryItem[] = transactions.map((tx: Record<string, unknown>) => ({
            hash: tx.hash as string,
            outerHash: tx.encrypted_hash as string | undefined,
            l1BatchHash: tx.l1_batch_hash as string | undefined,
            timestamp: parseInt(String(tx.timestamp)) || Date.now(),
            type: 'l2ps' as const,
            amount: parseFloat(String(tx.amount)) || 0,
            status: tx.status === 'confirmed' ? 'confirmed' as const :
              tx.status === 'batched' ? 'in_mempool' as const :
                tx.status === 'failed' ? 'failed' as const : 'pending' as const,
            message: (tx.execution_message as string) || 'L2PS Transaction',
            from: tx.from as string | undefined,
            to: tx.to as string | undefined,
            l1_block_number: tx.l1_block_number as number | undefined
          }))

          setL2psHistory(l2psTxs)
          addLog(`Loaded ${l2psTxs.length} L2PS transactions`)
        }
      }
    } catch (e: unknown) {
      const err = e as Error
      console.error('Failed to fetch L2PS account transactions', e)
      addLog(`L2PS history error: ${err.message || 'Unknown'}`)
    }
  }, [l2psUid, addLog])

  // Fetch L1 Transactions
  const fetchL1Transactions = useCallback(async (demosInstance: Demos, addr: string) => {
    try {
      const cleanAddr = addr.startsWith('0x') ? addr : `0x${addr}`

      const response = await demosInstance.rpcCall({
        method: 'nodeCall',
        params: [{
          message: 'getTransactionHistory',
          data: {
            address: cleanAddr,
            type: 'all',
            limit: 50
          },
          muid: `l1_history_${Date.now()}`
        }]
      }, false)

      if (response?.result === 200 && Array.isArray(response?.response)) {
        const txs: TxHistoryItem[] = response.response.map((tx: Record<string, unknown>) => {
          const content = (tx.content || {}) as Record<string, unknown>
          let txAmount: number | string = (content.amount || 0) as number | string

          // Try to extract amount from native payload if not at top level
          if (content.type === 'native' && Array.isArray(content.data) && (content.data as unknown[])[1]) {
            const payload = (content.data as unknown[])[1] as Record<string, unknown>
            if (payload.nativeOperation === 'send' && Array.isArray(payload.args)) {
              txAmount = (payload.args as unknown[])[1] as number | string
            }
          }

          // Ensure timestamp is a valid number
          let ts = content.timestamp as number | string | undefined
          if (typeof ts === 'string') {
            ts = parseInt(ts, 10)
          }
          if (!ts || isNaN(ts as number)) {
            ts = Date.now()
          }

          return {
            hash: tx.hash as string,
            timestamp: ts as number,
            type: 'l1' as const,
            amount: typeof txAmount === 'string' ? parseFloat(txAmount) : txAmount as number,
            status: 'confirmed' as const,
            from: content.from as string | undefined,
            to: content.to as string | undefined,
            l1_block_number: typeof tx.blockNumber === 'string' ? parseInt(tx.blockNumber) : tx.blockNumber as number | undefined
          }
        })

        setL1History(txs)
        console.log(`[L1 History] Loaded ${txs.length} transactions`)
      }
    } catch (e: unknown) {
      console.error('Failed to fetch L1 transactions', e)
    }
  }, [])

  // Refresh all data
  const refreshData = useCallback(async () => {
    if (!demos || !address) return

    await fetchBalance(demos, address)
    // Always fetch L1 history
    await fetchL1Transactions(demos, address)

    if (mode === 'l2ps') {
      await fetchL2PSMempoolInfo(demos)
      await fetchL2PSTransactions(demos, address)
    }
  }, [demos, address, mode, fetchBalance, fetchL2PSMempoolInfo, fetchL2PSTransactions, fetchL1Transactions])

  // Auto-refresh every 5 seconds when connected
  useEffect(() => {
    if (!isConnected || !demos) return

    const interval = setInterval(() => {
      refreshData()
    }, 5000)

    return () => clearInterval(interval)
  }, [isConnected, demos, refreshData])

  const sendTransaction = async () => {
    if (!demos || !isConnected) return
    if (!recipient) {
      showToast('error', 'Missing Recipient', 'Enter a recipient address')
      return
    }

    // L2PS Specific Checks
    if (mode === 'l2ps') {
      if (!aesKey || !iv) {
        showToast('error', 'Missing L2PS Keys', 'AES Key and IV are required for L2PS encryption')
        setShowSettings(true)
        return
      }
    }

    const typeLabel = mode === 'l1' ? 'L1' : 'L2PS'
    const amountValue = parseFloat(amount) || 0

    setSending(true)
    addLog(`Preparing to send ${txCount} ${typeLabel} transactions...`)

    try {
      // Initialize L2PS if in L2PS mode
      let l2ps = null
      if (mode === 'l2ps') {
        l2ps = await createL2PSInstance(aesKey, iv, l2psUid, nodeUrl)
      }

      const signerAddress = normalizeHex(await demos.getEd25519Address(), 'Ed25519 address')
      const toAddress = normalizeHex(recipient, 'Recipient address')

      let currentNonce = (await demos.getAddressNonce(signerAddress)) + 1
      const sentHashes: string[] = []

      for (let i = 0; i < txCount; i++) {
        const payload: TxPayload = {
          l2ps_uid: mode === 'l2ps' ? l2psUid : undefined,
          message: `${txMessage} [${i + 1}/${txCount}]`
        }

        const tx = await buildInnerTransaction(demos, toAddress, amountValue, payload)
        let finalTx = tx

        if (mode === 'l2ps' && l2ps) {
          const encryptedTx = await l2ps.encryptTx(tx)
          const [, encryptedPayload] = encryptedTx.content.data

          finalTx = await buildL2PSTransaction(
            demos,
            encryptedPayload as L2PSEncryptedPayload,
            toAddress,
            currentNonce
          )
        }

        const validityResponse = await demos.confirm(finalTx)

        const validityData = validityResponse.response as Record<string, unknown>
        const validityDataInner = validityData?.data as Record<string, unknown> | undefined
        if (!validityDataInner?.valid) {
          throw new Error((validityDataInner?.message as string)?.trim() ?? 'Transaction rejected by node')
        }

        const broadcastResponse = await demos.broadcast(validityResponse) as Record<string, unknown>

        if (broadcastResponse?.result !== 200) {
          const responseObj = broadcastResponse?.response as Record<string, unknown> | undefined
          const extra = broadcastResponse?.extra
            || responseObj?.extra
            || broadcastResponse?.response
          const msg = typeof extra === 'string' ? extra : JSON.stringify(extra)
          throw new Error(msg || 'Broadcast failed')
        }

        sentHashes.push(tx.hash)
        addLog(`Sent ${typeLabel} tx ${i + 1}: ${tx.hash.slice(0, 16)}...`)
        currentNonce++

        if (i < txCount - 1) {
          await new Promise(r => setTimeout(r, 500))
        }
      }

      const hashSummary = sentHashes.length === 1
        ? `Hash: ${sentHashes[0].slice(0, 12)}...${sentHashes[0].slice(-6)}`
        : sentHashes.map((h, i) => `#${i + 1}: ${h.slice(0, 10)}...${h.slice(-4)}`).join('\n')

      showToast(
        'success',
        `${txCount} ${typeLabel} tx${txCount > 1 ? 's' : ''} sent -- ${amountValue} DEM`,
        `To: ${toAddress.slice(0, 10)}...${toAddress.slice(-6)}\n${hashSummary}`
      )
      addLog(`All ${txCount} transactions submitted`)

      // Refresh data
      setTimeout(async () => {
        await fetchBalance(demos, address)
        await fetchL1Transactions(demos, address)
        if (mode === 'l2ps') {
          await fetchL2PSMempoolInfo(demos)
          await fetchL2PSTransactions(demos, address)
        }
      }, 1000)

    } catch (e: unknown) {
      const err = e as Error
      const rawMsg = err.message || String(e)
      const { title, detail } = friendlyError(rawMsg)
      showToast('error', title, detail)
      addLog(`Error: ${rawMsg}`)
      console.error(e)
    } finally {
      setSending(false)
    }
  }

  return {
    // Configuration
    mode,
    setMode,
    l2psUid,
    setL2psUid,
    aesKey,
    setAesKey,
    iv,
    setIv,
    showSettings,
    setShowSettings,

    // Transaction form
    recipient,
    setRecipient,
    amount,
    setAmount,
    txCount,
    setTxCount,
    txMessage,
    setTxMessage,
    sending,

    // History
    l1History,
    l2psHistory,
    history,
    revealedTxs,
    setRevealedTxs,
    l2psMempoolInfo,
    historyFilter,
    setHistoryFilter,

    // Actions
    sendTransaction,
    fetchL1Transactions,
    fetchL2PSTransactions,
    fetchL2PSMempoolInfo,
    refreshData,
  }
}
