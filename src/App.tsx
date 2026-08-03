import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { I18nProvider } from './components/I18nProvider';
import './i18n/index.js';
import './styles/responsive.css';
import './styles/mobile-performance.css';
import { AccessibilityProvider } from './context/AccessibilityContext';
import { ExpertiseProvider } from './context/ExpertiseContext';
import ErrorBoundary from './components/ErrorBoundary';
import { DeveloperTools } from './components/DeveloperTools';
import OnboardingFlow from './components/onboarding/OnboardingFlow';
import { TipProvider } from './components/ai/TipProvider';
import DashboardLayout from './routes/DashboardLayout';

export default function App() {
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const hasCompleted = localStorage.getItem('hasCompletedOnboarding');
    if (!hasCompleted) {
      setShowOnboarding(true);
    }
  }, []);

  return (
    <I18nProvider>
      <AccessibilityProvider>
        <ExpertiseProvider>
          <ErrorBoundary maxRetries={2}>
            {showOnboarding && <OnboardingFlow onComplete={() => setShowOnboarding(false)} />}
            <Routes>
              <Route path="/connect" element={<DashboardLayout />} />
              <Route path="/*" element={<DashboardLayout />} />
            </Routes>
            <DeveloperTools />
          </ErrorBoundary>
        </ExpertiseProvider>
      </AccessibilityProvider>
    </I18nProvider>
  );
}
