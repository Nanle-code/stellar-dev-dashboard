/**
 * Interactive Soroban Debugging Tutorial Series Component
 * 
 * Progressive in-app educational environment walking developers through:
 * 1. Simulation errors & host execution traps
 * 2. Declarative authorization failures & auth trees
 * 3. Ledger footprint issues, read-only conflicts & state TTL expiration
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Play,
  RotateCcw,
  Shield,
  Layers,
  Terminal,
  Cpu,
  Award,
  ChevronRight,
  Code2,
  FileCheck,
  AlertCircle,
  BookOpen,
} from 'lucide-react';
import {
  sorobanDebuggingTutorialService,
  SorobanTutorialModule,
  TutorialStep,
  SimulationRunResult,
  DebuggingEnvironment,
  SorobanTutorialError,
} from '../../lib/sorobanDebuggingTutorial';
import { useStore } from '../../lib/store';

export const SorobanDebugTutorial: React.FC = () => {
  const { network } = useStore();
  const modules = useMemo(() => sorobanDebuggingTutorialService.getModules(), []);

  const [activeModuleSlug, setActiveModuleSlug] = useState<string>('simulation-errors');
  const [activeStepNumber, setActiveStepNumber] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'debugger' | 'footprint' | 'quiz' | 'guide'>('debugger');
  const [editorCode, setEditorCode] = useState<string>('');
  const [simulationResult, setSimulationResult] = useState<SimulationRunResult | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [allowMainnetSimulation, setAllowMainnetSimulation] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Quiz State
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [quizSubmitted, setQuizSubmitted] = useState<boolean>(false);
  const [quizResult, setQuizResult] = useState<ReturnType<typeof sorobanDebuggingTutorialService.submitQuiz> | null>(null);

  const currentModule: SorobanTutorialModule = useMemo(() => {
    return (
      sorobanDebuggingTutorialService.getModule(activeModuleSlug) ||
      modules[0]
    );
  }, [activeModuleSlug, modules]);

  const currentStep: TutorialStep = useMemo(() => {
    return (
      currentModule.steps.find((s) => s.stepNumber === activeStepNumber) ||
      currentModule.steps[0]
    );
  }, [currentModule, activeStepNumber]);

  // Load initial code when step or module changes
  useEffect(() => {
    if (currentStep) {
      setEditorCode(currentStep.initialCode);
      setSimulationResult(null);
      setShowHint(false);
      setErrorMessage(null);
    }
  }, [currentStep, activeModuleSlug]);

  // Reset quiz state when switching module
  useEffect(() => {
    setQuizAnswers(new Array(currentModule.quiz.length).fill(-1));
    setQuizSubmitted(false);
    setQuizResult(null);
  }, [currentModule]);

  // Environment normalization
  const currentEnv: DebuggingEnvironment = useMemo(() => {
    const raw = (network || 'testnet').toLowerCase();
    if (raw.includes('main')) return 'mainnet';
    if (raw.includes('future')) return 'futurenet';
    if (raw.includes('local') || raw.includes('standalone')) return 'local';
    return 'testnet';
  }, [network]);

  const handleRunSimulation = () => {
    setIsRunning(true);
    setErrorMessage(null);

    try {
      const result = sorobanDebuggingTutorialService.runSimulation({
        moduleId: currentModule.id,
        stepNumber: currentStep.stepNumber,
        contractCode: editorCode,
        environment: currentEnv,
        allowMainnetSimulation,
      });

      setSimulationResult(result);

      if (result.success && result.stepCompleted) {
        sorobanDebuggingTutorialService.recordStepCompletion(
          'local-user',
          currentModule.id,
          currentStep.stepNumber
        );
      }
    } catch (err: unknown) {
      if (err instanceof SorobanTutorialError) {
        setErrorMessage(`[${err.code}] ${err.message}`);
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Unexpected simulation error occurred.');
      }
    } finally {
      setIsRunning(false);
    }
  };

  const handleApplySolution = () => {
    setEditorCode(currentStep.solutionCode);
  };

  const handleResetCode = () => {
    setEditorCode(currentStep.initialCode);
    setSimulationResult(null);
    setErrorMessage(null);
  };

  const handleNextStep = () => {
    if (activeStepNumber < currentModule.steps.length) {
      setActiveStepNumber(activeStepNumber + 1);
    } else {
      setActiveTab('quiz');
    }
  };

  const handleQuizOptionSelect = (qIdx: number, optIdx: number) => {
    if (quizSubmitted) return;
    const next = [...quizAnswers];
    next[qIdx] = optIdx;
    setQuizAnswers(next);
  };

  const handleSubmitQuiz = () => {
    if (quizAnswers.some((a) => a === -1)) {
      setErrorMessage('Please answer all quiz questions before submitting.');
      return;
    }
    setErrorMessage(null);
    try {
      const res = sorobanDebuggingTutorialService.submitQuiz(
        currentModule.id,
        'local-user',
        quizAnswers
      );
      setQuizResult(res);
      setQuizSubmitted(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      }
    }
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '1.5rem', color: 'var(--text-primary)' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.75rem' }}>🐞</span>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0 }}>
              Soroban Interactive Debugging Series
            </h1>
            <span
              style={{
                fontSize: '0.75rem',
                padding: '0.25rem 0.6rem',
                borderRadius: '999px',
                background: 'rgba(59, 130, 246, 0.15)',
                color: '#60a5fa',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                fontWeight: 600,
              }}
            >
              2026 Developer Edition
            </span>
          </div>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Interactive lab for mastering simulation error diagnosis, declarative authorization trees, and ledger footprint concurrency.
          </p>
        </div>

        {/* Environment Badge & Mainnet Safety Guard */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--bg-elevated)', padding: '0.5rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <Shield size={16} color={currentEnv === 'mainnet' ? '#f59e0b' : '#10b981'} />
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
            Environment: <span style={{ textTransform: 'capitalize', color: currentEnv === 'mainnet' ? '#f59e0b' : '#10b981' }}>{currentEnv}</span>
          </span>
          {currentEnv === 'mainnet' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', cursor: 'pointer', marginLeft: '0.5rem', color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={allowMainnetSimulation}
                onChange={(e) => setAllowMainnetSimulation(e.target.checked)}
              />
              Enable Sandboxed Pre-flight
            </label>
          )}
        </div>
      </div>

      {/* Mainnet Guard Warning */}
      {currentEnv === 'mainnet' && !allowMainnetSimulation && (
        <div
          role="alert"
          style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <AlertTriangle size={20} color="#f59e0b" />
          <div style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
            <strong>Mainnet Safe Mode Active:</strong> Direct interactive mutations and unverified debugging execution are blocked on Mainnet. Switch to <strong>Testnet</strong> or <strong>Futurenet</strong>, or check &quot;Enable Sandboxed Pre-flight&quot; to test safely.
          </div>
        </div>
      )}

      {/* Module Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {modules.map((mod) => {
          const isSelected = mod.slug === activeModuleSlug;
          return (
            <button
              key={mod.id}
              onClick={() => {
                setActiveModuleSlug(mod.slug);
                setActiveStepNumber(1);
                setActiveTab('debugger');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.1rem',
                borderRadius: '8px',
                background: isSelected ? 'var(--primary, #3b82f6)' : 'var(--bg-elevated)',
                color: isSelected ? '#ffffff' : 'var(--text-primary)',
                border: isSelected ? '1px solid var(--primary, #3b82f6)' : '1px solid var(--border)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {mod.category === 'simulation' && <Cpu size={16} />}
              {mod.category === 'auth' && <Shield size={16} />}
              {mod.category === 'footprint' && <Layers size={16} />}
              <span>{mod.title}</span>
            </button>
          );
        })}
      </div>

      {/* Module Overview Card */}
      <div
        style={{
          background: 'var(--bg-card, #111827)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          padding: '1.25rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.75rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.25rem' }}>{currentModule.title}</h2>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{currentModule.subtitle}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
              ⏱ {currentModule.estimatedMinutes} min
            </span>
            <span
              style={{
                fontSize: '0.75rem',
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                background:
                  currentModule.difficulty === 'beginner'
                    ? 'rgba(16, 185, 129, 0.15)'
                    : currentModule.difficulty === 'intermediate'
                    ? 'rgba(245, 158, 11, 0.15)'
                    : 'rgba(239, 68, 68, 0.15)',
                color:
                  currentModule.difficulty === 'beginner'
                    ? '#10b981'
                    : currentModule.difficulty === 'intermediate'
                    ? '#f59e0b'
                    : '#ef4444',
                fontWeight: 600,
                textTransform: 'capitalize',
              }}
            >
              {currentModule.difficulty}
            </span>
          </div>
        </div>

        {/* Progressive Stepper */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem', overflowX: 'auto' }}>
          {currentModule.steps.map((st) => {
            const isStepActive = st.stepNumber === activeStepNumber && activeTab === 'debugger';
            return (
              <button
                key={st.stepNumber}
                onClick={() => {
                  setActiveStepNumber(st.stepNumber);
                  setActiveTab('debugger');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.45rem 0.85rem',
                  borderRadius: '6px',
                  background: isStepActive ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-elevated)',
                  border: isStepActive ? '1px solid #3b82f6' : '1px solid var(--border)',
                  color: isStepActive ? '#60a5fa' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                <span>Step {st.stepNumber}</span>
              </button>
            );
          })}

          <button
            onClick={() => setActiveTab('quiz')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 0.85rem',
              borderRadius: '6px',
              background: activeTab === 'quiz' ? 'rgba(168, 85, 247, 0.2)' : 'var(--bg-elevated)',
              border: activeTab === 'quiz' ? '1px solid #a855f7' : '1px solid var(--border)',
              color: activeTab === 'quiz' ? '#c084fc' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 600,
              marginLeft: 'auto',
            }}
          >
            <Award size={14} />
            <span>Knowledge Quiz</span>
          </button>
        </div>
      </div>

      {/* Global Error Banner */}
      {errorMessage && (
        <div
          role="alert"
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: '#f87171',
            fontSize: '0.85rem',
          }}
        >
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Workspace Area */}
      {activeTab === 'debugger' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.25rem' }}>
          {/* Left Column: Step Guide & Code Editor */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div
              style={{
                background: 'var(--bg-card, #111827)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {currentStep.title}
                </span>
                <button
                  onClick={() => setShowHint(!showHint)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    background: 'transparent',
                    border: 'none',
                    color: '#f59e0b',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <HelpCircle size={14} />
                  <span>{showHint ? 'Hide Hint' : 'Need a Hint?'}</span>
                </button>
              </div>

              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 0.5rem' }}>{currentStep.objective}</h3>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {currentStep.conceptSummary}
              </p>

              {showHint && (
                <div
                  style={{
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px dashed rgba(245, 158, 11, 0.3)',
                    borderRadius: '6px',
                    padding: '0.75rem',
                    fontSize: '0.8rem',
                    color: '#fbbf24',
                    marginTop: '0.5rem',
                  }}
                >
                  💡 <strong>Diagnostic Hint:</strong> {currentStep.diagnosticHint}
                </div>
              )}
            </div>

            {/* Code Editor Box */}
            <div
              style={{
                background: 'var(--bg-card, #111827)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Code2 size={16} color="var(--primary, #3b82f6)" />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>contract.rs (Soroban SDK)</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={handleApplySolution}
                    title="Load verified solution pattern"
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      padding: '0.35rem 0.65rem',
                      color: 'var(--text-secondary)',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    Reveal Solution
                  </button>
                  <button
                    onClick={handleResetCode}
                    title="Reset to buggy state"
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      padding: '0.35rem 0.65rem',
                      color: 'var(--text-secondary)',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <RotateCcw size={12} />
                    <span>Reset</span>
                  </button>
                </div>
              </div>

              <textarea
                value={editorCode}
                onChange={(e) => setEditorCode(e.target.value)}
                rows={14}
                spellCheck={false}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: '#0d1117',
                  color: '#e6edf3',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: '0.85rem',
                  lineHeight: '1.5',
                  padding: '0.85rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  resize: 'vertical',
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                <button
                  onClick={handleRunSimulation}
                  disabled={isRunning}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: 'var(--primary, #3b82f6)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.6rem 1.25rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: isRunning ? 'wait' : 'pointer',
                  }}
                >
                  <Play size={15} />
                  <span>{isRunning ? 'Simulating Host...' : 'Run Pre-Flight Simulation'}</span>
                </button>

                {simulationResult?.success && (
                  <button
                    onClick={handleNextStep}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      background: '#10b981',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.6rem 1.1rem',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <span>{activeStepNumber < currentModule.steps.length ? 'Next Step' : 'Take Module Quiz'}</span>
                    <ChevronRight size={15} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Diagnostics & Pre-flight Simulation Inspector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div
              style={{
                background: 'var(--bg-card, #111827)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Terminal size={16} color="var(--primary, #3b82f6)" />
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Simulation Diagnostic Output</h3>
                </div>

                {simulationResult && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '0.25rem 0.6rem',
                      borderRadius: '4px',
                      background: simulationResult.success ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: simulationResult.success ? '#10b981' : '#f87171',
                      border: `1px solid ${simulationResult.success ? '#10b981' : '#f87171'}`,
                    }}
                  >
                    {simulationResult.success ? 'SIMULATION PASSED' : `ERROR: ${simulationResult.errorCode}`}
                  </span>
                )}
              </div>

              {/* Resource Metrics Bar */}
              {simulationResult && (
                <div style={{ marginBottom: '1rem', background: 'var(--bg-elevated)', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>CPU Instructions Consumed:</span>
                    <span style={{ fontWeight: 600 }}>
                      {simulationResult.consumedCpuInstructions.toLocaleString()} / {simulationResult.cpuBudgetLimit.toLocaleString()} (
                      {Math.round((simulationResult.consumedCpuInstructions / simulationResult.cpuBudgetLimit) * 100)}%)
                    </span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.min(100, (simulationResult.consumedCpuInstructions / simulationResult.cpuBudgetLimit) * 100)}%`,
                        height: '100%',
                        background:
                          simulationResult.consumedCpuInstructions / simulationResult.cpuBudgetLimit > 0.9
                            ? '#ef4444'
                            : '#10b981',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Terminal Logs */}
              <div
                style={{
                  background: '#0d1117',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: '0.8rem',
                  minHeight: '160px',
                  maxHeight: '260px',
                  overflowY: 'auto',
                }}
              >
                {!simulationResult ? (
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Press &quot;Run Pre-Flight Simulation&quot; to test your contract code and inspect RPC diagnostics...
                  </span>
                ) : (
                  <div>
                    {simulationResult.diagnosticLogs.map((log, idx) => (
                      <div
                        key={idx}
                        style={{
                          marginBottom: '0.35rem',
                          color:
                            log.level === 'error'
                              ? '#f87171'
                              : log.level === 'warn'
                              ? '#fbbf24'
                              : '#60a5fa',
                        }}
                      >
                        [{log.level.toUpperCase()}] {log.message}
                      </div>
                    ))}
                    {simulationResult.errorMessage && (
                      <div style={{ color: '#ef4444', marginTop: '0.5rem', fontWeight: 600 }}>
                        💥 Failure: {simulationResult.errorMessage}
                      </div>
                    )}
                    {simulationResult.suggestedFix && !simulationResult.success && (
                      <div style={{ color: '#38bdf8', marginTop: '0.5rem' }}>
                        🛠 Suggested remediation: {simulationResult.suggestedFix}
                      </div>
                    )}
                    {simulationResult.success && (
                      <div style={{ color: '#4ade80', marginTop: '0.5rem', fontWeight: 600 }}>
                        ✨ Verified: Host execution finished with code 0. Footprint read/write verified.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footprint & Auth Inspector Card */}
            <div
              style={{
                background: 'var(--bg-card, #111827)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '1.25rem',
              }}
            >
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Layers size={15} color="var(--primary, #3b82f6)" />
                <span>Declared Transaction Footprint & Authorization</span>
              </h4>

              {/* Footprint table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '0.4rem 0.5rem' }}>Key</th>
                      <th style={{ padding: '0.4rem 0.5rem' }}>Storage Tier</th>
                      <th style={{ padding: '0.4rem 0.5rem' }}>Access Mode</th>
                      <th style={{ padding: '0.4rem 0.5rem' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(simulationResult?.footprintState || currentModule.initialFootprint || []).map((entry, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '0.4rem 0.5rem', fontFamily: 'monospace' }}>{entry.key}</td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>{entry.type}</td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>
                          <span
                            style={{
                              padding: '0.15rem 0.4rem',
                              borderRadius: '3px',
                              background: entry.access === 'readWrite' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                              color: entry.access === 'readWrite' ? '#34d399' : '#60a5fa',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                            }}
                          >
                            {entry.access}
                          </span>
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>
                          {simulationResult?.success ? (
                            <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                              <CheckCircle size={12} /> Validated
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>Pending run</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quiz Workspace Tab */}
      {activeTab === 'quiz' && (
        <div
          style={{
            background: 'var(--bg-card, #111827)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '1.5rem',
            maxWidth: '800px',
            margin: '0 auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <Award size={20} color="#a855f7" />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>
              Knowledge Check: {currentModule.title}
            </h3>
          </div>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Answer all questions to confirm mastery of the concepts covered in this module. Pass rate required: 70%.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {currentModule.quiz.map((q, qIdx) => (
              <div
                key={q.id}
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '1.25rem',
                }}
              >
                <p style={{ fontWeight: 600, fontSize: '0.95rem', margin: '0 0 0.85rem' }}>
                  {qIdx + 1}. {q.question}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {q.options.map((opt, optIdx) => {
                    const isSelected = quizAnswers[qIdx] === optIdx;
                    return (
                      <label
                        key={optIdx}
                        onClick={() => handleQuizOptionSelect(qIdx, optIdx)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.6rem',
                          padding: '0.65rem 0.85rem',
                          borderRadius: '6px',
                          background: isSelected ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255,255,255,0.03)',
                          border: isSelected ? '1px solid #a855f7' : '1px solid var(--border)',
                          cursor: quizSubmitted ? 'default' : 'pointer',
                          fontSize: '0.85rem',
                        }}
                      >
                        <input
                          type="radio"
                          name={`quiz-q-${qIdx}`}
                          checked={isSelected}
                          onChange={() => handleQuizOptionSelect(qIdx, optIdx)}
                          disabled={quizSubmitted}
                        />
                        <span>{opt}</span>
                      </label>
                    );
                  })}
                </div>

                {quizSubmitted && quizResult && (
                  <div
                    style={{
                      marginTop: '0.85rem',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '6px',
                      background: quizResult.details[qIdx].isCorrect ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      border: `1px solid ${quizResult.details[qIdx].isCorrect ? '#10b981' : '#ef4444'}`,
                      fontSize: '0.8rem',
                      color: quizResult.details[qIdx].isCorrect ? '#34d399' : '#f87171',
                    }}
                  >
                    <strong>{quizResult.details[qIdx].isCorrect ? '✓ Correct:' : '✗ Incorrect:'}</strong>{' '}
                    {q.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {!quizSubmitted ? (
              <button
                onClick={handleSubmitQuiz}
                style={{
                  background: '#a855f7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <FileCheck size={16} />
                <span>Submit Quiz</span>
              </button>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '0.85rem 1.25rem',
                  borderRadius: '8px',
                  background: quizResult?.passed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  border: `1px solid ${quizResult?.passed ? '#10b981' : '#ef4444'}`,
                  width: '100%',
                }}
              >
                {quizResult?.passed ? <CheckCircle size={24} color="#10b981" /> : <AlertTriangle size={24} color="#ef4444" />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                    {quizResult?.passed ? 'Module Certification Passed!' : 'Did Not Meet 70% Passing Threshold'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Your Score: {quizResult?.score}% ({quizResult?.correctAnswersCount} / {quizResult?.totalQuestions} correct)
                  </div>
                </div>
                <button
                  onClick={() => {
                    setQuizSubmitted(false);
                    setQuizAnswers(new Array(currentModule.quiz.length).fill(-1));
                    setQuizResult(null);
                  }}
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '0.45rem 0.85rem',
                    color: 'var(--text-primary)',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  Retake Quiz
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Curriculum Summary Footer */}
      <div
        style={{
          marginTop: '2rem',
          padding: '1.25rem',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <BookOpen size={20} color="var(--primary, #3b82f6)" />
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Comprehensive Soroban Debugging Guide</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Looking for full CLI commands, RPC schemas, and architectural best practices?
            </div>
          </div>
        </div>
        <a
          href="/docs/SOROBAN_DEBUGGING_GUIDE.md"
          target="_blank"
          rel="noreferrer"
          style={{
            fontSize: '0.8rem',
            fontWeight: 600,
            color: 'var(--primary, #3b82f6)',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
          }}
        >
          <span>View Documentation</span>
          <ChevronRight size={14} />
        </a>
      </div>
    </div>
  );
};

export default SorobanDebugTutorial;
