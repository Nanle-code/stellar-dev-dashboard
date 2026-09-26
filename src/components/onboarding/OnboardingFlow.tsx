import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Check, SkipForward, Wallet, User, Layout, Star } from 'lucide-react';
import { connectFreighter } from '../../lib/wallet/freighter.js';

export default function OnboardingFlow({ onComplete }) {
  const [step, setStep] = useState(0);
  const [walletConnected, setWalletConnected] = useState(false);
  const [preferences, setPreferences] = useState({ theme: 'dark', layout: 'advanced' });

  const steps = [
    {
      id: 'welcome',
      title: 'Welcome to Stellar Dev Dashboard',
      description: 'Let\'s get you set up to explore the Stellar network, test integrations, and build powerful applications.',
      icon: <Star size={40} style={{ color: 'var(--cyan)' }} />
    },
    {
      id: 'account',
      title: 'Create Your Account',
      description: 'You can generate a new testnet account or bring your own.',
      icon: <User size={40} style={{ color: 'var(--blue)' }} />
    },
    {
      id: 'wallet',
      title: 'Connect Your Wallet',
      description: 'Connect Freighter to securely sign transactions without sharing your secret keys.',
      icon: <Wallet size={40} style={{ color: 'var(--orange)' }} />
    },
    {
      id: 'preferences',
      title: 'Customize Your Setup',
      description: 'Choose how you want your dashboard to look and behave.',
      icon: <Layout size={40} style={{ color: 'var(--purple)' }} />
    }
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(prev => prev + 1);
    } else {
      finishOnboarding();
    }
  };

  const handlePrev = () => {
    if (step > 0) {
      setStep(prev => prev - 1);
    }
  };

  const finishOnboarding = () => {
    localStorage.setItem('hasCompletedOnboarding', 'true');
    localStorage.setItem('dashboardPreferences', JSON.stringify(preferences));
    if (onComplete) onComplete();
  };

  const handleConnectWallet = async () => {
    try {
      const account = await connectFreighter();
      if (account) {
        setWalletConnected(true);
        setTimeout(handleNext, 1000); // Auto advance after success
      }
    } catch (err) {
      alert('Failed to connect wallet. Ensure Freighter is installed and unlocked.');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'var(--bg-base)',
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        maxWidth: '600px',
        width: '100%',
        padding: '40px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        <button
          onClick={finishOnboarding}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '14px'
          }}
        >
          Skip <SkipForward size={14} />
        </button>

        {/* Progress Bar */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {steps.map((s, idx) => (
            <div key={s.id} style={{
              flex: 1,
              height: '4px',
              borderRadius: '2px',
              background: idx <= step ? 'var(--cyan)' : 'var(--bg-elevated)',
              transition: 'background 0.3s'
            }} />
          ))}
        </div>

        {/* Content */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '220px' }}>
          <div style={{ marginBottom: '20px', padding: '16px', background: 'var(--bg-elevated)', borderRadius: '50%' }}>
            {steps[step].icon}
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 12px 0', color: 'var(--text-primary)' }}>
            {steps[step].title}
          </h2>
          <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, maxWidth: '400px' }}>
            {steps[step].description}
          </p>

          <div style={{ marginTop: '30px', width: '100%' }}>
            {step === 1 && (
              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                <button
                  onClick={handleNext}
                  style={{
                    padding: '12px 24px', background: 'var(--cyan)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600
                  }}
                >
                  Generate Testnet Account
                </button>
              </div>
            )}
            
            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                {walletConnected ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--green)', fontWeight: 600 }}>
                    <Check size={20} /> Wallet Connected Successfully
                  </div>
                ) : (
                  <button
                    onClick={handleConnectWallet}
                    style={{
                      padding: '12px 24px', background: 'transparent', border: '2px solid var(--orange)', color: 'var(--orange)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600
                    }}
                  >
                    Connect Freighter Wallet
                  </button>
                )}
              </div>
            )}

            {step === 3 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', textAlign: 'left' }}>
                <div style={{ background: 'var(--bg-elevated)', padding: '16px', borderRadius: '8px', cursor: 'pointer', border: preferences.theme === 'dark' ? '2px solid var(--cyan)' : '2px solid transparent' }} onClick={() => setPreferences(p => ({ ...p, theme: 'dark' }))}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Dark Theme</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Easier on the eyes</div>
                </div>
                <div style={{ background: 'var(--bg-elevated)', padding: '16px', borderRadius: '8px', cursor: 'pointer', border: preferences.theme === 'light' ? '2px solid var(--cyan)' : '2px solid transparent' }} onClick={() => setPreferences(p => ({ ...p, theme: 'light' }))}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Light Theme</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Crisp and clear</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
          <button
            onClick={handlePrev}
            disabled={step === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 16px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              cursor: step === 0 ? 'not-allowed' : 'pointer',
              opacity: step === 0 ? 0.5 : 1
            }}
          >
            <ChevronLeft size={16} /> Back
          </button>
          
          <button
            onClick={handleNext}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 20px',
              background: 'var(--cyan)',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {step === steps.length - 1 ? 'Finish Setup' : 'Continue'} <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
