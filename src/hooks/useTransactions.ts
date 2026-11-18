import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Demos } from '@kynesyslabs/demosdk/websdk'
import {
  buildPrivateTransfer,
  createL2PSInstance,
  normalizeHex,
  submitTransaction,
} from '../utils/l2ps'
import { demToOs, osToDem } from '../utils/amount'
import friendlyError from '../utils/friendlyError'

// The subnet key and IV are handed to testers out of band and typed in at
// runtime; the bundle is public, so no build variable may carry them.
export const DEFAULT_L2PS_UID = import.meta.env.VITE_L2PS_UID || 'l2ps_web_demo'
export const DEFAULT_AES_KEY = ''
export const DEFAULT_IV = ''

// Members refuse a transfer whose nonce runs more than ~18 ahead of the
// sender's L1 nonce, so one burst stays well inside that window.
export const MAX_TX_COUNT = 10
const MAX_NONCE_AHEAD = 18

// getAddressNonce is the confirmed nonce, and a private transfer only moves
// it when its batch settles (~2 min), so nonces handed out since are tracked
// here. A transfer refused at settlement never consumes its nonce; after this
// long without the chain catching up, the tracked value is dropped so the
// account cannot stay stuck behind the gap.
const NONCE_TRACK_TTL_MS = 5 * 60_000

// Transaction status type
export interface TxHistoryItem {
  hash: string
  outerHash?: string
  l1BatchHash?: string
  timestamp: number
  type: 'l1' | 'l2ps'
  /** DEM, formatted from the chain's OS amount. */
  amount?: string
  status: 'pending' | 'in_mempool' | 'confirmed' | 'failed'
  message?: string
  from?: string
  to?: string
  l1_block_number?: number
}

const failureMessage = (tx: Record<string, unknown>): string | undefined => {
  if (tx.status !== 'failed') return undefined
  const attrs = tx.attrs as { message?: unknown } | undefined
  return typeof attrs?.message === 'string' ? attrs.message : 'Included in a block as failed'
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
  /** Called after a send is accepted, so the UI can show its progress. */
  onSent?: () => void
}

