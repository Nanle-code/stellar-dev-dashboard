/**
 * Alert Rules Management UI
 */

import React, { useState } from 'react'
import { useStore } from '../../lib/store'
import { useAlertRules } from '../../hooks/useAlertRules'
import type { AlertRuleType, ExecutionFrequency, NotificationChannel } from '../../types/alerts'
import { requestBrowserNotificationPermission, getBrowserNotificationPermission } from '../../lib/alertNotifications'
import { isValidPublicKey } from '../../lib/stellar'
import { format } from 'date-fns'

const OPERATION_TYPES = ['payment', 'create_account', 'path_payment_strict_send', 'path_payment_strict_receive', 'manage_buy_offer', 'manage_sell_offer', 'change_trust', 'account_merge']

export default function AlertRules() {
  const { connectedAddress } = useStore()
  const { rules, notifications, loading, error, engineRunning, addRule, removeRule, toggleRule, markRead, markAllRead } = useAlertRules()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [ruleType, setRuleType] = useState<AlertRuleType>('balance_threshold')
  const [accountAddress, setAccountAddress] = useState(connectedAddress || '')
  const [assetCode, setAssetCode] = useState('XLM')
  const [assetIssuer, setAssetIssuer] = useState('')
  const [threshold, setThreshold] = useState('100')
  const [direction, setDirection] = useState<'below' | 'above'>('below')
  const [operationTypes, setOperationTypes] = useState<string[]>(['payment'])
  const [counterpartyAddress, setCounterpartyAddress] = useState('')
  const [counterpartyDirection, setCounterpartyDirection] = useState<'incoming' | 'outgoing' | 'any'>('any')
  const [executionFrequency, setExecutionFrequency] = useState<ExecutionFrequency>(60)
  const [notificationChannels, setNotificationChannels] = useState<NotificationChannel[]>(['in_app'])
  const [formError, setFormError] = useState('')

  const unreadCount = notifications.filter(n => !n.read).length
  const browserPermission = getBrowserNotificationPermission()

  const handleCreateRule = async () => {
    setFormError('')
    if (!isValidPublicKey(accountAddress)) {
      setFormError('Invalid account address')
      return
    }
    let config: any
    if (ruleType === 'balance_threshold') {
      const thresholdNum = parseFloat(threshold)
      if (isNaN(thresholdNum) || thresholdNum < 0) {
        setFormError('Invalid threshold value')
        return
      }
      config = { assetCode, assetIssuer: assetIssuer || undefined, threshold: thresholdNum, direction }
    } else if (ruleType === 'operation_type') {
      if (operationTypes.length === 0) {
        setFormError('Select at least one operation type')
        return
      }
      config = { operationTypes }
    } else if (ruleType === 'counterparty') {
      if (!isValidPublicKey(counterpartyAddress)) {
        setFormError('Invalid counterparty address')
        return
      }
      config = { counterpartyAddress, direction: counterpartyDirection }
    }
    if (notificationChannels.includes('browser') && browserPermission !== 'granted') {
      const granted = await requestBrowserNotificationPermission()
      if (!granted) {
        setFormError('Browser notification permission denied')
        return
      }
    }
    try {
      await addRule({ userId: connectedAddress!, accountAddress, type: ruleType, config, executionFrequency, enabled: true, notificationChannels })
      setShowCreateForm(false)
      setAccountAddress(connectedAddress || '')
      setAssetCode('XLM')
      setAssetIssuer('')
      setThreshold('100')
      setOperationTypes(['payment'])
      setCounterpartyAddress('')
      setFormError('')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create rule')
    }
  }

  const toggleOperationType = (type: string) => {
    setOperationTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type])
  }

  const toggleNotificationChannel = (channel: NotificationChannel) => {
    setNotificationChannels(prev => prev.includes(channel) ? prev.filter(c => c !== channel) : [...prev, channel])
  }

  if (!connectedAddress) {
    return <div className="animate-in" style={{ padding: '40px', textAlign: 'center' }}><div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Connect an account to manage alert rules</div></div>
  }

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700 }}>Alert Rules</div><div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Monitor account activity and receive notifications</div></div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ padding: '6px 12px', background: engineRunning ? 'var(--green-glow)' : 'var(--bg-elevated)', border: `1px solid ${engineRunning ? 'var(--green)' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)', fontSize: '11px', color: engineRunning ? 'var(--green)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: '6px' }}><span>{engineRunning ? '●' : '○'}</span>{engineRunning ? 'ACTIVE' : 'INACTIVE'}</div>
          <button onClick={() => setShowNotifications(!showNotifications)} style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '12px', cursor: 'pointer', position: 'relative' }}>🔔 Notifications{unreadCount > 0 && <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: 'var(--cyan)', color: '#0a0a0a', borderRadius: '999px', fontSize: '10px', fontWeight: 700, padding: '2px 6px', minWidth: '18px' }}>{unreadCount}</span>}</button>
          <button onClick={() => setShowCreateForm(!showCreateForm)} style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--cyan-dim)', background: 'var(--cyan-glow)', color: 'var(--cyan)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>+ Create Rule</button>
        </div>
      </div>
      {error && <div style={{ padding: '12px 16px', background: 'rgba(255, 0, 0, 0.1)', border: '1px solid var(--red)', borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--red)' }}>{error}</div>}
      {showNotifications && <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}><div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px' }}>Notifications ({notifications.length})</div>{unreadCount > 0 && <button onClick={markAllRead} style={{ padding: '4px 8px', fontSize: '11px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>Mark all read</button>}</div><div style={{ maxHeight: '400px', overflowY: 'auto' }}>{notifications.length === 0 ? <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>No notifications yet</div> : notifications.map(notif => <div key={notif.id} onClick={() => !notif.read && markRead(notif.id)} style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', background: notif.read ? 'transparent' : 'var(--cyan-glow-sm)', cursor: notif.read ? 'default' : 'pointer' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}><div style={{ flex: 1 }}><div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{notif.title}</div><div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>{notif.message}</div><div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>{format(new Date(notif.triggeredAt), 'MMM d, yyyy HH:mm:ss')}</div></div>{!notif.read && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--cyan)', flexShrink: 0 }} />}</div></div>)}</div></div>}
      {showCreateForm && <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '18px' }}><div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '14px', marginBottom: '16px' }}>Create Alert Rule</div>{formError && <div style={{ padding: '8px 12px', background: 'rgba(255, 0, 0, 0.1)', border: '1px solid var(--red)', borderRadius: 'var(--radius-sm)', fontSize: '11px', color: 'var(--red)', marginBottom: '12px' }}>{formError}</div>}<div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}><label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}><span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Rule Type</span><select value={ruleType} onChange={e => setRuleType(e.target.value as AlertRuleType)} style={{ padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '12px' }}><option value="balance_threshold">Balance Threshold</option><option value="operation_type">Operation Type</option><option value="counterparty">Counterparty</option></select></label><label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}><span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Account Address</span><input type="text" value={accountAddress} onChange={e => setAccountAddress(e.target.value)} placeholder="G..." style={{ padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '12px', fontFamily: 'var(--font-mono)' }} /></label>{ruleType === 'balance_threshold' && <><label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}><span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Asset Code</span><input type="text" value={assetCode} onChange={e => setAssetCode(e.target.value)} placeholder="XLM" style={{ padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '12px' }} /></label><label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}><span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Threshold</span><input type="number" value={threshold} onChange={e => setThreshold(e.target.value)} placeholder="100" style={{ padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '12px' }} /></label><label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}><span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Direction</span><select value={direction} onChange={e => setDirection(e.target.value as 'below' | 'above')} style={{ padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '12px' }}><option value="below">Below</option><option value="above">Above</option></select></label></>}{ruleType === 'operation_type' && <div style={{ gridColumn: '1 / -1' }}><span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Operation Types</span><div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>{OPERATION_TYPES.map(type => <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}><input type="checkbox" checked={operationTypes.includes(type)} onChange={() => toggleOperationType(type)} /><span>{type.replace(/_/g, ' ')}</span></label>)}</div></div>}{ruleType === 'counterparty' && <><label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}><span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Counterparty Address</span><input type="text" value={counterpartyAddress} onChange={e => setCounterpartyAddress(e.target.value)} placeholder="G..." style={{ padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '12px', fontFamily: 'var(--font-mono)' }} /></label><label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}><span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Direction</span><select value={counterpartyDirection} onChange={e => setCounterpartyDirection(e.target.value as 'incoming' | 'outgoing' | 'any')} style={{ padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '12px' }}><option value="any">Any</option><option value="incoming">Incoming</option><option value="outgoing">Outgoing</option></select></label></>}<label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}><span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Check Frequency</span><select value={executionFrequency} onChange={e => setExecutionFrequency(Number(e.target.value) as ExecutionFrequency)} style={{ padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '12px' }}><option value={30}>Every 30 seconds</option><option value={60}>Every minute</option><option value={300}>Every 5 minutes</option><option value={600}>Every 10 minutes</option></select></label><div style={{ gridColumn: '1 / -1' }}><span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Notification Channels</span><div style={{ display: 'flex', gap: '16px' }}><label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}><input type="checkbox" checked={notificationChannels.includes('in_app')} onChange={() => toggleNotificationChannel('in_app')} /><span>In-App</span></label><label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}><input type="checkbox" checked={notificationChannels.includes('browser')} onChange={() => toggleNotificationChannel('browser')} disabled={browserPermission === 'denied'} /><span>Browser {browserPermission === 'denied' && '(denied)'}</span></label></div></div></div><div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}><button onClick={() => setShowCreateForm(false)} style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer' }}>Cancel</button><button onClick={handleCreateRule} style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--cyan-dim)', background: 'var(--cyan-glow)', color: 'var(--cyan)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Create Rule</button></div></div>}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}><div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px' }}>Active Rules ({rules.length})</div>{loading ? <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>Loading rules...</div> : rules.length === 0 ? <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>No alert rules configured. Create your first rule to start monitoring.</div> : rules.map(rule => <div key={rule.id} style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}><div style={{ flex: 1 }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}><span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '3px', background: 'var(--cyan-glow)', border: '1px solid var(--cyan)', color: 'var(--cyan)' }}>{rule.type.replace(/_/g, ' ')}</span><span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{rule.type === 'balance_threshold' && `${(rule.config as any).assetCode} ${(rule.config as any).direction} ${(rule.config as any).threshold}`}{rule.type === 'operation_type' && `${(rule.config as any).operationTypes.join(', ')}`}{rule.type === 'counterparty' && `${(rule.config as any).direction} with ${(rule.config as any).counterpartyAddress.slice(0, 8)}...`}</span></div><div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{rule.accountAddress.slice(0, 12)}... • Check every {rule.executionFrequency}s{rule.lastTriggeredAt && ` • Last triggered ${format(new Date(rule.lastTriggeredAt), 'MMM d HH:mm')}`}</div></div><div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><button onClick={() => toggleRule(rule.id)} style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: `1px solid ${rule.enabled ? 'var(--green)' : 'var(--border)'}`, background: rule.enabled ? 'var(--green-glow)' : 'var(--bg-elevated)', color: rule.enabled ? 'var(--green)' : 'var(--text-muted)', fontSize: '11px', cursor: 'pointer' }}>{rule.enabled ? 'Enabled' : 'Disabled'}</button><button onClick={() => removeRule(rule.id)} style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--red-dim)', background: 'var(--red-glow)', color: 'var(--red)', fontSize: '11px', cursor: 'pointer' }}>Delete</button></div></div>)}</div>
    </div>
  )
}
