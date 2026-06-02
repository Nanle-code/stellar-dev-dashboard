/**
 * Hardware Wallet Security Component
 * UI for managing hardware wallet security features
 */

import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, CheckCircle, Lock, Unlock, Usb, RefreshCw } from 'lucide-react';
import {
  hardwareWalletSecurity,
  HardwareDevice,
  SecurityCheckResult,
  SecurityVulnerability,
} from '../../lib/wallet/hardwareWalletSecurity';

export const HardwareWalletSecurity: React.FC = () => {
  const [devices, setDevices] = useState<HardwareDevice[]>([]);
  const [securityChecks, setSecurityChecks] = useState<Map<string, SecurityCheckResult>>(new Map());
  const [loading, setLoading] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      setLoading(true);
      const connectedDevices = hardwareWalletSecurity.getAllConnectedDevices();
      setDevices(connectedDevices);

      // Perform security checks
      for (const device of connectedDevices) {
        const check = await hardwareWalletSecurity.checkDeviceSecurity(device);
        setSecurityChecks((prev) => new Map(prev).set(device.id, check));
      }
    } catch (error) {
      console.error('Failed to load devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDetectDevice = async () => {
    try {
      setLoading(true);
      const device = await hardwareWalletSecurity.detectDevice();
      
      if (device) {
        setDevices((prev) => [...prev, device]);
        const check = await hardwareWalletSecurity.checkDeviceSecurity(device);
        setSecurityChecks((prev) => new Map(prev).set(device.id, check));
      } else {
        alert('No hardware wallet detected. Please connect your device and try again.');
      }
    } catch (error) {
      console.error('Failed to detect device:', error);
      alert('Failed to detect device. Make sure your browser supports WebUSB.');
    } finally {
      setLoading(false);
    }
  };

  const handleEnablePinProtection = (deviceId: string) => {
    setSelectedDevice(deviceId);
    setShowPinModal(true);
  };

  const vulnerabilityDatabase = hardwareWalletSecurity.getVulnerabilityDatabase();

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Hardware Wallet Security</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Enhanced security features for your hardware wallets
          </p>
        </div>
        <button
          onClick={handleDetectDevice}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.5rem',
            background: 'var(--primary)',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '0.9rem',
            fontWeight: 500,
            opacity: loading ? 0.6 : 1,
          }}
        >
          <Usb size={18} />
          {loading ? 'Detecting...' : 'Detect Device'}
        </button>
      </div>

      {/* Connected Devices */}
      <div style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield size={20} />
          Connected Devices
        </h2>
        
        {devices.length === 0 ? (
          <div
            style={{
              padding: '3rem',
              textAlign: 'center',
              background: 'var(--card-bg)',
              borderRadius: '0.5rem',
              border: '1px dashed var(--border)',
            }}
          >
            <Usb size={48} style={{ color: 'var(--text-tertiary)', margin: '0 auto 1rem' }} />
            <p style={{ color: 'var(--text-secondary)' }}>No hardware wallets connected</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
              Click "Detect Device" to connect your hardware wallet
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {devices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                securityCheck={securityChecks.get(device.id)}
                onEnablePin={() => handleEnablePinProtection(device.id)}
                onRefresh={loadDevices}
              />
            ))}
          </div>
        )}
      </div>

      {/* Known Vulnerabilities Database */}
      <div>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={20} />
          Known Vulnerabilities Database
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {vulnerabilityDatabase.map((vuln) => (
            <VulnerabilityCard key={vuln.id} vulnerability={vuln} />
          ))}
        </div>
      </div>

      {showPinModal && selectedDevice && (
        <PinProtectionModal
          deviceId={selectedDevice}
          onClose={() => {
            setShowPinModal(false);
            setSelectedDevice(null);
          }}
          onSuccess={() => {
            setShowPinModal(false);
            setSelectedDevice(null);
            loadDevices();
          }}
        />
      )}
    </div>
  );
};

