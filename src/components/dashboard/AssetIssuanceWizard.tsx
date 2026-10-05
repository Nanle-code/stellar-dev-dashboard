import React, { useEffect, useMemo, useState } from 'react';
import * as StellarSdk from '@stellar/stellar-sdk';
import { AlertTriangle, Check, Copy, Download, Eye, EyeOff, FileText, LockKeyhole, ShieldCheck, Trash2 } from 'lucide-react';
import { buildAssetIssuanceOperations, buildAssetTomlSnippet, createAssetIssuanceDraft, EMPTY_ASSET_ISSUANCE_CONFIG, validateAssetIssuanceConfig, type AssetIssuanceConfig, type AssetIssuanceDraft, type AssetIssuanceStage } from '../../lib/assetIssuanceWizard';
import { validateSep1Fields } from '../../lib/stellarTomlInspector';
import { fundTestnetAccount, getServer, NETWORKS } from '../../lib/stellar';

const DRAFT_KEY = 'stellar:asset-issuance:testnet:v1';
const stages: Array<{ id: AssetIssuanceStage; title: string; description: string }> = [
  { id: 'configure', title: 'Issuer policy and domain', description: 'Set home_domain and the selected authorization flags.' },
  { id: 'trustline', title: 'Distributor trustline', description: 'Reserve the holder balance and enforce the supply limit.' },
  { id: 'authorize', title: 'Authorize holder', description: 'Required only when authorization is required.' },
  { id: 'issue', title: 'Issue initial supply', description: 'Send the configured supply to the distributor.' },
  { id: 'lock', title: 'Lock issuer (optional)', description: 'Set the issuer master key weight to zero. This cannot be undone.' },
];

const panelStyle: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 };
const fieldStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', background: 'var(--bg-canvas)', font: 'inherit' };
const actionStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, justifyContent: 'center', padding: '8px 11px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', color: 'var(--text-primary)', cursor: 'pointer', font: 'inherit' };

function emptyDraft(): AssetIssuanceDraft {
  return { config: EMPTY_ASSET_ISSUANCE_CONFIG, issuerPublicKey: '', distributorPublicKey: '', issuerFunded: false, distributorFunded: false, completed: {}, transactionHashes: {} };
}

function loadDraft(): AssetIssuanceDraft {
  try {
    return createAssetIssuanceDraft(JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null')) ?? emptyDraft();
  } catch {
    return emptyDraft();
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'flex', flexDirection: 'column', gap: 5, color: 'var(--text-muted)', fontSize: 12 }}>{label}{children}</label>;
}

