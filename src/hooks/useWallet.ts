import { useState, useCallback } from 'react'
import { Demos } from '@kynesyslabs/demosdk/websdk'
import * as bip39 from 'bip39'

export const DEFAULT_NODE_URL = import.meta.env.VITE_NODE_URL || '/rpc'

type ShowToastFn = (type: 'success' | 'error' | 'info', title: string, message?: string) => void
type AddLogFn = (msg: string) => void

export function useWallet(showToast: ShowToastFn, addLog: AddLogFn) {
  const [mnemonic, setMnemonic] = useState<string>('')
  const [address, setAddress] = useState<string>('')
  const [balance, setBalance] = useState<string>('0')
  const [isConnected, setIsConnected] = useState<boolean>(false)
  const [demos, setDemos] = useState<Demos | null>(null)
  const [nodeUrl, setNodeUrl] = useState<string>(DEFAULT_NODE_URL)

  const generateMnemonic = () => {
    const newMnemonic = bip39.generateMnemonic(256)
    setMnemonic(newMnemonic)
    addLog('Generated new 24-word mnemonic')
  }

  // Proper balance fetching using SDK's rpcCall -> nodeCall
  const fetchBalance = useCallback(async (demosInstance: Demos, addr: string) => {
    try {
      // Remove 0x prefix if present for consistency with DB
      const cleanAddr = addr.startsWith('0x') ? addr : `0x${addr}`

      addLog(`Fetching balance for: ${cleanAddr}`)
      console.log('[Balance] Fetching for address:', cleanAddr)

      // Use demos.rpcCall with nodeCall method to get address info
      const response = await demosInstance.rpcCall({
        method: 'nodeCall',
        params: [{
          message: 'getAddressInfo',
          data: { address: cleanAddr },
          muid: `balance_${Date.now()}`
        }]
      }, false) // false = not authenticated

      console.log('[Balance] Full response:', JSON.stringify(response, null, 2))
      addLog(`RPC Response: ${JSON.stringify(response?.result)}`)

      if (response?.result === 200 && response?.response) {
        const info = response.response as Record<string, unknown>
        console.log('[Balance] Info object:', info)

        // Balance could be in different formats - try multiple field names
        // bigint from DB might come as string
        const bal = info.balance ?? info.nativeBalance ?? info.amount ?? 0
        const balStr = typeof bal === 'bigint' ? bal.toString() : String(bal)

        setBalance(balStr)
        addLog(`Balance: ${balStr} DEM`)
      } else {
        addLog(`Balance fetch failed: result=${response?.result}`)
        console.log('[Balance] Failed response:', response)
      }
    } catch (e: unknown) {
      const err = e as Error
      console.error('Failed to fetch balance', e)
      addLog(`Balance fetch error: ${err.message || 'Unknown'}`)
    }
  }, [addLog])

  const connectWallet = async (
    onConnected?: (demosInstance: Demos, formattedAddr: string) => Promise<void>
  ) => {
    try {
      if (!mnemonic) {
        showToast('error', 'Mnemonic Required', 'Enter your wallet mnemonic to connect')
        return
      }

      addLog(`Connecting to node: ${nodeUrl}`)
      const demosInstance = new Demos()
      await demosInstance.connect(nodeUrl)
      addLog('Node connected')

      addLog('Connecting wallet...')
      await demosInstance.connectWallet(mnemonic)

      const addr = await demosInstance.getEd25519Address()
      const formattedAddr = addr.startsWith('0x') ? addr : `0x${addr}`

      setAddress(formattedAddr)
      setDemos(demosInstance)
      setIsConnected(true)

      addLog(`Wallet connected: ${formattedAddr}`)

      // Initial fetch
      await fetchBalance(demosInstance, formattedAddr)

      // Let caller do additional post-connect work (fetch history, etc.)
      if (onConnected) {
        await onConnected(demosInstance, formattedAddr)
      }
    } catch (err: unknown) {
      const error = err as Error
      showToast('error', 'Connection Failed', error.message || String(err))
      addLog(`Connection Failed: ${error.message || err}`)
      console.error(err)
    }
  }

  return {
    mnemonic,
    setMnemonic,
    address,
    balance,
    isConnected,
    demos,
    nodeUrl,
    setNodeUrl,
    generateMnemonic,
    connectWallet,
    fetchBalance,
  }
}
