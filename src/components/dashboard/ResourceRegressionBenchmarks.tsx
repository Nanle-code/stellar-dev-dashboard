/**
 * Resource regression benchmarks panel (#980).
 *
 * Rendered inside the contract history area. Lets developers save an invocation
 * as a named benchmark, re-simulate it against the currently deployed contract
 * version, and see a per-resource diff (CPU / memory / fee) with regressions
 * highlighted over a configurable threshold.
 *
 * Benchmarks can be exported and imported as JSON so CI can replay the same
 * suite and fail a build when a contract upgrade regresses resource usage.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, Gauge, Play, Save, Trash2, Upload } from 'lucide-react'

import { simulateContractCall } from '../../lib/stellar'
import type { ContractInvocationArg, NetworkName } from '../../lib/stellar'
import {
  BenchmarkImportError,
  DEFAULT_REGRESSION_THRESHOLD_PCT,
  deleteBenchmark,
  diffMeasurement,
  exportBenchmarksJson,
  formatDeltaPct,
  importBenchmarks,
  loadBenchmarks,
  loadMeasurements,
  loadThresholdPct,
  reSimulateBenchmarks,
  saveThresholdPct,
  upsertBenchmark,
  type Benchmark,
  type BenchmarkMeasurement,
  type ResourceDiff,
} from '../../lib/benchmarks'

interface ResourceRegressionBenchmarksProps {
  /** Optional contract id used to prefill the save form. */
  initialContractId?: string
}

type StatusTone = 'info' | 'success' | 'error'

interface StatusMessage {
  tone: StatusTone
  message: string
  issues?: string[]
}

const NETWORK_OPTIONS: NetworkName[] = ['testnet', 'mainnet', 'futurenet']

function panelStyle(): React.CSSProperties {
  return {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
  }
}

function inputStyle(): React.CSSProperties {
  return {
    width: '100%',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-bright)',
    borderRadius: 'var(--radius-md)',
    padding: '8px 12px',
    color: 'var(--text-primary)',
    fontSize: '12px',
    fontFamily: 'var(--font-mono)',
    outline: 'none',
    boxSizing: 'border-box',
  }
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={panelStyle()}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px' }}>{title}</div>
        {subtitle && (
          <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{subtitle}</div>
        )}
      </div>
      <div style={{ padding: '18px' }}>{children}</div>
    </div>
  )
}

function ActionButton({
  label,
  onClick,
  disabled,
  tone = 'primary',
  icon,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  tone?: 'primary' | 'secondary' | 'danger'
  icon?: React.ReactNode
}) {
  const palette =
    tone === 'danger'
      ? { background: 'var(--bg-elevated)', color: 'var(--red)', border: '1px solid var(--red)' }
      : tone === 'secondary'
        ? { background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-bright)' }
        : { background: 'var(--cyan)', color: 'var(--bg-base)', border: 'none' }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 14px',
        background: disabled ? 'var(--bg-elevated)' : palette.background,
        color: disabled ? 'var(--text-muted)' : palette.color,
        border: disabled ? '1px solid var(--border)' : palette.border,
        borderRadius: 'var(--radius-md)',
        fontFamily: 'var(--font-mono)',
        fontWeight: 700,
        fontSize: '12px',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {icon}
      {label}
    </button>
  )
}

function DeltaStatus({ row }: { row: ResourceDiff['rows'][number] }) {
  if (row.regression) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '4px',
          background: 'rgba(255, 0, 0, 0.12)',
          color: 'var(--red)',
          fontWeight: 700,
          fontSize: '11px',
        }}
      >
        <AlertTriangle size={11} /> REGRESSION
      </span>
    )
  }
  if (row.delta < 0) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '4px',
          background: 'rgba(0, 255, 0, 0.1)',
          color: 'var(--green)',
          fontWeight: 700,
          fontSize: '11px',
        }}
      >
        <CheckCircle2 size={11} /> IMPROVED
      </span>
    )
  }
  return <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>OK</span>
}

