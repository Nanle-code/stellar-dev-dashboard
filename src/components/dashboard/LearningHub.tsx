/**
 * Learning Hub Component
 * Interactive educational platform for Stellar blockchain
 */

import React, { useState, useEffect } from 'react';
import { BookOpen, Video, Code, Award, CheckCircle, Play, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { learningHub, Tutorial, UserProgress } from '../../lib/learningHub';

export const LearningHub: React.FC = () => {
  const { t } = useTranslation();
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [selectedTutorial, setSelectedTutorial] = useState<Tutorial | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const userId = 'demo-user'; // In production, use actual user ID

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await learningHub.initialize();
      const [allTutorials, userProgress] = await Promise.all([
        learningHub.getAllTutorials(),
        learningHub.getUserProgress(userId),
      ]);
      setTutorials(allTutorials);
      setProgress(userProgress);
    } catch (error) {
      console.error('Failed to load learning hub data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTutorials =
    filter === 'all' ? tutorials : tutorials.filter((t) => t.category === filter);

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="spinner" />
        <p>{t('learningHub.loading')}</p>
      </div>
    );
  }

  if (selectedTutorial) {
    return (
      <TutorialView
        tutorial={selectedTutorial}
        userId={userId}
        onBack={() => {
          setSelectedTutorial(null);
          loadData();
        }}
        isCompleted={progress?.completedTutorials.includes(selectedTutorial.id) || false}
      />
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{t('learningHub.title')}</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          {t('learningHub.subtitle')}
        </p>
      </div>

      {/* Progress Overview */}
      {progress && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem',
          }}
        >
          <StatCard icon={Award} label={t('learningHub.stat.level')} value={progress.level.toString()} color="var(--primary)" />
          <StatCard
            icon={CheckCircle}
            label={t('learningHub.stat.completed')}
            value={`${progress.completedTutorials.length}/${tutorials.length}`}
            color="var(--success)"
          />
          <StatCard icon={BookOpen} label={t('learningHub.stat.points')} value={progress.totalPoints.toString()} color="var(--info)" />
        </div>
      )}

      {/* Category Filter */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {['all', 'basics', 'advanced', 'soroban', 'assets', 'payments'].map((category) => (
          <button
            key={category}
            onClick={() => setFilter(category)}
            style={{
              padding: '0.5rem 1rem',
              background: filter === category ? 'var(--primary)' : 'var(--surface-2)',
              color: filter === category ? 'white' : 'var(--text-primary)',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.85rem',
              textTransform: 'capitalize',
              transition: 'all 0.2s',
            }}
          >
            {t(`learningHub.category.${category}`)}
          </button>
        ))}
      </div>

      {/* Tutorials Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {filteredTutorials.map((tutorial) => (
          <TutorialCard
            key={tutorial.id}
            tutorial={tutorial}
            isCompleted={progress?.completedTutorials.includes(tutorial.id) || false}
            onSelect={() => setSelectedTutorial(tutorial)}
          />
        ))}
      </div>

      {filteredTutorials.length === 0 && (
        <div
          style={{
            padding: '3rem',
            textAlign: 'center',
            background: 'var(--card-bg)',
            borderRadius: '0.5rem',
            border: '1px dashed var(--border)',
          }}
        >
          <p style={{ color: 'var(--text-secondary)' }}>{t('learningHub.tutorial.noFound')}</p>
        </div>
      )}
    </div>
  );
};

const StatCard: React.FC<{
  icon: React.ComponentType<{ size: number; style?: React.CSSProperties }>;
  label: string;
  value: string;
  color: string;
}> = ({ icon: Icon, label, value, color }) => (
  <div
    style={{
      padding: '1.5rem',
      background: 'var(--card-bg)',
      border: '1px solid var(--border)',
      borderRadius: '0.5rem',
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
    }}
  >
    <Icon size={32} style={{ color }} />
    <div>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 0.25rem' }}>{label}</p>
      <p style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>{value}</p>
    </div>
  </div>
);

const TutorialCard: React.FC<{
  tutorial: Tutorial;
  isCompleted: boolean;
  onSelect: () => void;
}> = ({ tutorial, isCompleted, onSelect }) => {
  const { t } = useTranslation();
  const difficultyColors = {
    beginner: 'var(--success)',
    intermediate: 'var(--warning)',
    advanced: 'var(--danger)',
  };

  return (
    <div
      onClick={onSelect}
      style={{
        padding: '1.5rem',
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderRadius: '0.5rem',
        cursor: 'pointer',
        transition: 'all 0.2s',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {isCompleted && (
        <div
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'var(--success)',
            color: 'white',
            borderRadius: '50%',
            padding: '0.25rem',
          }}
        >
          <CheckCircle size={20} />
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        {tutorial.videoUrl && <Video size={18} color="var(--primary)" />}
        <BookOpen size={18} color="var(--primary)" />
        <Code size={18} color="var(--primary)" />
      </div>
      <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', fontWeight: 600 }}>{tutorial.title}</h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: '1.5' }}>
        {tutorial.description}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <span
            style={{
              padding: '0.25rem 0.5rem',
              background: difficultyColors[tutorial.difficulty],
              color: 'white',
              borderRadius: '0.25rem',
              fontSize: '0.7rem',
              textTransform: 'capitalize',
            }}
          >
            {t(`learningHub.tutorial.difficulty.${tutorial.difficulty}`)}
          </span>
          <span
            style={{
              padding: '0.25rem 0.5rem',
              background: 'var(--surface-2)',
              borderRadius: '0.25rem',
              fontSize: '0.7rem',
              color: 'var(--text-secondary)',
            }}
          >
            {t('learningHub.tutorial.duration', { min: tutorial.duration })}
          </span>
        </div>
        <ChevronRight size={18} color="var(--text-secondary)" />
      </div>
    </div>
  );
};

const TutorialView: React.FC<{
  tutorial: Tutorial;
  userId: string;
  onBack: () => void;
  isCompleted: boolean;
}> = ({ tutorial, userId, onBack, isCompleted }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'content' | 'playground' | 'quiz'>('content');
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizResult, setQuizResult] = useState<any>(null);

  const handleQuizSubmit = async () => {
    if (!tutorial.quiz || quizAnswers.length !== tutorial.quiz.questions.length) {
      alert(t('learningHub.quiz.answerAll'));
      return;
    }

    try {
      const result = await learningHub.submitQuiz(userId, tutorial.quiz.id, quizAnswers);
      setQuizResult(result);
      setQuizSubmitted(true);
    } catch (error) {
      console.error('Failed to submit quiz:', error);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <button
        onClick={onBack}
        style={{
          padding: '0.5rem 1rem',
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: '0.375rem',
          cursor: 'pointer',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        {t('learningHub.back')}
      </button>

      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <h1 style={{ fontSize: '2rem' }}>{tutorial.title}</h1>
          {isCompleted && (
            <span
              style={{
                background: 'var(--success)',
                color: 'white',
                padding: '0.25rem 0.75rem',
                borderRadius: '0.375rem',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <CheckCircle size={14} /> {t('learningHub.tutorial.completed')}
            </span>
          )}
        </div>
        <p style={{ color: 'var(--text-secondary)' }}>{tutorial.description}</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
        <TabButton
          label={t('learningHub.tabs.content')}
          icon={BookOpen}
          active={activeTab === 'content'}
          onClick={() => setActiveTab('content')}
        />
        <TabButton
          label={t('learningHub.tabs.playground')}
          icon={Code}
          active={activeTab === 'playground'}
          onClick={() => setActiveTab('playground')}
        />
        {tutorial.quiz && (
          <TabButton
            label={t('learningHub.tabs.quiz')}
            icon={Award}
            active={activeTab === 'quiz'}
            onClick={() => setActiveTab('quiz')}
          />
        )}
      </div>

      {/* Content */}
      {activeTab === 'content' && (
        <div style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
          {tutorial.videoUrl && (
            <div style={{ marginBottom: '2rem', aspectRatio: '16/9', background: '#000', borderRadius: '0.375rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Play size={48} color="#fff" />
            </div>
          )}
          <div
            style={{ lineHeight: '1.8', color: 'var(--text-primary)' }}
            dangerouslySetInnerHTML={{ __html: tutorial.content.replace(/\n/g, '<br/>') }}
          />
          {tutorial.codeExamples.map((example) => (
            <div key={example.id} style={{ marginTop: '2rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>{example.title}</h3>
              <pre
                style={{
                  background: 'var(--surface-1)',
                  padding: '1rem',
                  borderRadius: '0.375rem',
                  overflow: 'auto',
                  fontSize: '0.85rem',
                }}
              >
                <code>{example.code}</code>
              </pre>
              <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                {example.explanation}
              </p>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'playground' && (
        <div style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
          <h3 style={{ marginBottom: '1rem' }}>{t('learningHub.playground.title')}</h3>
          <textarea
            placeholder={t('learningHub.playground.placeholder')}
            style={{
              width: '100%',
              minHeight: '300px',
              padding: '1rem',
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              borderRadius: '0.375rem',
              fontFamily: 'monospace',
              fontSize: '0.9rem',
              color: 'var(--text-primary)',
            }}
          />
          <button
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1.5rem',
              background: 'var(--primary)',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
            }}
          >
            {t('learningHub.playground.run')}
          </button>
        </div>
      )}

      {activeTab === 'quiz' && tutorial.quiz && (
        <div style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>{t('learningHub.quiz.testKnowledge')}</h3>
          {tutorial.quiz.questions.map((question, qIndex) => (
            <div key={question.id} style={{ marginBottom: '2rem' }}>
              <p style={{ fontWeight: 600, marginBottom: '1rem' }}>
                {qIndex + 1}. {question.question}
              </p>
              {question.options.map((option, oIndex) => (
                <label
                  key={oIndex}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem',
                    background: quizAnswers[qIndex] === oIndex ? 'var(--primary-light)' : 'var(--surface-1)',
                    borderRadius: '0.375rem',
                    marginBottom: '0.5rem',
                    cursor: 'pointer',
                    border: `1px solid ${quizAnswers[qIndex] === oIndex ? 'var(--primary)' : 'var(--border)'}`,
                  }}
                >
                  <input
                    type="radio"
                    name={`question-${qIndex}`}
                    checked={quizAnswers[qIndex] === oIndex}
                    onChange={() => {
                      const newAnswers = [...quizAnswers];
                      newAnswers[qIndex] = oIndex;
                      setQuizAnswers(newAnswers);
                    }}
                    disabled={quizSubmitted}
                  />
                  {option}
                </label>
              ))}
              {quizSubmitted && (
                <p style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'var(--info-bg)', borderRadius: '0.375rem', fontSize: '0.85rem' }}>
                  {question.explanation}
                </p>
              )}
            </div>
          ))}
          {!quizSubmitted ? (
            <button
              onClick={handleQuizSubmit}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'var(--primary)',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
              }}
            >
              {t('learningHub.quiz.submit')}
            </button>
          ) : (
            <div
              style={{
                padding: '1.5rem',
                background: quizResult?.passed ? 'var(--success-bg)' : 'var(--danger-bg)',
                borderRadius: '0.5rem',
                marginTop: '1rem',
              }}
            >
              <h4 style={{ marginBottom: '0.5rem' }}>
                {quizResult?.passed ? t('learningHub.quiz.passed') : t('learningHub.quiz.failed')}
              </h4>
              <p>
                {t('learningHub.quiz.score', {
                  percent: Math.round(quizResult?.score * 100),
                  correct: Math.round(quizResult?.score * quizResult?.totalQuestions),
                  total: quizResult?.totalQuestions,
                })}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const TabButton: React.FC<{
  label: string;
  icon: React.ComponentType<{ size: number }>;
  active: boolean;
  onClick: () => void;
}> = ({ label, icon: Icon, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      padding: '0.75rem 1rem',
      background: 'transparent',
      border: 'none',
      borderBottom: `2px solid ${active ? 'var(--primary)' : 'transparent'}`,
      cursor: 'pointer',
      color: active ? 'var(--primary)' : 'var(--text-secondary)',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      fontWeight: active ? 600 : 400,
    }}
  >
    <Icon size={18} />
    {label}
  </button>
);
