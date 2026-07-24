import React, { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { I18nProvider } from './components/I18nProvider';
import './i18n/index.js';
import './styles/responsive.css';
import './styles/mobile-performance.css';
import { AccessibilityProvider } from './context/AccessibilityContext';
import ErrorBoundary from './components/ErrorBoundary';
import { DeveloperTools } from './components/DeveloperTools';
import OnboardingFlow from './components/onboarding/OnboardingFlow';

const DashboardLayout = lazy(() => import('./routes/DashboardLayout'));

function AppLoadingFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '24px',
        background: 'var(--bg-base)',
        color: 'var(--text-primary)',
      }}
    >
      <div style={{ maxWidth: '580px', textAlign: 'center' }}>
        <p style={{ fontSize: '18px', marginBottom: '12px' }}>Loading application...</p>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Fetching the dashboard bundle so the app can render faster.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [showOnboarding, setShowOnboarding] = React.useState(false);

  React.useEffect(() => {
    const hasCompleted = localStorage.getItem('hasCompletedOnboarding');
    if (!hasCompleted) {
      setShowOnboarding(true);
    }
  }, []);

  return (
    <I18nProvider>
      <AccessibilityProvider>
        <ErrorBoundary maxRetries={2}>
          {showOnboarding && <OnboardingFlow onComplete={() => setShowOnboarding(false)} />}
          <Suspense fallback={<AppLoadingFallback />}>
            <Routes>
              <Route path="/connect" element={<DashboardLayout />} />
              <Route path="/*" element={<DashboardLayout />} />
            </Routes>
          </Suspense>
          <DeveloperTools />
        </ErrorBoundary>
      </AccessibilityProvider>
    </I18nProvider>
  );
}
