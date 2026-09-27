const feedbackRecords = [];

export async function saveFeedback(feedback) {
  const record = {
    id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    createdAt: new Date().toISOString(),
    ...feedback,
  };
  feedbackRecords.push(record);
  return record;
}

export async function getFeedback() {
  return [...feedbackRecords];
}

export function _resetFeedbackStore() {
  feedbackRecords.length = 0;
}
