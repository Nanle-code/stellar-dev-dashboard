/**
 * CursorOverlay
 *
 * Displays real-time cursor positions from other users/tabs.
 */

import { usePresence } from '../../hooks/usePresence'
import { useEffect, useState } from 'react'

export function CursorOverlay({ accountId }) {
  const { users, getUsersForAccount } = usePresence()
  const [containerRef, setContainerRef] = useState(null)

  const relevantUsers = getUsersForAccount(accountId || '')

  if (relevantUsers.length === 0) return null

  return (
    <div ref={setContainerRef} className="cursor-overlay">
      {relevantUsers.map((user) =>
        user.cursor ? (
          <RemoteCursor key={user.tabId} user={user} container={containerRef} />
        ) : null
      )}
    </div>
  )
}

function RemoteCursor({ user, container }) {
  const [position, setPosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (!user.cursor || !container) return

    // Convert relative cursor position to absolute
    const rect = container.getBoundingClientRect()
    setPosition({
      x: user.cursor.x,
      y: user.cursor.y,
    })
  }, [user.cursor, container])

  const userColor = getUserColor(user.id)

  return (
    <div
      className="remote-cursor"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        '--cursor-color': userColor,
      }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M5 2L15 12L10 13L13 18L11 19L8 14L5 17V2Z"
          fill={userColor}
          stroke="white"
          strokeWidth="1"
        />
      </svg>
      <span className="remote-cursor-label">{user.id.slice(0, 4)}</span>
    </div>
  )
}

function getUserColor(userId) {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ]
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return colors[hash % colors.length]
}
