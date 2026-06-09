import { useEffect, useRef, useCallback } from 'react'
import { tokenStorage } from '@/api/client'

const WS_BASE = (import.meta.env.VITE_WS_URL ?? 'ws://localhost:8000').replace(/\/$/, '')

type WSMessage = { event: string; ticket_id: string; [key: string]: unknown }
type Handler   = (msg: WSMessage) => void

export function useWebSocket(onMessage: Handler, enabled = true) {
  const ws        = useRef<WebSocket | null>(null)
  const retry     = useRef(0)
  const maxRetry  = 5
  const handlerRef = useRef<Handler>(onMessage)
  handlerRef.current = onMessage

  const connect = useCallback(() => {
    const token = tokenStorage.getAccess()
    if (!token || !enabled) return

    const url = `${WS_BASE}/api/v1/tickets/ws/tickets?token=${token}`
    const socket = new WebSocket(url)
    ws.current = socket

    socket.onopen = () => {
      retry.current = 0
      // Send keepalive every 25s
      const id = setInterval(() => socket.readyState === WebSocket.OPEN && socket.send('ping'), 25_000)
      socket.onclose = () => { clearInterval(id); scheduleReconnect() }
    }

    socket.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg !== 'pong') handlerRef.current(msg as WSMessage)
      } catch { /* ignore malformed */ }
    }

    socket.onerror = () => socket.close()
  }, [enabled])

  function scheduleReconnect() {
    if (retry.current >= maxRetry) return
    const delay = Math.min(1000 * 2 ** retry.current, 30_000)
    retry.current++
    setTimeout(connect, delay)
  }

  useEffect(() => {
    connect()
    return () => { ws.current?.close() }
  }, [connect])
}
