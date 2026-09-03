import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { subscribeToInstallPrompt, promptInstall } from '../utils/offline.js';

const PWAInstallBanner = () => {
  const [isInstallable, setIsInstallable] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToInstallPrompt((available) => {
      setIsInstallable(available);
      if (available) setIsVisible(true);
    });
    return unsubscribe;
  }, []);

  const handleInstall = async () => {
    await promptInstall();
    setIsVisible(false);
  };

  if (!isInstallable || !isVisible) return null;

  return (
    <div className="fixed top-4 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-[480px] bg-indigo-600 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between border border-white/10 z-[60] animate-in fade-in slide-in-from-top-5 duration-300">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center">
          <Download size={20} />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-sm">Install Stellar Dashboard</h4>
          <p className="text-xs text-indigo-100 italic">Access your dashboard faster from your home screen.</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <button 
          onClick={handleInstall}
          className="px-4 py-2 bg-white text-indigo-600 font-bold text-xs rounded-lg hover:bg-indigo-50 transition-colors shadow-sm"
        >
          Install
        </button>
        <button 
          onClick={() => setIsVisible(false)}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};

export default PWAInstallBanner;
