import React, { useState, useEffect } from 'react';
import { subscribeToAnnouncements } from '../../utils/accessibility';
import '../../styles/accessibility.css';

/**
 * An invisible component that manages an aria-live region to read dynamic messages
 * to screen reader users (e.g., page load successful, form errors).
 */
const ScreenReaderAnnouncer = () => {
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Listen for announcements
    const unsubscribe = subscribeToAnnouncements((newMessage) => {
      setMessage(newMessage);
      
      // Clear message after a short delay so the same message can be announced multiple times
      setTimeout(() => {
        setMessage('');
      }, 500);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div 
      className="sr-only" 
      role="status" 
      aria-live="polite" 
      aria-atomic="true"
    >
      {message}
    </div>
  );
};

export default ScreenReaderAnnouncer;
