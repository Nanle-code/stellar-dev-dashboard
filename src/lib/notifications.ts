// src/lib/notifications.js
export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  INFO: 'info',
  WARNING: 'warning',
  TX_CONFIRM: 'tx_confirm',
  ACCOUNT_CHANGE: 'account_change',
  NETWORK_EVENT: 'network_event',
  PRICE_ALERT: 'price_alert'
};

export const NOTIFICATION_DEFAULT_TIMEOUT = 5000;

export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
};

let audioCtx = null;

export const playSound = (type) => {
  if (typeof window === 'undefined') return;
  
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    let frequency = 440;
    let typeWave = 'sine';
    let duration = 0.1;
    
    switch (type) {
      case 'success':
      case 'tx_confirm':
        frequency = 880;
        typeWave = 'sine';
        duration = 0.15;
        break;
      case 'error':
        frequency = 150;
        typeWave = 'sawtooth';
        duration = 0.3;
        break;
      case 'warning':
      case 'price_alert':
        frequency = 600;
        typeWave = 'square';
        duration = 0.2;
        break;
      case 'info':
      case 'account_change':
      case 'network_event':
      default:
        frequency = 440;
        typeWave = 'sine';
        duration = 0.1;
        break;
    }
    
    oscillator.type = typeWave;
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
  } catch (e) {
    console.error('Audio play failed', e);
  }
};
