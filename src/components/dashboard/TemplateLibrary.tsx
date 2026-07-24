/**
 * Template Library Component
 * Browse, search, and use pre-built transaction templates
 */

import React, { useState, useEffect } from 'react';
import { Search, Star, TrendingUp, BookOpen, Play, Save, Filter } from 'lucide-react';
import { templateLibrary, TransactionTemplate } from '../../lib/templateLibrary';

export const TemplateLibrary: React.FC = () => {
  const [templates, setTemplates] = useState<TransactionTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<TransactionTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TransactionTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'rating' | 'usage' | 'name'>('rating');
  const [loading, setLoading] = useState(true);
  const userId = 'demo-user';

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    filterAndSortTemplates();
  }, [templates, searchQuery, categoryFilter, sortBy]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      await templateLibrary.initialize();
      const allTemplates = await templateLibrary.getAllTemplates();
      setTemplates(allTemplates);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortTemplates = () => {
    let filtered = templates;

    // Apply category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((t) => t.category === categoryFilter);
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query) ||
          t.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return b.averageRating - a.averageRating;
        case 'usage':
          return b.usageCount - a.usageCount;
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    setFilteredTemplates(filtered);
  };

  const handleSearch = async () => {
    if (searchQuery) {
      const results = await templateLibrary.searchTemplates(searchQuery);
      setFilteredTemplates(results);
    } else {
      setFilteredTemplates(templates);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="spinner" />
        <p>Loading template library...</p>
      </div>
    );
  }

  if (selectedTemplate) {
    return (
      <TemplatePreview
        template={selectedTemplate}
        userId={userId}
        onBack={() => setSelectedTemplate(null)}
        onUse={() => {
          templateLibrary.incrementUsageCount(selectedTemplate.id);
          alert('Template ready to use!');
        }}
      />
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Template Library</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Browse and use pre-built transaction templates for common Stellar operations
        </p>
      </div>

      {/* Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        <StatCard icon={BookOpen} label="Total Templates" value={templates.length.toString()} />
        <StatCard icon={Star} label="Avg Rating" value={`${(templates.reduce((sum, t) => sum + t.averageRating, 0) / templates.length).toFixed(1)} ⭐`} />
        <StatCard icon={TrendingUp} label="Total Uses" value={templates.reduce((sum, t) => sum + t.usageCount, 0).toString()} />
      </div>

      {/* Search and Filters */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 300px', position: 'relative' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search templates..."
              style={{
                width: '100%',
                padding: '0.75rem 3rem 0.75rem 1rem',
                border: '1px solid var(--border)',
                borderRadius: '0.5rem',
                background: 'var(--surface-1)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
              }}
            />
            <button
              onClick={handleSearch}
              style={{
                position: 'absolute',
                right: '0.5rem',
                top: '50%',
                transform: 'translateY(-50%)',
                padding: '0.5rem',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Search size={20} color="var(--text-secondary)" />
            </button>
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{
              padding: '0.75rem 1rem',
              border: '1px solid var(--border)',
              borderRadius: '0.5rem',
              background: 'var(--surface-1)',
              color: 'var(--text-primary)',
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            <option value="all">All Categories</option>
            <option value="payment">Payment</option>
            <option value="asset">Asset</option>
            <option value="multisig">Multi-Sig</option>
            <option value="dex">DEX</option>
            <option value="contract">Contract</option>
            <option value="advanced">Advanced</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            style={{
              padding: '0.75rem 1rem',
              border: '1px solid var(--border)',
              borderRadius: '0.5rem',
              background: 'var(--surface-1)',
              color: 'var(--text-primary)',
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            <option value="rating">Top Rated</option>
            <option value="usage">Most Used</option>
            <option value="name">Name</option>
          </select>
        </div>

        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Showing {filteredTemplates.length} of {templates.length} templates
        </div>
      </div>

      {/* Templates Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
        {filteredTemplates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onSelect={() => setSelectedTemplate(template)}
          />
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div
          style={{
            padding: '3rem',
            textAlign: 'center',
            background: 'var(--card-bg)',
            borderRadius: '0.5rem',
            border: '1px dashed var(--border)',
          }}
        >
          <p style={{ color: 'var(--text-secondary)' }}>No templates found</p>
        </div>
      )}
    </div>
  );
};

const StatCard: React.FC<{
  icon: React.ComponentType<{ size: number; style?: React.CSSProperties }>;
  label: string;
  value: string;
}> = ({ icon: Icon, label, value }) => (
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
    <Icon size={32} style={{ color: 'var(--primary)' }} />
    <div>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 0.25rem' }}>{label}</p>
      <p style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>{value}</p>
    </div>
  </div>
);

const TemplateCard: React.FC<{
  template: TransactionTemplate;
  onSelect: () => void;
}> = ({ template, onSelect }) => {
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
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>{template.name}</h3>
          {template.isOfficial && (
            <span
              style={{
                padding: '0.25rem 0.5rem',
                background: 'var(--primary)',
                color: 'white',
                borderRadius: '0.25rem',
                fontSize: '0.7rem',
                fontWeight: 600,
              }}
            >
              OFFICIAL
            </span>
          )}
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.5rem 0', lineHeight: '1.5' }}>
          {template.description}
        </p>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <span
          style={{
            padding: '0.25rem 0.5rem',
            background: difficultyColors[template.difficulty],
            color: 'white',
            borderRadius: '0.25rem',
            fontSize: '0.7rem',
            textTransform: 'capitalize',
          }}
        >
          {template.difficulty}
        </span>
        <span
          style={{
            padding: '0.25rem 0.5rem',
            background: 'var(--surface-2)',
            borderRadius: '0.25rem',
            fontSize: '0.7rem',
            color: 'var(--text-secondary)',
            textTransform: 'capitalize',
          }}
        >
          {template.category}
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <Star size={14} fill="gold" color="gold" />
          <span>{template.averageRating.toFixed(1)}</span>
          <span style={{ marginLeft: '0.5rem', color: 'var(--text-tertiary)' }}>
            ({template.ratings.length})
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <TrendingUp size={14} />
          <span>{template.usageCount} uses</span>
        </div>
      </div>

      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.75rem' }}>
        By {template.author}
      </div>
    </div>
  );
};

const TemplatePreview: React.FC<{
  template: TransactionTemplate;
  userId: string;
  onBack: () => void;
  onUse: () => void;
}> = ({ template, userId, onBack, onUse }) => {
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  useEffect(() => {
    // Initialize parameters with default values
    const defaults: Record<string, any> = {};
    template.parameters.forEach((param) => {
      if (param.defaultValue !== undefined) {
        defaults[param.name] = param.defaultValue;
      }
    });
    setParameters(defaults);
  }, [template]);

  const handleSubmitRating = async () => {
    if (rating > 0) {
      try {
        await templateLibrary.rateTemplate(template.id, userId, rating, comment);
        alert('Rating submitted!');
        setRating(0);
        setComment('');
      } catch (error) {
        console.error('Failed to submit rating:', error);
      }
    }
  };

  const handleSaveTemplate = async () => {
    try {
      await templateLibrary.saveUserTemplate(userId, template);
      alert('Template saved to your library!');
    } catch (error) {
      console.error('Failed to save template:', error);
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
        }}
      >
        ← Back to Library
      </button>

      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{template.name}</h1>
            <p style={{ color: 'var(--text-secondary)' }}>{template.description}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={handleSaveTemplate}
              style={{
                padding: '0.75rem 1rem',
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <Save size={16} />
              Save
            </button>
            <button
              onClick={onUse}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'var(--primary)',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <Play size={16} />
              Use Template
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <span>Version {template.version}</span>
          <span>•</span>
          <span>{template.usageCount} uses</span>
          <span>•</span>
          <span>⭐ {template.averageRating.toFixed(1)}</span>
          <span>•</span>
          <span>By {template.author}</span>
        </div>
      </div>

      {/* Parameters */}
      <div style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '0.5rem', border: '1px solid var(--border)', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Parameters</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {template.parameters.map((param) => (
            <div key={param.name}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                {param.name}
                {param.required && <span style={{ color: 'var(--danger)' }}> *</span>}
              </label>
              <input
                type={param.type === 'number' ? 'number' : 'text'}
                value={parameters[param.name] || ''}
                onChange={(e) => setParameters({ ...parameters, [param.name]: e.target.value })}
                placeholder={param.description}
                required={param.required}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid var(--border)',
                  borderRadius: '0.375rem',
                  background: 'var(--surface-1)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                }}
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.25rem', margin: 0 }}>
                {param.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Operations */}
      <div style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '0.5rem', border: '1px solid var(--border)', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Operations</h2>
        {template.operations.map((op, idx) => (
          <div key={idx} style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span
                style={{
                  padding: '0.25rem 0.75rem',
                  background: 'var(--primary)',
                  color: 'white',
                  borderRadius: '0.25rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                }}
              >
                {op.type}
              </span>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{op.description}</span>
            </div>
            <pre
              style={{
                background: 'var(--surface-1)',
                padding: '1rem',
                borderRadius: '0.375rem',
                overflow: 'auto',
                fontSize: '0.85rem',
              }}
            >
              <code>{JSON.stringify(op.fields, null, 2)}</code>
            </pre>
          </div>
        ))}
      </div>

      {/* Rating */}
      <div style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Rate this Template</h2>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '2rem',
              }}
            >
              <Star size={32} fill={star <= rating ? 'gold' : 'none'} color={star <= rating ? 'gold' : 'var(--text-tertiary)'} />
            </button>
          ))}
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Leave a comment (optional)"
          style={{
            width: '100%',
            minHeight: '80px',
            padding: '0.75rem',
            border: '1px solid var(--border)',
            borderRadius: '0.375rem',
            background: 'var(--surface-1)',
            color: 'var(--text-primary)',
            fontSize: '0.9rem',
            marginBottom: '1rem',
          }}
        />
        <button
          onClick={handleSubmitRating}
          disabled={rating === 0}
          style={{
            padding: '0.75rem 1.5rem',
            background: rating === 0 ? 'var(--surface-2)' : 'var(--primary)',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: rating === 0 ? 'not-allowed' : 'pointer',
            fontSize: '0.9rem',
          }}
        >
          Submit Rating
        </button>
      </div>
    </div>
  );
};
