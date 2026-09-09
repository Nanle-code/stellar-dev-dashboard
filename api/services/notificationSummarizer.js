const STOPWORDS = new Set(['the','a','an','and','or','to','of','in','on','for','with','is','are','by','from','that','this','it','as','at','be']);

function tokenize(text=''){
  return text.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(Boolean);
}

function topKeywords(texts=[], limit=5){
  const freq = {};
  for (const t of texts) for (const w of tokenize(t)) if (!STOPWORDS.has(w)) freq[w] = (freq[w]||0)+1;
  return Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,limit).map(x=>x[0]);
}

export function summarizeCluster(cluster){
  // cluster: { id, notifications: [{title, body, source}], windowStart, windowEnd }
  const texts = (cluster.notifications || []).map(n => `${n.title || ''} ${n.body || ''}`);
  const keywords = topKeywords(texts, 6);
  const sources = [...new Set((cluster.notifications||[]).map(n=>n.source).filter(Boolean))].slice(0,3);
  const example = cluster.notifications && cluster.notifications.length ? `${cluster.notifications[0].title || ''} — ${cluster.notifications[0].body || ''}` : '';
  const summary = `${cluster.size || cluster.notifications.length} notifications about ${keywords.slice(0,3).join(', ')}` + (sources.length ? ` from ${sources.join(', ')}` : '') + (example ? `. Example: ${example}` : '');
  return { summary, keywords, sources };
}

export default { summarizeCluster };
