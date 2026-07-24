import React, { useState, useEffect } from 'react';
import { useStore } from '../../lib/store';
import { Wallet, Shield, AlertTriangle, CheckCircle, Copy, Trash2, Plus, Download, Upload } from 'lucide-react';

interface WalletInfo {
  id: string;
  name: string;
  type: 'freighter' | 'rabet' | 'xbull' | 'lobstr' | 'ledger';
  publicKey: string;
  connected: boolean;
  lastUsed: number;
  balance?: number;
  securityScore: number;
  permissions: string[];
}

interface SecurityAudit {
  walletId: string;
  issues: string[];
  warnings: string[];
  score: number;
}

export default function MultiWalletManager() {
  const { walletConnected, walletType, walletPublicKey, setWalletConnected, disconnectWallet } = useStore();
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [showAddWallet, setShowAddWallet] = useState(false);
  const [auditResults, setAuditResults] = useState<Record<string, SecurityAudit>>({});

  // Initialize with some example wallets
  useEffect(() => {
    const exampleWallets: WalletInfo[] = [
      {
        id: '1',
        name: 'Main Wallet',
        type: 'freighter',
        publicKey: walletPublicKey || 'GD...EXAMPLE',
        connected: walletConnected,
        lastUsed: Date.now(),
        balance: 1000.5,
        securityScore: 95,
        permissions: ['sign_transaction', 'get_address']
      },
      {
        id: '2',
        name: 'Trading Wallet',
        type: 'rabet',
        publicKey: 'GB...EXAMPLE2',
        connected: false,
        lastUsed: Date.now() - 86400000,
        balance: 500.25,
        securityScore: 88,
        permissions: ['sign_transaction']
      }
    ];
    setWallets(exampleWallets);
  }, [walletConnected, walletType, walletPublicKey]);

  const connectWallet = (walletId: string) => {
    const wallet = wallets.find(w => w.id === walletId);
    if (wallet) {
      setWalletConnected(true, wallet.type, wallet.publicKey);
      setWallets(prev => prev.map(w => 
        w.id === walletId ? { ...w, connected: true, lastUsed: Date.now() } : { ...w, connected: false }
      ));
      setSelectedWallet(walletId);
    }
  };

  const disconnectWalletHandler = (walletId: string) => {
    disconnectWallet();
    setWallets(prev => prev.map(w => 
      w.id === walletId ? { ...w, connected: false } : w
    ));
    setSelectedWallet(null);
  };

  const removeWallet = (walletId: string) => {
    setWallets(prev => prev.filter(w => w.id !== walletId));
    if (selectedWallet === walletId) {
      setSelectedWallet(null);
    }
  };

  const runSecurityAudit = async (walletId: string) => {
    const wallet = wallets.find(w => w.id === walletId);
    if (!wallet) return;

    // Simulated security audit
    const issues: string[] = [];
    const warnings: string[] = [];
    let score = 100;

    // Check for common security issues
    if (wallet.permissions.includes('sign_transaction') && wallet.permissions.includes('get_address')) {
      // This is normal, no issue
    }

    if (wallet.securityScore < 80) {
      warnings.push('Security score below recommended threshold');
      score -= 10;
    }

    if (wallet.lastUsed < Date.now() - 30 * 24 * 60 * 60 * 1000) {
      warnings.push('Wallet not used in over 30 days');
      score -= 5;
    }

    if (wallet.type === 'ledger') {
      score += 5; // Bonus for hardware wallet
    }

    setAuditResults(prev => ({
      ...prev,
      [walletId]: { walletId, issues, warnings, score: Math.max(0, score) }
    }));
  };

  const exportWalletConfig = () => {
    const config = {
      wallets: wallets.map(w => ({
        ...w,
        publicKey: w.publicKey // In production, you'd encrypt this
      })),
      exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = 'wallet-config.json';
    link.href = URL.createObjectURL(blob);
    link.click();
  };

  const importWalletConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const config = JSON.parse(e.target?.result as string);
        if (config.wallets && Array.isArray(config.wallets)) {
          setWallets(config.wallets);
        }
      } catch (error) {
        console.error('Failed to import wallet config:', error);
      }
    };
    reader.readAsText(file);
  };

  const revokePermission = (walletId: string, permission: string) => {
    setWallets(prev => prev.map(w => 
      w.id === walletId 
        ? { ...w, permissions: w.permissions.filter(p => p !== permission) }
        : w
    ));
  };

  const getSecurityColor = (score: number) => {
    if (score >= 90) return 'var(--green)';
    if (score >= 70) return 'var(--orange)';
    return 'var(--red)';
  };

  const getWalletIcon = (type: string) => {
    return <Wallet size={20} />;
  };

  return (
    <div style={{
      padding: '24px',
      background: 'var(--bg-base)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-mono)'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <div>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 600,
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Wallet size={24} />
            Multi-Wallet Manager
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Manage multiple wallets with unified view and security auditing
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setShowAddWallet(true)}
            style={{
              padding: '12px 20px',
              background: 'var(--cyan-dim)',
              border: 'none',
              borderRadius: '8px',
              color: 'var(--bg-base)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Plus size={16} />
            Add Wallet
          </button>
          <button
            onClick={exportWalletConfig}
            style={{
              padding: '12px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              color: 'var(--text-primary)'
            }}
            title="Export wallet configuration"
          >
            <Download size={16} />
          </button>
          <label style={{
            padding: '12px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            color: 'var(--text-primary)'
          }} title="Import wallet configuration">
            <Upload size={16} />
            <input
              type="file"
              accept=".json"
              onChange={importWalletConfig}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

      {/* Unified Portfolio Summary */}
      <div style={{
        padding: '20px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        marginBottom: '24px'
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
          Unified Portfolio View
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px'
        }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Total Wallets
            </div>
            <div style={{ fontSize: '24px', fontWeight: 600 }}>
              {wallets.length}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Connected Wallets
            </div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--green)' }}>
              {wallets.filter(w => w.connected).length}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Combined Balance
            </div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--cyan)' }}>
              {wallets.reduce((sum, w) => sum + (w.balance || 0), 0).toFixed(2)} XLM
            </div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Avg Security Score
            </div>
            <div style={{ 
              fontSize: '24px', 
              fontWeight: 600,
              color: getSecurityColor(
                wallets.reduce((sum, w) => sum + w.securityScore, 0) / wallets.length
              )
            }}>
              {Math.round(wallets.reduce((sum, w) => sum + w.securityScore, 0) / wallets.length)}
            </div>
          </div>
        </div>
      </div>

      {/* Wallet List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {wallets.map((wallet) => (
          <div
            key={wallet.id}
            onClick={() => setSelectedWallet(wallet.id)}
            style={{
              padding: '20px',
              background: selectedWallet === wallet.id ? 'var(--bg-hover)' : 'var(--bg-elevated)',
              border: selectedWallet === wallet.id ? '2px solid var(--cyan)' : '1px solid var(--border)',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'var(--transition)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{
                  padding: '12px',
                  background: wallet.connected ? 'var(--green-dim)' : 'var(--bg-base)',
                  borderRadius: '8px',
                  color: wallet.connected ? 'var(--green)' : 'var(--text-secondary)'
                }}>
                  {getWalletIcon(wallet.type)}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '16px', fontWeight: 600 }}>
                      {wallet.name}
                    </span>
                    {wallet.connected && (
                      <span style={{
                        padding: '2px 8px',
                        background: 'var(--green-dim)',
                        color: 'var(--green)',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 600
                      }}>
                        Connected
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    {wallet.publicKey}
                  </div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Type: <span style={{ color: 'var(--text-primary)' }}>{wallet.type}</span>
                    </span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Balance: <span style={{ color: 'var(--cyan)' }}>{wallet.balance?.toFixed(2)} XLM</span>
                    </span>
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '4px 12px',
                  background: 'var(--bg-base)',
                  borderRadius: '20px',
                  border: `1px solid ${getSecurityColor(wallet.securityScore)}`
                }}>
                  <Shield size={14} style={{ color: getSecurityColor(wallet.securityScore) }} />
                  <span style={{ 
                    fontSize: '13px', 
                    fontWeight: 600,
                    color: getSecurityColor(wallet.securityScore)
                  }}>
                    {wallet.securityScore}
                  </span>
                </div>
                
                <div style={{ display: 'flex', gap: '8px' }}>
                  {!wallet.connected ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); connectWallet(wallet.id); }}
                      style={{
                        padding: '8px 16px',
                        background: 'var(--cyan-dim)',
                        border: 'none',
                        borderRadius: '6px',
                        color: 'var(--bg-base)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Connect
                    </button>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); disconnectWalletHandler(wallet.id); }}
                      style={{
                        padding: '8px 16px',
                        background: 'var(--red-dim)',
                        border: 'none',
                        borderRadius: '6px',
                        color: 'var(--red)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Disconnect
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); runSecurityAudit(wallet.id); }}
                    style={{
                      padding: '8px',
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      color: 'var(--text-primary)'
                    }}
                    title="Run security audit"
                  >
                    <Shield size={14} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeWallet(wallet.id); }}
                    style={{
                      padding: '8px',
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      color: 'var(--text-primary)'
                    }}
                    title="Remove wallet"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Security Audit Results */}
            {auditResults[wallet.id] && (
              <div style={{
                marginTop: '16px',
                padding: '16px',
                background: 'var(--bg-base)',
                borderRadius: '8px',
                border: '1px solid var(--border)'
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  marginBottom: '12px',
                  fontWeight: 600
                }}>
                  <Shield size={16} />
                  Security Audit Results
                </div>
                
                <div style={{ marginBottom: '12px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Score: </span>
                  <span style={{ 
                    fontWeight: 600,
                    color: getSecurityColor(auditResults[wallet.id].score)
                  }}>
                    {auditResults[wallet.id].score}/100
                  </span>
                </div>

                {auditResults[wallet.id].issues.length > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--red)', marginBottom: '4px' }}>
                      Issues:
                    </div>
                    {auditResults[wallet.id].issues.map((issue, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        marginBottom: '4px'
                      }}>
                        <AlertTriangle size={12} style={{ color: 'var(--red)' }} />
                        {issue}
                      </div>
                    ))}
                  </div>
                )}

                {auditResults[wallet.id].warnings.length > 0 && (
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--orange)', marginBottom: '4px' }}>
                      Warnings:
                    </div>
                    {auditResults[wallet.id].warnings.map((warning, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        marginBottom: '4px'
                      }}>
                        <AlertTriangle size={12} style={{ color: 'var(--orange)' }} />
                        {warning}
                      </div>
                    ))}
                  </div>
                )}

                {auditResults[wallet.id].issues.length === 0 && auditResults[wallet.id].warnings.length === 0 && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: 'var(--green)'
                  }}>
                    <CheckCircle size={16} />
                    No security issues detected
                  </div>
                )}
              </div>
            )}

            {/* Permissions */}
            {selectedWallet === wallet.id && (
              <div style={{
                marginTop: '16px',
                padding: '16px',
                background: 'var(--bg-base)',
                borderRadius: '8px',
                border: '1px solid var(--border)'
              }}>
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>
                  Wallet Permissions
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {wallet.permissions.map((permission) => (
                    <div
                      key={permission}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        background: 'var(--bg-elevated)',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}
                    >
                      <span style={{ textTransform: 'capitalize' }}>{permission.replace('_', ' ')}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); revokePermission(wallet.id, permission); }}
                        style={{
                          padding: '4px 8px',
                          background: 'var(--red-dim)',
                          border: 'none',
                          borderRadius: '4px',
                          color: 'var(--red)',
                          fontSize: '11px',
                          cursor: 'pointer'
                        }}
                      >
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Wallet Modal */}
      {showAddWallet && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            padding: '24px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            width: '400px',
            maxWidth: '90%'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
              Add New Wallet
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {['freighter', 'rabet', 'xbull', 'lobstr'].map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    // In production, this would trigger the actual wallet connection flow
                    const newWallet: WalletInfo = {
                      id: Date.now().toString(),
                      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Wallet`,
                      type: type as any,
                      publicKey: 'G...NEW',
                      connected: false,
                      lastUsed: Date.now(),
                      balance: 0,
                      securityScore: 85,
                      permissions: ['get_address']
                    };
                    setWallets(prev => [...prev, newWallet]);
                    setShowAddWallet(false);
                  }}
                  style={{
                    padding: '16px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    transition: 'var(--transition)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--cyan)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }}
                >
                  <Wallet size={20} />
                  <span style={{ textTransform: 'capitalize' }}>{type}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAddWallet(false)}
              style={{
                marginTop: '16px',
                padding: '12px',
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                width: '100%'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
