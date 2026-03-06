import { useState, useEffect, useRef, useCallback } from 'react'

interface TooltipProps {
  text: string
  children: React.ReactNode
}

export default function Tooltip({ text, children }: TooltipProps) {
  const [show, setShow] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  const close = useCallback((e: MouseEvent | TouchEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setShow(false)
    }
  }, [])

  useEffect(() => {
    if (show) {
      document.addEventListener('click', close, true)
      return () => document.removeEventListener('click', close, true)
    }
  }, [show, close])

  return (
    <span
      ref={ref}
      className="tooltip-wrap"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onClick={() => setShow((s) => !s)}
    >
      {children}
      {show && <span className="tooltip-box">{text}</span>}
    </span>
  )
}
