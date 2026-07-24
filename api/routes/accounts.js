import express from 'express';
export const router = express.Router();

router.get('/:accountId', (req, res) => {
  const { accountId } = req.params;
  
  // Mock data for the dashboard account endpoint
  res.json({
    id: accountId,
    balance: '1000 XLM',
    status: 'active',
    sequence_number: '123456789',
    subentry_count: 2,
    last_modified_ledger: 1000000
  });
});
