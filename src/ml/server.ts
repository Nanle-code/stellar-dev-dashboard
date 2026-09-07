import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { analyzeContractUpgrade } from './contract_upgrade_analysis/contractUpgradeAnalysis.js'
import { scoreTransaction } from './scoringEngine.js'
import { FederatedLearningIntegration } from './federated/integration.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
app.use(express.json())

// Initialize federated learning integration
const federatedIntegration = new FederatedLearningIntegration({
  enableFederatedLearning: process.env.ENABLE_FEDERATED === 'true',
  federatedServerUrl: process.env.FEDERATED_SERVER_URL || 'http://localhost:4002',
  privacy: {
    epsilon: parseFloat(process.env.PRIVACY_EPSILON) || 1.0,
    delta: parseFloat(process.env.PRIVACY_DELTA) || 1e-5
  }
});

// Initialize on startup
federatedIntegration.initialize().catch(console.error);

app.post('/score', async (req, res) => {
  try {
    const tx = req.body;
    const result = await scoreTransaction(tx);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Federated learning scoring endpoint
app.post('/score-federated', async (req, res) => {
  try {
    const tx = req.body;
    const result = await federatedIntegration.scoreTransactionWithFederated(tx);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// simple feedback endpoint: accept {tx, label}
app.post('/feedback', (req, res) => {
  try {
    const { tx, label } = req.body
    const fbDir = path.resolve(__dirname, 'data')
    fs.mkdirSync(fbDir, { recursive: true })
    const fbPath = path.join(fbDir, 'feedback.json')
    const arr = fs.existsSync(fbPath) ? JSON.parse(fs.readFileSync(fbPath)) : []
    arr.push({ tx, label, timestamp: Date.now() })
    fs.writeFileSync(fbPath, JSON.stringify(arr, null, 2))
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/analyze-upgrade', async (req, res) => {
  try {
    const analysis = analyzeContractUpgrade(req.body)
    res.json(analysis)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Liquidity Prediction API Endpoints (stubs — implementations pending)
app.get('/api/liquidity/predict', (req, res) => res.json({ status: 'not implemented' }));
app.post('/feedback-federated', (req, res) => res.json({ status: 'not implemented' }));
app.post('/api/liquidity/slippage', (req, res) => res.json({ status: 'not implemented' }));
app.post('/federated-train', (req, res) => res.json({ status: 'not implemented' }));
app.get('/api/liquidity/metrics', (req, res) => res.json({ status: 'not implemented' }));
app.get('/federated-status', (req, res) => res.json({ status: 'not implemented' }));
app.post('/api/liquidity/train', (req, res) => res.json({ status: 'not implemented' }));
app.post('/federated-sync', (req, res) => res.json({ status: 'not implemented' }));

const port = process.env.PORT || 4001
app.listen(port, () => {
  console.info('ML scoring server running on port', port)
})
