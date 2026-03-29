import React from 'react';
import '../../styles/accessibility.css';

/**
 * Provides a 'Skip to main content' link that is only visible when focused.
 * Helpful for keyboard users to bypass long navigation menus.
 * 
 * @param {Object} props
 * @param {string} props.targetId The id of the main content container to skip to.
 */
const KeyboardNavigation = ({ targetId = 'main-content' }) => {
  return (
    <a 
      href={`#${targetId}`} 
      className="skip-link sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:p-4 focus:bg-white focus:text-black"
    >
      Skip to main content
    </a>
  );
};

export default KeyboardNavigation;
