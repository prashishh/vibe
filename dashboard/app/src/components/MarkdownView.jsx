import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'

function MarkdownView({ content, compact = false }) {
  if (!content || content.trim() === '') {
    return (
      <p className="text-text-muted text-sm italic">No content available.</p>
    )
  }

  return (
    <div className={`markdown-body${compact ? ' markdown-compact' : ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
        {content}
      </ReactMarkdown>
    </div>
  )
}

export default MarkdownView
