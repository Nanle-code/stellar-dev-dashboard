import { predictBuildFailure, loadModels } from './buildPredictor.js';
import { scoreCommit } from './riskScorer.js';
import { validateCommit } from './preBuildValidator.js';
import { generateRecommendations } from './recommendationEngine.js';
import { extractAllFeatures } from './feature_extraction.js';

export async function analyzeBuildRisk(commitData) {
  const riskAssessment = await scoreCommit(commitData);
  const validation = await validateCommit(commitData);
  const { change, deps, history } = commitData;
  const recommendations = generateRecommendations(change, deps, history);

  let prediction = null;
  try {
    prediction = await predictBuildFailure(change, deps, history);
  } catch {
    // ML model not available
  }

  return {
    commitId: commitData.commitId,
    timestamp: new Date().toISOString(),
    riskScore: riskAssessment.riskScore,
    riskLevel: riskAssessment.riskLevel,
    prediction: prediction
      ? {
          buildFailurePredicted: prediction.isFailurePredicted,
          confidence: prediction.score,
        }
      : null,
    validation,
    recommendations,
    features: extractAllFeatures(change, deps, history),
  };
}

export { predictBuildFailure, scoreCommit, validateCommit, generateRecommendations, loadModels };
