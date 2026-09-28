/**
 * PresenceIndicator
 *
 * Displays real-time presence information showing which users/tabs
 * are currently viewing the same content.
 */

import { usePresence } from '../../hooks/usePresence'
import { Users } from 'lucide-react'

export function PresenceIndicator({ accountId }) {
  const { users, getUserCount, getUsersForAccount } = usePresence()

  const relevantUsers = accountId ? getUsersForAccount(accountId) : users
  const userCount = relevantUsers.length

  if (userCount === 0) return null

  return (
    <div className="presence-indicator">
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Users className="w-4 h-4" />
        <span>{userCount} {userCount === 1 ? 'viewer' : 'viewers'}</span>
      </div>
    </div>
  )
}
