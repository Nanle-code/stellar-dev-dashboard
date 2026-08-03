import React, { useState } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Sparkles,
  Target,
  BookOpen,
  Code,
  Puzzle,
  Zap,
} from 'lucide-react';
import {
  loadLearnerModel,
  saveLearnerModel,
  updateProfile,
  type UserBackground,
  type ExperienceLevel,
  type LearningStyle,
  type UserGoal,
} from '../../lib/learnerModel';

interface OnboardingWizardProps {
  onComplete: () => void;
}

const steps = [
  { id: 'welcome', icon: Sparkles },
  { id: 'background', icon: BookOpen },
  { id: 'goals', icon: Target },
  { id: 'style', icon: Puzzle },
  { id: 'complete', icon: Check },
];

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<Partial<UserBackground>>({
    experienceLevel: 'beginner',
    developmentExperience: '',
    blockchainExperience: '',
    stellarKnowledge: '',
    programmingLanguages: [],
    goals: ['learn'],
    learningStyle: 'interactive',
    timeCommitment: '',
  });

  const update = (updates: Partial<UserBackground>) => {
    setProfile((prev) => ({ ...prev, ...updates }));
  };

  const toggleGoal = (goal: UserGoal) => {
    const current = profile.goals || [];
    if (current.includes(goal)) {
      update({ goals: current.filter((g) => g !== goal) });
    } else {
      update({ goals: [...current, goal] });
    }
  };

  const toggleLanguage = (lang: string) => {
    const current = profile.programmingLanguages || [];
    if (current.includes(lang)) {
      update({ programmingLanguages: current.filter((l) => l !== lang) });
    } else {
      update({ programmingLanguages: [...current, lang] });
    }
  };

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep((s) => s + 1);
    } else {
      finishOnboarding();
    }
  };

  const handlePrev = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const finishOnboarding = () => {
    const model = loadLearnerModel();
    updateProfile(model, profile as UserBackground);
    saveLearnerModel(model);
    localStorage.setItem('hasCompletedOnboarding', 'true');
    onComplete();
  };

  const btnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    background: 'var(--cyan)',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
  };

  const btnOutline: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    cursor: 'pointer',
  };

  const renderStep = () => {
    switch (steps[step].id) {
      case 'welcome':
        return (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <Sparkles size={48} style={{ color: 'var(--cyan)', marginBottom: '16px' }} />
            <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 12px', color: 'var(--text-primary)' }}>
              Welcome to Stellar Dev Dashboard
            </h2>
            <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Let's personalize your learning experience. We'll tailor tutorials and guidance based on your goals and experience.
            </p>
          </div>
        );

      case 'background':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
              Tell us about yourself
            </h3>
            <div>
              <label style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                Experience Level
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                {(['beginner', 'intermediate', 'advanced'] as ExperienceLevel[]).map((level) => (
                  <button
                    key={level}
                    onClick={() => update({ experienceLevel: level })}
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      border: profile.experienceLevel === level ? '2px solid var(--cyan)' : '2px solid var(--border)',
                      background: profile.experienceLevel === level ? 'var(--bg-elevated)' : 'transparent',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontWeight: profile.experienceLevel === level ? 600 : 400,
                      textTransform: 'capitalize',
                    }}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                Development Experience
              </label>
              <textarea
                value={profile.developmentExperience}
                onChange={(e) => update({ developmentExperience: e.target.value })}
                placeholder="Describe your development background..."
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  resize: 'vertical',
                  minHeight: '60px',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                Programming Languages
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {['JavaScript', 'TypeScript', 'Python', 'Rust', 'Go', 'Java', 'Solidity'].map((lang) => (
                  <button
                    key={lang}
                    onClick={() => toggleLanguage(lang)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '20px',
                      border: (profile.programmingLanguages || []).includes(lang) ? '2px solid var(--cyan)' : '1px solid var(--border)',
                      background: (profile.programmingLanguages || []).includes(lang) ? 'var(--bg-elevated)' : 'transparent',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: '13px',
                    }}
                  >
                    {(profile.programmingLanguages || []).includes(lang) && <Check size={12} style={{ marginRight: '4px', display: 'inline' }} />}
                    {lang}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 'goals':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
              What are your learning goals?
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
              Select all that apply
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {([
                { id: 'explore' as UserGoal, label: 'Explore', desc: 'Browse the Stellar ecosystem', icon: CompassIcon },
                { id: 'learn' as UserGoal, label: 'Learn', desc: 'Build foundational knowledge', icon: BookOpen },
                { id: 'build' as UserGoal, label: 'Build', desc: 'Develop on Stellar', icon: Code },
                { id: 'integrate' as UserGoal, label: 'Integrate', desc: 'Integrate Stellar into projects', icon: Zap },
              ]).map((goal) => (
                <button
                  key={goal.id}
                  onClick={() => toggleGoal(goal.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '20px',
                    borderRadius: '12px',
                    border: (profile.goals || []).includes(goal.id) ? '2px solid var(--cyan)' : '1px solid var(--border)',
                    background: (profile.goals || []).includes(goal.id) ? 'var(--bg-elevated)' : 'transparent',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  <goal.icon size={28} style={{ color: (profile.goals || []).includes(goal.id) ? 'var(--cyan)' : 'var(--text-muted)' }} />
                  <span style={{ fontWeight: 600 }}>{goal.label}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{goal.desc}</span>
                </button>
              ))}
            </div>
          </div>
        );

      case 'style':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
              How do you prefer to learn?
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {([
                { id: 'visual' as LearningStyle, label: 'Visual', desc: 'Diagrams and visual aids' },
                { id: 'reading' as LearningStyle, label: 'Reading', desc: 'Text-based content' },
                { id: 'interactive' as LearningStyle, label: 'Interactive', desc: 'Hands-on practice' },
                { id: 'video' as LearningStyle, label: 'Video', desc: 'Video walkthroughs' },
              ]).map((style) => (
                <button
                  key={style.id}
                  onClick={() => update({ learningStyle: style.id })}
                  style={{
                    padding: '20px',
                    borderRadius: '12px',
                    border: profile.learningStyle === style.id ? '2px solid var(--cyan)' : '1px solid var(--border)',
                    background: profile.learningStyle === style.id ? 'var(--bg-elevated)' : 'transparent',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>{style.label}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{style.desc}</div>
                </button>
              ))}
            </div>
            <div>
              <label style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                Time Commitment
              </label>
              <select
                value={profile.timeCommitment}
                onChange={(e) => update({ timeCommitment: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                }}
              >
                <option value="">Select time commitment</option>
                <option value="casual">Casual - A few hours per week</option>
                <option value="regular">Regular - A few hours per day</option>
                <option value="intensive">Intensive - Full-time learning</option>
              </select>
            </div>
          </div>
        );

      case 'complete':
        return (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <Check size={48} style={{ color: 'var(--green)', marginBottom: '16px' }} />
            <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 12px', color: 'var(--text-primary)' }}>
              You're all set!
            </h2>
            <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Your personalized learning path is ready. We'll recommend tutorials based on your goals and adapt as you progress.
            </p>
          </div>
        );

      default:
        return null;
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
      padding: '20px',
    }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        maxWidth: '600px',
        width: '100%',
        padding: '40px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          {steps.map((s, idx) => (
            <div
              key={s.id}
              style={{
                flex: 1,
                height: '4px',
                borderRadius: '2px',
                background: idx <= step ? 'var(--cyan)' : 'var(--bg-elevated)',
                transition: 'background 0.3s',
              }}
            />
          ))}
        </div>

        <div style={{ minHeight: '320px' }}>
          {renderStep()}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={handlePrev}
            disabled={step === 0}
            style={{
              ...btnOutline,
              opacity: step === 0 ? 0.5 : 1,
              cursor: step === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            <ChevronLeft size={16} /> Back
          </button>
          <button onClick={handleNext} style={btnStyle}>
            {step === steps.length - 1 ? 'Get Started' : 'Continue'} <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function CompassIcon({ size, style }: { size: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}
