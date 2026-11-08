import React from 'react'

interface FormattedTextProps {
  content: string
}

/**
 * FormattedScientificText
 * Renders scientific assistant responses with clean typography, styled headings,
 * bullet lists, numbered points, and bold emphasis without exposing raw markdown asterisks or hash marks.
 */
export const FormattedScientificText: React.FC<FormattedTextProps> = ({ content }) => {
  if (!content) return null

  // Split content by paragraphs / lines
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let listBuffer: React.ReactNode[] = []
  let listType: 'ul' | 'ol' | null = null

  const flushList = () => {
    if (listBuffer.length > 0 && listType) {
      if (listType === 'ul') {
        elements.push(
          <ul key={`ul-${elements.length}`} style={{ margin: '8px 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {listBuffer}
          </ul>
        )
      } else {
        elements.push(
          <ol key={`ol-${elements.length}`} style={{ margin: '8px 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {listBuffer}
          </ol>
        )
      }
      listBuffer = []
      listType = null
    }
  }

  // Parse inline bold (**bold** or *italic*) and code (`code`)
  const parseInline = (text: string): React.ReactNode => {
    // Process markdown-like inline styling
    // Handle inline math like $$math$$ or $math$
    const cleanMath = text.replace(/\$\$(.*?)\$\$/g, '$1').replace(/\$(.*?)\$/g, '$1')

    // Split tokens by **bold** or `code`
    const parts = cleanMath.split(/(\*\*.*?\*\*|`.*?`)/g)
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        return (
          <strong key={idx} style={{ color: 'var(--cyan, #38BDF8)', fontWeight: 600 }}>
            {part.slice(2, -2)}
          </strong>
        )
      }
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        return (
          <code
            key={idx}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              padding: '2px 6px',
              borderRadius: 4,
              fontSize: '0.85em',
              fontFamily: 'monospace',
              color: 'var(--sci-green, #4ADE80)',
            }}
          >
            {part.slice(1, -1)}
          </code>
        )
      }
      // If there are stray lone asterisks, clean them up cleanly
      const cleaned = part.replace(/\*/g, '')
      return <span key={idx}>{cleaned}</span>
    })
  }

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim()

    if (!line) {
      flushList()
      return
    }

    // Header 3 or 2 (### or ##)
    if (line.startsWith('### ') || line.startsWith('## ') || line.startsWith('# ')) {
      flushList()
      const title = line.replace(/^#+\s*/, '')
      elements.push(
        <h4
          key={`h-${idx}`}
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--sci-green, #4ADE80)',
            marginTop: elements.length === 0 ? 0 : 14,
            marginBottom: 6,
            letterSpacing: '0.02em',
          }}
        >
          {title}
        </h4>
      )
      return
    }

    // Bullet list item (- or *)
    if (/^[-*]\s+/.test(line)) {
      if (listType !== 'ul') flushList()
      listType = 'ul'
      const itemContent = line.replace(/^[-*]\s+/, '')
      listBuffer.push(
        <li key={`li-${idx}`} style={{ lineHeight: 1.5, color: 'var(--text-secondary, #E2E8F0)' }}>
          {parseInline(itemContent)}
        </li>
      )
      return
    }

    // Numbered list item (1. 2. etc)
    const numMatch = line.match(/^(\d+)\.\s+(.*)/)
    if (numMatch) {
      if (listType !== 'ol') flushList()
      listType = 'ol'
      const itemContent = numMatch[2]
      listBuffer.push(
        <li key={`li-num-${idx}`} style={{ lineHeight: 1.5, color: 'var(--text-secondary, #E2E8F0)' }}>
          {parseInline(itemContent)}
        </li>
      )
      return
    }

    // Standard paragraph or Section header with bold
    flushList()
    // Check if line is a section label like "**Section:**"
    if (line.startsWith('**') && line.endsWith('**') && !line.includes('. ')) {
      elements.push(
        <div
          key={`sec-${idx}`}
          style={{
            fontWeight: 700,
            color: 'var(--amber, #FBBF24)',
            marginTop: 10,
            marginBottom: 4,
            fontSize: '0.92rem',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {line.replace(/\*\*/g, '')}
        </div>
      )
      return
    }

    // Standard block
    elements.push(
      <p
        key={`p-${idx}`}
        style={{
          margin: '6px 0',
          lineHeight: 1.6,
          color: 'var(--text-secondary, #CBD5E1)',
          fontSize: '0.88rem',
        }}
      >
        {parseInline(line)}
      </p>
    )
  })

  flushList()

  return <div className="scientific-response-flow">{elements}</div>
}
