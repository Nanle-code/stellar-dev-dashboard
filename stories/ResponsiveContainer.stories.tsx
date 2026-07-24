import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import ResponsiveContainer, { ResponsiveGrid, ResponsiveFlex } from '../src/components/layout/ResponsiveContainer';

const meta: Meta = {
  title: 'Layout/ResponsiveContainer',
  parameters: {
    docs: {
      description: {
        component: 'Layout utilities that adapt to mobile, tablet, and desktop breakpoints.',
      },
    },
  },
};
export default meta;

const Box = ({ label }: { label: string }) => (
  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px', textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>
    {label}
  </div>
);

export const Container: StoryObj = {
  render: () => (
    <ResponsiveContainer mobileLayout tabletLayout style={{ padding: '8px' }}>
      <Box label="Item 1" />
      <Box label="Item 2" />
      <Box label="Item 3" />
    </ResponsiveContainer>
  ),
};

export const Grid: StoryObj = {
  render: () => (
    <ResponsiveGrid columns={{ mobile: 1, tablet: 2, desktop: 3 }} gap={{ mobile: '12px', tablet: '16px', desktop: '20px' }}>
      {Array.from({ length: 6 }, (_, i) => <Box key={i} label={`Cell ${i + 1}`} />)}
    </ResponsiveGrid>
  ),
};

export const Flex: StoryObj = {
  render: () => (
    <ResponsiveFlex direction={{ mobile: 'column', tablet: 'row', desktop: 'row' }} gap={{ mobile: '12px', tablet: '16px', desktop: '20px' }} align="stretch">
      <Box label="Flex A" />
      <Box label="Flex B" />
      <Box label="Flex C" />
    </ResponsiveFlex>
  ),
};

export const MobileGrid: StoryObj = {
  render: () => (
    <ResponsiveGrid columns={{ mobile: 1, tablet: 2, desktop: 3 }}>
      {Array.from({ length: 4 }, (_, i) => <Box key={i} label={`Item ${i + 1}`} />)}
    </ResponsiveGrid>
  ),
  parameters: { viewport: { defaultViewport: 'mobile375' } },
};

export const TabletGrid: StoryObj = {
  render: () => (
    <ResponsiveGrid columns={{ mobile: 1, tablet: 2, desktop: 3 }}>
      {Array.from({ length: 4 }, (_, i) => <Box key={i} label={`Item ${i + 1}`} />)}
    </ResponsiveGrid>
  ),
  parameters: { viewport: { defaultViewport: 'tablet768' } },
};