const DeviceCard: React.FC<{
  device: HardwareDevice;
  securityCheck?: SecurityCheckResult;
  onEnablePin: () => void;
  onRefresh: () => void;
}> = ({ device, securityCheck, onEnablePin, onRefresh }) => {
  const hasVulnerabilities = (securityCheck?.vulnerabilities.length || 0) > 0;
  const criticalVulns = securityCheck?.vulnerabilities.filter((v) => v.severity === 'critical').length || 0;

  return (
    <div
      style={{
        padding: '1.5rem',
        background: 'var(--card-bg)',
        border: `2px solid ${hasVulnerabilities ? 'var(--danger)' : 'var(--success)'}`,
        borderRadius: '0.5rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{device.model}</h3>
            <span
              style={{
                padding: '0.25rem 0.5rem',
                background: device.connected ? 'var(--success)' : 'var(--text-tertiary)',
                color: 'white',
                borderRadius: '0.25rem',
                fontSize: '0.7rem',
              }}
            >
              {device.connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Firmware: {device.firmwareVersion}
          </p>
        </div>
        <button
          onClick={onRefresh}
          style={{
            padding: '0.5rem',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: '0.375rem',
            cursor: 'pointer',
          }}
          title="Refresh security check"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Security Status */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
        <SecurityItem
          label="PIN Protection"
          status={device.pinProtected ? 'enabled' : 'disabled'}
          icon={device.pinProtected ? Lock : Unlock}
        />
        <SecurityItem
          label="Firmware"
          status={securityCheck?.firmwareUpToDate ? 'up-to-date' : 'outdated'}
          icon={securityCheck?.firmwareUpToDate ? CheckCircle : AlertTriangle}
        />
        <SecurityItem
          label="Vulnerabilities"
          status={hasVulnerabilities ? `${securityCheck?.vulnerabilities.length} found` : 'none'}
          icon={hasVulnerabilities ? AlertTriangle : CheckCircle}
        />
      </div>

      {/* Recommendations */}
      {securityCheck && securityCheck.recommendations.length > 0 && (
        <div
          style={{
            padding: '1rem',
            background: criticalVulns > 0 ? 'var(--danger-bg)' : 'var(--warning-bg)',
            borderRadius: '0.375rem',
            marginBottom: '1rem',
          }}
        >
          <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: 600 }}>Recommendations:</h4>
          <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.85rem' }}>
            {securityCheck.recommendations.map((rec, idx) => (
              <li key={idx} style={{ marginBottom: '0.25rem' }}>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        {!device.pinProtected && (
          <button
            onClick={onEnablePin}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--primary)',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Lock size={14} />
            Enable PIN Protection
          </button>
        )}
      </div>
    </div>
  );
};

const SecurityItem: React.FC<{
  label: string;
  status: string;
  icon: React.ComponentType<{ size: number; style?: React.CSSProperties }>;
}> = ({ label, icon: Icon, status }) => {
  const isGood = status === 'enabled' || status === 'up-to-date' || status === 'none';
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <Icon
        size={18}
        style={{ color: isGood ? 'var(--success)' : 'var(--danger)' }}
      />
      <div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', margin: 0 }}>{label}</p>
        <p style={{ fontSize: '0.85rem', fontWeight: 500, margin: 0, textTransform: 'capitalize' }}>{status}</p>
      </div>
    </div>
  );
};

const VulnerabilityCard: React.FC<{ vulnerability: SecurityVulnerability }> = ({ vulnerability }) => {
  const severityColors = {
    critical: 'var(--danger)',
    high: 'var(--warning)',
    medium: 'var(--info)',
    low: 'var(--text-secondary)',
  };

  return (
    <div
      style={{
        padding: '1.25rem',
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderLeft: `4px solid ${severityColors[vulnerability.severity]}`,
        borderRadius: '0.375rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
        <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>{vulnerability.title}</h4>
        <span
          style={{
            padding: '0.25rem 0.75rem',
            background: severityColors[vulnerability.severity],
            color: 'white',
            borderRadius: '0.25rem',
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          {vulnerability.severity}
        </span>
      </div>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
        {vulnerability.description}
      </p>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '0.75rem' }}>
        <strong>Affected versions:</strong> {vulnerability.affectedVersions.join(', ')}
      </div>
      <div
        style={{
          padding: '0.75rem',
          background: 'var(--success-bg)',
          borderRadius: '0.25rem',
          fontSize: '0.85rem',
        }}
      >
        <strong>💡 Recommendation:</strong> {vulnerability.recommendation}
      </div>
      {vulnerability.cveId && (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.5rem', margin: 0 }}>
          CVE ID: {vulnerability.cveId}
        </p>
      )}
    </div>
  );
};

const PinProtectionModal: React.FC<{
  deviceId: string;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ deviceId, onClose, onSuccess }) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (pin !== confirmPin) {
      setError('PINs do not match');
      return;
    }

    if (pin.length < 4 || pin.length > 8) {
      setError('PIN must be 4-8 digits');
      return;
    }

    if (!/^\d+$/.test(pin)) {
      setError('PIN must contain only digits');
      return;
    }

    setSubmitting(true);
    try {
      await hardwareWalletSecurity.enablePinProtection(deviceId, pin);
      onSuccess();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to enable PIN protection');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--card-bg)',
          padding: '2rem',
          borderRadius: '0.5rem',
          maxWidth: '400px',
          width: '90%',
          border: '1px solid var(--border)',
        }}
      >
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Lock size={24} />
          Enable PIN Protection
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Set a 4-8 digit PIN to protect your hardware wallet. You'll need to enter this PIN before signing transactions.
        </p>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
              Enter PIN
            </label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="4-8 digits"
              maxLength={8}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid var(--border)',
                borderRadius: '0.375rem',
                background: 'var(--surface-1)',
                color: 'var(--text-primary)',
                fontSize: '1.2rem',
                textAlign: 'center',
                letterSpacing: '0.5rem',
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
              Confirm PIN
            </label>
            <input
              type="password"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              placeholder="Re-enter PIN"
              maxLength={8}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid var(--border)',
                borderRadius: '0.375rem',
                background: 'var(--surface-1)',
                color: 'var(--text-primary)',
                fontSize: '1.2rem',
                textAlign: 'center',
                letterSpacing: '0.5rem',
              }}
            />
          </div>

          {error && (
            <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              {error}
            </p>
          )}

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                flex: 1,
                padding: '0.75rem',
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                flex: 1,
                padding: '0.75rem',
                background: 'var(--primary)',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem',
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? 'Enabling...' : 'Enable PIN'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
