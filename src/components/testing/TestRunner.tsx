import React, { useRef, useState, useCallback } from 'react'
import { runContractTests, exportTestReport } from '../../lib/contractTestRunner'

function formatDuration(ms) {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

export default function TestRunner({
  sourceCode: externalSource,
  testCode: externalTestCode,
  onSourceChange,
  onTestCodeChange,
}) {
  const inputRef = useRef(null)
  const [sourceCode, setSourceCode] = useState(externalSource || '')
  const [testCode, setTestCode] = useState(externalTestCode || '')
  const [fileName, setFileName] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  const [activeDetailTab, setActiveDetailTab] = useState('tests')
  const [expandedTest, setExpandedTest] = useState(null)

  const handleSourceChange = (e) => {
    setSourceCode(e.target.value)
    onSourceChange?.(e.target.value)
  }

  const handleTestCodeChange = (e) => {
    setTestCode(e.target.value)
    onTestCodeChange?.(e.target.value)
  }

  const handleFile = useCallback(async (file) => {
    if (!file) return
    if (!file.name.endsWith('.rs')) {
      setError('Please select a Rust source file (.rs)')
      return
    }
    setError('')
    setFileName(file.name)
    const text = await file.text()
    setTestCode(text)
    onTestCodeChange?.(text)
  }, [onTestCodeChange])

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]
    await handleFile(file)
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleDrop = async (event) => {
    event.preventDefault()
    const file = event.dataTransfer.files?.[0]
    await handleFile(file)
  }

  const handleRun = async () => {
    if (!sourceCode.trim() || !testCode.trim()) {
      setError('Both contract source and test code are required')
      return
    }
    setError('')
    setReport(null)
    setIsRunning(true)
    try {
      const result = await runContractTests(sourceCode, testCode)
      setReport(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test execution failed')
    } finally {
      setIsRunning(false)
    }
  }

  const handleExport = () => {
    if (!report) return
    const json = exportTestReport(report, 'json')
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `test-report-${report.contractName}-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* File upload area */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click() } }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        style={{
          padding: '16px',
          border: `2px dashed ${fileName ? 'var(--green)' : error ? 'var(--red)' : 'var(--border-bright)'}`,
          borderRadius: 'var(--radius-md)',
          background: fileName ? 'rgba(34, 197, 94, 0.06)' : 'var(--bg-elevated)',
          cursor: isRunning ? 'not-allowed' : 'pointer',
          textAlign: 'center',
          opacity: isRunning ? 0.6 : 1,
          transition: 'all var(--transition)',
        }}
      >
        <div style={{ fontSize: '24px', marginBottom: '6px' }}>{fileName ? '✅' : '📄'}</div>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
          {fileName ? `Loaded: ${fileName}` : 'Drop a .rs test file here or click to browse'}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Upload a Rust test file containing #[test] functions
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".rs"
          onChange={handleFileChange}
          disabled={isRunning}
          style={{ display: 'none' }}
        />
      </div>

      {/* Editors */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>
            Contract Source
          </div>
          <textarea
            value={sourceCode}
            onChange={handleSourceChange}
            rows={12}
            style={{
              width: '100%',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-bright)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 12px',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              resize: 'vertical',
              outline: 'none',
              minHeight: '180px',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>
            Test Code
          </div>
          <textarea
            value={testCode}
            onChange={handleTestCodeChange}
            rows={12}
            style={{
              width: '100%',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-bright)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 12px',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              resize: 'vertical',
              outline: 'none',
              minHeight: '180px',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={handleRun}
          disabled={isRunning || !sourceCode.trim() || !testCode.trim()}
          style={{
            padding: '10px 20px',
            background: isRunning ? 'var(--bg-elevated)' : 'var(--cyan)',
            color: isRunning ? 'var(--text-muted)' : 'var(--bg-base)',
            border: isRunning ? '1px solid var(--border)' : 'none',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            fontSize: '12px',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            transition: 'var(--transition)',
          }}
        >
          {isRunning ? 'Running...' : 'Run Tests'}
        </button>

        {report && (
          <button
            onClick={handleExport}
            style={{
              padding: '10px 20px',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-bright)',
              borderRadius: 'var(--radius-md)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'var(--transition)',
            }}
          >
            Export Report
          </button>
        )}
      </div>

      {error && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(220, 38, 38, 0.1)',
          border: '1px solid var(--red)',
          fontSize: '12px',
          color: 'var(--red)',
          lineHeight: 1.5,
        }}>
          {error}
        </div>
      )}

      {/* Results */}
      {report && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}>
          {/* Summary bar */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            gap: '24px',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '50%',
                background: report.summary.failed > 0 ? 'rgba(220,38,38,0.15)' : 'rgba(34,197,94,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '18px',
              }}>
                {report.summary.failed > 0 ? '❌' : '✅'}
              </div>
              <div>
                <div style={{ fontSize: '22px', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                  {report.summary.passed}/{report.summary.total}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Tests Passed
                </div>
              </div>
            </div>

            <div style={statBoxStyle}>
              <div style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{formatDuration(report.summary.durationMs)}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Duration</div>
            </div>

            <div style={statBoxStyle}>
              <div style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{report.summary.assertionsPassed}/{report.summary.assertions}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Assertions</div>
            </div>

            <div style={statBoxStyle}>
              <div style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{report.coverage.overallPercent}%</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Coverage</div>
            </div>

            <div style={{ flex: 1 }} />

            <div style={{
              display: 'flex', gap: '4px', alignItems: 'center',
              fontSize: '11px', fontFamily: 'var(--font-mono)',
            }}>
              <span style={{ color: 'var(--green)', fontWeight: 700 }}>{report.summary.passed}</span>
              <span style={{ color: 'var(--text-muted)' }}>/</span>
              <span style={{ color: 'var(--red)', fontWeight: 700 }}>{report.summary.failed}</span>
              {report.summary.skipped > 0 && (
                <>
                  <span style={{ color: 'var(--text-muted)' }}>/</span>
                  <span style={{ color: 'var(--amber)', fontWeight: 700 }}>{report.summary.skipped}</span>
                </>
              )}
            </div>
          </div>

          {/* Coverage bar */}
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Function Coverage
              </span>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {report.coverage.functions.filter(f => f.covered).length}/{report.coverage.functions.length} functions
              </span>
            </div>
            <div style={{
              height: '8px', borderRadius: '4px', background: 'var(--bg-base)',
              overflow: 'hidden', position: 'relative',
            }}>
              <div style={{
                height: '100%',
                width: `${report.coverage.overallPercent}%`,
                borderRadius: '4px',
                background: report.coverage.overallPercent >= 80 ? 'var(--green)' : report.coverage.overallPercent >= 50 ? 'var(--amber)' : 'var(--red)',
                transition: 'width 0.6s ease',
              }} />
            </div>
          </div>

          {/* Tab selector */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
            {[
              { id: 'tests', label: 'Test Results' },
              { id: 'coverage', label: 'Coverage Details' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveDetailTab(tab.id)}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: activeDetailTab === tab.id ? 'var(--bg-elevated)' : 'transparent',
                  border: 'none',
                  borderBottom: activeDetailTab === tab.id ? '2px solid var(--cyan)' : '2px solid transparent',
                  color: activeDetailTab === tab.id ? 'var(--cyan)' : 'var(--text-muted)',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ padding: '16px 20px', maxHeight: '400px', overflow: 'auto' }}>
            {activeDetailTab === 'tests' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {report.tests.map((test, i) => (
                  <div key={i}>
                    <div
                      onClick={() => setExpandedTest(expandedTest === i ? null : i)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        background: test.status === 'passed' ? 'rgba(34,197,94,0.06)' : test.status === 'failed' ? 'rgba(220,38,38,0.06)' : 'rgba(255,184,0,0.06)',
                        border: `1px solid ${
                          test.status === 'passed' ? 'rgba(34,197,94,0.2)' : test.status === 'failed' ? 'rgba(220,38,38,0.2)' : 'rgba(255,184,0,0.2)'
                        }`,
                        cursor: 'pointer',
                        transition: 'var(--transition)',
                      }}
                    >
                      <span style={{ fontSize: '14px' }}>
                        {test.status === 'passed' ? '✅' : test.status === 'failed' ? '❌' : '⏭️'}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {test.name}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Line {test.line} · {formatDuration(test.durationMs)} · {test.assertionsPassed}/{test.assertions} assertions
                        </div>
                      </div>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {expandedTest === i ? '▲' : '▼'}
                      </span>
                    </div>
                    {expandedTest === i && test.error && (
                      <div style={{
                        marginTop: '2px', marginLeft: '24px', padding: '8px 12px',
                        background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)',
                        fontSize: '11px', fontFamily: 'var(--font-mono)',
                        color: 'var(--red)',
                        lineHeight: 1.5,
                      }}>
                        {test.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {activeDetailTab === 'coverage' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {report.coverage.functions.map((fn, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: fn.covered ? 'rgba(34,197,94,0.06)' : 'rgba(220,38,38,0.06)',
                    border: `1px solid ${fn.covered ? 'rgba(34,197,94,0.2)' : 'rgba(220,38,38,0.2)'}`,
                  }}>
                    <span style={{ fontSize: '12px' }}>{fn.covered ? '✅' : '❌'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {fn.function}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        Lines {fn.lineStart}-{fn.lineEnd}
                        {fn.calledByTests.length > 0 && ` · tested by: ${fn.calledByTests.join(', ')}`}
                      </div>
                    </div>
                    <div style={{
                      width: '60px', height: '6px', borderRadius: '3px',
                      background: 'var(--bg-base)', overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%', width: fn.covered ? '100%' : '0%',
                        borderRadius: '3px',
                        background: fn.covered ? 'var(--green)' : 'var(--red)',
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                  </div>
                ))}
                {report.coverage.uncoveredFunctions.length > 0 && (
                  <div style={{
                    marginTop: '8px', padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(255,184,0,0.08)',
                    border: '1px solid rgba(255,184,0,0.2)',
                    fontSize: '11px',
                    color: 'var(--amber)',
                    lineHeight: 1.5,
                  }}>
                    Uncovered functions: {report.coverage.uncoveredFunctions.join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const statBoxStyle = {
  padding: '8px 12px',
  background: 'var(--bg-elevated)',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
  minWidth: '80px',
  textAlign: 'center',
}
