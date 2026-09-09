import React from 'react';
import { setFocus } from '../../utils/accessibility';

export default function SkipLink() {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setFocus('main-content');
  };

  return (
    <a href="#main-content" className="skip-link" onClick={handleClick}>
      Skip to main content
    </a>
  );
}
