import type { FC } from 'react'

interface IntroModalProps {
  onClose: () => void
}

const IntroModal: FC<IntroModalProps> = ({ onClose }) => {
  return (
    <div className="intro-overlay" onClick={onClose}>
      <div className="intro-card" onClick={e => e.stopPropagation()}>
        <div className="intro-emoji">🔒</div>
        <h2 className="intro-title">Private transactions, in your browser</h2>
        <p className="intro-lede">
          This wallet demonstrates two ways Demos keeps data private on a public chain.
          Everything sensitive is encrypted on your device before it ever leaves.
        </p>

        <div className="intro-features">
          <div className="intro-feature">
            <span className="intro-feature-icon private">💸</span>
            <div>
              <strong>Private Transfer</strong>
              <p>Send value where the amount and memo are encrypted — the network stores only ciphertext. Only you and the recipient can read them.</p>
            </div>
          </div>
          <div className="intro-feature">
            <span className="intro-feature-icon anon">🛡️</span>
            <div>
              <strong>Anonymous Identity</strong>
              <p>Prove you're a registered member and act once — without revealing which member you are.</p>
            </div>
          </div>
        </div>

        <button className="intro-cta" onClick={onClose}>
          Start with a Private Transfer →
        </button>
        <p className="intro-foot">Non-production demo · testnet subnet</p>
      </div>
    </div>
  )
}

export default IntroModal
