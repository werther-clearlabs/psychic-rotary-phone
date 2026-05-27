// src/screens/genomics/components/report-chat-panel.tsx
import { useState, useRef, useEffect, useCallback } from 'react'
import type { Case, Report } from '../../../server/genomics/types'

interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
}

function buildContextPrimer(c: Case, report: Report | null): string {
  const parts = [
    `You are assisting with clinical genomics report review for patient: ${c.patient_name ?? 'unknown'}.`,
    `Diagnosis: ${c.diagnosis ?? 'unknown'}.`,
    c.stage ? `Stage: ${c.stage}.` : '',
    c.ehr_summary ? `EHR summary: ${c.ehr_summary}` : '',
    report ? `A ${report.status} report exists with ${Object.keys(report.sections as object).length} sections.` : '',
    'You can help review variants, suggest edits, find clinical trials, or answer clinical genomics questions.',
  ]
  return parts.filter(Boolean).join(' ')
}

interface Props {
  caseId: string
  caseData: Case
  report: Report | null
}

export function ReportChatPanel({ caseId, caseData, report }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [contextSent, setContextSent] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sessionKey = `genomics-case-${caseId}`

  const appendMessage = useCallback((msg: Message) => {
    setMessages((prev) => {
      const existing = prev.find((m) => m.id === msg.id)
      if (existing) {
        return prev.map((m) => m.id === msg.id ? { ...m, text: m.text + msg.text } : m)
      }
      return [...prev, msg]
    })
  }, [])

  const setMessageText = useCallback((id: string, role: 'user' | 'assistant', text: string) => {
    setMessages((prev) => {
      const existing = prev.find((m) => m.id === id)
      if (existing) {
        return prev.map((m) => m.id === id ? { ...m, text } : m)
      }
      return [...prev, { id, role, text }]
    })
  }, [])

  // Send context primer on first mount
  useEffect(() => {
    if (contextSent) return
    setContextSent(true)
    const primer = buildContextPrimer(caseData, report)
    void sendToStream(primer, 'system-primer', true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  async function sendToStream(text: string, msgId: string, silent = false): Promise<void> {
    if (!silent) {
      appendMessage({ id: msgId, role: 'user', text })
    }

    const assistantId = `${msgId}-reply`
    setMessageText(assistantId, 'assistant', '')

    try {
      const res = await fetch('/api/send-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionKey, friendlyId: sessionKey }),
        credentials: 'same-origin',
      })
      if (!res.ok || !res.body) {
        setMessageText(assistantId, 'assistant', 'Error: could not reach Hermes.')
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let currentEvent = ''

      // SSE frames: `event: <name>\ndata: <json>\n\n`. The named-event line
      // and data line arrive on consecutive lines; track currentEvent until a
      // data line is consumed (or the frame ends with a blank line).
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const rawLine of lines) {
          const line = rawLine.trimEnd()
          if (!line) {
            // blank line = end of frame
            currentEvent = ''
            continue
          }
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim()
            continue
          }
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6)
          if (!raw || raw === '[DONE]') continue
          let evt: Record<string, unknown>
          try {
            evt = JSON.parse(raw) as Record<string, unknown>
          } catch {
            continue // heartbeats / malformed lines
          }

          if (currentEvent === 'chunk' && typeof evt.text === 'string') {
            // `text` is the FULL accumulated text so far — replace, do not append.
            setMessageText(assistantId, 'assistant', evt.text)
          } else if (currentEvent === 'error') {
            const message = typeof evt.message === 'string'
              ? evt.message
              : typeof evt.error === 'string'
                ? evt.error
                : 'Unknown error'
            setMessageText(assistantId, 'assistant', `Error: ${message}`)
          }
          // started / done / tool / thinking / hb_signal / heartbeat — ignored
        }
      }
    } catch (err) {
      setMessageText(
        assistantId,
        'assistant',
        `Error: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setSending(true)
    const id = crypto.randomUUID()
    await sendToStream(text, id)
    setSending(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, sending])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const visibleMessages = messages.filter((m) => {
    // Hide the system primer user message; show its response
    return !(m.role === 'user' && m.id === 'system-primer')
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff', borderLeft: '1px solid var(--gray-200)', fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--gray-200)', background: '#fafafa' }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.44px', color: 'var(--gray-700)' }}>
          AI Assistant · {caseData.patient_name ?? caseId}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visibleMessages.length === 0 && (
          <p style={{ color: 'var(--gray-400)', fontSize: 12, fontStyle: 'italic', textAlign: 'center', marginTop: 24 }}>
            Loading case context…
          </p>
        )}
        {visibleMessages.map((msg) => (
          <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '85%', padding: '8px 12px', borderRadius: msg.role === 'user' ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
              background: msg.role === 'user' ? 'var(--brand-500)' : 'var(--gray-100)',
              color: msg.role === 'user' ? '#fff' : 'var(--gray-900)',
              fontSize: 13, lineHeight: '20px', whiteSpace: 'pre-wrap',
            }}>
              {msg.text || <span style={{ opacity: 0.5 }}>…</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid var(--gray-200)', display: 'flex', gap: 8, background: '#fafafa' }}>
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about variants, trials, or ask AI to update a section…"
          disabled={sending}
          style={{
            flex: 1, resize: 'none', border: '1px solid var(--gray-300)', borderRadius: 4,
            padding: '8px 10px', fontSize: 12, lineHeight: '18px', color: 'var(--gray-900)',
            fontFamily: 'inherit', background: sending ? 'var(--gray-100)' : '#fff',
          }}
        />
        <button
          onClick={() => void handleSend()}
          disabled={!input.trim() || sending}
          style={{
            padding: '0 14px', borderRadius: 4, fontSize: 11, fontWeight: 700,
            background: !input.trim() || sending ? 'var(--gray-300)' : 'var(--brand-500)',
            color: '#fff', border: 'none',
            cursor: !input.trim() || sending ? 'not-allowed' : 'pointer',
            alignSelf: 'flex-end', height: 36,
          }}
        >
          {sending ? '…' : 'Send'}
        </button>
      </div>
    </div>
  )
}
