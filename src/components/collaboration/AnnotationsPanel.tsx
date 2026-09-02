/**
 * AnnotationsPanel
 *
 * Displays and manages collaborative annotations for accounts, transactions, and contracts.
 */

import { useAnnotations } from '../../hooks/usePresence'
import { MessageSquare, X, Check, Trash2 } from 'lucide-react'

export function AnnotationsPanel({ type, targetId, onClose }) {
  const {
    annotations,
    isInitialized,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    resolveAnnotation,
    getAnnotationsForTarget,
  } = useAnnotations()

  const [newComment, setNewComment] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  const relevantAnnotations = getAnnotationsForTarget(type, targetId)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!newComment.trim()) return

    setIsAdding(true)
    try {
      // Generate a simple author ID from presence manager
      const authorId = `user-${Date.now()}`
      await addAnnotation(type, targetId, newComment, authorId, 'You')
      setNewComment('')
    } catch (err) {
      console.error('Failed to add annotation:', err)
    } finally {
      setIsAdding(false)
    }
  }

  const handleResolve = async (id) => {
    try {
      await resolveAnnotation(id)
    } catch (err) {
      console.error('Failed to resolve annotation:', err)
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteAnnotation(id)
    } catch (err) {
      console.error('Failed to delete annotation:', err)
    }
  }

  if (!isInitialized) {
    return (
      <div className="annotations-panel loading">
        <p className="text-sm text-gray-500">Loading annotations...</p>
      </div>
    )
  }

  return (
    <div className="annotations-panel">
      <div className="annotations-panel-header">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          <span className="text-sm font-medium">
            Annotations ({relevantAnnotations.length})
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="annotations-panel-form">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          className="annotations-panel-input"
          rows={2}
        />
        <button
          type="submit"
          disabled={!newComment.trim() || isAdding}
          className="annotations-panel-submit"
        >
          {isAdding ? 'Adding...' : 'Add Comment'}
        </button>
      </form>

      <div className="annotations-panel-list">
        {relevantAnnotations.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            No annotations yet. Be the first to comment!
          </p>
        ) : (
          relevantAnnotations.map((annotation) => (
            <AnnotationItem
              key={annotation.id}
              annotation={annotation}
              onResolve={handleResolve}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </div>
  )
}

function AnnotationItem({ annotation, onResolve, onDelete }) {
  const formatDate = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div className={`annotation-item ${annotation.resolved ? 'resolved' : ''}`}>
      <div className="annotation-item-header">
        <div className="annotation-item-author">
          <span className="annotation-item-avatar">
            {annotation.authorName?.slice(0, 2).toUpperCase() || '??'}
          </span>
          <span className="annotation-item-name">{annotation.authorName || 'Anonymous'}</span>
        </div>
        <span className="annotation-item-time">{formatDate(annotation.createdAt)}</span>
      </div>
      <p className="annotation-item-content">{annotation.content}</p>
      <div className="annotation-item-actions">
        {!annotation.resolved && (
          <button
            onClick={() => onResolve(annotation.id)}
            className="annotation-item-action resolve"
            title="Mark as resolved"
          >
            <Check className="w-3 h-3" />
            Resolve
          </button>
        )}
        <button
          onClick={() => onDelete(annotation.id)}
          className="annotation-item-action delete"
          title="Delete"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}
