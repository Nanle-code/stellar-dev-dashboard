import React, { useMemo, useState, useEffect } from 'react'
import { useStore } from '../../lib/store'
import ContractDeployerView from '../deployment/ContractDeployer'
import ContractRecommendations from './ContractRecommendations'
import {
  fetchContractInfo,
  invokeContract,
  isValidContractId,
  NETWORKS,
  simulateContractCall,
} from '../../lib/stellar'
import { parseContractWasm } from '../../lib/contractInvoker'
import { useContractRecommendations } from '../../hooks/useContractRecommendations'
import { Sparkles, AlertTriangle, AlertCircle } from 'lucide-react'
import {
  buildContractWorkspace,
  generateDeploymentPlan,
  getContractTemplates,
  initDebugSession,
} from '../../lib/contractDevelopment'
import TemplateLibrary from '../templates/TemplateLibrary'
import ContractDebugger from './ContractDebugger.jsx'
import TestRunner from '../testing/TestRunner'

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
  const [mode, setMode] = useState('inspect')
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
    args: [{ type: 'string', value: '', name: '' }],
  })
  const [contractFunctions, setContractFunctions] = useState([])
  const [simulateLoading, setSimulateLoading] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [invokeError, setInvokeError] = useState('')
  const [simulationResult, setSimulationResult] = useState(null)
  const [submitResult, setSubmitResult] = useState(null)
  const [templateId, setTemplateId] = useState('token')
  const [workspace, setWorkspace] = useState(() => buildContractWorkspace('token'))
  const [sourceEditor, setSourceEditor] = useState(() => buildContractWorkspace('token').source)
  const [testEditor, setTestEditor] = useState(() => buildContractWorkspace('token').tests)
  const [deployPlan, setDeployPlan] = useState(null)
  const [debugSession, setDebugSession] = useState(null)

  const isMainnet = network === 'mainnet'
  const inspectInputError = inspectInput.trim() !== '' && !isValidContractId(inspectInput.trim())
  const invokeContractError = invokeForm.contractId.trim() !== '' && !isValidContractId(invokeForm.contractId.trim())

  useEffect(() => {
    if (!invokeForm.contractId || !isValidContractId(invokeForm.contractId.trim())) {
      setContractFunctions([])
      return
    }
    let isCurrent = true
    parseContractWasm(invokeForm.contractId.trim(), network)
      .then(res => {
        if (isCurrent && res && res.functions) {
          setContractFunctions(res.functions)
        }
      })
      .catch(err => {
        if (isCurrent) {
          console.warn("Failed to load contract specification for recommendations:", err)
        }
      })
    return () => {
      isCurrent = false
    }
  }, [invokeForm.contractId, network])

  const {
    recommendations,
    track,
    getParamSuggestions,
    getAnomalies,
  } = useContractRecommendations({
    contractFunctions,
    contractId: invokeForm.contractId,
    currentFunction: invokeForm.functionName,
  })

  const currentFuncMeta = contractFunctions.find(f => f.name === invokeForm.functionName)
  const parameterDefinitions = currentFuncMeta?.parameters || []

  const mappedArgsForAnomaly = invokeForm.args.map((arg, idx) => ({
    name: parameterDefinitions[idx]?.name || arg.name || `arg${idx}`,
    type: arg.type,
    value: arg.value
  }))

  const anomalies = getAnomalies(invokeForm.functionName, mappedArgsForAnomaly, parameterDefinitions)
  const suggestions = getParamSuggestions(invokeForm.functionName, parameterDefinitions)

  function applyAllSuggestions() {
    if (!suggestions) return
    setInvokeForm(current => {
      const nextArgs = current.args.map((arg, idx) => {
        const paramName = parameterDefinitions[idx]?.name
        if (paramName && suggestions[paramName]) {
          return { ...arg, value: suggestions[paramName].value }
        }
        return arg
      })
      return { ...current, args: nextArgs }
    })
  }

  function applySingleSuggestion(index, value) {
    updateArgument(index, 'value', value)
  }

  // Auto-setup arguments when function changes
  useEffect(() => {
    if (parameterDefinitions.length > 0) {
      setInvokeForm(current => {
        const nextArgs = parameterDefinitions.map(param => {
          const lowerType = String(param.type).toLowerCase()
          let type = 'string'
          if (lowerType.includes('bool')) type = 'bool'
          else if (['int', 'u32', 'i32', 'u64', 'i64', 'u128', 'i128', 'u256', 'i256'].some(t => lowerType.includes(t))) type = 'int'
          else if (lowerType.includes('address')) type = 'address'

          const sug = suggestions && suggestions[param.name]
          const sugVal = sug && sug.confidence > 0 ? sug.value : ''

          return {
            name: param.name,
            type,
            value: sugVal
          }
        })
        return { ...current, args: nextArgs }
      })
    }
  }, [invokeForm.functionName, contractFunctions])

  const invocationPreview = useMemo(() => ({
    contractId: invokeForm.contractId.trim(),
    functionName: invokeForm.functionName.trim(),
    sourceAccount: invokeForm.sourceAccount.trim() || connectedAddress || '',
    args: invokeForm.args.filter(arg => arg.value.trim() !== ''),
    network,
  }), [connectedAddress, invokeForm, network])
  const contractTemplates = useMemo(() => getContractTemplates(), [])

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
      args: [...current.args, { type: 'string', value: '', name: '' }],
    }))
  }

  function removeArgument(index) {
    setInvokeForm((current) => ({
      ...current,
      args: current.args.filter((_, argIndex) => argIndex !== index),
    }))
  }

  function handleLoadTemplate(nextTemplateId) {
    try {
      const nextWorkspace = buildContractWorkspace(nextTemplateId, {
        contractName: nextTemplateId === 'token' ? 'TokenContract' : undefined,
      })
      setTemplateId(nextTemplateId)
      setWorkspace(nextWorkspace)
      setSourceEditor(nextWorkspace.source)
      setTestEditor(nextWorkspace.tests)
      setDeployPlan(null)
    } catch (error) {
      setInvokeError(error.message || 'Failed to load template')
    }
  }

  function handleStartDebug() {
    const template = contractTemplates.find(t => t.id === templateId)
    const session = initDebugSession(sourceEditor, template?.entrypoint || 'transfer')
    setDebugSession(session)
  }

  function handleGenerateDeployPlan() {
    const contractName = workspace?.packageName || 'contract'
    const plan = generateDeploymentPlan({
      network,
      sourceAccount: invokeForm.sourceAccount || connectedAddress || '<SOURCE_ACCOUNT>',
      wasmPath: `target/wasm32-unknown-unknown/release/${contractName}.wasm`,
    })
    setDeployPlan(plan)
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
      track({
        contractId: invokeForm.contractId,
        functionName: invokeForm.functionName,
        args: invokeForm.args.map((a, i) => ({
          name: parameterDefinitions[i]?.name || a.name || `arg${i}`,
          type: a.type,
          value: a.value
        })),
        sourceAccount: invokeForm.sourceAccount || connectedAddress,
        network,
        status: 'simulated'
      })
    } catch (error) {
      setInvokeError(error.message || 'Simulation failed')
      track({
        contractId: invokeForm.contractId,
        functionName: invokeForm.functionName,
        args: invokeForm.args.map((a, i) => ({
          name: parameterDefinitions[i]?.name || a.name || `arg${i}`,
          type: a.type,
          value: a.value
        })),
        sourceAccount: invokeForm.sourceAccount || connectedAddress,
        network,
        status: 'error'
      })
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
      track({
        contractId: invokeForm.contractId,
        functionName: invokeForm.functionName,
        args: invokeForm.args.map((a, i) => ({
          name: parameterDefinitions[i]?.name || a.name || `arg${i}`,
          type: a.type,
          value: a.value
        })),
        sourceAccount: invokeForm.sourceAccount || connectedAddress,
        network,
        status: 'success'
      })
    } catch (error) {
      setInvokeError(error.message || 'Submission failed')
      track({
        contractId: invokeForm.contractId,
        functionName: invokeForm.functionName,
        args: invokeForm.args.map((a, i) => ({
          name: parameterDefinitions[i]?.name || a.name || `arg${i}`,
          type: a.type,
          value: a.value
        })),
        sourceAccount: invokeForm.sourceAccount || connectedAddress,
        network,
        status: 'error'
      })
    } finally {
      setSubmitLoading(false)
    }
  }

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700 }}>Soroban Contracts</div>
      <div style={{ display: 'flex', gap: '8px' }}>
        {['inspect', 'deploy', 'templates'].map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              padding: '7px 14px',
              background: mode === m ? 'var(--cyan-glow)' : 'transparent',
              border: `1px solid ${mode === m ? 'var(--cyan-dim)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-sm)',
              color: mode === m ? 'var(--cyan)' : 'var(--text-secondary)',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {m === 'inspect' ? 'Inspect & Invoke' : m === 'deploy' ? 'Deploy' : '📚 Templates'}
          </button>
        ))}
      </div>
      {mode === 'deploy' && <ContractDeployerView />}
      {mode === 'templates' && <TemplateLibrary />}

      <Panel
        title="Test Runner"
        subtitle="Upload .rs test files, run Soroban contract tests, and view coverage reports."
      >
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
          {contractTemplates.map((template) => (
            <button
              key={template.id}
              onClick={() => handleLoadTemplate(template.id)}
              style={{
                textAlign: 'left',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${templateId === template.id ? 'var(--cyan)' : 'var(--border)'}`,
                background: templateId === template.id ? 'var(--cyan-glow)' : 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              {template.name}
            </button>
          ))}
        </div>

        <TestRunner
          sourceCode={sourceEditor}
          testCode={testEditor}
          onSourceChange={setSourceEditor}
          onTestCodeChange={setTestEditor}
        />
      </Panel>

      <Panel
        title="Deploy Plan"
        subtitle="Generate a deployment plan for your contract."
      >
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <ActionButton label="Debug" tone="secondary" onClick={handleStartDebug} />
          <ActionButton label="Generate Deploy Plan" tone="secondary" onClick={handleGenerateDeployPlan} />
        </div>

        {deployPlan && (
          <ResultBlock
            label="Deployment Plan"
            data={deployPlan}
          />
        )}
      </Panel>

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
        {anomalies.filter(a => a.type === 'sequence_anomaly').map((anomaly, ai) => (
          <div
            key={ai}
            style={{
              marginBottom: "14px",
              padding: "10px 14px",
              background: "rgba(245, 158, 11, 0.1)",
              border: "1px solid var(--amber-dim)",
              borderRadius: "var(--radius-md)",
              color: "var(--amber)",
              fontSize: "12px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <AlertTriangle size={15} />
            <span>{anomaly.message}</span>
          </div>
        ))}

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
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <input
                value={invokeForm.functionName}
                onChange={(event) => updateField('functionName', event.target.value)}
                placeholder="increment"
                style={textInputStyle()}
              />
              {recommendations.length > 0 && (
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                  <span style={{ fontSize: "10px", color: "var(--text-muted)", alignSelf: "center" }}>AI Suggested:</span>
                  {recommendations.slice(0, 3).map((rec) => (
                    <button
                      key={rec.functionName}
                      onClick={() => updateField('functionName', rec.functionName)}
                      style={{
                        padding: "2px 6px",
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border)",
                        borderRadius: "4px",
                        color: "var(--cyan)",
                        fontSize: "10px",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "3px"
                      }}
                      title={rec.explanation}
                    >
                      <Sparkles size={8} /> {rec.functionName}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
          <div style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}>
            <span>Typed Arguments</span>
            {Object.keys(suggestions).length > 0 && (
              <button
                onClick={applyAllSuggestions}
                style={{
                  background: "var(--cyan-glow)",
                  border: "1px solid var(--cyan-dim)",
                  borderRadius: "4px",
                  color: "var(--cyan)",
                  fontSize: "9px",
                  padding: "2px 6px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontWeight: 600
                }}
              >
                <Sparkles size={9} /> Autofill AI Suggestions
              </button>
            )}
          </div>
          <ActionButton label="Add Argument" onClick={addArgument} tone="secondary" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '18px' }}>
          {invokeForm.args.map((arg, index) => {
            const paramName = parameterDefinitions[index]?.name
            const paramType = parameterDefinitions[index]?.type
            const hasSpecName = !!paramName

            const fieldAnomalies = anomalies.filter(a => a.parameterName === (paramName || `arg${index}`))
            const fieldSuggestion = suggestions[paramName]

            return (
              <div
                key={index}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  padding: "10px",
                  background: "var(--bg-elevated)",
                  borderRadius: "var(--radius-md)",
                  border: fieldAnomalies.some(a => a.severity === 'error') ? "1px solid var(--red-dim)" : "1px solid var(--border)",
                }}
              >
                {hasSpecName && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--text-primary)" }}>
                      {paramName} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>({paramType})</span>
                    </span>
                    {fieldSuggestion && fieldSuggestion.confidence > 0 && arg.value !== fieldSuggestion.value && (
                      <button
                        onClick={() => applySingleSuggestion(index, fieldSuggestion.value)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--cyan)",
                          fontSize: "10px",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                        title={fieldSuggestion.explanation}
                      >
                        <Sparkles size={10} /> Fill: "{fieldSuggestion.value}"
                      </button>
                    )}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr auto', gap: '10px', alignItems: 'center' }}>
                  <select
                    value={arg.type}
                    onChange={(event) => updateArgument(index, 'type', event.target.value)}
                    style={textInputStyle()}
                    disabled={hasSpecName}
                  >
                    {ARGUMENT_TYPES.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>

                  <input
                    value={arg.value}
                    onChange={(event) => updateArgument(index, 'value', event.target.value)}
                    placeholder={arg.type === 'bool' ? 'true or false' : hasSpecName ? `Enter ${paramName}` : 'Argument value'}
                    style={textInputStyle(fieldAnomalies.some(a => a.severity === 'error'))}
                  />

                  <ActionButton
                    label="Remove"
                    onClick={() => removeArgument(index)}
                    disabled={invokeForm.args.length === 1 || hasSpecName}
                    tone="secondary"
                  />
                </div>

                {fieldSuggestion && fieldSuggestion.confidence > 0 && (
                  <div style={{ display: "flex", gap: "4px", alignItems: "center", fontSize: "10px", color: "var(--text-muted)", marginLeft: "4px" }}>
                    <Sparkles size={10} style={{ color: "var(--cyan)" }} />
                    <span>AI Suggested: <strong>{fieldSuggestion.value}</strong> — {fieldSuggestion.explanation}</span>
                  </div>
                )}

                {fieldAnomalies.map((anomaly, ai) => (
                  <div
                    key={ai}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "11px",
                      color: anomaly.severity === "error" ? "var(--red)" : "var(--amber)",
                      marginLeft: "4px",
                      marginTop: "2px"
                    }}
                  >
                    <AlertCircle size={12} />
                    <span>{anomaly.message}</span>
                  </div>
                ))}
              </div>
            )
          })}
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
            disabled={simulateLoading || submitLoading || anomalies.some(a => a.severity === 'error')}
          />
          <ActionButton
            label={submitLoading ? 'Submitting...' : 'Submit'}
            onClick={handleSubmit}
            disabled={isMainnet || submitLoading || simulateLoading || anomalies.some(a => a.severity === 'error')}
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

      {debugSession && (
        <ContractDebugger 
          session={debugSession}
          setSession={setDebugSession}
          sourceCode={sourceEditor}
          onClose={() => setDebugSession(null)}
        />
      )}

      {contractData && (
        <ContractRecommendations
          contractFunctions={contractFunctions}
          contractId={invokeForm.contractId}
          currentFunction={invokeForm.functionName}
          onSelectFunction={(fnName) => setInvokeForm((prev) => ({ ...prev, functionName: fnName }))}
          standalone={false}
        />
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
