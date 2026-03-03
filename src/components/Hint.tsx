import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'

/** Small (?) icon with a portal tooltip rendered in <body> -- bypasses all backdrop-filter/stacking issues */
function Hint({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })

  const onEnter = () => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    setPos({ x: rect.left + rect.width / 2, y: rect.top - 8 })
    setShow(true)
  }

  return (
    <>
      <span
        ref={ref}
        className="hint-icon"
        onMouseEnter={onEnter}
        onMouseLeave={() => setShow(false)}
      >?</span>
      {show && createPortal(
        <div className="hint-tooltip" style={{ left: pos.x, top: pos.y }}>
          {text}
        </div>,
        document.body
      )}
    </>
  )
}

export default Hint
