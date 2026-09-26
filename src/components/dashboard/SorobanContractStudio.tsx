import React, { useState, useRef } from 'react';
import { useStore } from '../../lib/store';
import { Code, Play, Rocket, FileText, Book, Download, Upload, AlertCircle, CheckCircle, Copy } from 'lucide-react';

interface ContractTemplate {
  id: string;
  name: string;
  description: string;
  code: string;
}

const TEMPLATES: ContractTemplate[] = [
  {
    id: 'hello',
    name: 'Hello World',
    description: 'Simple contract that returns a greeting',
    code: `#![no_std]
use soroban_sdk::{contract, contractimpl, Env, Symbol};

#[contract]
pub struct HelloContract;

#[contractimpl]
impl HelloContract {
    pub fn hello(env: Env, to: Symbol) -> Symbol {
        Symbol::short(&env.readonly_string(&to))
    }
}`
  },
  {
    id: 'counter',
    name: 'Counter',
    description: 'A simple counter with increment and decrement',
    code: `#![no_std]
use soroban_sdk::{contract, contractimpl, Env, Symbol};

#[contract]
pub struct CounterContract;

#[contractimpl]
impl CounterContract {
    pub fn increment(env: Env) -> u32 {
        let key = Symbol::short(&env, "count");
        let mut count = env.storage().get(&key).unwrap_or(0);
        count += 1;
        env.storage().set(&key, &count);
        count
    }
    
    pub fn decrement(env: Env) -> u32 {
        let key = Symbol::short(&env, "count");
        let mut count = env.storage().get(&key).unwrap_or(0);
        if count > 0 {
            count -= 1;
        }
        env.storage().set(&key, &count);
        count
    }
    
    pub fn get(env: Env) -> u32 {
        let key = Symbol::short(&env, "count");
        env.storage().get(&key).unwrap_or(0)
    }
}`
  },
  {
    id: 'token',
    name: 'Simple Token',
    description: 'Basic ERC20-like token implementation',
    code: `#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, Symbol};

#[contract]
pub struct TokenContract;

#[contractimpl]
impl TokenContract {
    pub fn initialize(env: Env, admin: Address) {
        env.storage().set(&Symbol::short(&env, "admin"), &admin);
    }
    
    pub fn mint(env: Env, to: Address, amount: i128) {
        let admin = env.storage().get(&Symbol::short(&env, "admin"));
        // Verify admin and mint logic here
    }
    
    pub fn balance(env: Env, addr: Address) -> i128 {
        let key = Symbol::short(&env, "balance");
        env.storage().get(&key).unwrap_or(0)
    }
}`
  }
];

