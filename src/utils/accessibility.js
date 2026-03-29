// src/utils/accessibility.js
let listeners = [];

/**
 * Trigger an announcement via the ScreenReaderAnnouncer component.
 * @param {string} message The text to be read by the screen reader.
 */
export const announceToScreenReader = (message) => {
  listeners.forEach(listener => listener(message));
};

/**
 * Subscribe a component to announcements.
 * Use internally by the ScreenReaderAnnouncer.
 * @param {function} listener Callback to execute on new message.
 * @returns {function} Unsubscribe function.
 */
export const subscribeToAnnouncements = (listener) => {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
};

/**
 * Set focus to a specific element safely.
 * Useful for focusing main content areas after routing, or returning focus
 * to a trigger button after a modal closes.
 * @param {string|HTMLElement} elementOrId Ensure it has tabindex="-1" or is natively focusable.
 */
export const setFocus = (elementOrId) => {
  if (!elementOrId) return;

  const el =
    typeof elementOrId === 'string'
      ? document.getElementById(elementOrId)
      : elementOrId;
      
  if (el) {
    el.focus();
  }
};