export default function AssetIssuanceWizard() {
  const [draft, setDraft] = useState<AssetIssuanceDraft>(loadDraft);
  const [secrets, setSecrets] = useState({ issuer: '', distributor: '' });
  const [showSecrets, setShowSecrets] = useState(false);
  const [preview, setPreview] = useState<{ stage: AssetIssuanceStage; xdr: string } | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [lockAcknowledged, setLockAcknowledged] = useState(false);

  useEffect(() => {
    const { config, issuerPublicKey, distributorPublicKey, issuerFunded, distributorFunded, completed, transactionHashes } = draft;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ config, issuerPublicKey, distributorPublicKey, issuerFunded, distributorFunded, completed, transactionHashes }));
    } catch {
      setError('This browser could not save the resumable draft. Keep the page open and back up both secret keys.');
    }
  }, [draft]);

  const configErrors = useMemo(() => validateAssetIssuanceConfig(draft.config), [draft.config]);
  const tomlSnippet = useMemo(() => draft.issuerPublicKey ? buildAssetTomlSnippet(draft.config, draft.issuerPublicKey) : '', [draft.config, draft.issuerPublicKey]);
  const tomlIssues = useMemo(() => draft.issuerPublicKey ? validateSep1Fields({ CURRENCIES: [{ code: draft.config.code, issuer: draft.issuerPublicKey }] }) : [], [draft.config.code, draft.issuerPublicKey]);

  const updateDraft = (updates: Partial<AssetIssuanceDraft>) => setDraft((current) => ({ ...current, ...updates }));
  const updateConfig = (updates: Partial<AssetIssuanceConfig>) => updateDraft({ config: { ...draft.config, ...updates } });

  const createAndFund = async () => {
    setBusy('accounts'); setError(''); setMessage('');
    try {
      let issuerSecret = secrets.issuer;
      let distributorSecret = secrets.distributor;
      let issuerPublicKey = draft.issuerPublicKey;
      let distributorPublicKey = draft.distributorPublicKey;
      if (!issuerPublicKey && !distributorPublicKey) {
        const issuer = StellarSdk.Keypair.random();
        const distributor = StellarSdk.Keypair.random();
        issuerSecret = issuer.secret(); distributorSecret = distributor.secret();
        issuerPublicKey = issuer.publicKey(); distributorPublicKey = distributor.publicKey();
        setSecrets({ issuer: issuerSecret, distributor: distributorSecret });
        updateDraft({ issuerPublicKey, distributorPublicKey });
      } else if (!issuerSecret || !distributorSecret) {
        throw new Error('Enter both secret keys to resume funding. Keys are not stored in the draft.');
      }
      if (StellarSdk.Keypair.fromSecret(issuerSecret).publicKey() !== issuerPublicKey || StellarSdk.Keypair.fromSecret(distributorSecret).publicKey() !== distributorPublicKey) {
        throw new Error('The entered secret keys do not match the saved issuer and distributor accounts.');
      }
      if (!draft.issuerFunded) {
        await fundTestnetAccount(issuerPublicKey);
        updateDraft({ issuerFunded: true });
      }
      if (!draft.distributorFunded) {
        await fundTestnetAccount(distributorPublicKey);
        updateDraft({ distributorFunded: true });
      }
      setMessage('Both testnet accounts are funded. Back up the secret keys before continuing.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Account creation or Friendbot funding failed.');
    } finally { setBusy(''); }
  };

  const setSecret = (role: 'issuer' | 'distributor', value: string) => setSecrets((current) => ({ ...current, [role]: value.trim() }));

  const previewStage = async (stage: AssetIssuanceStage) => {
    setBusy(stage); setError(''); setMessage('');
    try {
      if (configErrors.length) throw new Error(configErrors[0]);
      if (!draft.issuerFunded || !draft.distributorFunded) throw new Error('Create and fund both accounts before previewing transactions.');
      if (stage === 'authorize' && !draft.config.authRequired) throw new Error('Authorization is not needed when auth_required is off.');
      const source = stage === 'trustline' ? draft.distributorPublicKey : draft.issuerPublicKey;
      const operations = buildAssetIssuanceOperations(stage, draft.config, draft.issuerPublicKey, draft.distributorPublicKey);
      const account = await getServer('testnet').loadAccount(source);
      const transaction = new StellarSdk.TransactionBuilder(account, { fee: '100', networkPassphrase: NETWORKS.testnet.passphrase })
        .addOperation(operations[0])
        .setTimeout(180)
        .build();
      setPreview({ stage, xdr: transaction.toXDR() });
      setLockAcknowledged(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not build the transaction preview.');
    } finally { setBusy(''); }
  };

  const submitPreview = async () => {
    if (!preview) return;
    const stage = preview.stage;
    const sourceSecret = stage === 'trustline' ? secrets.distributor : secrets.issuer;
    setBusy(`submit-${stage}`); setError(''); setMessage('');
    try {
      if (stage === 'lock' && !lockAcknowledged) throw new Error('Acknowledge the irreversible issuer lock before signing.');
      if (!sourceSecret) throw new Error(`Enter the ${stage === 'trustline' ? 'distributor' : 'issuer'} secret key to sign this transaction.`);
      const keypair = StellarSdk.Keypair.fromSecret(sourceSecret);
      const expectedPublicKey = stage === 'trustline' ? draft.distributorPublicKey : draft.issuerPublicKey;
      if (keypair.publicKey() !== expectedPublicKey) throw new Error('The secret key does not match the transaction source account.');
      const transaction = StellarSdk.TransactionBuilder.fromXDR(preview.xdr, NETWORKS.testnet.passphrase) as StellarSdk.Transaction;
      transaction.sign(keypair);
      const result = await getServer('testnet').submitTransaction(transaction);
      updateDraft({ completed: { ...draft.completed, [stage]: true }, transactionHashes: { ...draft.transactionHashes, [stage]: result.hash } });
      setPreview(null);
      setMessage(`Transaction confirmed: ${result.hash}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Transaction submission failed. Your draft is still available to retry.');
    } finally { setBusy(''); }
  };

  const copyValue = async (value: string, label: string) => {
    try { await navigator.clipboard.writeText(value); setMessage(`${label} copied.`); }
    catch { setError(`Could not copy ${label.toLowerCase()} to the clipboard.`); }
  };

  const downloadText = (filename: string, content: string) => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
    link.download = filename; link.click(); URL.revokeObjectURL(link.href);
  };

  const exportKeys = () => {
    if (!secrets.issuer || !secrets.distributor) { setError('Enter both secret keys before exporting a backup.'); return; }
    downloadText('stellar-testnet-asset-keys.txt', `TESTNET ONLY - KEEP THIS FILE PRIVATE\nIssuer public key: ${draft.issuerPublicKey}\nIssuer secret key: ${secrets.issuer}\nDistributor public key: ${draft.distributorPublicKey}\nDistributor secret key: ${secrets.distributor}\n`);
  };

  const resetDraft = () => {
    if (!window.confirm('Clear this wizard draft and forget the account addresses? This does not delete or lock accounts on Stellar.')) return;
    setDraft(emptyDraft()); setSecrets({ issuer: '', distributor: '' }); setPreview(null); setError(''); setMessage('Draft cleared. Existing testnet accounts remain on-chain.');
  };

  const accountReady = draft.issuerFunded && draft.distributorFunded;
  const stageReady = (stage: AssetIssuanceStage) => {
    if (stage === 'configure') return accountReady;
    if (stage === 'trustline') return accountReady && Boolean(draft.completed.configure);
    if (stage === 'authorize') return accountReady && Boolean(draft.completed.trustline) && draft.config.authRequired;
    if (stage === 'issue') return accountReady && Boolean(draft.completed.trustline) && (!draft.config.authRequired || Boolean(draft.completed.authorize));
    return accountReady && Boolean(draft.completed.issue);
  };

  return (
    <main style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16, maxWidth: 920, margin: '0 auto', color: 'var(--text-primary)' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div><h1 style={{ margin: 0, fontSize: 21 }}>Testnet asset issuance</h1><p style={{ margin: '5px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>Create issuer and distributor accounts, configure policy, establish a trustline, and issue supply.</p></div>
        <div aria-label="Selected network" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '6px 9px', fontSize: 12 }}>TESTNET ONLY</div>
      </header>

      <section style={{ ...panelStyle, borderColor: 'var(--warning, #eab308)' }}>
        <strong style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13 }}><ShieldCheck size={16} /> Signing-key handling</strong>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Keys are generated and used in this browser. Only public addresses and progress are saved for resume; secret keys are never written to local storage. After a reload, re-enter both keys to continue. Never use these generated testnet keys on mainnet.</p>
      </section>

      <section style={panelStyle}>
        <h2 style={{ margin: 0, fontSize: 15 }}>1. Asset setup</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
          <Field label="Asset code"><input aria-label="Asset code" style={fieldStyle} value={draft.config.code} onChange={(event) => updateConfig({ code: event.target.value.toUpperCase() })} placeholder="DEMO" disabled={Boolean(draft.completed.configure)} /></Field>
          <Field label="Asset name"><input aria-label="Asset name" style={fieldStyle} value={draft.config.name} onChange={(event) => updateConfig({ name: event.target.value })} placeholder="Demo Credit" disabled={Boolean(draft.completed.configure)} /></Field>
          <Field label="Home domain"><input aria-label="Home domain" style={fieldStyle} value={draft.config.homeDomain} onChange={(event) => updateConfig({ homeDomain: event.target.value })} placeholder="example.org" disabled={Boolean(draft.completed.configure)} /></Field>
          <Field label="Initial supply"><input aria-label="Initial supply" inputMode="decimal" style={fieldStyle} value={draft.config.supply} onChange={(event) => updateConfig({ supply: event.target.value })} disabled={Boolean(draft.completed.configure)} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 8 }}>
          <label title="Holders need issuer authorization before the asset can be received." style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}><span><input type="checkbox" checked={draft.config.authRequired} onChange={(event) => updateConfig({ authRequired: event.target.checked })} disabled={Boolean(draft.completed.configure)} /> Auth required</span><span style={{ color: 'var(--text-muted)' }}>New trustlines cannot receive this asset until the issuer approves them. The wizard adds an approval transaction.</span></label>
          <label title="The issuer can freeze or revoke individual trustlines." style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}><span><input type="checkbox" checked={draft.config.authRevocable} onChange={(event) => updateConfig({ authRevocable: event.target.checked })} disabled={Boolean(draft.completed.configure) || draft.config.clawbackEnabled} /> Revocable</span><span style={{ color: 'var(--text-muted)' }}>The issuer can freeze or revoke holder authorization later. Clawback requires this control.</span></label>
          <label title="Enables the issuer to reclaim issued tokens from holders." style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}><span><input type="checkbox" checked={draft.config.clawbackEnabled} onChange={(event) => updateConfig({ clawbackEnabled: event.target.checked, authRevocable: event.target.checked || draft.config.authRevocable })} disabled={Boolean(draft.completed.configure)} /> Clawback</span><span style={{ color: 'var(--text-muted)' }}>Allows the issuer to reclaim tokens from any holder, a material holder risk. Automatically enables revocable authorization.</span></label>
        </div>
        {configErrors.length > 0 && <div role="alert" style={{ color: 'var(--warning, #eab308)', fontSize: 12 }}>{configErrors.join(' ')}</div>}
      </section>

      <section style={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><h2 style={{ margin: 0, fontSize: 15 }}>2. Create and fund testnet accounts</h2><button type="button" style={actionStyle} onClick={createAndFund} disabled={Boolean(busy)}>{busy === 'accounts' ? 'Working…' : 'Create and fund accounts'}</button></div>
        {draft.issuerPublicKey && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, fontSize: 12 }}>
          {(['issuer', 'distributor'] as const).map((role) => <div key={role} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><strong>{role === 'issuer' ? 'Issuer' : 'Distributor'} · {role === 'issuer' ? (draft.issuerFunded ? 'funded' : 'not funded') : (draft.distributorFunded ? 'funded' : 'not funded')}</strong><code style={{ overflowWrap: 'anywhere' }}>{role === 'issuer' ? draft.issuerPublicKey : draft.distributorPublicKey}</code><Field label={`${role === 'issuer' ? 'Issuer' : 'Distributor'} secret key (re-enter after reload)`}><input aria-label={`${role} secret key`} type={showSecrets ? 'text' : 'password'} autoComplete="off" style={fieldStyle} value={secrets[role]} onChange={(event) => setSecret(role, event.target.value)} /></Field></div>)}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}><button type="button" style={actionStyle} onClick={() => setShowSecrets((value) => !value)}>{showSecrets ? <EyeOff size={15} /> : <Eye size={15} />}{showSecrets ? 'Hide keys' : 'Reveal keys'}</button><button type="button" style={actionStyle} onClick={exportKeys}><Download size={15} /> Back up keys</button></div>
        </div>}
        {!draft.issuerPublicKey && <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 12 }}>Friendbot funds both generated accounts with test XLM. Account generation does not touch mainnet.</p>}
      </section>

      <section style={panelStyle}>
        <h2 style={{ margin: 0, fontSize: 15 }}>3. Preview and submit transactions</h2>
        {stages.filter((stage) => stage.id !== 'authorize' || draft.config.authRequired).map((stage, index) => {
          const completed = Boolean(draft.completed[stage.id]);
          return <article key={stage.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 11, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 8 }}><span style={{ color: completed ? 'var(--success, #22c55e)' : 'var(--text-muted)' }}>{completed ? <Check size={17} /> : `${index + 1}.`}</span><div><strong style={{ fontSize: 13 }}>{stage.title}</strong><div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 3 }}>{stage.description}</div></div></div>
              <button type="button" style={actionStyle} onClick={() => previewStage(stage.id)} disabled={!stageReady(stage.id) || Boolean(busy) || completed}>{busy === stage.id ? 'Preparing…' : 'Preview transaction'}</button>
            </div>
            {completed && draft.transactionHashes[stage.id] && <code style={{ fontSize: 11, overflowWrap: 'anywhere' }}>Confirmed: {draft.transactionHashes[stage.id]}</code>}
            {stage.id === 'lock' && <div style={{ display: 'flex', gap: 7, color: 'var(--danger, #ef4444)', fontSize: 12 }}><AlertTriangle size={16} />Irreversible: zeroing the issuer master weight removes the only signing authority. Do not continue unless you have reviewed every flag and do not need future issuer actions.</div>}
          </article>;
        })}
        {preview && <div style={{ ...panelStyle, background: 'var(--bg-canvas)' }}><strong style={{ fontSize: 13 }}>Transaction preview: {stages.find((stage) => stage.id === preview.stage)?.title}</strong><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 180, overflow: 'auto', margin: 0, fontSize: 10 }}>{preview.xdr}</pre>{preview.stage === 'lock' && <div style={{ display: 'flex', flexDirection: 'column', gap: 8, border: '1px solid var(--danger, #ef4444)', padding: 10, color: 'var(--danger, #ef4444)', fontSize: 12 }}><strong>Irreversible: this generated issuer will lose its signing authority permanently. No recovery is possible.</strong><label><input type="checkbox" checked={lockAcknowledged} onChange={(event) => setLockAcknowledged(event.target.checked)} /> I have verified the asset setup and understand this issuer cannot be operated again.</label></div>}<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button type="button" style={actionStyle} onClick={() => copyValue(preview.xdr, 'Transaction XDR')}><Copy size={14} /> Copy XDR</button><button type="button" style={actionStyle} onClick={submitPreview} disabled={Boolean(busy) || (preview.stage === 'lock' && !lockAcknowledged)}>{busy === `submit-${preview.stage}` ? 'Submitting…' : 'Sign and submit'}</button><button type="button" style={actionStyle} onClick={() => { setPreview(null); setLockAcknowledged(false); }}>Cancel</button></div></div>}
      </section>

      <section style={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><h2 style={{ margin: 0, fontSize: 15 }}>4. stellar.toml currency entry</h2><FileText size={17} /></div>
        {tomlSnippet ? <><pre style={{ margin: 0, padding: 12, background: 'var(--bg-canvas)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12 }}>{tomlSnippet}</pre><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button style={actionStyle} type="button" onClick={() => copyValue(tomlSnippet, 'stellar.toml snippet')}><Copy size={14} /> Copy snippet</button><button style={actionStyle} type="button" onClick={() => downloadText('stellar-currency.toml', tomlSnippet)}><Download size={14} /> Download TOML</button></div><div style={{ fontSize: 12 }}><strong>SEP-1 inspector currency check:</strong> {tomlIssues.filter((issue) => issue.severity === 'error').length === 0 ? 'No currency-entry errors.' : tomlIssues.filter((issue) => issue.severity === 'error').map((issue) => issue.message).join(' ') }{tomlIssues.filter((issue) => issue.severity === 'warning').map((issue) => <div key={issue.field} style={{ color: 'var(--warning, #eab308)', marginTop: 4 }}>{issue.message}</div>)}</div></> : <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 12 }}>Create accounts to generate a snippet with the issuer public key.</p>}
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 12 }}>Publish this entry at <code>https://{draft.config.homeDomain || 'your-domain'}/.well-known/stellar.toml</code>, then run the SEP-1 Inspector against the hosted file to check transport and issuer home_domain.</p>
      </section>

      {(error || message) && <div role={error ? 'alert' : 'status'} style={{ ...panelStyle, color: error ? 'var(--danger, #ef4444)' : 'var(--success, #22c55e)', fontSize: 12 }}>{error || message}</div>}
      <footer style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', color: 'var(--text-muted)', fontSize: 11 }}><span><LockKeyhole size={13} style={{ verticalAlign: 'middle' }} /> Resumable progress is saved locally; private keys are excluded.</span><button type="button" style={actionStyle} onClick={resetDraft}><Trash2 size={14} /> Clear draft</button></footer>
    </main>
  );
}