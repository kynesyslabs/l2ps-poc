import { useState, useCallback, useRef } from 'react'

export interface Toast {
  id: number
  type: 'success' | 'error' | 'info'
  title: string
  message?: string
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastIdRef = useRef(0)

  const showToast = useCallback((type: Toast['type'], title: string, message?: string) => {
    const id = ++toastIdRef.current
    setToasts(prev => [...prev, { id, type, title, message }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, type === 'error' ? 8000 : 6000)
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return { toasts, showToast, dismissToast }
}
