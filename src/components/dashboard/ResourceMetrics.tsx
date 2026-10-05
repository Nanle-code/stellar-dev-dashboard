import React, { useEffect, useState } from 'react';
import { NetworkName } from '../../lib/stellar';
import { fetchNetworkLimits, SorobanLimits, DEFAULT_SOROBAN_LIMITS } from '../../lib/sorobanLimits';
import { AlertCircle } from 'lucide-react';

interface ResourceMetricsProps {
  cost: any;
  footprint: any;
  network: NetworkName;
  inclusionFee: number;
}

export default function ResourceMetrics({ cost, footprint, network, inclusionFee }: ResourceMetricsProps) {
  const [limits, setLimits] = useState<SorobanLimits>(DEFAULT_SOROBAN_LIMITS);

  useEffect(() => {
    fetchNetworkLimits(network).then(setLimits);
  }, [network]);

  const cpuInstructions = cost?.cpuInstructions || 0;
  const memoryBytes = cost?.memoryBytes || 0;
  
  // footprint might contain readOnly, readWrite arrays, and events might be present
  // we approximate if exact sizes aren't in cost
  const readEntries = cost?.readEntries || footprint?.readOnly?.length || 0;
  const writeEntries = cost?.writeEntries || footprint?.readWrite?.length || 0;
  const readBytes = cost?.readBytes || 0;
  const writeBytes = cost?.writeBytes || 0;
  const eventsSize = cost?.eventsSize || 0;
  
  const minResourceFee = footprint?.minResourceFee ? parseInt(footprint.minResourceFee, 10) : 0;
  // Approximation for split if not provided by RPC:
  const rentFee = cost?.rentFee || Math.floor(minResourceFee * 0.3); // Rent & events are refundable
  const nonRefundableResourceFee = minResourceFee - rentFee;

  const renderMetric = (label: string, value: number, limit: number, unit = '') => {
    const percentage = limit > 0 ? (value / limit) * 100 : 0;
    const isWarning = percentage >= 80;
    
    return (
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
          <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
          <span style={{ color: isWarning ? 'var(--amber)' : 'var(--text-primary)', fontWeight: isWarning ? 600 : 400 }}>
            {value.toLocaleString()} / {limit.toLocaleString()} {unit} ({percentage.toFixed(1)}%)
          </span>
        </div>
        <div style={{ height: '6px', background: 'var(--bg-elevated)', borderRadius: '3px', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${Math.min(100, Math.max(0, percentage))}%`,
              background: isWarning ? 'var(--amber)' : 'var(--cyan)',
              transition: 'width 0.3s ease'
            }}
          />
        </div>
        {isWarning && (
          <div style={{ fontSize: '11px', color: 'var(--amber)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <AlertCircle size={12} />
            Approaching network limit. <a href="https://developers.stellar.org/docs/smart-contracts/getting-started/optimization" target="_blank" rel="noreferrer" style={{ color: 'var(--cyan)' }}>View optimization docs</a>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
      <h4 style={{ fontSize: '14px', margin: '0 0 16px 0', fontFamily: 'var(--font-display)' }}>Resource Usage & Limits</h4>
      
      {renderMetric('CPU Instructions', cpuInstructions, limits.cpuInstructions)}
      {renderMetric('Memory', memoryBytes, limits.memoryBytes, 'bytes')}
      {renderMetric('Read Entries', readEntries, limits.readEntries)}
      {renderMetric('Write Entries', writeEntries, limits.writeEntries)}
      {renderMetric('Read Bytes', readBytes, limits.readBytes, 'bytes')}
      {renderMetric('Write Bytes', writeBytes, limits.writeBytes, 'bytes')}
      {renderMetric('Events Size', eventsSize, limits.eventsSize, 'bytes')}
      
      <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
        <h5 style={{ fontSize: '13px', margin: '0 0 12px 0' }}>Fee Breakdown (Stroops)</h5>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          <div style={{ background: 'var(--bg-elevated)', padding: '12px', borderRadius: '6px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Inclusion Fee</div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>{inclusionFee.toLocaleString()}</div>
          </div>
          
          <div style={{ background: 'var(--bg-elevated)', padding: '12px', borderRadius: '6px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Resource Fee (Non-refundable)</div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>{nonRefundableResourceFee.toLocaleString()}</div>
          </div>
          
          <div style={{ background: 'var(--bg-elevated)', padding: '12px', borderRadius: '6px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Rent & Events (Refundable)</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--green)' }}>{rentFee.toLocaleString()}</div>
          </div>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '14px', fontWeight: 600 }}>
          <span>Total Estimated Fee</span>
          <span>{(inclusionFee + minResourceFee).toLocaleString()} stroops</span>
        </div>
      </div>
    </div>
  );
}
