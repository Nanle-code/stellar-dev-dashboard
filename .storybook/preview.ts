import React from 'react';
import type { Preview } from '@storybook/react';
import { MINIMAL_VIEWPORTS } from '@storybook/addon-viewport';
import '../src/styles/globals.css';
import '../src/styles/accessibility.css';

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0f1820' },
        { name: 'light', value: '#f5f7fa' },
      ],
    },
    viewport: {
      viewports: {
        ...MINIMAL_VIEWPORTS,
        mobile375: { name: 'Mobile (375px)', styles: { width: '375px', height: '667px' } },
        mobile390: { name: 'iPhone 14', styles: { width: '390px', height: '844px' } },
        tablet768: { name: 'Tablet (768px)', styles: { width: '768px', height: '1024px' } },
        desktop1280: { name: 'Desktop (1280px)', styles: { width: '1280px', height: '800px' } },
      },
      defaultViewport: 'desktop1280',
    },
    a11y: {
      config: {
        rules: [
          { id: 'color-contrast', enabled: true },
          { id: 'landmark-one-main', enabled: false },
        ],
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme || 'dark';
      return React.createElement(
        'div',
        {
          'data-theme': theme,
          style: {
            padding: '2rem',
            background: 'var(--bg-base)',
            minHeight: '100vh',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-sans)',
          },
        },
        React.createElement(Story)
      );
    },
  ],
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Global theme for components',
      defaultValue: 'dark',
      toolbar: {
        icon: 'circlehollow',
        items: [
          { value: 'light', icon: 'sun', title: 'Light' },
          { value: 'dark', icon: 'moon', title: 'Dark' },
        ],
        showName: true,
        dynamicTitle: true,
      },
    },
  },
};

export default preview;
