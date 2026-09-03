import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Info,
  ArrowUpDown,
  Wallet,
  CreditCard,
  BanknoteIcon,
  Coins,
  ChevronDown,
  ChevronUp,
  Star,
  Shield,
} from 'lucide-react';
import anchorService from '../../lib/anchors.js';
import auditTrail from '../../lib/auditTrail.js';
import { connectFreighter, signTransactionWithFreighter } from '../../lib/wallet/freighter.js';

const METHOD_ICONS = {
  bank_transfer: BanknoteIcon,
  wire: BanknoteIcon,
  crypto: Coins,
  card: CreditCard,
  p2p: Wallet
};

const METHOD_COLORS = {
  bank_transfer: 'var(--blue)',
  wire: 'var(--purple)',
  crypto: 'var(--green)',
  card: 'var(--orange)',
  p2p: 'var(--cyan)'
};

export default function AnchorIntegration() {
  const [anchors, setAnchors] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState('XLM');
  const [amount, setAmount] = useState('100');
  const [transactionType, setTransactionType] = useState('deposit');
  const [selectedAnchor, setSelectedAnchor] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedAnchor, setExpandedAnchor] = useState(null);
  const [supportedAssets, setSupportedAssets] = useState([]);
  const [authStatus, setAuthStatus] = useState('disconnected');
  const [authMessage, setAuthMessage] = useState('Not connected');
  const [authError, setAuthError] = useState(null);
  const [anchorSession, setAnchorSession] = useState(null);
  const [isAnchorAuthLoading, setIsAnchorAuthLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedAsset && amount && transactionType) {
      loadComparison();
    }
  }, [selectedAsset, amount, transactionType, loadComparison]);

  const loadData = async () => {
    try {
      const availableAnchors = anchorService.getAvailableAnchors({ status: 'active' });
      const assets = anchorService.getSupportedAssets();
      
      setAnchors(availableAnchors);
      setSupportedAssets(assets);
      
      auditTrail.logUserAction('Loaded anchor integration data', {
        anchorCount: availableAnchors.length,
        supportedAssets: assets.length
      });
    } catch (error) {
      auditTrail.logError(error, { operation: 'loadAnchorData' });
    }
  };

  const loadComparison = useCallback(async () => {
    try {
      setLoading(true);
      const amountNum = parseFloat(amount);
      
      if (isNaN(amountNum) || amountNum <= 0) {
        setComparison(null);
        return;
      }

      const comparisonData = anchorService.compareAnchors(selectedAsset, amountNum, transactionType);
      setComparison(comparisonData);
      
      auditTrail.logUserAction('Compared anchor rates', {
        asset: selectedAsset,
        amount: amountNum,
        type: transactionType,
        anchorCount: comparisonData.totalAnchors
      });
    } catch (error) {
      auditTrail.logError(error, { 
        operation: 'compareAnchors',
        asset: selectedAsset,
        amount,
        type: transactionType
      });
    } finally {
      setLoading(false);
    }
  }, [selectedAsset, amount, transactionType]);

  const handleAnchorSelect = (anchor) => {
    setSelectedAnchor(anchor);
    auditTrail.logUserAction('Selected anchor', {
      anchorId: anchor.id,
      anchorName: anchor.name,
      asset: selectedAsset,
      amount,
      type: transactionType
    });
  };

  useEffect(() => {
    const loadAnchorSession = async () => {
      if (!selectedAnchor) {
        setAnchorSession(null);
        setAuthStatus('disconnected');
        setAuthMessage('Not connected');
        return;
      }

      if (!anchorService.hasWebAuth(selectedAnchor.id)) {
        setAnchorSession(null);
        setAuthStatus('disconnected');
        setAuthMessage('Anchor SEP-10 not configured');
        return;
      }

      try {
        const session = await anchorService.getAnchorAuthSession(selectedAnchor.id);
        if (session && session.token) {
          setAnchorSession(session);
          setAuthStatus('connected');
          setAuthMessage(`Connected as ${session.accountPublicKey}`);
        } else {
          setAnchorSession(null);
          setAuthStatus('disconnected');
          setAuthMessage('Not connected');
        }
      } catch (error) {
        setAnchorSession(null);
        setAuthStatus('error');
        setAuthMessage('Unable to load anchor auth session');
        auditTrail.logError(error, { operation: 'loadAnchorAuthSession', anchorId: selectedAnchor.id });
      }
    };

    loadAnchorSession();
  }, [selectedAnchor]);

  const handleConnectToAnchor = async () => {
    if (!selectedAnchor) return;

    setAuthError(null);
    setIsAnchorAuthLoading(true);
    setAuthStatus('loading');

    try {
      const account = await connectFreighter();
      const challengeResponse = await anchorService.requestChallengeTransaction(
        selectedAnchor.id,
        account.publicKey,
        account.network
      );

      const signedXdr = await signTransactionWithFreighter(challengeResponse.transaction, account.network);
      const token = await anchorService.submitChallengeTransaction(selectedAnchor.id, signedXdr, account.network);

      await anchorService.saveAnchorAuthSession(
        selectedAnchor.id,
        token,
        account.publicKey,
        account.network,
        selectedAnchor.homeDomain
      );

      const jwtPayload = anchorService.parseJwt(token);
      const session = {
        token,
        accountPublicKey: account.publicKey,
        network: account.network,
        homeDomain: selectedAnchor.homeDomain,
        tokenPayload: jwtPayload
      };

      setAnchorSession(session);
      setAuthStatus('connected');
      setAuthMessage(`Connected as ${account.publicKey}`);
      auditTrail.logUserAction('Authenticated with anchor via SEP-10', {
        anchorId: selectedAnchor.id,
        anchorName: selectedAnchor.name,
        accountPublicKey: account.publicKey,
        network: account.network,
        homeDomain: selectedAnchor.homeDomain
      });
    } catch (error) {
      setAuthStatus('error');
      setAuthError(error.message || 'Anchor authentication failed');
      auditTrail.logError(error, { operation: 'anchorSep10Auth', anchorId: selectedAnchor.id, error: error?.message });
    } finally {
      setIsAnchorAuthLoading(false);
    }
  };

  const handleDisconnectAnchor = async () => {
    if (!selectedAnchor) return;
    await anchorService.clearAnchorAuthSession(selectedAnchor.id);
    setAnchorSession(null);
    setAuthStatus('disconnected');
    setAuthMessage('Not connected');
    auditTrail.logUserAction('Disconnected anchor SEP-10 session', {
      anchorId: selectedAnchor.id,
      anchorName: selectedAnchor.name
    });
  };

  const generateInstructions = () => {
    if (!selectedAnchor) return null;

    try {
      const amountNum = parseFloat(amount);
      
      if (transactionType === 'deposit') {
        return anchorService.generateDepositInstructions(
          selectedAnchor.id,
          selectedAsset,
          amountNum,
          selectedAnchor.depositMethods[0]
        );
      } else {
        return anchorService.generateWithdrawalInstructions(
          selectedAnchor.id,
          selectedAsset,
          amountNum,
          selectedAnchor.withdrawalMethods[0]
        );
      }
    } catch (error) {
      auditTrail.logError(error, { operation: 'generateInstructions' });
      return null;
    }
  };

  const instructions = generateInstructions();

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ArrowUpDown size={22} style={{ color: 'var(--cyan)' }} />
          Stellar Anchor Integration
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Compare and connect with major Stellar anchors for fiat on/off ramps
        </div>
      </div>

      {/* Configuration */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          padding: '20px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <div>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
            Transaction Type
          </label>
          <select
            value={transactionType}
            onChange={(e) => setTransactionType(e.target.value)}
            style={selectStyle}
          >
            <option value="deposit">Deposit (Buy)</option>
            <option value="withdrawal">Withdrawal (Sell)</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
            Asset
          </label>
          <select
            value={selectedAsset}
            onChange={(e) => setSelectedAsset(e.target.value)}
            style={selectStyle}
          >
            {supportedAssets.map(asset => (
              <option key={asset} value={asset}>{asset}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
            Amount (USD)
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="1"
            step="1"
            style={inputStyle}
          />
        </div>
      </div>

      {/* Comparison Summary */}
      {comparison && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '16px',
          }}
        >
          <ComparisonCard
            title="Best Rate"
            anchor={comparison.best.anchor}
            fee={comparison.best.fee}
            totalCost={comparison.best.totalCost}
            effectiveRate={comparison.best.effectiveRate}
            type="best"
          />
          
          <ComparisonCard
            title="Highest Cost"
            anchor={comparison.worst.anchor}
            fee={comparison.worst.fee}
            totalCost={comparison.worst.totalCost}
            effectiveRate={comparison.worst.effectiveRate}
            type="worst"
          />
          
          <SavingsCard
            savings={comparison.savings}
            percentage={comparison.savings.percentage}
          />
          
          <StatCard
            title="Available Anchors"
            value={comparison.totalAnchors}
            icon={<Info size={16} />}
            color="var(--cyan)"
          />
        </div>
      )}

      {/* Anchor List */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Available Anchors
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading anchor comparison...
          </div>
        ) : (
          <div>
            {anchors.map(anchor => {
              const feeData = comparison?.allOptions.find(opt => opt.name === anchor.name);
              const isExpanded = expandedAnchor === anchor.id;
              
              return (
                <AnchorCard
                  key={anchor.id}
                  anchor={anchor}
                  feeData={feeData}
                  isExpanded={isExpanded}
                  onToggle={() => setExpandedAnchor(isExpanded ? null : anchor.id)}
                  onSelect={() => handleAnchorSelect(anchor)}
                  isSelected={selectedAnchor?.id === anchor.id}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Anchor Details */}
      {selectedAnchor && instructions && (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px',
          }}
        >
          <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={18} style={{ color: 'var(--green)' }} />
            {instructions.anchorName} - {transactionType === 'deposit' ? 'Deposit' : 'Withdrawal'} Instructions
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-primary)' }}>
                Transaction Details
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Asset:</span>
                  <span style={{ fontWeight: 500 }}>{instructions.asset}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Amount:</span>
                  <span style={{ fontWeight: 500 }}>${instructions.amount}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Method:</span>
                  <span style={{ fontWeight: 500 }}>{instructions.method.replace('_', ' ')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Fee:</span>
                  <span style={{ fontWeight: 500 }}>${instructions.fees.fee.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Total:</span>
                  <span style={{ fontWeight: 600, color: 'var(--cyan)' }}>
                    ${instructions.fees.totalAmount.toFixed(2)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Processing Time:</span>
                  <span style={{ fontWeight: 500 }}>{instructions.processingTime}</span>
                </div>
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-primary)' }}>
                Instructions
              </h4>
              <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', lineHeight: '1.6' }}>
                {instructions.instructions.map((instruction, index) => (
                  <li key={index} style={{ marginBottom: '8px', color: 'var(--text-secondary)' }}>
                    {instruction}
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {instructions.warnings.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--orange)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={16} />
                Important Notes
              </h4>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', lineHeight: '1.6' }}>
                {instructions.warnings.map((warning, index) => (
                  <li key={index} style={{ marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ marginTop: '24px', padding: '18px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Anchor Authentication
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {anchorService.hasWebAuth(selectedAnchor.id)
                    ? 'This anchor supports SEP-10 web authentication. Connect with Freighter to request a signed challenge and receive a secure session token.'
                    : 'SEP-10 authentication is not available for this anchor.'}
                </div>
              </div>

              {anchorService.hasWebAuth(selectedAnchor.id) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  <button
                    onClick={handleConnectToAnchor}
                    disabled={isAnchorAuthLoading}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '10px 18px',
                      background: 'var(--cyan)',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      color: '#FFF',
                      fontSize: '13px',
                      cursor: 'pointer',
                      opacity: isAnchorAuthLoading ? 0.6 : 1,
                    }}
                  >
                    {anchorSession ? 'Reconnect to Anchor' : 'Connect to Anchor'}
                  </button>
                  <button
                    onClick={handleDisconnectAnchor}
                    disabled={!anchorSession || isAnchorAuthLoading}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '10px 18px',
                      background: 'transparent',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      cursor: anchorSession && !isAnchorAuthLoading ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Connection Status</div>
                <div style={{ marginTop: '6px' }}>{authStatus === 'loading' ? 'Connecting...' : authMessage}</div>
              </div>

              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Anchor Domain</div>
                <div style={{ marginTop: '6px' }}>{selectedAnchor.homeDomain || 'Unknown'}</div>
              </div>

              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Authenticated Wallet</div>
                <div style={{ marginTop: '6px' }}>{anchorSession?.accountPublicKey || 'None'}</div>
              </div>

              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Network</div>
                <div style={{ marginTop: '6px' }}>{anchorSession?.network || 'TESTNET'}</div>
              </div>
            </div>

            {anchorSession?.tokenPayload?.exp && (
              <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                Token expires at {new Date(anchorSession.tokenPayload.exp * 1000).toLocaleString()}.
              </div>
            )}

            {authError && (
              <div style={{ marginTop: '16px', fontSize: '13px', color: 'var(--red)' }}>
                {authError}
              </div>
            )}
          </div>

          <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
            <button
              onClick={() => window.open(instructions.supportUrl, '_blank')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 16px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'var(--transition)',
              }}
            >
              <ExternalLink size={14} />
              Visit {instructions.anchorName}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AnchorCard({ anchor, feeData, isExpanded, onToggle, onSelect, isSelected }) {
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div
        style={{
          padding: '16px 20px',
          cursor: 'pointer',
          background: isSelected ? 'rgba(34, 197, 94, 0.05)' : 'transparent',
          transition: 'var(--transition)',
        }}
        onClick={() => onSelect()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '24px' }}>{anchor.icon}</div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {anchor.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                <span>{anchor.supportedAssets.length} assets • {anchor.depositMethods.length + anchor.withdrawalMethods.length} methods</span>
                {anchor.rating && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '2px', color: '#f59e0b' }}>
                    <Star size={12} fill="currentColor" /> {anchor.rating.toFixed(1)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {feeData && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Fee</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  ${feeData.fee.toFixed(2)}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {feeData.effectiveRate.toFixed(2)}%
                </div>
              </div>
            )}
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div style={{ padding: '0 20px 16px', background: 'var(--bg-elevated)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', fontSize: '12px' }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>Supported Assets</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {anchor.supportedAssets.map(asset => (
                  <span
                    key={asset}
                    style={{
                      padding: '2px 8px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: '999px',
                      fontSize: '11px',
                    }}
                  >
                    {asset}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>Deposit Methods</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {anchor.depositMethods.map(method => {
                  const Icon = METHOD_ICONS[method];
                  return (
                    <span
                      key={method}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 8px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderRadius: '999px',
                        fontSize: '11px',
                        color: METHOD_COLORS[method],
                      }}
                    >
                      <Icon size={10} />
                      {method.replace('_', ' ')}
                    </span>
                  );
                })}
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>Withdrawal Methods</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {anchor.withdrawalMethods.map(method => {
                  const Icon = METHOD_ICONS[method];
                  return (
                    <span
                      key={method}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 8px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderRadius: '999px',
                        fontSize: '11px',
                        color: METHOD_COLORS[method],
                      }}
                    >
                      <Icon size={10} />
                      {method.replace('_', ' ')}
                    </span>
                  );
                })}
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>Processing Time</div>
              <div style={{ color: 'var(--text-secondary)' }}>
                <div>Deposit: {anchor.processingTime.deposit}</div>
                <div>Withdrawal: {anchor.processingTime.withdrawal}</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)' }}>Anchor Capabilities & SEP Support</div>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    const caps = await anchorService.checkCapabilities(anchor.id);
                    if (caps) {
                      alert(`SEP-10 Auth: ${caps.sep10Auth ? 'Yes' : 'No'}\nSEP-24 Interactive: ${caps.sep24Interactive ? 'Yes' : 'No'}\nSEP-31 Cross-border: ${caps.sep31CrossBorder ? 'Yes' : 'No'}\nSEP-6 Transfer: ${caps.sep6Transfer ? 'Yes' : 'No'}\nSEP-12 KYC: ${caps.sep12KYC ? 'Yes' : 'No'}\nSupported Currencies: ${caps.currencies?.length || 0}`);
                    } else {
                      alert('Could not fetch capabilities. Anchor may not support SEP standards.');
                    }
                  } catch (err) {
                    alert('Error fetching capabilities.');
                  }
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  background: 'var(--cyan)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                <Shield size={12} />
                Check Capabilities
              </button>
            </div>
            
            {anchor.reviews && anchor.reviews.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)', marginBottom: '8px' }}>User Reviews</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                  {anchor.reviews.map((review, idx) => (
                    <div key={idx} style={{ padding: '8px', background: 'var(--bg-card)', borderRadius: '6px', fontSize: '11px', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{review.user}</span>
                        <span style={{ display: 'flex', alignItems: 'center', color: '#f59e0b' }}>
                          <Star size={10} fill="currentColor" /> {review.rating}
                        </span>
                      </div>
                      <div style={{ color: 'var(--text-secondary)' }}>"{review.comment}"</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              <strong>Fee Structure:</strong> Deposit {anchor.fees.deposit}, Withdrawal {anchor.fees.withdrawal} (min: {anchor.fees.minimum})
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ComparisonCard({ title, anchor, fee, totalCost, effectiveRate, type }) {
  const color = type === 'best' ? 'var(--green)' : 'var(--red)';
  const Icon = type === 'best' ? TrendingUp : TrendingDown;

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${color}`,
        borderRadius: 'var(--radius-lg)',
        padding: '16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <Icon size={16} style={{ color }} />
        <div style={{ fontSize: '14px', fontWeight: 600, color }}>{title}</div>
      </div>
      
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
        {anchor}
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Fee:</span>
          <span style={{ fontWeight: 600 }}>${fee.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Total:</span>
          <span style={{ fontWeight: 600 }}>${totalCost.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Rate:</span>
          <span style={{ fontWeight: 600, color }}>{effectiveRate.toFixed(2)}%</span>
        </div>
      </div>
    </div>
  );
}

function SavingsCard({ savings, percentage }) {
  return (
    <div
      style={{
        background: 'rgba(34, 197, 94, 0.05)',
        border: '1px solid var(--green)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <DollarSign size={16} style={{ color: 'var(--green)' }} />
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--green)' }}>
          Potential Savings
        </div>
      </div>
      
      <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--green)', marginBottom: '4px' }}>
        ${savings.toFixed(2)}
      </div>
      
      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
        {percentage.toFixed(1)}% cheaper than highest cost option
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }) {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <div style={{ color }}>{icon}</div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {title}
        </div>
      </div>
      
      <div style={{ fontSize: '24px', fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

const selectStyle = {
  width: '100%',
  padding: '8px 12px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-primary)',
  fontSize: '13px',
  fontFamily: 'var(--font-mono)',
  outline: 'none',
};

const inputStyle = {
  width: '100%',
  padding: '8px 12px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-primary)',
  fontSize: '13px',
  fontFamily: 'var(--font-mono)',
  outline: 'none',
};