export function useTransactions({
  demos,
  address,
  isConnected,
  nodeUrl,
  showToast,
  addLog,
  fetchBalance,
  onSent,
}: UseTransactionsParams) {
  // Configuration State
  const [mode, setMode] = useState<'l1' | 'l2ps'>('l2ps')
  const [l2psUid, setL2psUid] = useState<string>(DEFAULT_L2PS_UID)
  const [aesKey, setAesKey] = useState<string>(DEFAULT_AES_KEY)
  const [iv, setIv] = useState<string>(DEFAULT_IV)
  const [showSettings, setShowSettings] = useState<boolean>(false)

  // Transaction State
  const [recipient, setRecipient] = useState<string>('')
  const [amount, setAmount] = useState<string>('5')
  const [txCount, setTxCount] = useState<number>(1)
  const [sending, setSending] = useState<boolean>(false)
  const nextNonce = useRef<{ key: string; value: number; at: number } | null>(null)

  // History & L2PS Status
  const [l1History, setL1History] = useState<TxHistoryItem[]>([])
  const [serverL2psHistory, setL2psHistory] = useState<TxHistoryItem[]>([])
  // A private transfer reaches the member's history only once it is executed,
  // and a refresh can miss it for a few seconds; the sender sees it at once.
  const [localPending, setLocalPending] = useState<TxHistoryItem[]>([])
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

  const l2psHistory = useMemo(() => {
    const known = new Set(serverL2psHistory.map(tx => tx.hash))
    const local = localPending.filter(tx => !known.has(tx.hash))
    return [...local, ...serverL2psHistory].sort((a, b) => b.timestamp - a.timestamp)
  }, [serverL2psHistory, localPending])

  // Drop local entries once the member reports them, or once they are old
  // enough that a refusal is the only explanation.
  useEffect(() => {
    if (localPending.length === 0) return
    const known = new Set(serverL2psHistory.map(tx => tx.hash))
    const now = Date.now()
    const keep = localPending.filter(tx => !known.has(tx.hash) && now - tx.timestamp < NONCE_TRACK_TTL_MS)
    if (keep.length !== localPending.length) setLocalPending(keep)
  }, [serverL2psHistory, localPending])

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

  // The member decrypts the account's history only for a request signed by
  // that account; the SDK signs it bound to the subnet uid.
  const fetchL2PSTransactions = useCallback(async (demosInstance: Demos) => {
    try {
      const page = await demosInstance.getL2PSHistory(l2psUid, { limit: 50 })
      const l2psTxs: TxHistoryItem[] = page.transactions.map(tx => ({
        hash: tx.hash,
        outerHash: tx.encrypted_hash ?? undefined,
        l1BatchHash: tx.l1_batch_hash ?? undefined,
        timestamp: parseInt(String(tx.timestamp)) || Date.now(),
        type: 'l2ps' as const,
        amount: osToDem(tx.amount),
        status: tx.status === 'confirmed' ? 'confirmed' as const :
          tx.status === 'batched' ? 'in_mempool' as const :
            tx.status === 'failed' ? 'failed' as const : 'pending' as const,
        message: tx.execution_message || 'L2PS Transaction',
        from: tx.from,
        to: tx.to,
        l1_block_number: tx.l1_block_number ?? undefined,
      }))
      setL2psHistory(l2psTxs)
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
          // Post-osDenomination the wire amount is an OS decimal string.

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
            amount: osToDem(String(txAmount)),
            status: tx.status === 'failed' ? 'failed' as const : 'confirmed' as const,
            message: failureMessage(tx),
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
      await fetchL2PSTransactions(demos)
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

    if (mode === 'l2ps' && (!aesKey || !iv)) {
      showToast('error', 'Missing L2PS Keys', 'Enter the subnet key and IV you were given (Advanced Settings)')
      setShowSettings(true)
      return
    }

    const typeLabel = mode === 'l1' ? 'L1' : 'L2PS'
    const count = Math.min(Math.max(1, txCount), MAX_TX_COUNT)

    setSending(true)
    addLog(`Preparing to send ${count} ${typeLabel} transaction(s)...`)
    // Kept outside the try so transfers accepted before a later one fails
    // still show up in History.
    const sentLocal: TxHistoryItem[] = []

    try {
      const amountOs = demToOs(amount)
      const l2ps = mode === 'l2ps' ? await createL2PSInstance(aesKey, iv, l2psUid, nodeUrl) : null

      const signerAddress = normalizeHex(await demos.getEd25519Address(), 'Ed25519 address')
      const toAddress = normalizeHex(recipient, 'Recipient address')

      const confirmed = await demos.getAddressNonce(signerAddress)
      const trackKey = `${nodeUrl}|${signerAddress}`
      const tracked = nextNonce.current
      const useTracked = tracked && tracked.key === trackKey && Date.now() - tracked.at < NONCE_TRACK_TTL_MS
      let currentNonce = Math.max(confirmed + 1, useTracked ? tracked.value : 0)
      if (currentNonce + count - 1 > confirmed + MAX_NONCE_AHEAD) {
        throw new Error(`Too many transfers are still waiting to settle (next nonce ${currentNonce}, chain at ${confirmed}). Wait until earlier ones are confirmed in History.`)
      }
      const sentHashes: string[] = []
      let feeOs = 0n

      for (let i = 0; i < count; i++) {
        let hash: string
        if (l2ps) {
          const transfer = await buildPrivateTransfer(demos, l2ps, {
            to: toAddress,
            amountOs,
            l2psUid,
            nonce: currentNonce,
          })
          await submitTransaction(demos, transfer.outer)
          feeOs += transfer.fee
          hash = transfer.inner.hash
          sentLocal.push({
            hash,
            timestamp: Date.now(),
            type: 'l2ps',
            amount: osToDem(amountOs),
            status: 'pending',
            message: 'Sent to the subnet; waiting for the batch proof',
            from: signerAddress,
            to: toAddress,
          })
        } else {
          const signed = await demos.transfer(toAddress, amountOs, { nonce: currentNonce })
          await submitTransaction(demos, signed)
          hash = signed.hash
        }

        sentHashes.push(hash)
        addLog(`Sent ${typeLabel} tx ${i + 1}: ${hash.slice(0, 16)}...`)
        currentNonce++
        nextNonce.current = { key: trackKey, value: currentNonce, at: Date.now() }

        if (i < count - 1) {
          await new Promise(r => setTimeout(r, 500))
        }
      }

      const hashSummary = sentHashes.length === 1
        ? `Hash: ${sentHashes[0].slice(0, 12)}...${sentHashes[0].slice(-6)}`
        : sentHashes.map((h, i) => `#${i + 1}: ${h.slice(0, 10)}...${h.slice(-4)}`).join('\n')
      const feeLine = mode === 'l2ps'
        ? `\nFee at settlement: ${osToDem(feeOs)} DEM. Settles on L1 in about 2 minutes.`
        : ''

      showToast(
        'success',
        `${count} ${typeLabel} tx${count > 1 ? 's' : ''} sent -- ${osToDem(amountOs)} DEM each`,
        `To: ${toAddress.slice(0, 10)}...${toAddress.slice(-6)}\n${hashSummary}${feeLine}`
      )
      addLog(`All ${count} transactions submitted`)
      if (sentLocal.length > 0) setLocalPending(prev => [...sentLocal, ...prev])
      onSent?.()

      setTimeout(() => { refreshData() }, 1000)
    } catch (e: unknown) {
      const err = e as Error
      const rawMsg = err.message || String(e)
      if (sentLocal.length > 0) setLocalPending(prev => [...sentLocal, ...prev])
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
