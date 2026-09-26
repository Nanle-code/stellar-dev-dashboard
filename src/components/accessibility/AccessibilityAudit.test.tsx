import React from 'react';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { BrowserRouter } from 'react-router-dom';
import AccessibilityProvider from './AccessibilityProvider';

expect.extend(toHaveNoViolations);

const Wrapper = ({ children }) => (
  <BrowserRouter>
    <AccessibilityProvider>{children}</AccessibilityProvider>
  </BrowserRouter>
);

describe('Accessibility Audit', () => {
  it('AccessibilityProvider has no axe violations', async () => {
    const { container } = render(
      <Wrapper>
        <main id="main-content" tabIndex={-1}>
          <h1>Test Page</h1>
          <button aria-label="Test button">Click</button>
          <a href="/test">Test link</a>
          <input aria-label="Test input" type="text" />
        </main>
      </Wrapper>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
