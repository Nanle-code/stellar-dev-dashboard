import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAITips, dismissTip, recordTipFeedback,
  updateTipFrequency, getTipFrequency, resetTipFrequency,
  generateTipRecommendation, type TipContext,
} from '../../lib/aiTipEngine';
import { createDefaultModel, updateProfile } from '../../lib/learnerModel';

const mockContext: TipContext = {
  activeTab: 'overview', network: 'testnet',
  connectedAddress: 'GABC123', userActions: [],
  currentRoute: '/', timeOnPage: 0,
};

beforeEach(() => {
  resetTipFrequency();
  localStorage.removeItem('ai_tip_dismissed');
  localStorage.removeItem('ai_tip_feedback');
});

describe('AITipEngine', () => {
  it('returns tips for a valid context', () => {
    const tips = getAITips(mockContext, null, getTipFrequency());
    expect(tips.length).toBeGreaterThan(0);
  });

  it('returns empty array when tips disabled', () => {
    const freq = updateTipFrequency({ enabled: false });
    expect(getAITips(mockContext, null, freq).length).toBe(0);
  });

  it('dismisses tips correctly', () => {
    const tips = getAITips(mockContext, null, getTipFrequency());
    expect(tips.length).toBeGreaterThan(0);
    dismissTip(tips[0].id);
    const newTips = getAITips(mockContext, null, getTipFrequency());
    expect(newTips.find((t) => t.id === tips[0].id)).toBeUndefined();
  });

  it('ranks tips by relevance descending', () => {
    const tips = getAITips(mockContext, null, getTipFrequency());
    for (let i = 1; i < tips.length; i++) {
      expect(tips[i - 1].relevance).toBeGreaterThanOrEqual(tips[i].relevance);
    }
  });

  it('limits to 5 tips max', () => {
    expect(getAITips(mockContext, null, getTipFrequency()).length).toBeLessThanOrEqual(5);
  });

  it('records tip feedback', () => {
    const tips = getAITips(mockContext, null, getTipFrequency());
    if (tips.length > 0) {
      recordTipFeedback(tips[0].id, true);
      const fb = JSON.parse(localStorage.getItem('ai_tip_feedback') || '{}');
      expect(fb[tips[0].id]).toBe(1);
    }
  });

  it('generates recommendation with score', () => {
    const rec = generateTipRecommendation(mockContext, null);
    expect(rec.tips.length).toBeGreaterThan(0);
    expect(rec.relevanceScore).toBeGreaterThan(0);
  });

  it('updates frequency settings', () => {
    const freq = updateTipFrequency({ frequency: 'low' });
    expect(freq.frequency).toBe('low');
    expect(freq.minInterval).toBe(300000);
  });

  it('resets frequency to defaults', () => {
    updateTipFrequency({ frequency: 'high', enabled: false });
    const r = resetTipFrequency();
    expect(r.frequency).toBe('medium');
    expect(r.enabled).toBe(true);
  });
});
