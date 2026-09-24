import React, { useState, useEffect } from 'react';
import useMemoAnalysis from '../../hooks/useMemoAnalysis';
import './MemoAnalyzer.css';

export const MemoAnalyzer: React.FC = () => {
  const { analyzeMemo, suggestTemplates, searchMemos, getAnalytics, recordMemoUsage } = useMemoAnalysis();

  const [memo, setMemo] = useState('');
  const [analysis, setAnalysis] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'analyzer' | 'search' | 'analytics'>('analyzer');

  useEffect(() => {
    if (memo.trim()) {
      const result = analyzeMemo(memo);
      if (result) {
        setAnalysis(result);
        const templates = suggestTemplates(result.category.category);
        setSuggestions(templates);
      }
    }
  }, [memo, analyzeMemo, suggestTemplates]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const results = searchMemos(searchQuery);
      setSearchResults(results);
    }
  }, [searchQuery, searchMemos]);

  useEffect(() => {
    const analyticsData = getAnalytics();
    setAnalytics(analyticsData);
  }, [getAnalytics]);

  const handleApplySuggestion = (templateId: string) => {
    recordMemoUsage(memo, templateId);
  };

  return (
    <div className="memo-analyzer">
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'analyzer' ? 'active' : ''}`}
          onClick={() => setActiveTab('analyzer')}
        >
          Analyzer
        </button>
        <button
          className={`tab ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          Search
        </button>
        <button
          className={`tab ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          Analytics
        </button>
      </div>

      {activeTab === 'analyzer' && (
        <div className="analyzer-panel">
          <h2>Memo Analysis</h2>

          <div className="input-section">
            <label>Enter Memo</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Enter transaction memo..."
              rows={3}
            />
          </div>

          {analysis && (
            <>
              <div className="analysis-result">
                <div className="category-badge">
                  <span className="label">Category:</span>
                  <span className={`category ${analysis.category.category}`}>
                    {analysis.category.category}
                  </span>
                  <span className="confidence">({(analysis.category.confidence * 100).toFixed(1)}%)</span>
                </div>

                <p className="description">{analysis.category.description}</p>

                {analysis.entities.length > 0 && (
                  <div className="entities">
                    <h4>Extracted Entities:</h4>
                    <div className="entity-list">
                      {analysis.entities.map((entity: any, idx: number) => (
                        <div key={idx} className={`entity ${entity.type}`}>
                          <span className="type">{entity.type}</span>
                          <span className="value">{entity.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="summary">{analysis.summary}</div>
              </div>

              {suggestions.length > 0 && (
                <div className="suggestions">
                  <h3>Suggested Templates</h3>
                  <div className="template-list">
                    {suggestions.map((suggestion) => (
                      <div key={suggestion.template.id} className="template-card">
                        <div className="template-header">
                          <h4>{suggestion.template.name}</h4>
                          <span className="relevance">{(suggestion.relevanceScore * 100).toFixed(0)}%</span>
                        </div>
                        <p className="template-text">{suggestion.template.template}</p>
                        <p className="reasoning">{suggestion.reasoning}</p>
                        <button
                          className="apply-btn"
                          onClick={() => handleApplySuggestion(suggestion.template.id)}
                        >
                          Use Template
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'search' && (
        <div className="search-panel">
          <h2>Search Memos</h2>

          <div className="search-input-section">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search memo by meaning..."
            />
          </div>

          {searchResults.length > 0 && (
            <div className="search-results">
              <h3>Results ({searchResults.length})</h3>
              <div className="results-list">
                {searchResults.map((result) => (
                  <div key={result.memoId} className="result-item">
                    <div className="result-header">
                      <span className={`category ${result.category}`}>{result.category}</span>
                      <span className="relevance">{(result.relevanceScore * 100).toFixed(0)}%</span>
                    </div>
                    <p className="memo-text">{result.memo}</p>
                    {result.entities.length > 0 && (
                      <div className="entities-small">
                        {result.entities.slice(0, 3).map((e: string, idx: number) => (
                          <span key={idx} className="entity-tag">
                            {e}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'analytics' && analytics && (
        <div className="analytics-panel">
          <h2>Memo Analytics</h2>

          <div className="analytics-grid">
            <div className="metric">
              <span className="label">Total Memos</span>
              <span className="value">{analytics.totalMemos}</span>
            </div>

            <div className="metric">
              <span className="label">Average Length</span>
              <span className="value">{analytics.averageMemoLength.toFixed(0)}</span>
            </div>

            <div className="metric">
              <span className="label">Unique Entities</span>
              <span className="value">{analytics.uniqueEntities}</span>
            </div>

            <div className="metric">
              <span className="label">Searchability</span>
              <span className="value">{(analytics.searchableScore * 100).toFixed(1)}%</span>
            </div>
          </div>

          {analytics.mostCommonCategories.length > 0 && (
            <div className="categories-chart">
              <h3>Top Categories</h3>
              <div className="category-bars">
                {analytics.mostCommonCategories.map((cat: any) => (
                  <div key={cat.category} className="bar-item">
                    <span className="category-name">{cat.category}</span>
                    <div className="bar">
                      <div
                        className="bar-fill"
                        style={{
                          width: `${(cat.count / analytics.totalMemos) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="count">{cat.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analytics.mostCommonKeywords.length > 0 && (
            <div className="keywords-cloud">
              <h3>Popular Keywords</h3>
              <div className="keywords">
                {analytics.mostCommonKeywords.map((kw: any) => (
                  <span key={kw.keyword} className="keyword" style={{ fontSize: `${0.8 + (kw.count / 10) * 0.3}rem` }}>
                    {kw.keyword}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MemoAnalyzer;
