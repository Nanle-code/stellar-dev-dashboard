import React, { useState, useEffect } from 'react'
import { 
  Play, 
  StepForward, 
  Square, 
  Circle, 
  Bug, 
  Terminal, 
  Layers, 
  Database,
  X
} from 'lucide-react'
import { stepDebugSession, toggleBreakpoint } from '../../lib/contractDevelopment'

export default function ContractDebugger({ 
  session, 
  setSession, 
  sourceCode, 
  onClose 
}) {
  const [activeTab, setActiveTab] = useState('state')
  
  const handleStep = () => {
    const nextSession = stepDebugSession(session, sourceCode)
    setSession(nextSession)
  }

  const handleContinue = () => {
    // Simulated continue until breakpoint or end
    let currentSession = session
    const maxSteps = 100 // Safety break
    let steps = 0
    
    while (steps < maxSteps) {
      currentSession = stepDebugSession(currentSession, sourceCode)
      if (currentSession.status === 'finished' || currentSession.breakpoints.includes(currentSession.currentLine)) {
        break
      }
      steps++
    }
    setSession(currentSession)
  }

  const handleToggleBreakpoint = (line) => {
    const nextSession = toggleBreakpoint(session, line)
    setSession(nextSession)
  }

  const lines = sourceCode.split('\n')

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(8px)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-sans)',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--bg-card)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'var(--cyan-glow)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--cyan)'
          }}>
            <Bug size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px' }}>Soroban Debugger</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Simulated Execution Environment</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={handleContinue}
            disabled={session.status === 'finished'}
            style={controlButtonStyle('var(--green)')}
            title="Continue (F5)"
          >
            <Play size={16} fill="currentColor" />
          </button>
          <button 
            onClick={handleStep}
            disabled={session.status === 'finished'}
            style={controlButtonStyle('var(--cyan)')}
            title="Step Over (F10)"
          >
            <StepForward size={16} />
          </button>
          <button 
            onClick={onClose}
            style={controlButtonStyle('var(--red)')}
            title="Stop Debugging"
          >
            <Square size={16} fill="currentColor" />
          </button>
        </div>

        <button 
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px'
          }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Editor Area */}
        <div style={{ 
          flex: 1, 
          overflow: 'auto', 
          background: 'var(--bg-base)', 
          borderRight: '1px solid var(--border)',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', minHeight: '100%' }}>
            {/* Gutter */}
            <div style={{ 
              width: '48px', 
              background: 'var(--bg-elevated)', 
              borderRight: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              paddingTop: '16px',
              userSelect: 'none'
            }}>
              {lines.map((_, i) => {
                const lineNum = i + 1
                const isBreakpoint = session.breakpoints.includes(lineNum)
                const isCurrent = session.currentLine === lineNum
                
                return (
                  <div 
                    key={i} 
                    onClick={() => handleToggleBreakpoint(lineNum)}
                    style={{
                      height: '22px',
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '11px',
                      color: isCurrent ? 'var(--cyan)' : 'var(--text-muted)',
                      position: 'relative'
                    }}
                  >
                    {isBreakpoint && (
                      <div style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: 'var(--red)',
                        position: 'absolute',
                        left: '8px'
                      }} />
                    )}
                    {lineNum}
                  </div>
                )
              })}
            </div>

            {/* Code */}
            <div style={{ flex: 1, paddingTop: '16px', paddingLeft: '12px', fontFamily: 'var(--font-mono)', fontSize: '13px', lineHeight: '22px' }}>
              {lines.map((line, i) => {
                const isCurrent = session.currentLine === i + 1
                return (
                  <div 
                    key={i} 
                    style={{ 
                      height: '22px', 
                      background: isCurrent ? 'rgba(0, 243, 255, 0.1)' : 'transparent',
                      color: isCurrent ? 'var(--cyan)' : 'inherit',
                      whiteSpace: 'pre',
                      position: 'relative'
                    }}
                  >
                    {isCurrent && (
                      <div style={{
                        position: 'absolute',
                        left: '-12px',
                        top: 0,
                        bottom: 0,
                        width: '3px',
                        background: 'var(--cyan)'
                      }} />
                    )}
                    {line}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Sidebar Area */}
        <div style={{ width: '400px', display: 'flex', flexDirection: 'column', background: 'var(--bg-card)' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
            {[
              { id: 'state', icon: <Database size={14} />, label: 'Variables' },
              { id: 'stack', icon: <Layers size={14} />, label: 'Call Stack' },
              { id: 'logs', icon: <Terminal size={14} />, label: 'Debug Log' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px',
                  background: activeTab === tab.id ? 'var(--bg-base)' : 'transparent',
                  border: 'none',
                  borderBottom: activeTab === tab.id ? '2px solid var(--cyan)' : '2px solid transparent',
                  color: activeTab === tab.id ? 'var(--cyan)' : 'var(--text-muted)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
            {activeTab === 'state' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <Section title="Local Variables">
                  {Object.keys(session.state.variables).length === 0 ? (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No local variables in scope.</div>
                  ) : (
                    Object.entries(session.state.variables).map(([key, val]) => (
                      <VarItem key={key} name={key} value={val} />
                    ))
                  )}
                </Section>
                <Section title="Contract Storage">
                  {Object.keys(session.state.storage).length === 0 ? (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Storage is empty.</div>
                  ) : (
                    Object.entries(session.state.storage).map(([key, val]) => (
                      <VarItem key={key} name={key} value={val} />
                    ))
                  )}
                </Section>
                <Section title="Environment">
                  <VarItem name="address" value="C...test" />
                  <VarItem name="ledger" value="123456" />
                </Section>
              </div>
            )}

            {activeTab === 'stack' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {session.callStack.map((frame, i) => (
                  <div key={i} style={{
                    padding: '8px 12px',
                    background: i === 0 ? 'var(--cyan-glow)' : 'var(--bg-elevated)',
                    borderRadius: 'var(--radius-sm)',
                    border: i === 0 ? '1px solid var(--cyan-dim)' : '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                  }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: i === 0 ? 'var(--cyan)' : 'var(--text-primary)' }}>
                      {frame.function}()
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      Line {frame.line}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'logs' && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {session.logs.map((log, i) => (
                  <div key={i} style={{ color: log.startsWith('Stepped') ? 'var(--text-muted)' : 'var(--cyan)' }}>
                    {`[${new Date().toLocaleTimeString()}] ${log}`}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {children}
      </div>
    </div>
  )
}

function VarItem({ name, value }) {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      padding: '6px 10px', 
      background: 'var(--bg-elevated)', 
      borderRadius: 'var(--radius-sm)',
      fontSize: '12px',
      fontFamily: 'var(--font-mono)'
    }}>
      <span style={{ color: 'var(--amber)' }}>{name}</span>
      <span style={{ color: 'var(--text-secondary)' }}>{value}</span>
    </div>
  )
}

function controlButtonStyle(color) {
  return {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: color,
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  }
}