export default function SorobanContractStudio() {
  const { network } = useStore();
  const [code, setCode] = useState(TEMPLATES[0].code);
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0].id);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [compilationResult, setCompilationResult] = useState<any>(null);
  const [deploymentResult, setDeploymentResult] = useState<any>(null);
  const [testResults, setTestResults] = useState<any>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const editorRef = useRef<HTMLTextArea>(null);

  const handleTemplateSelect = (template: ContractTemplate) => {
    setCode(template.code);
    setSelectedTemplate(template.id);
    setShowTemplates(false);
  };

  const handleCompile = async () => {
    setIsCompiling(true);
    setCompilationResult(null);

    // Simulate compilation
    setTimeout(() => {
      const hasErrors = code.includes('error');
      setCompilationResult({
        success: !hasErrors,
        wasmSize: Math.floor(Math.random() * 50000) + 10000,
        errors: hasErrors ? ['Syntax error at line 5', 'Missing import'] : [],
        warnings: ['Unused variable at line 12']
      });
      setIsCompiling(false);
    }, 2000);
  };

  const handleDeploy = async () => {
    if (!compilationResult?.success) return;

    setIsDeploying(true);
    setDeploymentResult(null);

    // Simulate deployment
    setTimeout(() => {
      setDeploymentResult({
        success: true,
        contractId: `C${Math.random().toString(16).substr(2, 56)}`,
        network,
        timestamp: new Date().toISOString(),
        fee: 1500
      });
      setIsDeploying(false);
    }, 3000);
  };

  const handleRunTests = async () => {
    setIsRunningTests(true);
    setTestResults(null);

    // Simulate test execution
    setTimeout(() => {
      setTestResults({
        total: 5,
        passed: 4,
        failed: 1,
        duration: '1.2s',
        tests: [
          { name: 'test_hello', status: 'passed', duration: '0.1s' },
          { name: 'test_counter_increment', status: 'passed', duration: '0.2s' },
          { name: 'test_counter_decrement', status: 'passed', duration: '0.15s' },
          { name: 'test_counter_get', status: 'passed', duration: '0.1s' },
          { name: 'test_edge_case', status: 'failed', duration: '0.3s', error: 'Assertion failed' }
        ]
      });
      setIsRunningTests(false);
    }, 1500);
  };

  const handleExportCode = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const link = document.createElement('a');
    link.download = 'contract.rs';
    link.href = URL.createObjectURL(blob);
    link.click();
  };

  const handleImportCode = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      setCode(e.target?.result as string);
    };
    reader.readAsText(file);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code);
  };

  return (
    <div style={{
      padding: '24px',
      background: 'var(--bg-base)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-mono)',
      height: 'calc(100vh - 100px)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <div>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 600,
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Code size={24} />
            Soroban Contract Studio
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Write, compile, test, and deploy Soroban smart contracts
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            style={{
              padding: '12px 20px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Book size={16} />
            Templates
          </button>
          <button
            onClick={handleExportCode}
            style={{
              padding: '12px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              color: 'var(--text-primary)'
            }}
            title="Export code"
          >
            <Download size={16} />
          </button>
          <label style={{
            padding: '12px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            color: 'var(--text-primary)'
          }} title="Import code">
            <Upload size={16} />
            <input
              type="file"
              accept=".rs,.txt"
              onChange={handleImportCode}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

      {/* Template Selection */}
      {showTemplates && (
        <div style={{
          padding: '16px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          marginBottom: '16px'
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
            Contract Templates
          </h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            {TEMPLATES.map((template) => (
              <div
                key={template.id}
                onClick={() => handleTemplateSelect(template)}
                style={{
                  padding: '12px',
                  background: selectedTemplate === template.id ? 'var(--bg-hover)' : 'var(--bg-base)',
                  border: selectedTemplate === template.id ? '2px solid var(--cyan)' : '1px solid var(--border)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'var(--transition)'
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>{template.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {template.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Editor Area */}
      <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0 }}>
        {/* Code Editor */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              contract.rs
            </span>
            <button
              onClick={copyCode}
              style={{
                padding: '6px 12px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                color: 'var(--text-primary)'
              }}
            >
              <Copy size={12} />
              Copy
            </button>
          </div>
          <textarea
            ref={editorRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{
              flex: 1,
              padding: '16px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              lineHeight: '1.6',
              resize: 'none',
              outline: 'none'
            }}
            spellCheck={false}
          />
        </div>

        {/* Sidebar - Actions & Results */}
        <div style={{ width: '400px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Action Buttons */}
          <div style={{
            padding: '16px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: '8px'
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
              Actions
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={handleCompile}
                disabled={isCompiling}
                style={{
                  padding: '12px',
                  background: isCompiling ? 'var(--border)' : 'var(--purple-dim)',
                  border: 'none',
                  borderRadius: '6px',
                  color: 'var(--bg-base)',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: isCompiling ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {isCompiling ? (
                  <>
                    <div style={{
                      width: '14px',
                      height: '14px',
                      border: '2px solid var(--bg-base)',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    Compiling...
                  </>
                ) : (
                  <>
                    <FileText size={16} />
                    Compile
                  </>
                )}
              </button>
              
              <button
                onClick={handleDeploy}
                disabled={!compilationResult?.success || isDeploying}
                style={{
                  padding: '12px',
                  background: !compilationResult?.success || isDeploying ? 'var(--border)' : 'var(--cyan-dim)',
                  border: 'none',
                  borderRadius: '6px',
                  color: 'var(--bg-base)',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: !compilationResult?.success || isDeploying ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {isDeploying ? (
                  <>
                    <div style={{
                      width: '14px',
                      height: '14px',
                      border: '2px solid var(--bg-base)',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    Deploying...
                  </>
                ) : (
                  <>
                    <Rocket size={16} />
                    Deploy to {network}
                  </>
                )}
              </button>
              
              <button
                onClick={handleRunTests}
                disabled={isRunningTests}
                style={{
                  padding: '12px',
                  background: isRunningTests ? 'var(--border)' : 'var(--green-dim)',
                  border: 'none',
                  borderRadius: '6px',
                  color: 'var(--bg-base)',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: isRunningTests ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {isRunningTests ? (
                  <>
                    <div style={{
                      width: '14px',
                      height: '14px',
                      border: '2px solid var(--bg-base)',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    Running Tests...
                  </>
                ) : (
                  <>
                    <Play size={16} />
                    Run Tests
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Compilation Results */}
          {compilationResult && (
            <div style={{
              padding: '16px',
              background: 'var(--bg-elevated)',
              border: `1px solid ${compilationResult.success ? 'var(--green)' : 'var(--red)'}`,
              borderRadius: '8px'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                marginBottom: '12px',
                fontWeight: 600
              }}>
                {compilationResult.success ? (
                  <CheckCircle size={16} style={{ color: 'var(--green)' }} />
                ) : (
                  <AlertCircle size={16} style={{ color: 'var(--red)' }} />
                )}
                Compilation {compilationResult.success ? 'Success' : 'Failed'}
              </div>
              
              {compilationResult.success && (
                <div style={{ fontSize: '13px', marginBottom: '8px' }}>
                  WASM Size: {(compilationResult.wasmSize / 1024).toFixed(2)} KB
                </div>
              )}
              
              {compilationResult.errors.length > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--red)', marginBottom: '4px' }}>
                    Errors:
                  </div>
                  {compilationResult.errors.map((error: string, idx: number) => (
                    <div key={idx} style={{
                      padding: '8px',
                      background: 'var(--red-dim)',
                      borderRadius: '4px',
                      fontSize: '12px',
                      marginBottom: '4px'
                    }}>
                      {error}
                    </div>
                  ))}
                </div>
              )}
              
              {compilationResult.warnings.length > 0 && (
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--orange)', marginBottom: '4px' }}>
                    Warnings:
                  </div>
                  {compilationResult.warnings.map((warning: string, idx: number) => (
                    <div key={idx} style={{
                      padding: '8px',
                      background: 'var(--orange-dim)',
                      borderRadius: '4px',
                      fontSize: '12px',
                      marginBottom: '4px'
                    }}>
                      {warning}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Deployment Results */}
          {deploymentResult && (
            <div style={{
              padding: '16px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--green)',
              borderRadius: '8px'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                marginBottom: '12px',
                fontWeight: 600,
                color: 'var(--green)'
              }}>
                <CheckCircle size={16} />
                Deployment Successful
              </div>
              
              <div style={{ fontSize: '13px', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Contract ID: </span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{deploymentResult.contractId}</span>
              </div>
              
              <div style={{ fontSize: '13px', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Network: </span>
                {deploymentResult.network}
              </div>
              
              <div style={{ fontSize: '13px', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Fee: </span>
                {deploymentResult.fee} stroops
              </div>
              
              <div style={{ fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Deployed: </span>
                {new Date(deploymentResult.timestamp).toLocaleString()}
              </div>
            </div>
          )}

          {/* Test Results */}
          {testResults && (
            <div style={{
              padding: '16px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              maxHeight: '300px',
              overflowY: 'auto'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
                fontWeight: 600
              }}>
                <span>Test Results</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {testResults.duration}
                </span>
              </div>
              
              <div style={{
                display: 'flex',
                gap: '16px',
                marginBottom: '12px',
                fontSize: '13px'
              }}>
                <span style={{ color: 'var(--green)' }}>{testResults.passed} passed</span>
                <span style={{ color: 'var(--red)' }}>{testResults.failed} failed</span>
                <span style={{ color: 'var(--text-secondary)' }}>{testResults.total} total</span>
              </div>
              
              {testResults.tests.map((test: any, idx: number) => (
                <div
                  key={idx}
                  style={{
                    padding: '8px 12px',
                    background: test.status === 'passed' ? 'var(--green-dim)' : 'var(--red-dim)',
                    borderRadius: '4px',
                    marginBottom: '8px',
                    fontSize: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{test.name}</span>
                    <span style={{ color: test.status === 'passed' ? 'var(--green)' : 'var(--red)' }}>
                      {test.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    {test.duration}
                  </div>
                  {test.error && (
                    <div style={{ color: 'var(--red)', marginTop: '4px' }}>
                      {test.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
