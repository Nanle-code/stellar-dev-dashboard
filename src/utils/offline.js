/**
 * Offline detection and sync utilities
 * Handles offline/online state transitions and queues requests for sync
 */

let listeners = [];
let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
let pendingRequests = [];

/**
 * Initialize offline detection
 */
export const initOfflineDetection = () => {
  if (typeof window === 'undefined') return;

  window.addEventListener('online', () => {
    isOnline = true;
    notifyListeners(true);
    processPendingRequests();
  });

  window.addEventListener('offline', () => {
    isOnline = false;
    notifyListeners(false);
  });
};

/**
 * Check if currently online
 */
export const getOnlineStatus = () => isOnline;

/**
 * Subscribe to online/offline changes
 */
export const subscribeToOnlineStatus = (callback) => {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter(l => l !== callback);
  };
};

/**
 * Notify all listeners of status change
 */
function notifyListeners(online) {
  listeners.forEach(cb => cb(online));
}

/**
 * Queue a request for when going back online
 */
export const queueRequest = (id, fn, priority = 0) => {
  pendingRequests.push({
    id,
    fn,
    priority,
    timestamp: Date.now()
  });

  // Sort by priority (higher first) then timestamp
  pendingRequests.sort((a, b) => {
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    return a.timestamp - b.timestamp;
  });
};

/**
 * Cancel a queued request
 */
export const cancelQueuedRequest = (id) => {
  pendingRequests = pendingRequests.filter(r => r.id !== id);
};

/**
 * Get pending requests
 */
export const getPendingRequests = () => [...pendingRequests];

/**
 * Process all pending requests
 */
async function processPendingRequests() {
  const requests = [...pendingRequests];
  pendingRequests = [];

  for (const request of requests) {
    try {
      await request.fn();
    } catch (error) {
      // Re-queue failed request with exponential backoff
      console.error(`Failed to process request ${request.id}:`, error);
      queueRequest(request.id, request.fn, Math.max(0, request.priority - 1));
    }
  }
}

// Initialize on import
initOfflineDetection();
