export function highlightMatch(text, query){if(!query)return text; return String(text).replace(new RegExp(query,'ig'),(m)=>[])}
