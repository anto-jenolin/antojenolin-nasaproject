import { useState, useEffect, useRef } from 'react'
import { MessageSquare, X, Send, Loader2 } from 'lucide-react'
import { streamChat } from '../api/client'
import { FormattedScientificText } from './FormattedScientificText'
import toast from 'react-hot-toast'

/**
 * Floating AI assistant widget.
 * Appears on all authenticated pages except login, register, and admin login.
 */
export default function ChatbotWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // Hide on auth pages.
  useEffect(() => {
    const hideOn = ['/login', '/register', '/admin/login']
    if (hideOn.includes(window.location.pathname)) setOpen(false)
  }, [])

  const sendMessage = async () => {
    if (!input.trim()) return
    const userMsg = { role: 'user' as const, content: input }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)
    abortRef.current = streamChat(
      [...messages, userMsg],
      undefined,
      (chunk) => {
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last?.role === 'assistant') {
            const updated = { ...last, content: last.content + chunk }
            return [...prev.slice(0, -1), updated]
          }
          return [...prev, { role: 'assistant', content: chunk }]
        })
      },
      () => {
        setLoading(false)
        abortRef.current = null
      },
      (err) => {
        setLoading(false)
        abortRef.current = null
        toast.error(`Chat error: ${err}`)
      },
    )
  }

  const closeChat = () => {
    setOpen(false)
    if (abortRef.current) abortRef.current.abort()
    setMessages([])
  }

  return (
    <div className="chatbot-widget">
      <button className="chatbot-toggle" onClick={() => setOpen((v) => !v)} aria-label="AI Assistant">
        <MessageSquare size={20} />
      </button>
      {open && (
        <div className="chatbot-panel">
          <div className="chatbot-header">
            <span>AI Assistant</span>
            <button onClick={closeChat} className="chatbot-close"><X size={16} /></button>
          </div>
          <div className="chatbot-messages" id="chatbot-messages">
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>
                <span className="role">{m.role === 'user' ? 'You' : 'AI'}</span>
                <div className="content" style={{ fontSize: '0.85rem' }}>
                  {m.role === 'user' ? m.content : <FormattedScientificText content={m.content} />}
                </div>
              </div>
            ))}
            {loading && (
              <div className="msg assistant loading"><Loader2 className="spinner" size={14} /></div>
            )}
          </div>
          <div className="chatbot-input">
            <input type="text" placeholder="Type a message…" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !loading && sendMessage()} disabled={loading} />
            <button onClick={sendMessage} disabled={loading || !input.trim()} className="send-btn"><Send size={14} /></button>
          </div>
        </div>
      )}
      <style>{`
        .chatbot-widget { position: fixed; bottom: 24px; right: 24px; z-index: 2000; }
        .chatbot-toggle { background: var(--cyan); color: var(--midnight-navy); border: none; border-radius: 50%; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-md); cursor: pointer; }
        .chatbot-panel { width: 320px; max-height: 480px; background: var(--card-blue); border: 1px solid var(--border-blue); border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: var(--shadow-lg); }
        .chatbot-header { padding: 8px 12px; background: var(--panel-blue); display: flex; justify-content: space-between; align-items: center; font-weight: 600; }
        .chatbot-close { background: transparent; border: none; color: var(--text-muted); cursor: pointer; }
        .chatbot-messages { flex: 1; overflow-y: auto; padding: 8px; }
        .msg { margin-bottom: 8px; }
        .msg.user .role { color: var(--sci-green); }
        .msg.assistant .role { color: var(--cyan); }
        .msg.assistant.loading { display: flex; align-items: center; }
        .chatbot-input { display: flex; border-top: 1px solid var(--border-subtle); }
        .chatbot-input input { flex: 1; border: none; padding: 8px; background: var(--deep-space); color: var(--text-primary); }
        .chatbot-input button { background: var(--cyan); border: none; padding: 0 12px; display: flex; align-items: center; justify-content: center; color: var(--midnight-navy); cursor: pointer; }
      `}</style>
    </div>
  )
}
