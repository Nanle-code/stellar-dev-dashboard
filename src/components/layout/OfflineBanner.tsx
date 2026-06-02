/**
 * OfflineBanner — shown when navigator.onLine is false.
 *
 * Displays:
 *  - "You're offline" notice with cached-data reassurance
 *  - Count of queued write operations waiting to replay
 *  - Dismisses automatically when back online
 */

import React, { useEffect, useState, type CSSProperties } from 'react'
import { WifiOff, X, AlertTriangle } from 'lucide-react'
import { subscribeToOnlineStatus, getOnlineStatus, getPendingCount } from '../../utils/offline'

export default function OfflineBanner() {
  const [offline, setOffline]       = useState<boolean>(!getOnlineStatus())
  const [queueSize, setQueueSize]   = useState<number>(0)
  const [dismissed, setDismissed]   = useState<boolean>(false)

  // Track online / offline transitions
  useEffect(() => {
    const unsub = subscribeToOnlineStatus((online: boolean) => {
      setOffline(!online)
      if (online) {
        setDismissed(false)  // re-show if we go offline again later
      }
    })
    return unsub
  }, [])

  // Track queued operation count
  useEffect(() => {
    // Prime from IDB (in case we resumed after reload)
    const interval = setInterval(() => {
      getPendingCount().then(setQueueSize).catch(() => {})
    }, 5000);
    getPendingCount().then(setQueueSize).catch(() => {})
    return () => clearInterval(interval);
  }, []);

  if (!offline || dismissed) return null

  return (
    <div 
      role="status" 
      aria-live="polite" 
      className="fixed bottom-6 left-6 right-6 md:left-auto md:w-[420px] bg-[#1e2327]/95 backdrop-blur-xl border border-red-500/20 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-2xl p-4 flex items-start gap-4 z-[2000] animate-in fade-in slide-in-from-bottom-8 duration-500"
    >
      <div className="bg-red-500/10 p-2.5 rounded-xl text-red-500">
        <WifiOff size={22} />
      </div>
      
      <div className="flex-1 min-w-0">
        <h4 className="text-white font-bold text-sm tracking-tight">Offline Mode Active</h4>
        <p className="text-gray-400 text-xs mt-1 leading-relaxed">
          Showing cached data. Modifications will be queued and replayed automatically when you're back online.
        </p>
        
        {queueSize > 0 && (
          <div className="flex items-center gap-2 mt-3 bg-red-500/10 border border-red-500/10 rounded-lg px-2.5 py-1.5 w-fit">
            <AlertTriangle size={12} className="text-red-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">
              {queueSize} Operation{queueSize !== 1 ? 's' : ''} Pending
            </span>
          </div>
        )}
      </div>

      <button
        onClick={() => setDismissed(true)}
        className="text-gray-500 hover:text-white transition-colors p-1"
      >
        <X size={18} />
      </button>
    </div>
  )
}
