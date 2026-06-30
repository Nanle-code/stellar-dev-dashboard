import React from 'react';
import CopyableValue from '../src/components/dashboard/CopyableValue';

export default {
  title: 'Dashboard/CopyableValue',
  component: CopyableValue,
};

export const Default = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
    <div>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Public Key:</p>
      <CopyableValue value="GABC..." />
    </div>
    <div>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>With custom children:</p>
      <CopyableValue value="GABC...">Short Address</CopyableValue>
    </div>
    <div>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>With custom styling:</p>
      <CopyableValue 
        value="0123456789abcdef" 
        textStyle={{ color: 'var(--cyan)', fontFamily: 'var(--font-mono)' }} 
      />
    </div>
  </div>
);
