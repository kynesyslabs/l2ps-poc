import type { FC } from 'react'

interface IdentityGuideProps {
  hasIdentity: boolean
  isRegistered: boolean
  hasActed: boolean
}

interface Step {
  n: number
  title: string
  desc: string
  done: boolean
}

const IdentityGuide: FC<IdentityGuideProps> = ({ hasIdentity, isRegistered, hasActed }) => {
  const steps: Step[] = [
    { n: 1, title: 'Create anonymous identity', desc: 'A secret stays on your device; only a commitment is published.', done: hasIdentity },
    { n: 2, title: 'Join the anonymity set', desc: 'Your commitment joins the on-chain tree of members.', done: isRegistered },
    { n: 3, title: 'Act — without revealing who', desc: 'Prove membership and vote once; a double-spend is rejected.', done: hasActed },
  ]
  // Active = the first step that isn't done yet.
  const activeIndex = steps.findIndex(s => !s.done)

  return (
    <div className="idguide">
      <div className="idguide-head">
        <h3 className="idguide-title">Anonymous Identity</h3>
        <p className="idguide-lede">
          Prove you belong to a group and act once — without revealing which member you are.
          The chain sees a valid proof, never your wallet.
        </p>
      </div>
      <ol className="idguide-steps">
        {steps.map((s, i) => {
          const state = s.done ? 'done' : i === activeIndex ? 'active' : 'todo'
          return (
            <li key={s.n} className={`idguide-step ${state}`}>
              <span className="idguide-num">{s.done ? '✓' : s.n}</span>
              <div className="idguide-body">
                <strong>{s.title}</strong>
                <span>{s.desc}</span>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default IdentityGuide
