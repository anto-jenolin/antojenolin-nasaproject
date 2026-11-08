import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Trash2, RefreshCw, AlertCircle, CheckCircle, Satellite } from 'lucide-react'
import { chatApi, streamChat } from '../api/client'
import { useRegion } from '../contexts/RegionContext'
import { FormattedScientificText } from '../components/FormattedScientificText'
import toast from 'react-hot-toast'

interface Message {
  id: number
  role: 'user' | 'assistant'
  content: string
  loading?: boolean
}

let msgId = 1

export default function AICopilotPage() {
  const { region, dateStart, dateEnd, variable, qualityFilter } = useRegion()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<any>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    chatApi.status()
      .then(r => setStatus(r.data))
      .catch(() => setStatus({ configured: false, message: 'Could not contact backend.' }))
      .finally(() => setStatusLoading(false))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const getContext = () => ({
    page: 'AI Copilot',
    ...(region ? {
      region: { min_lat: region.min_lat, max_lat: region.max_lat, min_lon: region.min_lon, max_lon: region.max_lon },
      date_start: dateStart,
      date_end: dateEnd,
      variable,
    } : {}),
  })

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    const userMsg: Message = { id: msgId++, role: 'user', content: text }
    const aiMsg: Message = { id: msgId++, role: 'assistant', content: '', loading: true }

    setMessages((prev: Message[]) => [...prev, userMsg, aiMsg])
    setInput('')
    setIsStreaming(true)

    const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))

    if (status?.configured) {
      // Streaming mode
      let aiContent = ''
      const aiId = aiMsg.id
      abortRef.current = streamChat(
        history,
        getContext(),
        (chunk) => {
          aiContent += chunk
          setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: aiContent, loading: false } : m))
        },
        () => {
          setIsStreaming(false)
          setMessages(prev => prev.map(m => m.id === aiId ? { ...m, loading: false } : m))
        },
        (err) => {
          setIsStreaming(false)
          setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: `Error: ${err}`, loading: false } : m))
        }
      )
    } else {
      // Non‑streaming fallback for unconfigured providers
      try {
        const { data } = await chatApi.message(history, getContext(), false)
        const aiId = aiMsg.id
        setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: data.response || '(no response)', loading: false } : m))
      } catch (e: any) {
        const aiId = aiMsg.id
        const errMsg = e?.response?.data?.detail || 'Request failed'
        setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: errMsg, loading: false } : m))
      } finally {
        setIsStreaming(false)
      }
    }
  }

  const testConnection = async () => {
    setStatusLoading(true)
    try {
      const { data } = await chatApi.test()
      setStatus((prev: any) => ({ ...prev, ...data, configured: data.success }))
      if (data.success) toast.success('LLM provider connected successfully')
      else toast.error('Connection test failed: ' + (data.reason || 'Unknown'))
    } catch {
      toast.error('Test request failed')
    } finally { setStatusLoading(false) }
  }

  const clearConversation = () => {
    if (isStreaming && abortRef.current) { abortRef.current.abort(); setIsStreaming(false) }
    setMessages([])
    toast.success('Conversation cleared')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="app-shell">
      <div className="copilot-layout" style={{ marginTop: 'var(--nav-height)' }}>
        {/* Sidebar */}
        <aside className="copilot-sidebar">
          <div className="copilot-bg" style={{ backgroundImage: "url('/copilot_bg.png')" }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{
                width: 40, height: 40,
                background: 'linear-gradient(135deg, var(--amber), #E09B0F)',
                borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Satellite size={20} style={{ color: '#000' }} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>AI Copilot</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>TerraPulse Scientific Assistant</div>
              </div>
            </div>

            {/* Provider status */}
            <div style={{
              padding: '12px 14px',
              borderRadius: 10,
              border: `1px solid ${status?.configured ? 'rgba(124,231,165,0.3)' : 'var(--border-subtle)'}`,
              background: status?.configured ? 'var(--sci-green-dim)' : 'var(--deep-space)',
              marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                {status?.configured
                  ? <CheckCircle size={14} style={{ color: 'var(--sci-green)' }} />
                  : <AlertCircle size={14} style={{ color: 'var(--amber)' }} />}
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                  {status?.configured ? 'Provider Connected' : 'Provider Not Configured'}
                </span>
              </div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {status?.message || 'Checking…'}
              </p>
              {status?.model && (
                <div style={{ fontSize: '0.72rem', color: 'var(--cyan)', marginTop: 4 }}>
                  Model: {status.model}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={testConnection} disabled={statusLoading}>
                {statusLoading
                  ? <div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                  : <RefreshCw size={12} />}
                {' '}Test Connection
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={clearConversation} style={{ color: 'var(--coral)' }}>
                <Trash2 size={12} /> Clear Conversation
              </button>
            </div>

            {/* Context */}
            {region && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  Active Context
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  <div>📍 [{region.min_lat}°, {region.max_lat}°] × [{region.min_lon}°, {region.max_lon}°]</div>
                  <div>📅 {dateStart} → {dateEnd}</div>
                  <div>📊 {variable} · QA ≤{qualityFilter}</div>
                </div>
              </div>
            )}

            {/* Starter questions */}
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Example Questions
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  'What does NDVI measure and why is it useful?',
                  'How should I interpret Pixel Reliability values?',
                  'What could cause low NDVI values in this region?',
                  'Explain the difference between NDVI and EVI.',
                ].map((q) => (
                  <button key={q}
                    className="btn btn-ghost btn-sm"
                    style={{ justifyContent: 'flex-start', textAlign: 'left', fontSize: '0.75rem', whiteSpace: 'normal', lineHeight: 1.4 }}
                    onClick={() => { setInput(q) }}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Chat area */}
        <div className="copilot-chat">
          {/* Messages */}
          <div className="copilot-messages">
            {messages.length === 0 && (
              <div className="copilot-welcome">
                <div style={{
                  width: 64, height: 64,
                  background: 'linear-gradient(135deg, var(--amber), #E09B0F)',
                  borderRadius: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 16,
                }}>
                  <Satellite size={30} style={{ color: '#000' }} />
                </div>
                <h3>TerraPulse AI Copilot</h3>
                <p>Scientific assistant for NASA MODIS data, NDVI analysis, and Earth observation interpretation.</p>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-disabled)', marginTop: 8 }}>
                  {status?.configured
                    ? 'Powered by ' + (status.model || 'OpenAI')
                    : 'Demo mode — configure OPENAI_API_KEY in backend .env to enable real responses'}
                </p>
              </div>
            )}

            <AnimatePresence>
              {messages.map(msg => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={msg.role === 'user' ? 'msg-user' : 'msg-ai'}
                >
                  {msg.role === 'assistant' && (
                    <div className="msg-avatar">
                      <Satellite size={14} />
                    </div>
                  )}
                  <div className={msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}>
                    {msg.loading
                      ? <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 0' }}>
                          <div className="typing-dot" />
                          <div className="typing-dot" style={{ animationDelay: '0.15s' }} />
                          <div className="typing-dot" style={{ animationDelay: '0.3s' }} />
                        </div>
                      : msg.role === 'assistant'
                        ? <FormattedScientificText content={msg.content} />
                        : <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.content}</div>
                    }
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="copilot-input-area">
            <div className="copilot-input-box">
              <textarea
                ref={textAreaRef}
                className="copilot-textarea"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={status?.configured ? 'Ask about NDVI, EVI, data quality, or your selected region…' : 'Ask a question (demo mode)…'}
                rows={1}
                disabled={isStreaming}
              />
              <button
                className="btn btn-primary copilot-send"
                onClick={sendMessage}
                disabled={!input.trim() || isStreaming}
              >
                {isStreaming
                  ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  : <Send size={16} />}
              </button>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-disabled)', textAlign: 'center', marginTop: 6 }}>
              Press Enter to send · Shift+Enter for newline · The AI Copilot does not invent data or model results
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .copilot-layout { display: flex; height: calc(100vh - var(--nav-height)); overflow: hidden; }
        .copilot-sidebar { width: 280px; flex-shrink: 0; padding: 24px 20px; overflow-y: auto; border-right: 1px solid var(--border-subtle); position: relative; background: var(--glass-bg-heavy); backdrop-filter: blur(20px); }
        .copilot-bg { position: absolute; inset: 0; background-size: cover; background-position: center; filter: brightness(0.12) saturate(1.2); z-index: 0; }
        .copilot-chat { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .copilot-messages { flex: 1; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 16px; }
        .copilot-welcome { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; color: var(--text-secondary); padding: 40px; }
        .copilot-welcome h3 { margin-bottom: 8px; }
        .msg-user { display: flex; justify-content: flex-end; }
        .msg-ai { display: flex; align-items: flex-start; gap: 10; }
        .msg-avatar { width: 28px; height: 28px; background: linear-gradient(135deg, var(--amber), #E09B0F); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #000; flex-shrink: 0; }
        .copilot-input-area { padding: 16px 24px; border-top: 1px solid var(--border-subtle); background: var(--glass-bg-heavy); backdrop-filter: blur(20px); }
        .copilot-input-box { display: flex; gap: 10; align-items: flex-end; }
        .copilot-textarea { flex: 1; background: var(--deep-space); border: 1px solid var(--border-blue); border-radius: var(--radius-md); color: var(--text-primary); font-family: 'Inter', sans-serif; font-size: 0.9rem; padding: 12px 16px; resize: none; outline: none; max-height: 200px; overflow-y: auto; line-height: 1.5; transition: border-color var(--transition-fast); }
        .copilot-textarea:focus { border-color: var(--amber); box-shadow: 0 0 0 3px rgba(255,203,116,0.15); }
        .copilot-send { padding: 12px 16px; align-self: flex-end; }
        .typing-dot { width: 7px; height: 7px; background: var(--text-muted); border-radius: 50%; animation: typing 1s ease-in-out infinite; }
        @keyframes typing { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-6px); opacity: 1; } }
      `}</style>
    </div>
  )
}
