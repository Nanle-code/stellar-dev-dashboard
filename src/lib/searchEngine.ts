export class SearchEngine {
  searchTransactions(transactions, query) { const q = query.toLowerCase(); return transactions.filter((t) => JSON.stringify(t).toLowerCase().includes(q)); }
  filterByType(operations, types) { return operations.filter((op) => types.includes(op.type)); }
  filterByDateRange(items, startDate, endDate) { return items.filter((i) => { const d = new Date(i.created_at || i.date || Date.now()); return d >= startDate && d <= endDate; }); }
}
