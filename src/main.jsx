import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/globals.css';
import { registerServiceWorker, captureInstallPrompt } from './utils/offline.js';

// ── PWA bootstrap ────────────────────────────────────────────────────────────
// Capture the beforeinstallprompt event BEFORE the first render so it isn't
// missed. Registration runs after mount so it doesn't block the first paint.
captureInstallPrompt();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register the service worker after the app has mounted.
// Using window.load ensures the SW registration doesn't compete with initial
// resource fetching and slowing the first paint.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    registerServiceWorker();
  });
}