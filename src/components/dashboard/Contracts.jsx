import React, { useMemo, useState } from 'react'
import { useStore } from '../../lib/store'
import {
  fetchContractInfo,
  invokeContract,
  isValidContractId,
  NETWORKS,
  simulateContractCall,
} from '../../lib/stellar'

const ARGUMENT_TYPES = [
  { value: 'string', label: 'String' },
  { value: 'int', label: 'Int' },
  { value: 'address', label: 'Address' },
  { value: 'bool', label: 'Bool' },
]

function Panel({ title, subtitle, children }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px' }}>{title}</div>
        {subtitle && (
          <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {subtitle}
          </div>
        )}
      </div>
      <div style={{ padding: '18px' }}>
        {children}
      </div>
    </div>
  )
}

function LabeledField({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
        {label}
      </span>
      {children}
    </label>
  )
}

function textInputStyle(hasError = false) {
  return {
    width: '100%',
    background: 'var(--bg-elevated)',
    border: `1px solid ${hasError ? 'var(--red)' : 'var(--border-bright)'}`,
    borderRadius: 'var(--radius-md)',
    padding: '10px 14px',
    color: 'var(--text-primary)',
    fontSize: '13px',
    fontFamily: 'var(--font-mono)',
    outline: 'none',
    transition: 'var(--transition)',
    boxSizing: 'border-box',
  }
}

function ActionButton({ label, onClick, disabled, tone = 'primary' }) {
  const palette = tone === 'secondary'
    ? {
        background: 'var(--bg-elevated)',
        color: 'var(--text-primary)',
        border: '1px solid var(--border-bright)',
      }
    : {
        background: 'var(--cyan)',
        color: 'var(--bg-base)',
        border: 'none',
      }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '10px 16px',
        background: disabled ? 'var(--bg-elevated)' : palette.background,
        color: disabled ? 'var(--text-muted)' : palette.color,
        border: disabled ? '1px solid var(--border)' : palette.border,
        borderRadius: 'var(--radius-md)',
        fontFamily: 'var(--font-mono)',
        fontWeight: 700,
        fontSize: '12px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'var(--transition)',
      }}
    >
      {label}
    </button>
  )
}

