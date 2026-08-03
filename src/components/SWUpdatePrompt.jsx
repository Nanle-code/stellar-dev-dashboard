import React, { useState, useEffect } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { subscribeToSWUpdates, applySWUpdate } from '../utils/offline';

export default function SWUpdatePrompt() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToSWUpdates((available) => {
      setUpdateAvailable(available);
      if (available) setDismissed(false);
    });
    return unsubscribe;
  }, []);

  if (!updateAvailable || dismissed) return null;

  const handleUpdate = async () => {
    setDismissed(true);
    await applySWUpdate();
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 left-6 md:left-auto md:w-[420px] bg-[#1e2327]/95 backdrop-blur-xl border border-cyan-500/20 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-2xl p-4 flex items-start gap-4 z-[2000] animate-in fade-in slide-in-from-bottom-8 duration-500"
    >
      <div className="bg-cyan-500/10 p-2.5 rounded-xl text-cyan-500">
        <RefreshCw size={22} />
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="text-white font-bold text-sm tracking-tight">Update Available</h4>
        <p className="text-gray-400 text-xs mt-1 leading-relaxed">
          A new version of the dashboard is ready. Update now to get the latest features and fixes.
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleUpdate}
          className="px-4 py-2 bg-cyan-500 text-white font-bold text-xs rounded-lg hover:bg-cyan-400 transition-colors shadow-sm"
        >
          Update
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-2 text-gray-500 hover:text-white transition-colors rounded-lg"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
