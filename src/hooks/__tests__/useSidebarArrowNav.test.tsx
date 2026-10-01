import React, { useRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useSidebarArrowNav } from '../useSidebarArrowNav';

afterEach(() => {
  cleanup();
});

function NavigationHarness() {
  const navRef = useRef<HTMLElement>(null);
  useSidebarArrowNav(navRef);

  return (
    <nav ref={navRef} aria-label="Dashboard sections">
      <button data-testid="workspace">Explore</button>
      <ul hidden>
        <li><button data-testid="collapsed-route">Hidden route</button></li>
      </ul>
      <button data-testid="next-workspace">Build</button>
    </nav>
  );
}

describe('useSidebarArrowNav', () => {
  it('moves focus to the next visible control and skips collapsed routes', () => {
    render(<NavigationHarness />);
    const workspace = screen.getByTestId('workspace');
    const nextWorkspace = screen.getByTestId('next-workspace');

    workspace.focus();
    fireEvent.keyDown(workspace, { key: 'ArrowDown' });

    expect(document.activeElement).toBe(nextWorkspace);
  });
});
