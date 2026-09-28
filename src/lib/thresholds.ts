// src/lib/thresholds.js

// Threshold values for risk scoring. Adjust as needed for your security policy.
export const THRESHOLDS = {
  // Score >= CRITICAL is considered critical risk.
  CRITICAL: 50,
  // Score >= HIGH but < CRITICAL is high risk.
  HIGH: 30,
  // Score >= MEDIUM but < HIGH is medium risk.
  MEDIUM: 15,
  // Scores below MEDIUM are low risk.
  LOW: 0,
};