function ResultBlock({ label, data }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
        {label}
      </div>
      <pre style={{
        margin: 0,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '14px',
        fontSize: '11px',
        color: 'var(--text-secondary)',
        overflowX: 'auto',
        lineHeight: 1.6,
        fontFamily: 'var(--font-mono)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  )
}

export default function Contracts() {
  const {
    network,
    contractId,
    setContractId,
    contractData,
    setContractData,
    contractLoading,
    setContractLoading,
    contractError,
    setContractError,
    connectedAddress,
  } = useStore()

  const [inspectInput, setInspectInput] = useState(contractId || '')
  const [invokeForm, setInvokeForm] = useState({
    contractId: contractId || '',
    functionName: '',
    sourceAccount: connectedAddress || '',
    secretKey: '',
    args: [{ type: 'string', value: '' }],
  })
  const [simulateLoading, setSimulateLoading] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [invokeError, setInvokeError] = useState('')
  const [simulationResult, setSimulationResult] = useState(null)
  const [submitResult, setSubmitResult] = useState(null)

  const isMainnet = network === 'mainnet'
  const inspectInputError = inspectInput.trim() !== '' && !isValidContractId(inspectInput.trim())
  const invokeContractError = invokeForm.contractId.trim() !== '' && !isValidContractId(invokeForm.contractId.trim())

  const invocationPreview = useMemo(() => ({
    contractId: invokeForm.contractId.trim(),
    functionName: invokeForm.functionName.trim(),
    sourceAccount: invokeForm.sourceAccount.trim() || connectedAddress || '',
    args: invokeForm.args.filter(arg => arg.value.trim() !== ''),
    network,
  }), [connectedAddress, invokeForm, network])

  function updateField(field, value) {
    setInvokeForm((current) => ({ ...current, [field]: value }))
  }

  function updateArgument(index, field, value) {
    setInvokeForm((current) => ({
      ...current,
      args: current.args.map((arg, argIndex) => (
        argIndex === index ? { ...arg, [field]: value } : arg
      )),
    }))
  }

  function addArgument() {
    setInvokeForm((current) => ({
      ...current,
      args: [...current.args, { type: 'string', value: '' }],
    }))
  }

  function removeArgument(index) {
    setInvokeForm((current) => ({
      ...current,
      args: current.args.filter((_, argIndex) => argIndex !== index),
    }))
  }

  async function handleFetch() {
    const id = inspectInput.trim()
    setContractId(id)
    setContractError(null)
    setContractData(null)

    if (!id) {
      setContractError('Enter a contract ID')
      return
    }

    if (!isValidContractId(id)) {
      setContractError('Enter a valid Soroban contract address')
      return
    }

    setContractLoading(true)
    try {
      const result = await fetchContractInfo(id, network)
      setContractData(result)
      setInvokeForm((current) => ({ ...current, contractId: id }))
    } catch (error) {
      setContractError(error.message || 'Failed to fetch contract')
    } finally {
      setContractLoading(false)
    }
  }

  async function handleSimulate() {
    setInvokeError('')
    setSubmitResult(null)
    setSimulationResult(null)
    setSimulateLoading(true)

    try {
      const result = await simulateContractCall(invocationPreview)
      setSimulationResult(result)
    } catch (error) {
      setInvokeError(error.message || 'Simulation failed')
    } finally {
      setSimulateLoading(false)
    }
  }

  async function handleSubmit() {
    setInvokeError('')
    setSubmitResult(null)
    setSubmitLoading(true)

    try {
      const result = await invokeContract({
        contractId: invocationPreview.contractId,
        functionName: invocationPreview.functionName,
        args: invocationPreview.args,
        secretKey: invokeForm.secretKey,
        network,
      })
      setSubmitResult(result)
    } catch (error) {
      setInvokeError(error.message || 'Submission failed')
    } finally {
      setSubmitLoading(false)
    }
  }

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700 }}>Soroban Contracts</div>

      <Panel
        title="Inspect Contract"
        subtitle={`Read deployed contract data from ${NETWORKS[network].name}.`}
      >
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input
            value={inspectInput}
            onChange={(event) => setInspectInput(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleFetch()}
            placeholder="C... contract address"
            style={{ ...textInputStyle(inspectInputError), flex: 1, minWidth: '280px' }}
          />
          <ActionButton
            label={contractLoading ? 'Loading...' : 'Inspect'}
            onClick={handleFetch}
            disabled={contractLoading}
          />
        </div>
        {contractError && (
          <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--red)' }}>
            {contractError}
          </div>
        )}
      </Panel>

      {contractData && (
        <ResultBlock label="Contract Data" data={contractData} />
      )}

      <Panel
        title="Invoke Contract"
        subtitle="Build a contract call, simulate it through Soroban RPC, and optionally submit it on Testnet using a secret key."
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '18px' }}>
          <LabeledField label="Contract ID">
            <input
              value={invokeForm.contractId}
              onChange={(event) => updateField('contractId', event.target.value)}
              placeholder="C... contract address"
              style={textInputStyle(invokeContractError)}
            />
          </LabeledField>

          <LabeledField label="Function">
            <input
              value={invokeForm.functionName}
              onChange={(event) => updateField('functionName', event.target.value)}
              placeholder="increment"
              style={textInputStyle()}
            />
          </LabeledField>

          <LabeledField label="Source Account">
            <input
              value={invokeForm.sourceAccount}
              onChange={(event) => updateField('sourceAccount', event.target.value)}
              placeholder={connectedAddress || 'G... source account'}
              style={textInputStyle()}
            />
          </LabeledField>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Typed Arguments
          </div>
          <ActionButton label="Add Argument" onClick={addArgument} tone="secondary" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '18px' }}>
          {invokeForm.args.map((arg, index) => (
            <div key={index} style={{ display: 'grid', gridTemplateColumns: '140px 1fr auto', gap: '10px', alignItems: 'center' }}>
              <select
                value={arg.type}
                onChange={(event) => updateArgument(index, 'type', event.target.value)}
                style={textInputStyle()}
              >
                {ARGUMENT_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>

              <input
                value={arg.value}
                onChange={(event) => updateArgument(index, 'value', event.target.value)}
                placeholder={arg.type === 'bool' ? 'true or false' : 'Argument value'}
                style={textInputStyle()}
              />

              <ActionButton
                label="Remove"
                onClick={() => removeArgument(index)}
                disabled={invokeForm.args.length === 1}
                tone="secondary"
              />
            </div>
          ))}
        </div>

        <div style={{
          marginBottom: '18px',
          padding: '14px',
          borderRadius: 'var(--radius-md)',
          border: `1px solid ${isMainnet ? 'var(--amber)' : 'var(--border)'}`,
          background: isMainnet ? 'rgba(255, 184, 0, 0.08)' : 'var(--bg-elevated)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}>
          <div style={{ fontSize: '12px', color: isMainnet ? 'var(--amber)' : 'var(--text-secondary)', lineHeight: 1.6 }}>
            {isMainnet
              ? 'Mainnet safety mode is active. Simulation still works, but transaction submission is disabled.'
              : 'Submission is available on Testnet only. Your secret key is used locally to sign the prepared transaction before it is sent to Soroban RPC.'}
          </div>

          <LabeledField label="Secret Key For Submit">
            <input
              type="password"
              value={invokeForm.secretKey}
              onChange={(event) => updateField('secretKey', event.target.value)}
              placeholder="S... testnet secret key"
              style={textInputStyle()}
            />
          </LabeledField>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <ActionButton
            label={simulateLoading ? 'Simulating...' : 'Simulate'}
            onClick={handleSimulate}
            disabled={simulateLoading || submitLoading}
          />
          <ActionButton
            label={submitLoading ? 'Submitting...' : 'Submit'}
            onClick={handleSubmit}
            disabled={isMainnet || submitLoading || simulateLoading}
            tone="secondary"
          />
        </div>

        {invokeError && (
          <div style={{ marginTop: '14px', fontSize: '12px', color: 'var(--red)', lineHeight: 1.5 }}>
            {invokeError}
          </div>
        )}
      </Panel>

      {simulationResult && (
        <div style={{ display: 'grid', gap: '16px' }}>
          <ResultBlock
            label="Simulation Summary"
            data={{
              result: simulationResult.result,
              cost: simulationResult.cost,
              latestLedger: simulationResult.latestLedger,
              transactionXdr: simulationResult.xdr,
            }}
          />
          <ResultBlock label="Simulation Events" data={simulationResult.events} />
          <ResultBlock label="Simulation Footprint" data={simulationResult.footprint} />
        </div>
      )}

      {submitResult && (
        <ResultBlock label="Submission Result" data={submitResult} />
      )}

      {!contractData && !contractLoading && !contractError && (
        <Panel
          title="Contract Toolkit"
          subtitle={`Inspect storage, simulate calls, and safely test submissions against ${NETWORKS[network].name}.`}
        >
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {[
              { label: 'Storage Inspector', desc: 'Look up deployed instance data.' },
              { label: 'Call Simulator', desc: 'Preview return values, events, and footprint.' },
              { label: 'RPC Endpoint', desc: NETWORKS[network].sorobanUrl },
            ].map((item) => (
              <div key={item.label} style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                minWidth: '190px',
                flex: '1 1 190px',
              }}>
                <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '4px', fontSize: '12px' }}>
                  {item.label}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', lineHeight: 1.6 }}>
                  {item.desc}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  )
}
