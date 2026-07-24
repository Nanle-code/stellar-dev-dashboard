/**
 * PresenceList
 *
 * Shows a detailed list of active users/tabs with their current state.
 */

import { usePresence } from '../../hooks/usePresence'
import { Users, Eye, MousePointer2 } from 'lucide-react'

export function PresenceList({ accountId }) {
  const { users, getUsersForAccount } = usePresence()

  const relevantUsers = accountId ? getUsersForAccount(accountId) : users

  if (relevantUsers.length === 0) {
    return (
      <div className="presence-list empty">
        <Users className="w-8 h-8 text-gray-600 mx-auto mb-2" />
        <p className="text-sm text-gray-500 text-center">No other viewers</p>
      </div>
    )
  }

  return (
    <div className="presence-list">
      <div className="presence-list-header">
        <Users className="w-4 h-4" />
        <span className="text-sm font-medium">Active Viewers ({relevantUsers.length})</span>
      </div>
      <div className="presence-list-items">
        {relevantUsers.map((user) => (
          <PresenceListItem key={user.tabId} user={user} />
        ))}
      </div>
    </div>
  )
}

function PresenceListItem({ user }) {
  const formatLastSeen = (timestamp) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return 'Active now'
    if (seconds < 120) return '1 min ago'
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
    return `${Math.floor(seconds / 3600)}h ago`
  }

  return (
    <div className="presence-list-item">
      <div className="presence-list-item-header">
        <div className="presence-avatar">
          <span className="presence-avatar-text">
            {user.id.slice(-2).toUpperCase()}
          </span>
        </div>
        <div className="presence-info">
          <div className="presence-user-id">{user.id.slice(0, 8)}...</div>
          <div className="presence-status">{formatLastSeen(user.lastSeen)}</div>
        </div>
      </div>
      {user.activeTab && (
        <div className="presence-detail">
          <Eye className="w-3 h-3" />
          <span className="text-xs text-gray-400">Viewing: {user.activeTab}</span>
        </div>
      )}
      {user.selection && (
        <div className="presence-detail">
          <MousePointer2 className="w-3 h-3" />
          <span className="text-xs text-gray-400">
            Selected: {user.selection.type} ({user.selection.id.slice(0, 8)}...)
          </span>
        </div>
      )}
    </div>
  )
}
