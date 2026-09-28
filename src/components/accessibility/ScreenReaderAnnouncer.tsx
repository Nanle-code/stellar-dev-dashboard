import React, { useState, useEffect } from 'react';
import { subscribeToAnnouncements } from '../../utils/accessibility';
import '../../styles/accessibility.css';

const ScreenReaderAnnouncer: React.FC = () => {
  const [message, setMessage] = useState('');

  useEffect(() => {
    const unsubscribe = subscribeToAnnouncements((newMessage: string) => {
      setMessage(newMessage);
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
