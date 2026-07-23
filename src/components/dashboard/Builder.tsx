import React, { useState, useEffect } from 'react'
import { useStore } from '../../lib/store'
import { buildTransaction, simulateTransaction, exportTransactionXDR } from '../../lib/stellar'
import AdvancedTransactionSimulation from './AdvancedTransactionSimulation'
import { StatCard } from './Card'
import { Plus, Trash2, Play, Copy, AlertCircle, CheckCircle } from 'lucide-react'

const OPERATION_TYPES = [
  { id: 'payment', label: 'Payment', icon: '→' },
  { id: 'createAccount', label: 'Create Account', icon: '+' },
  { id: 'clawback', label: 'Clawback', icon: '↶' },
  { id: 'beginSponsoringFutureReserves', label: 'Begin Sponsoring', icon: 'Ⓢ' },
  { id: 'endSponsoringFutureReserves', label: 'End Sponsoring', icon: 'Ⓔ' },
  { id: 'feeBump', label: 'Fee-Bump Transaction', icon: '⇧' },
]

export default function Builder() {
  const { network } = useStore()
  const [operations, setOperations] = useState([])
  const [memo, setMemo] = useState('')
  const [baseFee, setBaseFee] = useState('100')
  const [timeBounds, setTimeBounds] = useState({ minTime: '', maxTime: '' })
  const [sourceAccount, setSourceAccount] = useState('')
  const [simulation, setSimulation] = useState(null)
  const [isSimulating, setIsSimulating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const transactionParams = {
    sourceAccount,
    operations,
    memo,
    baseFee: parseInt(baseFee || '100', 10),
    timeBounds,
    network,
  }

  // Reset transaction when network changes
  useEffect(() => {
    setOperations([])
    setMemo('')
    setBaseFee('100')
    setTimeBounds({ minTime: '', maxTime: '' })
    setSourceAccount('')
    setSimulation(null)
    setError('')
    setSuccess('')
  }, [network])

  const addOperation = (type) => {
    const newOp = {
      id: Date.now(),
      type,
    }
    
    if (type === 'payment') {
      newOp.destination = ''
      newOp.asset = 'XLM'
      newOp.amount = ''
    } else if (type === 'createAccount') {
      newOp.destination = ''
      newOp.startingBalance = ''
    } else if (type === 'clawback') {
      newOp.assetCode = ''
      newOp.assetIssuer = ''
      newOp.from = ''
      newOp.amount = ''
    } else if (type === 'beginSponsoringFutureReserves') {
      newOp.sponsoredId = ''
    } else if (type === 'endSponsoringFutureReserves') {
      // No additional fields needed
    } else if (type === 'feeBump') {
      newOp.feeSource = ''
      newOp.baseFee = ''
      newOp.innerTransaction = ''
    }
    
    setOperations([...operations, newOp])
  }

  const updateOperation = (id, field, value) => {
    setOperations(ops => ops.map(op => 
      op.id === id ? { ...op, [field]: value } : op
    ))
  }

  const removeOperation = (id) => {
    setOperations(ops => ops.filter(op => op.id !== id))
  }

  const handleSimulate = async () => {
    if (!sourceAccount) {
      setError('Source account is required')
      return
    }

    setIsSimulating(true)
    setError('')
    setSimulation(null)

    try {
      const result = await simulateTransaction({
        sourceAccount,
        operations,
        memo,
        baseFee: parseInt(baseFee),
        timeBounds,
        network
      })
      setSimulation(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSimulating(false)
    }
  }

  const handleExportXDR = async () => {
    if (!sourceAccount) {
      setError('Source account is required')
      return
    }

    try {
      const xdr = await exportTransactionXDR({
        sourceAccount,
        operations,
        memo,
        baseFee: parseInt(baseFee),
        timeBounds,
        network
      })
      
      await navigator.clipboard.writeText(xdr)
      setSuccess('Transaction XDR copied to clipboard!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700 }}>
        Transaction Builder
      </div>

      {/* Source Account */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '18px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px', marginBottom: '12px' }}>
          Source Account
        </div>
        <input
          type="text"
          placeholder="Enter source account public key (G...)"
          value={sourceAccount}
          onChange={(e) => setSourceAccount(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)'
          }}
        />
      </div>

      {/* Operations */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ 
          padding: '14px 18px', 
          borderBottom: '1px solid var(--border)', 
          fontFamily: 'var(--font-display)', 
          fontWeight: 600, 
          fontSize: '13px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          Operations ({operations.length})
          <div style={{ display: 'flex', gap: '8px' }}>
            {OPERATION_TYPES.map(type => (
              <button
                key={type.id}
                onClick={() => addOperation(type.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  background: 'var(--cyan-glow)',
                  border: '1px solid var(--cyan-dim)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--cyan)',
                  cursor: 'pointer'
                }}
              >
                <Plus size={12} />
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {operations.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
            No operations added. Click the buttons above to add operations.
          </div>
        ) : (
          <div style={{ padding: '18px' }}>
            {operations.map((op, index) => (
              <OperationCard
                key={op.id}
                operation={op}
                index={index}
                onUpdate={updateOperation}
                onRemove={removeOperation}
              />
            ))}
          </div>
        )}
      </div>

      {/* Transaction Settings */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
        {/* Memo */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '18px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px', marginBottom: '12px' }}>
            Memo (Optional)
          </div>
          <input
            type="text"
            placeholder="Transaction memo"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              fontSize: '12px'
            }}
          />
        </div>

        {/* Base Fee */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '18px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px', marginBottom: '12px' }}>
            Base Fee (stroops)
          </div>
          <input
            type="number"
            placeholder="100"
            value={baseFee}
            onChange={(e) => setBaseFee(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)'
            }}
          />
        </div>
      </div>

      {/* Time Bounds */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '18px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px', marginBottom: '12px' }}>
          Time Bounds (Optional)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
              Min Time (Unix timestamp)
            </label>
            <input
              type="number"
              placeholder="0"
              value={timeBounds.minTime}
              onChange={(e) => setTimeBounds(prev => ({ ...prev, minTime: e.target.value }))}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)'
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
              Max Time (Unix timestamp)
            </label>
            <input
              type="number"
              placeholder="0"
              value={timeBounds.maxTime}
              onChange={(e) => setTimeBounds(prev => ({ ...prev, maxTime: e.target.value }))}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)'
              }}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={handleSimulate}
          disabled={isSimulating || operations.length === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 18px',
            background: 'var(--cyan-glow)',
            border: '1px solid var(--cyan)',
            borderRadius: 'var(--radius)',
            color: 'var(--cyan)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: operations.length === 0 ? 'not-allowed' : 'pointer',
            opacity: operations.length === 0 ? 0.5 : 1
          }}
        >
          <Play size={14} />
          {isSimulating ? 'Simulating...' : 'Simulate'}
        </button>

        <button
          onClick={handleExportXDR}
          disabled={operations.length === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 18px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            color: 'var(--text-primary)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: operations.length === 0 ? 'not-allowed' : 'pointer',
            opacity: operations.length === 0 ? 0.5 : 1
          }}
        >
          <Copy size={14} />
          Export XDR
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 16px',
          background: 'var(--red-glow)',
          border: '1px solid var(--red)',
          borderRadius: 'var(--radius)',
          color: 'var(--red)',
          fontSize: '12px'
        }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {success && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 16px',
          background: 'var(--green-glow)',
          border: '1px solid var(--green)',
          borderRadius: 'var(--radius)',
          color: 'var(--green)',
          fontSize: '12px'
        }}>
          <CheckCircle size={16} />
          {success}
        </div>
      )}

      {/* Simulation Results */}
      {simulation && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px' }}>
            Simulation Results
          </div>
          <div style={{ padding: '18px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <StatCard 
                label="Estimated Fee" 
                value={`${simulation.fee} stroops`} 
                accent="var(--cyan)" 
              />
              <StatCard 
                label="Operations" 
                value={simulation.operationCount} 
                accent="var(--green)" 
              />
              {simulation.resourceUsage && (
                <StatCard 
                  label="CPU Instructions" 
                  value={simulation.resourceUsage.cpuInstructions?.toLocaleString()} 
                  accent="var(--amber)" 
                />
              )}
            </div>
            
            {simulation.warnings && simulation.warnings.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--amber)', marginBottom: '8px' }}>
                  Warnings:
                </div>
                {simulation.warnings.map((warning, index) => (
                  <div key={index} style={{
                    padding: '8px 12px',
                    background: 'var(--amber-glow)',
                    border: '1px solid var(--amber)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--amber)',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    marginBottom: '4px'
                  }}>
                    {warning}
                  </div>
                ))}
              </div>
            )}

            {simulation.feeOptions && simulation.feeOptions.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Fee priority guidance:
                </div>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {simulation.feeOptions.map((option) => (
                    <div key={option.label} style={{
                      padding: '10px 12px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-secondary)',
                      fontSize: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '12px'
                    }}>
                      <span>{option.label}</span>
                      <span>{option.fee} stroops</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {simulation.errors && simulation.errors.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--red)', marginBottom: '8px' }}>
                  Errors:
                </div>
                {simulation.errors.map((error, index) => (
                  <div key={index} style={{
                    padding: '8px 12px',
                    background: 'var(--red-glow)',
                    border: '1px solid var(--red)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--red)',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    marginBottom: '4px'
                  }}>
                    {error}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <AdvancedTransactionSimulation transactionParams={transactionParams} />
    </div>
  )
}

function OperationCard({ operation, index, onUpdate, onRemove }) {
  const { type } = operation
  
  const getTypeLabel = () => {
    switch (type) {
      case 'payment': return 'Payment'
      case 'createAccount': return 'Create Account'
      case 'clawback': return 'Clawback'
      case 'beginSponsoringFutureReserves': return 'Begin Sponsoring Future Reserves'
      case 'endSponsoringFutureReserves': return 'End Sponsoring Future Reserves'
      case 'feeBump': return 'Fee-Bump Transaction'
      default: return type
    }
  }

  const fieldInputStyle = {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
    fontSize: '11px',
    fontFamily: 'var(--font-mono)'
  }

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '16px',
      marginBottom: '12px',
      background: 'var(--bg-surface)'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px'
      }}>
        <div style={{
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--text-primary)'
        }}>
          Operation {index + 1}: {getTypeLabel()}
        </div>
        <button
          onClick={() => onRemove(operation.id)}
          style={{
            padding: '4px',
            background: 'transparent',
            border: 'none',
            color: 'var(--red)',
            cursor: 'pointer'
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: type === 'payment' ? '1fr 1fr 1fr' : type === 'clawback' ? '1fr 1fr 1fr 1fr' : type === 'feeBump' ? '1fr' : '1fr', gap: '12px' }}>
        {type === 'payment' && (
          <>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                Destination
              </label>
              <input
                type="text"
                placeholder="G..."
                value={operation.destination}
                onChange={(e) => onUpdate(operation.id, 'destination', e.target.value)}
                style={fieldInputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                Asset
              </label>
              <select
                value={operation.asset}
                onChange={(e) => onUpdate(operation.id, 'asset', e.target.value)}
                style={{...fieldInputStyle, fontFamily: 'inherit'}}
              >
                <option value="XLM">XLM</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                Amount
              </label>
              <input
                type="text"
                placeholder="0.0000000"
                value={operation.amount}
                onChange={(e) => onUpdate(operation.id, 'amount', e.target.value)}
                style={fieldInputStyle}
              />
            </div>
          </>
        )}
        
        {type === 'createAccount' && (
          <>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                Destination
              </label>
              <input
                type="text"
                placeholder="G..."
                value={operation.destination}
                onChange={(e) => onUpdate(operation.id, 'destination', e.target.value)}
                style={fieldInputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                Starting Balance
              </label>
              <input
                type="text"
                placeholder="1.0000000"
                value={operation.startingBalance}
                onChange={(e) => onUpdate(operation.id, 'startingBalance', e.target.value)}
                style={fieldInputStyle}
              />
            </div>
          </>
        )}
        
        {type === 'clawback' && (
          <>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                Asset Code
              </label>
              <input
                type="text"
                placeholder="USDC"
                value={operation.assetCode || ''}
                onChange={(e) => onUpdate(operation.id, 'assetCode', e.target.value)}
                style={fieldInputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                Asset Issuer
              </label>
              <input
                type="text"
                placeholder="G..."
                value={operation.assetIssuer || ''}
                onChange={(e) => onUpdate(operation.id, 'assetIssuer', e.target.value)}
                style={fieldInputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                From
              </label>
              <input
                type="text"
                placeholder="G..."
                value={operation.from || ''}
                onChange={(e) => onUpdate(operation.id, 'from', e.target.value)}
                style={fieldInputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                Amount
              </label>
              <input
                type="text"
                placeholder="0.0000000"
                value={operation.amount || ''}
                onChange={(e) => onUpdate(operation.id, 'amount', e.target.value)}
                style={fieldInputStyle}
              />
            </div>
          </>
        )}
        
        {type === 'beginSponsoringFutureReserves' && (
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
              Sponsored ID
            </label>
            <input
              type="text"
              placeholder="G..."
              value={operation.sponsoredId || ''}
              onChange={(e) => onUpdate(operation.id, 'sponsoredId', e.target.value)}
              style={fieldInputStyle}
            />
          </div>
        )}
        
        {type === 'endSponsoringFutureReserves' && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '8px', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            This operation has no parameters. The account calling this operation ends its own sponsorship.
          </div>
        )}

        {type === 'feeBump' && (
          <>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                Fee Source Account
              </label>
              <input
                type="text"
                placeholder="G... account paying fee-bump fee"
                value={operation.feeSource || ''}
                onChange={(e) => onUpdate(operation.id, 'feeSource', e.target.value)}
                style={fieldInputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                Base Fee (stroops)
              </label>
              <input
                type="number"
                placeholder="100"
                value={operation.baseFee || ''}
                onChange={(e) => onUpdate(operation.id, 'baseFee', e.target.value)}
                style={fieldInputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                Inner Transaction XDR
              </label>
              <textarea
                placeholder="Paste the signed inner transaction XDR envelope here"
                value={operation.innerTransaction || ''}
                onChange={(e) => onUpdate(operation.id, 'innerTransaction', e.target.value)}
                style={{
                  ...fieldInputStyle,
                  minHeight: '80px',
                  resize: 'vertical'
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
