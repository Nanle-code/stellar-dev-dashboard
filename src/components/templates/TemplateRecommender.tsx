import React, { useEffect, useMemo, useState } from 'react'
import {
  recommendTemplates,
  requirementSignature,
} from '../../lib/templateRecommendation'
import { templateFeedbackStore } from '../../lib/templateFeedbackStore'
import TemplateCustomizer from './TemplateCustomizer'

/**
 * TemplateRecommender — Issue #563
 *
 * Lets a user describe what they want to build, shows ranked contract-template
 * suggestions with the reasons each was picked, and hands the chosen template
 * off to the existing TemplateCustomizer. Choosing a template records feedback
 * so future suggestions for similar needs improve.
 */
export default function TemplateRecommender() {
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [results, setResults] = useState([])
  const [chosen, setChosen] = useState(null)
  const [searched, setSearched] = useState(false)

  // Warm the feedback store once so getBoost has data to read.
  useEffect(() => {
    templateFeedbackStore.initialize().catch(() => {
      // Non-fatal: recommender still works without persisted feedback.
    })
  }, [])

  const requirement = useMemo(() => {
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    return {
      description: description.trim() || undefined,
      category: category || undefined,
      tags: tags.length ? tags : undefined,
    }
  }, [description, category, tagsInput])

  const handleRecommend = () => {
    const ranked = recommendTemplates(requirement, {
      boost: templateFeedbackStore.getBoost,
      limit: 5,
    })
    setResults(ranked)
    setSearched(true)
    setChosen(null)
  }

  const handleChoose = (template) => {
    const signature = requirementSignature(requirement)
    templateFeedbackStore.recordChoice(signature, template.id).catch(() => {
      // Non-fatal: choosing still proceeds even if persistence fails.
    })
    setChosen(template)
  }

  if (chosen) {
    return (
      <div className="template-recommender">
        <button type="button" onClick={() => setChosen(null)}>
          ← Back to suggestions
        </button>
        <TemplateCustomizer template={chosen} />
      </div>
    )
  }

  return (
    <div className="template-recommender">
      <h3>Find the right contract template</h3>
      <p>Describe what you want to build and we&apos;ll suggest a starting point.</p>

      <label htmlFor="recommender-description">What are you building?</label>
      <textarea
        id="recommender-description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="e.g. hold buyer funds until delivery, with an arbiter for disputes"
        rows={3}
      />

      <div className="recommender-filters">
        <label htmlFor="recommender-category">Category (optional)</label>
        <select
          id="recommender-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Any</option>
          <option value="token">Token</option>
          <option value="escrow">Escrow</option>
          <option value="governance">Governance</option>
          <option value="nft">NFT</option>
          <option value="utility">Utility</option>
        </select>

        <label htmlFor="recommender-tags">Tags (optional, comma-separated)</label>
        <input
          id="recommender-tags"
          type="text"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="e.g. staking, rewards"
        />
      </div>

      <button type="button" onClick={handleRecommend}>
        Suggest templates
      </button>

      {searched && results.length === 0 && (
        <p className="recommender-empty">
          No matching templates yet. Try describing your goal differently or add tags.
        </p>
      )}

      {results.length > 0 && (
        <ul className="recommender-results">
          {results.map((r) => (
            <li key={r.template.id} className="recommender-result">
              <div className="recommender-result-header">
                <strong>{r.template.name}</strong>
                {r.template.status === 'wip' && (
                  <span className="recommender-wip-badge"> (work in progress)</span>
                )}
              </div>
              <p>{r.template.description}</p>
              {r.reasons.length > 0 && (
                <ul className="recommender-reasons">
                  {r.reasons.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={() => handleChoose(r.template)}
                disabled={r.template.status === 'wip'}
              >
                {r.template.status === 'wip' ? 'Coming soon' : 'Use this template'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}