function DiffTable({ diff }: { diff: ResourceDiff }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
        <thead>
          <tr style={{ background: 'var(--bg-elevated)', textAlign: 'left' }}>
            <th style={{ padding: '8px 10px', color: 'var(--text-muted)', fontWeight: 600 }}>Resource</th>
            <th style={{ padding: '8px 10px', color: 'var(--text-muted)', fontWeight: 600 }}>Baseline</th>
            <th style={{ padding: '8px 10px', color: 'var(--text-muted)', fontWeight: 600 }}>Current</th>
            <th style={{ padding: '8px 10px', color: 'var(--text-muted)', fontWeight: 600 }}>Δ</th>
            <th style={{ padding: '8px 10px', color: 'var(--text-muted)', fontWeight: 600 }}>Δ%</th>
            <th style={{ padding: '8px 10px', color: 'var(--text-muted)', fontWeight: 600 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {diff.rows.map((row) => {
            const deltaColor = row.regression ? 'var(--red)' : row.delta > 0 ? 'var(--amber)' : 'var(--green)'
            return (
              <tr
                key={row.key}
                style={{
                  borderTop: '1px solid var(--border)',
                  background: row.regression ? 'rgba(255, 0, 0, 0.06)' : undefined,
                }}
              >
                <td style={{ padding: '8px 10px' }}>{row.label}</td>
                <td style={{ padding: '8px 10px' }}>{row.oldValue.toLocaleString()}</td>
                <td style={{ padding: '8px 10px' }}>{row.newValue.toLocaleString()}</td>
                <td style={{ padding: '8px 10px', color: deltaColor }}>
                  {row.delta > 0 ? '+' : ''}
                  {row.delta.toLocaleString()}
                </td>
                <td style={{ padding: '8px 10px', color: deltaColor }}>{formatDeltaPct(row.deltaPct)}</td>
                <td style={{ padding: '8px 10px' }}>
                  <DeltaStatus row={row} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function shortHash(hash: string): string {
  if (!hash) return '—'
  return hash.length > 16 ? `${hash.slice(0, 8)}…${hash.slice(-6)}` : hash
}

export function ResourceRegressionBenchmarks({ initialContractId = '' }: ResourceRegressionBenchmarksProps) {
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([])
  const [measurements, setMeasurements] = useState<Record<string, BenchmarkMeasurement>>({})
  const [thresholdPct, setThresholdPct] = useState<number>(DEFAULT_REGRESSION_THRESHOLD_PCT)
  const [currentWasmHash, setCurrentWasmHash] = useState('')
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState<StatusMessage | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [form, setForm] = useState({
    name: '',
    contractId: initialContractId,
    functionName: '',
    sourceAccount: '',
    network: 'testnet' as NetworkName,
    args: '[]',
    cpu: '',
    mem: '',
    fee: '',
    wasmHash: '',
  })

  const refresh = useCallback(() => {
    setBenchmarks(loadBenchmarks())
    setMeasurements(loadMeasurements())
  }, [])

  useEffect(() => {
    setThresholdPct(loadThresholdPct())
    refresh()
  }, [refresh])

  useEffect(() => {
    if (initialContractId) setForm((current) => ({ ...current, contractId: current.contractId || initialContractId }))
  }, [initialContractId])

  const diffs = useMemo<Record<string, ResourceDiff | null>>(() => {
    const map: Record<string, ResourceDiff | null> = {}
    for (const benchmark of benchmarks) {
      map[benchmark.id] = diffMeasurement(benchmark.baseline, measurements[benchmark.id], thresholdPct, {
        benchmarkId: benchmark.id,
        benchmarkName: benchmark.name,
        contractId: benchmark.contractId,
      })
    }
    return map
  }, [benchmarks, measurements, thresholdPct])

  const regressionCount = useMemo(() => {
    let total = 0
    for (const benchmark of benchmarks) {
      const diff = diffs[benchmark.id]
      if (diff) total += diff.regressionCount
    }
    return total
  }, [benchmarks, diffs])

  const simulator = useCallback(
    async (benchmark: Benchmark) => {
      const result = await simulateContractCall({
        contractId: benchmark.contractId,
        functionName: benchmark.functionName,
        args: benchmark.args as ContractInvocationArg[],
        sourceAccount: benchmark.sourceAccount,
        network: (benchmark.network || 'testnet') as NetworkName,
      })

      const cost = (result.cost ?? {}) as { cpuInstructions?: number; memoryBytes?: number }
      const resources = {
        cpuInsns: Number(cost.cpuInstructions ?? 0),
        memBytes: Number(cost.memoryBytes ?? 0),
        fee: Number(result.footprint?.minResourceFee ?? 0),
      }

      if (!resources.cpuInsns && !resources.memBytes && !resources.fee) {
        throw new Error('Simulation returned no resource data for this invocation')
      }

      return {
        resources,
        wasmHash: currentWasmHash.trim() || benchmark.baseline?.wasmHash || '',
        success: true,
      }
    },
    [currentWasmHash],
  )

  const handleSave = useCallback(() => {
    try {
      const name = form.name.trim()
      const contractId = form.contractId.trim()
      const functionName = form.functionName.trim()
      if (!name || !contractId || !functionName) {
        throw new Error('Name, contract ID and function are required')
      }

      let args: unknown
      try {
        args = JSON.parse(form.args || '[]')
      } catch {
        throw new Error('Arguments must be valid JSON (an array of { type, value } entries)')
      }
      if (!Array.isArray(args)) throw new Error('Arguments must be a JSON array')

      const hasBaseline = form.cpu !== '' || form.mem !== '' || form.fee !== ''
      const baseline: BenchmarkMeasurement | null = hasBaseline
        ? {
            wasmHash: form.wasmHash.trim(),
            resources: {
              cpuInsns: Number(form.cpu || 0),
              memBytes: Number(form.mem || 0),
              fee: Number(form.fee || 0),
            },
            measuredAt: new Date().toISOString(),
            success: true,
          }
        : null

      upsertBenchmark({
        name,
        contractId,
        functionName,
        args: args as Array<{ type: string; value: string }>,
        sourceAccount: form.sourceAccount,
        network: form.network,
        baseline,
      })
      refresh()
      setStatus({ tone: 'success', message: `Saved benchmark "${name}"` })
      setForm((current) => ({ ...current, name: '', functionName: '', args: '[]', cpu: '', mem: '', fee: '' }))
    } catch (error) {
      setStatus({ tone: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }, [form, refresh])

  const handleDelete = useCallback(
    (benchmark: Benchmark) => {
      if (!confirm(`Delete benchmark "${benchmark.name}"?`)) return
      deleteBenchmark(benchmark.id)
      refresh()
      setStatus({ tone: 'info', message: `Deleted benchmark "${benchmark.name}"` })
    },
    [refresh],
  )

  const handleRunAll = useCallback(async () => {
    if (benchmarks.length === 0) {
      setStatus({ tone: 'info', message: 'Save at least one benchmark before re-simulating.' })
      return
    }

    setRunning(true)
    setStatus({ tone: 'info', message: `Re-simulating ${benchmarks.length} benchmark(s) against the current version…` })

    try {
      const results = await reSimulateBenchmarks(benchmarks, simulator, { thresholdPct })
      refresh()

      const failed = results.filter((result) => !result.measurement.success).length
      const regressed = results.filter((result) => result.diff?.regressed).length

      if (failed > 0) {
        setStatus({ tone: 'error', message: `${failed} benchmark(s) failed to simulate. See the notes below.` })
      } else if (regressed > 0) {
        setStatus({ tone: 'error', message: `Detected regressions in ${regressed} benchmark(s).` })
      } else {
        setStatus({ tone: 'success', message: 'All benchmarks within the configured threshold.' })
      }
    } catch (error) {
      setStatus({ tone: 'error', message: error instanceof Error ? error.message : String(error) })
    } finally {
      setRunning(false)
    }
  }, [benchmarks, refresh, simulator, thresholdPct])

  const handleExport = useCallback(() => {
    try {
      const blob = new Blob([exportBenchmarksJson()], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `contract-benchmarks_${Date.now()}.json`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      setStatus({ tone: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }, [])

  const handleImportFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return

      try {
        const raw = await file.text()
        const summary = importBenchmarks(raw, { merge: true })
        refresh()
        setStatus({
          tone: 'success',
          message: `Imported ${summary.imported} new benchmark(s), replaced ${summary.replaced}.`,
        })
      } catch (error) {
        if (error instanceof BenchmarkImportError) {
          setStatus({ tone: 'error', message: error.message, issues: error.issues })
        } else {
          setStatus({ tone: 'error', message: error instanceof Error ? error.message : String(error) })
        }
      }
    },
    [refresh],
  )

  const handleThresholdChange = useCallback((value: string) => {
    const parsed = Number(value)
    setThresholdPct(Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_REGRESSION_THRESHOLD_PCT)
  }, [])

  const handleThresholdCommit = useCallback(() => {
    setThresholdPct(saveThresholdPct(thresholdPct))
  }, [thresholdPct])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Gauge size={18} />
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '14px' }}>
            Resource Regression Benchmarks
          </div>
        </div>
        <div style={{ fontSize: '12px', color: regressionCount > 0 ? 'var(--red)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {regressionCount > 0
            ? `${regressionCount} regression(s) at ${thresholdPct}% threshold`
            : `No regressions at ${thresholdPct}% threshold`}
        </div>
      </div>

      {status && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            fontSize: '12px',
            border: `1px solid ${status.tone === 'error' ? 'rgba(255,0,0,0.3)' : status.tone === 'success' ? 'rgba(0,255,0,0.3)' : 'var(--border)'}`,
            background: status.tone === 'error' ? 'rgba(255,0,0,0.08)' : status.tone === 'success' ? 'rgba(0,255,0,0.06)' : 'var(--bg-elevated)',
            color: status.tone === 'error' ? 'var(--red)' : status.tone === 'success' ? 'var(--green)' : 'var(--text-secondary)',
          }}
        >
          <div>{status.message}</div>
          {status.issues && status.issues.length > 0 && (
            <ul style={{ margin: '6px 0 0', paddingLeft: '18px', fontSize: '11px' }}>
              {status.issues.slice(0, 8).map((issue, index) => (
                <li key={index}>{issue}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Panel
        title="Save benchmark"
        subtitle="Name an invocation so it can be replayed after a contract upgrade. Baseline resources are optional — the first re-simulation captures them automatically."
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
            Name
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="transfer-hot-path" style={inputStyle()} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
            Contract ID
            <input value={form.contractId} onChange={(e) => setForm((f) => ({ ...f, contractId: e.target.value }))} placeholder="C…" style={inputStyle()} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
            Function
            <input value={form.functionName} onChange={(e) => setForm((f) => ({ ...f, functionName: e.target.value }))} placeholder="transfer" style={inputStyle()} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
            Source account
            <input value={form.sourceAccount} onChange={(e) => setForm((f) => ({ ...f, sourceAccount: e.target.value }))} placeholder="G…" style={inputStyle()} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
            Network
            <select value={form.network} onChange={(e) => setForm((f) => ({ ...f, network: e.target.value as NetworkName }))} style={inputStyle()}>
              {NETWORK_OPTIONS.map((network) => (
                <option key={network} value={network}>
                  {network}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', color: 'var(--text-muted)', gridColumn: '1 / -1' }}>
            Arguments (JSON array)
            <textarea
              value={form.args}
              onChange={(e) => setForm((f) => ({ ...f, args: e.target.value }))}
              rows={2}
              placeholder='[{"type":"address","value":"G…"}]'
              style={{ ...inputStyle(), resize: 'vertical' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
            Baseline CPU insns
            <input value={form.cpu} onChange={(e) => setForm((f) => ({ ...f, cpu: e.target.value }))} placeholder="optional" style={inputStyle()} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
            Baseline memory bytes
            <input value={form.mem} onChange={(e) => setForm((f) => ({ ...f, mem: e.target.value }))} placeholder="optional" style={inputStyle()} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
            Baseline fee (stroops)
            <input value={form.fee} onChange={(e) => setForm((f) => ({ ...f, fee: e.target.value }))} placeholder="optional" style={inputStyle()} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
            Baseline Wasm hash
            <input value={form.wasmHash} onChange={(e) => setForm((f) => ({ ...f, wasmHash: e.target.value }))} placeholder="optional" style={inputStyle()} />
          </label>
        </div>

        <div style={{ marginTop: '14px' }}>
          <ActionButton label="Save benchmark" onClick={handleSave} icon={<Save size={14} />} />
        </div>
      </Panel>

      <Panel title="Re-simulate & diff" subtitle="Replays every saved benchmark through Soroban RPC and diffs the measured resources against each baseline.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', alignItems: 'end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
            Regression threshold (%)
            <input
              type="number"
              min={0}
              value={thresholdPct}
              onChange={(e) => handleThresholdChange(e.target.value)}
              onBlur={handleThresholdCommit}
              style={inputStyle()}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
            Current Wasm hash (optional)
            <input
              value={currentWasmHash}
              onChange={(e) => setCurrentWasmHash(e.target.value)}
              placeholder="recorded with each result"
              style={inputStyle()}
            />
          </label>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '14px' }}>
          <ActionButton
            label={running ? 'Re-simulating…' : 'Re-simulate all'}
            onClick={handleRunAll}
            disabled={running || benchmarks.length === 0}
            icon={<Play size={14} />}
          />
          <ActionButton label="Export JSON" onClick={handleExport} disabled={benchmarks.length === 0} tone="secondary" icon={<Download size={14} />} />
          <ActionButton label="Import JSON" onClick={() => fileInputRef.current?.click()} tone="secondary" icon={<Upload size={14} />} />
          <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleImportFile} style={{ display: 'none' }} />
        </div>
        <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
          A resource is flagged as a regression only when it grows by more than {thresholdPct}% (changes exactly at the
          threshold are accepted).
        </div>
      </Panel>

      {benchmarks.length === 0 ? (
        <div
          style={{
            padding: '28px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '12px',
            border: '1px dashed var(--border-bright)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          No benchmarks yet. Save an invocation above to start tracking resource usage across contract versions.
        </div>
      ) : (
        benchmarks.map((benchmark) => {
          const measurement = measurements[benchmark.id]
          const diff = diffs[benchmark.id]
          return (
            <Panel
              key={benchmark.id}
              title={benchmark.name}
              subtitle={`${benchmark.functionName}() on ${shortHash(benchmark.contractId)} · ${benchmark.network}`}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', lineHeight: 1.7 }}>
                  <div>Baseline Wasm: {shortHash(benchmark.baseline?.wasmHash ?? '')}</div>
                  <div>Latest Wasm: {shortHash(measurement?.wasmHash ?? '')}</div>
                  {measurement && !measurement.success && (
                    <div style={{ color: 'var(--red)' }}>Last run failed: {measurement.error}</div>
                  )}
                  {diff?.sameVersion && <div style={{ color: 'var(--amber)' }}>Latest run used the same Wasm hash as the baseline.</div>}
                </div>
                <ActionButton label="Delete" onClick={() => handleDelete(benchmark)} tone="danger" icon={<Trash2 size={13} />} />
              </div>

              <div style={{ marginTop: '14px' }}>
                {!benchmark.baseline && !measurement ? (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    No measurements yet — re-simulate to capture this benchmark&apos;s baseline.
                  </div>
                ) : !measurement ? (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Baseline stored{benchmark.baseline?.wasmHash ? ` (Wasm ${shortHash(benchmark.baseline.wasmHash)})` : ''}. Re-simulate to compare against the current version.
                  </div>
                ) : !measurement.success || !diff ? (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    No comparable measurements. Re-simulate after the contract is reachable.
                  </div>
                ) : (
                  <>
                    <DiffTable diff={diff} />
                    <div style={{ marginTop: '8px', fontSize: '11px', color: diff.regressed ? 'var(--red)' : 'var(--text-muted)' }}>
                      {diff.regressed
                        ? `${diff.regressionCount} resource(s) regressed beyond the ${diff.thresholdPct}% threshold.`
                        : `All resources are within the ${diff.thresholdPct}% threshold.`}
                    </div>
                  </>
                )}
              </div>
            </Panel>
          )
        })
      )}
    </div>
  )
}

export default ResourceRegressionBenchmarks
