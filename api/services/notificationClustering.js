// Simple clustering based on content similarity and temporal proximity
function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function termFreq(tokens) {
  const tf = {};
  for (const t of tokens) tf[t] = (tf[t] || 0) + 1;
  return tf;
}

function dot(a, b) {
  let s = 0;
  for (const k in a) if (b[k]) s += a[k] * b[k];
  return s;
}

function magnitude(a) {
  let s = 0; for (const k in a) s += a[k] * a[k]; return Math.sqrt(s);
}

function cosine(a, b) {
  const denom = magnitude(a) * magnitude(b);
  if (!denom) return 0; return dot(a, b) / denom;
}

function vectorize(text) {
  const tokens = tokenize(text);
  return termFreq(tokens);
}

export function clusterNotifications(notifications = [], { similarityThreshold = 0.35, timeWindowMs = 1000 * 60 * 60 } = {}) {
  // notifications: [{id, timestamp, title, body, source}]
  const clusters = [];

  // Precompute vectors
  const items = notifications.map(n => ({
    ...n,
    ts: n.timestamp ? new Date(n.timestamp).getTime() : Date.now(),
    text: [n.title, n.body].filter(Boolean).join(' '),
    vec: vectorize([n.title, n.body].filter(Boolean).join(' '))
  }));

  for (const item of items) {
    let placed = false;
    for (const c of clusters) {
      // check temporal proximity
      const dt = Math.abs(item.ts - c.windowCenter);
      if (dt > timeWindowMs) continue;
      // compute average similarity with cluster members (approx by comparing to centroid)
      const sim = cosine(item.vec, c.centroid);
      if (sim >= similarityThreshold) {
        c.items.push(item);
        // update centroid (simple average of term frequencies)
        for (const k in item.vec) c.centroid[k] = (c.centroid[k] || 0) + item.vec[k];
        c.windowStart = Math.min(c.windowStart, item.ts);
        c.windowEnd = Math.max(c.windowEnd, item.ts);
        c.windowCenter = Math.floor((c.windowStart + c.windowEnd) / 2);
        placed = true;
        break;
      }
    }
    if (!placed) {
      clusters.push({
        id: `c_${clusters.length + 1}`,
        items: [item],
        centroid: { ...item.vec },
        windowStart: item.ts,
        windowEnd: item.ts,
        windowCenter: item.ts
      });
    }
  }

  // map to public shape
  return clusters.map(c => ({
    id: c.id,
    notifications: c.items.map(i => ({ id: i.id, timestamp: new Date(i.ts).toISOString(), title: i.title, body: i.body, source: i.source })),
    windowStart: new Date(c.windowStart).toISOString(),
    windowEnd: new Date(c.windowEnd).toISOString(),
    size: c.items.length
  }));
}

export default { clusterNotifications };
