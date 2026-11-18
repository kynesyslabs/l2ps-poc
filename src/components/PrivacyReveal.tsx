import { useEffect, useState, type FC } from 'react'
import type { Demos } from '@kynesyslabs/demosdk/websdk'
import { buildPrivateTransfer, createL2PSInstance } from '../utils/l2ps'
import type { L2PSEncryptedPayload } from '../utils/l2ps'
import { demToOs, osToDem } from '../utils/amount'

interface PrivacyRevealProps {
  demos: Demos | null
  recipient: string
  amount: string
  l2psUid: string
  aesKey: string
  iv: string
  nodeUrl: string
}

interface Cipher {
  encrypted_data: string
  tag: string
  original_hash: string
  l2ps_uid: string
}

type Status = 'idle' | 'encrypting' | 'done' | 'error'

function toCipher(p: L2PSEncryptedPayload | undefined): Cipher | null {
  if (!p || typeof p.encrypted_data !== 'string') return null
  return {
    encrypted_data: p.encrypted_data,
    tag: p.tag ?? '',
    original_hash: p.original_hash ?? '',
    l2ps_uid: p.l2ps_uid ?? '',
  }
}

function shortAddr(a: string): string {
  if (!a || a.length < 14) return a || '—'
  return `${a.slice(0, 8)}…${a.slice(-6)}`
}

function chunk(b64: string, n = 46): string {
  return (b64 || '').slice(0, n)
}

const PrivacyReveal: FC<PrivacyRevealProps> = ({
  demos,
  recipient,
  amount,
  l2psUid,
  aesKey,
  iv,
  nodeUrl,
}) => {
  const [status, setStatus] = useState<Status>('idle')
  const [cipher, setCipher] = useState<Cipher | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [fee, setFee] = useState<string>('')

  let amountDem = '—'
  try {
    amountDem = osToDem(demToOs(amount))
  } catch {
    // Invalid input: the send refuses it with a clear message.
  }

  useEffect(() => {
    if (!demos) return
    let cancelled = false
    setStatus('encrypting')
    const t = setTimeout(async () => {
      try {
        // Real client-side encryption: the same settled transfer a live send
        // builds, never submitted. The next nonce is passed explicitly so the
        // preview does not reserve one.
        const l2ps = await createL2PSInstance(aesKey, iv, l2psUid, nodeUrl || '')
        const from = await demos.getEd25519Address()
        const nonce = (await demos.getAddressNonce(from)) + 1
        const transfer = await buildPrivateTransfer(demos, l2ps, {
          to: recipient,
          amountOs: demToOs(amount),
          l2psUid,
          nonce,
        })
        const payload = toCipher(transfer.payload)
        if (!cancelled) {
          setCipher(payload)
          setFee(osToDem(transfer.fee))
          setStatus(payload ? 'done' : 'error')
        }
      } catch {
        if (!cancelled) {
          setCipher(null)
          setFee('')
          setStatus('error')
        }
      }
    }, 600)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [demos, recipient, amount, l2psUid, aesKey, iv, nodeUrl])

  const encrypting = status === 'encrypting'

  return (
    <div className="reveal">
      <div className="reveal-caption">
        <span>What actually goes on-chain</span>
        <button
          type="button"
          className="reveal-toggle"
          onClick={() => setRevealed(r => !r)}
        >
          {revealed ? '🙈 Hide recipient view' : '🔑 Reveal recipient view'}
        </button>
      </div>

      <div className="reveal-grid">
        {/* Plaintext — what the sender enters */}
        <div className="reveal-card plain">
          <div className="reveal-card-head">
            <span className="reveal-badge plain">You send</span>
            <span className="reveal-sub">visible only to you</span>
          </div>
          <dl className="reveal-fields">
            <div><dt>To</dt><dd className="mono">{shortAddr(recipient)}</dd></div>
            <div><dt>Amount</dt><dd>{amountDem} DEM</dd></div>
            <div><dt>Fee</dt><dd>{fee ? `${fee} DEM` : '—'}</dd></div>
          </dl>
        </div>

        {/* Encrypt bridge */}
        <div className="reveal-bridge">
          <div className={`reveal-lock ${encrypting ? 'busy' : ''}`}>🔒</div>
          <div className="reveal-arrow" />
          <div className="reveal-algo">AES‑256‑GCM<br />in your browser</div>
        </div>

        {/* Ciphertext — what a validator / the chain sees */}
        <div className={`reveal-card cipher ${revealed ? 'is-revealed' : ''}`}>
          <div className="reveal-card-head">
            <span className="reveal-badge cipher">
              {revealed ? 'Recipient decrypts' : 'Validator sees'}
            </span>
            <span className="reveal-sub">
              {revealed ? 'with the shared key' : 'public network'}
            </span>
          </div>

          {revealed ? (
            <dl className="reveal-fields">
              <div><dt>To</dt><dd className="mono">{shortAddr(recipient)}</dd></div>
              <div><dt>Amount</dt><dd>{amountDem} DEM</dd></div>
              <div><dt>Fee</dt><dd>{fee ? `${fee} DEM` : '—'}</dd></div>
            </dl>
          ) : (
            <dl className="reveal-fields">
              <div><dt>Subnet</dt><dd className="mono">{cipher?.l2ps_uid || l2psUid}</dd></div>
              <div><dt>Amount</dt><dd><span className="redact">▓▓▓▓▓</span></dd></div>
              <div><dt>Receiver</dt><dd><span className="redact">▓▓▓▓▓▓▓▓</span></dd></div>
              <div className="wide">
                <dt>Payload</dt>
                <dd className="mono cipher-blob">
                  {encrypting
                    ? 'encrypting…'
                    : cipher
                      ? `${chunk(cipher.encrypted_data)}…`
                      : '—'}
                </dd>
              </div>
              <div className="wide">
                <dt>Auth tag</dt>
                <dd className="mono cipher-blob">
                  {cipher ? `${chunk(cipher.tag, 30)}` : '—'}
                </dd>
              </div>
            </dl>
          )}
        </div>
      </div>

      <p className="reveal-foot">
        The receiver and amount are encrypted on your device. Validators settle the transfer from a
        commitment without reading them; only the sender and holders of the subnet key can.
      </p>
    </div>
  )
}

export default PrivacyReveal
