import { useState, type FC } from 'react'
import type { Demos } from '@kynesyslabs/demosdk/websdk'

interface LearnTabProps {
  demos: Demos | null
  address: string
  l2psUid: string
  mode: 'l1' | 'l2ps'
  addLog: (msg: string) => void
}

const LearnTab: FC<LearnTabProps> = ({ demos, address, l2psUid, addLog }) => {
  const [demoLoading, setDemoLoading] = useState(false)
  const [demoResult, setDemoResult] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)

  return (
    <div className="card learn-card">
      <h2 style={{ marginBottom: '1.5rem', color: '#a855f7' }}>🎓 How L2PS Works</h2>

      {/* Section 1: What is L2PS */}
      <div className="learn-section">
        <h3>🔐 What is L2PS?</h3>
        <p>
          <strong>Layer 2 Privacy Subnet</strong> is a private transaction layer that runs on top of the public L1 blockchain.
        </p>
        <div className="learn-box">
          <div className="learn-comparison">
            <div className="comparison-item l1-item">
              <span className="comparison-title">L1 (Public)</span>
              <span>Alice {'->'} Bob: 5 DEM</span>
              <span className="comparison-note">Everyone sees this</span>
            </div>
            <div className="comparison-arrow">{'->'}</div>
            <div className="comparison-item l2ps-item">
              <span className="comparison-title">L2PS (Private)</span>
              <span>Alice {'->'} [encrypted blob]</span>
              <span className="comparison-note">Only participants know</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Transaction Flow */}
      <div className="learn-section">
        <h3>📦 Transaction Lifecycle</h3>
        <div className="learn-timeline">
          <div className="timeline-step">
            <span className="step-number">1</span>
            <div className="step-content">
              <strong>Encrypt</strong>
              <span>Your browser encrypts the tx with AES-256</span>
            </div>
          </div>
          <div className="timeline-step">
            <span className="step-number">2</span>
            <div className="step-content">
              <strong>Submit</strong>
              <span>Encrypted blob sent to L2PS node</span>
            </div>
          </div>
          <div className="timeline-step">
            <span className="step-number">3</span>
            <div className="step-content">
              <strong>Execute</strong>
              <span>Node decrypts & validates (status: ⚡ Executed)</span>
            </div>
          </div>
          <div className="timeline-step">
            <span className="step-number">4</span>
            <div className="step-content">
              <strong>Batch</strong>
              <span>Per L1 block, up to 10 txs bundled (status: 📦 Batched)</span>
            </div>
          </div>
          <div className="timeline-step">
            <span className="step-number">5</span>
            <div className="step-content">
              <strong>Confirm</strong>
              <span>Batch included in L1 block (status: ✓ Confirmed)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Fee Info */}
      <div className="learn-section">
        <h3>💰 Transaction Fees</h3>
        <div className="learn-box fee-box">
          <div className="fee-item">
            <span className="fee-label">L2PS Transaction Fee</span>
            <span className="fee-value">1 DEM</span>
          </div>
          <p className="fee-note">
            Each L2PS transaction costs <strong>1 DEM</strong> which is burned (removed from circulation).
            This is in addition to the transfer amount.
          </p>
        </div>
      </div>

      {/* Section 4: Privacy Demo - Interactive */}
      <div className="learn-section">
        <h3>🔒 Privacy Demo: Access Control</h3>
        <p>Try to fetch L2PS transaction history and see what happens with or without signing:</p>
        <div className="learn-demo">

          {/* Initial state: Show fetch button */}
          {!demoResult && !demoLoading && (
            <button
              className="demo-btn"
              onClick={() => {
                if (!demos) return
                setDemoResult({ type: 'info', message: 'CHOICE_MODAL' })
              }}
              disabled={!demos}
              style={{
                background: 'linear-gradient(135deg, #a855f7, #8b5cf6)',
              }}
            >
              🔍 Fetch L2PS History
            </button>
          )}

          {/* Choice Modal */}
          {demoResult?.message === 'CHOICE_MODAL' && (
            <div style={{
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '12px',
              padding: '1.5rem',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              animation: 'fadeIn 0.3s ease-in'
            }}>
              <p style={{ marginBottom: '1rem', textAlign: 'center', fontWeight: '600' }}>
                🔐 Authentication Required
              </p>
              <p style={{ marginBottom: '1.5rem', fontSize: '0.9rem', textAlign: 'center', color: '#94a3b8' }}>
                The node requires you to prove you own the address. Sign the request?
              </p>
              <div style={{ display: 'flex', gap: '1rem' }}>
                {/* Skip signing button */}
                <button
                  className="demo-btn"
                  onClick={async () => {
                    setDemoLoading(true)
                    setDemoResult(null)
                    addLog("🧪 Attempting access WITHOUT signing...")
                    try {
                      const timestamp = Date.now().toString()
                      const response = await demos!.rpcCall({
                        method: "nodeCall",
                        params: [{
                          message: "getL2PSAccountTransactions",
                          data: {
                            l2psUid: l2psUid,
                            address: address,
                            timestamp: timestamp,
                            signature: "not_signed",
                            limit: 10
                          },
                          muid: `demo_no_sign_${Date.now()}`
                        }]
                      }, false)

                      if (response?.result === 403) {
                        setDemoResult({ type: 'error', message: '🛡️ ACCESS DENIED (403): Cannot prove address ownership without signature!' })
                        addLog("🛡️ ACCESS DENIED (403)")
                      } else if (response?.result === 401) {
                        setDemoResult({ type: 'error', message: '🛡️ AUTH REQUIRED (401): Missing valid signature!' })
                        addLog("🛡️ AUTH REQUIRED (401)")
                      } else {
                        setDemoResult({ type: 'info', message: `Unexpected: ${response?.result}` })
                      }
                    } catch (e: any) {
                      setDemoResult({ type: 'error', message: `Error: ${e.message}` })
                    } finally {
                      setDemoLoading(false)
                    }
                  }}
                  style={{
                    flex: 1,
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  }}
                >
                  ❌ Skip Signing
                </button>

                {/* Sign button */}
                <button
                  className="demo-btn"
                  onClick={async () => {
                    setDemoLoading(true)
                    setDemoResult(null)
                    addLog("✍️ Signing authentication request...")
                    try {
                      const timestamp = Date.now().toString()
                      const messageToSign = `getL2PSHistory:${address}:${timestamp}`

                      addLog(`📝 Message: ${messageToSign.slice(0, 35)}...`)

                      const signResult = await demos!.signMessage(messageToSign)
                      const signature = typeof signResult === 'string' ? signResult : signResult.data

                      addLog("✅ Signed! Sending request...")

                      const response = await demos!.rpcCall({
                        method: "nodeCall",
                        params: [{
                          message: "getL2PSAccountTransactions",
                          data: {
                            l2psUid: l2psUid,
                            address: address,
                            timestamp: timestamp,
                            signature: signature,
                            limit: 10
                          },
                          muid: `demo_signed_${Date.now()}`
                        }]
                      }, false)

                      if (response?.result === 200) {
                        const txCount = response?.response?.transactions?.length || 0
                        setDemoResult({
                          type: 'success',
                          message: `✅ ACCESS GRANTED! Found ${txCount} L2PS transactions.`
                        })
                        addLog(`✅ SUCCESS! Found ${txCount} transactions`)
                      } else {
                        setDemoResult({ type: 'error', message: `Response: ${response?.result}` })
                      }
                    } catch (e: any) {
                      setDemoResult({ type: 'error', message: `Error: ${e.message}` })
                    } finally {
                      setDemoLoading(false)
                    }
                  }}
                  style={{
                    flex: 1,
                    background: 'linear-gradient(135deg, #4ade80, #22c55e)',
                  }}
                >
                  ✍️ Sign Request
                </button>
              </div>
            </div>
          )}

          {/* Loading state */}
          {demoLoading && (
            <div style={{
              padding: '2rem',
              textAlign: 'center',
              animation: 'pulse 1s infinite'
            }}>
              ⏳ Processing...
            </div>
          )}

          {/* Result Display */}
          {demoResult && demoResult.message !== 'CHOICE_MODAL' && !demoLoading && (
            <div style={{ animation: 'fadeIn 0.3s ease-in' }}>
              <div
                style={{
                  padding: '1.25rem',
                  borderRadius: '8px',
                  background: demoResult.type === 'error'
                    ? 'rgba(239, 68, 68, 0.2)'
                    : demoResult.type === 'success'
                      ? 'rgba(74, 222, 128, 0.2)'
                      : 'rgba(100, 108, 255, 0.2)',
                  border: `1px solid ${demoResult.type === 'error'
                    ? 'rgba(239, 68, 68, 0.5)'
                    : demoResult.type === 'success'
                      ? 'rgba(74, 222, 128, 0.5)'
                      : 'rgba(100, 108, 255, 0.5)'
                    }`,
                  marginBottom: '1rem'
                }}
              >
                <span style={{ fontSize: '1rem', fontWeight: '600' }}>
                  {demoResult.message}
                </span>
              </div>
              <button
                onClick={() => setDemoResult(null)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  padding: '0.5rem 1rem',
                  fontSize: '0.85rem',
                  width: '100%'
                }}
              >
                🔄 Try Again
              </button>
            </div>
          )}

          <p className="demo-explanation" style={{ marginTop: '1.5rem' }}>
            <strong>How it works:</strong> L2PS history requires cryptographic proof of address ownership.
            Without a valid signature, the node rejects the request (403).
          </p>
        </div>
      </div>

      {/* Section 5: Encryption Demo */}
      <div className="learn-section">
        <h3>🔓 Decryption Demo</h3>
        <p>See what an encrypted L2PS transaction looks like vs decrypted:</p>
        <div className="learn-demo">
          <div className="demo-comparison">
            <div className="demo-box encrypted">
              <span className="demo-label">Encrypted (What network sees)</span>
              <code>
                {`{
  "type": "l2psEncryptedTx",
  "to": "${l2psUid}",
  "data": "aGVsbG8gd29ybGQh..."
}`}
              </code>
            </div>
            <div className="demo-arrow">🔓</div>
            <div className="demo-box decrypted">
              <span className="demo-label">Decrypted (Only participants see)</span>
              <code>
                {`{
  "type": "native",
  "from": "${address.slice(0, 16)}...",
  "to": "0xRecipient...",
  "amount": 5
}`}
              </code>
            </div>
          </div>
        </div>
      </div>

      {/* Section 6: Transaction Lifecycle */}
      <div className="learn-section">
        <h3>🔄 L2PS Transaction Lifecycle</h3>
        <p>Every L2PS transaction progresses through three distinct stages of verification and finality:</p>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          marginTop: '1.5rem',
          paddingLeft: '1rem',
          borderLeft: '2px solid rgba(168, 85, 247, 0.3)'
        }}>
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute',
              left: '-1.45rem',
              top: '0.2rem',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: '#a855f7',
              boxShadow: '0 0 10px #a855f7'
            }}></div>
            <strong style={{ color: '#a855f7' }}>⚡ Stage 1: Executed</strong>
            <p style={{ margin: '0.25rem 0 0.5rem 0', fontSize: '0.85rem', color: '#94a3b8' }}>
              Occurs within milliseconds. The local node decrypts, validates GCR edits against L1 state, and reserves the balance.
            </p>
          </div>

          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute',
              left: '-1.45rem',
              top: '0.2rem',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: '#fbbf24',
              boxShadow: '0 0 10px #fbbf24'
            }}></div>
            <strong style={{ color: '#fbbf24' }}>📦 Stage 2: Batched</strong>
            <p style={{ margin: '0.25rem 0 0.5rem 0', fontSize: '0.85rem', color: '#94a3b8' }}>
              Occurs per L1 block. Multiple private transactions are bundled into an L1 batch, and a ZK proof is generated.
            </p>
          </div>

          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute',
              left: '-1.45rem',
              top: '0.2rem',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: '#4ade80',
              boxShadow: '0 0 10px #4ade80'
            }}></div>
            <strong style={{ color: '#4ade80' }}>✓ Stage 3: Confirmed</strong>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
              The L1 batch is included in a finalized block. Your transaction is now immutable and permanent on the blockchain.
            </p>
          </div>
        </div>
      </div>

      {/* Section 7: Architecture Visualization */}
      <div className="learn-section">
        <h3>🏗️ Rollup Architecture</h3>
        <div className="learn-box" style={{ padding: '1.5rem' }}>
          <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', lineHeight: '1.6' }}>
            <div style={{ color: '#94a3b8', marginBottom: '1rem' }}>
              Multiple L2PS transactions are batched into a single L1 transaction:
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              background: 'rgba(0,0,0,0.3)',
              padding: '1rem',
              borderRadius: '8px'
            }}>
              <div style={{ color: '#a855f7' }}>{'TX 1 ──┐'}</div>
              <div style={{ color: '#a855f7' }}>{'TX 2 ──┤'}</div>
              <div style={{ color: '#a855f7' }}>{'TX 3 ──┼──→ [Batch Aggregator] ──→ 1 L1 Transaction'}</div>
              <div style={{ color: '#a855f7' }}>{'TX 4 ──┤       (per block)'}</div>
              <div style={{ color: '#a855f7' }}>{'TX 5 ──┘'}</div>
            </div>
            <div style={{ marginTop: '1rem', color: '#94a3b8' }}>
              <strong style={{ color: '#4ade80' }}>Benefits:</strong>
              <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                <li>Reduced L1 congestion</li>
                <li>Lower gas costs (amortized across batch)</li>
                <li>Privacy preserved with ZK proofs</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Section 8: Key Points */}
      <div className="learn-section">
        <h3>💡 Key Takeaways</h3>
        <ul className="learn-list">
          <li>✅ <strong>Client-side encryption</strong> - Transaction encrypted in browser with AES-256</li>
          <li>✅ <strong>Signature verification</strong> - Only address owner can access their L2PS history</li>
          <li>✅ <strong>Batch aggregation</strong> - Up to 10 transactions bundled per L1 block</li>
          <li>✅ <strong>ZK Proofs</strong> - PLONK proofs verify validity without revealing content</li>
          <li>✅ <strong>1 DEM fee</strong> - Burned per transaction (deflationary mechanism)</li>
          <li>✅ <strong>Status tracking</strong> - Executed {'->'} Batched {'->'} Confirmed lifecycle</li>
        </ul>
      </div>

      {/* Section 9: Quick Reference */}
      <div className="learn-section" style={{ borderBottom: 'none' }}>
        <h3>📋 Quick Reference</h3>
        <div className="learn-box">
          <table style={{
            width: '100%',
            fontSize: '0.85rem',
            borderCollapse: 'collapse'
          }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <td style={{ padding: '0.5rem 0', color: '#94a3b8' }}>L2PS UID</td>
                <td style={{ padding: '0.5rem 0', fontFamily: 'monospace', color: '#a855f7' }}>{l2psUid}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <td style={{ padding: '0.5rem 0', color: '#94a3b8' }}>Transaction Fee</td>
                <td style={{ padding: '0.5rem 0', fontFamily: 'monospace', color: '#4ade80' }}>1 DEM (burned)</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <td style={{ padding: '0.5rem 0', color: '#94a3b8' }}>Batch Interval</td>
                <td style={{ padding: '0.5rem 0', fontFamily: 'monospace' }}>Per L1 block</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <td style={{ padding: '0.5rem 0', color: '#94a3b8' }}>Max Batch Size</td>
                <td style={{ padding: '0.5rem 0', fontFamily: 'monospace' }}>10 transactions</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <td style={{ padding: '0.5rem 0', color: '#94a3b8' }}>Encryption</td>
                <td style={{ padding: '0.5rem 0', fontFamily: 'monospace' }}>AES-256-CBC</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem 0', color: '#94a3b8' }}>Proof System</td>
                <td style={{ padding: '0.5rem 0', fontFamily: 'monospace' }}>PLONK (ZK-SNARK)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Section: L2PS Messaging */}
      <div className="learn-section">
        <h3>💬 L2PS Messaging</h3>
        <p>
          Beyond transactions, an L2PS subnet can carry <strong>instant messages</strong>.
          The node runs a messaging server (<code>ws://&lt;node&gt;:3006</code>) and peers
          exchange encrypted messages isolated to their L2PS network, with offline delivery
          when a recipient reconnects.
        </p>
        <div className="learn-box">
          <p style={{ margin: '0 0 0.5rem' }}>
            <strong>A peer is a wallet</strong> (an Ed25519 key), not a node. To register, a
            peer signs <code>register:&#123;publicKey&#125;:&#123;timestamp&#125;</code> with
            its key — the server verifies ownership before letting it send or receive. Open
            this POC in two browsers with two mnemonics to chat between two peers.
          </p>
        </div>
        <div className="learn-box fee-box" style={{ marginTop: '0.75rem' }}>
          <div className="fee-item">
            <span className="fee-label">Messaging Fee</span>
            <span className="fee-value" style={{ color: '#4ade80' }}>0 DEM</span>
          </div>
          <p className="fee-note">
            Messaging is <strong>free</strong> — no balance required (unlike a 1 DEM L2PS
            transaction). Limits are technical only: message ≤ 256 KB, ciphertext ≤ 128 KB,
            and the offline queue holds 200 messages per sender.
          </p>
        </div>
        <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#94a3b8' }}>
          Try it in the <strong>💬 Messaging</strong> tab. For production apps, use the SDK's
          <code> L2PSMessagingPeer</code> (real x25519+AES-GCM e2e encryption) rather than the
          tab's transport-only test harness.
        </p>
      </div>
    </div>
  )
}

export default LearnTab
