import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/globals.css";
import { initPerformanceMonitoring } from "./lib/performanceMonitoring";

// Initialize performance monitoring
initPerformanceMonitoring();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Register service worker and forward messages to window
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      // forward messages from SW to window-level event
      if (navigator.serviceWorker) {
        navigator.serviceWorker.addEventListener('message', (e) => {
          window.dispatchEvent(new CustomEvent('sw-message', { detail: e.data }));
        });
      }
      // request initial sync registration when coming online
      window.addEventListener('online', () => {
        if (reg && reg.sync) reg.sync.register('sync-queue').catch(() => {});
      });
    } catch (err) {
      // registration failed
    }
  });
}
