import express from 'express';
export const router = express.Router();

router.get('/', (req, res) => {
  const { accountId, limit = 10 } = req.query;
  
  if (!accountId) {
    return res.status(400).json({ error: 'accountId query parameter is required' });
  }

  // Mock transactions for the dashboard
  const transactions = [];
  const parsedLimit = parseInt(limit, 10);
  
  for (let i = 0; i < parsedLimit; i++) {
    transactions.push({
      id: `tx_${Date.now()}_${i}`,
      source_account: accountId,
      created_at: new Date(Date.now() - i * 3600000).toISOString(),
      fee_charged: '100',
      successful: true,
      operation_count: 1
    });
  }
  
  res.json({
    data: transactions,
    limit: parsedLimit
  });
});
