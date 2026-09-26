export function highlightMatch(text: any, query: any): string { if (!query) return String(text); return String(text).replace(new RegExp(query, 'ig'), (m) => m); }
