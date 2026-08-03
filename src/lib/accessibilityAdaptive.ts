export type AccessibilityPreferenceSettings = {
  reducedMotion: boolean;
  highContrast: boolean;
  fontSize: 'small' | 'default' | 'large';
  dyslexiaFont: boolean;
  adaptiveMode: boolean;
};

export type AccessibilityInteractionSignal = {
  type: 'keyboard' | 'long-session' | 'error' | 'focus';
  value: number;
};

export type AccessibilityFeedback = {
  type: 'explicit' | 'implicit';
  preference: Partial<AccessibilityPreferenceSettings>;
  strength: number;
};

export type AccessibilityRecommendation = {
  key: 'reducedMotion' | 'highContrast' | 'fontSize' | 'dyslexiaFont' | 'adaptiveMode';
  value: boolean | 'small' | 'default' | 'large';
  reason: string;
  confidence: number;
};

export type AccessibilityPreferenceProfile = {
  settings: AccessibilityPreferenceSettings;
  recommendations: AccessibilityRecommendation[];
  feedbackHistory: AccessibilityFeedback[];
  confidence: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function createDefaultAccessibilityProfile(
  settings: AccessibilityPreferenceSettings
): AccessibilityPreferenceProfile {
  return {
    settings,
    recommendations: [],
    feedbackHistory: [],
    confidence: 0.5,
  };
}

export function learnAccessibilityPreferences(
  previousProfile: AccessibilityPreferenceProfile,
  interactions: AccessibilityInteractionSignal[],
  feedbacks: AccessibilityFeedback[]
): AccessibilityPreferenceProfile {
  const nextSettings = {
    ...previousProfile.settings,
  };

  let confidence = Math.max(previousProfile.confidence, 0.55);

  for (const feedback of feedbacks) {
    if (feedback.preference.reducedMotion !== undefined) {
      nextSettings.reducedMotion = Boolean(feedback.preference.reducedMotion);
    }
    if (feedback.preference.highContrast !== undefined) {
      nextSettings.highContrast = Boolean(feedback.preference.highContrast);
    }
    if (feedback.preference.fontSize) {
      nextSettings.fontSize = feedback.preference.fontSize;
    }
    if (feedback.preference.dyslexiaFont !== undefined) {
      nextSettings.dyslexiaFont = Boolean(feedback.preference.dyslexiaFont);
    }
    if (feedback.preference.adaptiveMode !== undefined) {
      nextSettings.adaptiveMode = Boolean(feedback.preference.adaptiveMode);
    }

    confidence = clamp(confidence + feedback.strength * 0.18, 0.4, 1);
  }

  const keyboardIntensity = interactions.find((signal) => signal.type === 'keyboard')?.value ?? 0;
  const longSessionIntensity = interactions.find((signal) => signal.type === 'long-session')?.value ?? 0;
  const errorIntensity = interactions.find((signal) => signal.type === 'error')?.value ?? 0;

  if (keyboardIntensity > 0.6) {
    nextSettings.highContrast = true;
    nextSettings.dyslexiaFont = true;
    nextSettings.fontSize = 'large';
    confidence = clamp(confidence + 0.1, 0.4, 1);
  }

  if (longSessionIntensity > 0.6) {
    nextSettings.reducedMotion = true;
    nextSettings.fontSize = 'large';
    nextSettings.highContrast = true;
    confidence = clamp(confidence + 0.09, 0.4, 1);
  }

  if (errorIntensity > 0.6) {
    nextSettings.highContrast = true;
    nextSettings.dyslexiaFont = true;
    nextSettings.fontSize = 'large';
    confidence = clamp(confidence + 0.12, 0.4, 1);
  }

  if (keyboardIntensity > 0.8 || errorIntensity > 0.7) {
    nextSettings.adaptiveMode = true;
  }

  const recommendations: AccessibilityRecommendation[] = [];

  for (const feedback of feedbacks) {
    if (feedback.preference.reducedMotion !== undefined) {
      recommendations.push({
        key: 'reducedMotion',
        value: Boolean(feedback.preference.reducedMotion),
        reason: 'Your explicit preference indicates this motion setting should be applied.',
        confidence: clamp(0.8 + feedback.strength * 0.12, 0.6, 0.95),
      });
    }
    if (feedback.preference.highContrast !== undefined) {
      recommendations.push({
        key: 'highContrast',
        value: Boolean(feedback.preference.highContrast),
        reason: 'Your explicit preference indicates stronger contrast should be applied.',
        confidence: clamp(0.8 + feedback.strength * 0.12, 0.6, 0.95),
      });
    }
    if (feedback.preference.fontSize) {
      recommendations.push({
        key: 'fontSize',
        value: feedback.preference.fontSize,
        reason: 'Your explicit preference indicates this text scale should be used.',
        confidence: clamp(0.78 + feedback.strength * 0.12, 0.6, 0.95),
      });
    }
    if (feedback.preference.dyslexiaFont !== undefined) {
      recommendations.push({
        key: 'dyslexiaFont',
        value: Boolean(feedback.preference.dyslexiaFont),
        reason: 'Your explicit preference indicates a dyslexia-friendly font should be applied.',
        confidence: clamp(0.78 + feedback.strength * 0.12, 0.6, 0.95),
      });
    }
    if (feedback.preference.adaptiveMode !== undefined) {
      recommendations.push({
        key: 'adaptiveMode',
        value: Boolean(feedback.preference.adaptiveMode),
        reason: 'Adaptive mode should stay enabled so the interface can continue improving for you.',
        confidence: clamp(0.76 + feedback.strength * 0.1, 0.6, 0.95),
      });
    }
  }

  if (!nextSettings.reducedMotion && longSessionIntensity > 0.6) {
    recommendations.push({
      key: 'reducedMotion',
      value: true,
      reason: 'Long sessions often benefit from calmer motion and fewer distractions.',
      confidence: clamp(0.72 + longSessionIntensity * 0.2, 0.6, 0.95),
    });
  }

  if (!nextSettings.highContrast && (keyboardIntensity > 0.6 || errorIntensity > 0.6)) {
    recommendations.push({
      key: 'highContrast',
      value: true,
      reason: 'High contrast helps keep focus and readability strong during intensive navigation.',
      confidence: clamp(0.7 + keyboardIntensity * 0.15 + errorIntensity * 0.12, 0.6, 0.95),
    });
  }

  if (nextSettings.fontSize !== 'large' && (keyboardIntensity > 0.6 || longSessionIntensity > 0.6 || errorIntensity > 0.6)) {
    recommendations.push({
      key: 'fontSize',
      value: 'large',
      reason: 'A larger text scale usually improves legibility for extended use.',
      confidence: clamp(0.68 + longSessionIntensity * 0.16 + keyboardIntensity * 0.12, 0.6, 0.95),
    });
  }

  if (!nextSettings.dyslexiaFont && (keyboardIntensity > 0.6 || errorIntensity > 0.6)) {
    recommendations.push({
      key: 'dyslexiaFont',
      value: true,
      reason: 'A dyslexia-friendly font can reduce reading strain during repetitive tasks.',
      confidence: clamp(0.7 + errorIntensity * 0.15, 0.6, 0.95),
    });
  }

  if (!nextSettings.adaptiveMode) {
    recommendations.push({
      key: 'adaptiveMode',
      value: true,
      reason: 'Adaptive mode can keep applying comfort-focused changes as your behavior changes.',
      confidence: 0.68,
    });
  }

  return {
    settings: nextSettings,
    recommendations,
    feedbackHistory: [...previousProfile.feedbackHistory, ...feedbacks].slice(-8),
    confidence: clamp(confidence, 0.4, 1),
  };
}
