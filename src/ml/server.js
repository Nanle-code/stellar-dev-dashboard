const express = require('express');
const bodyParser = require('body-parser');
const { scoreTransaction, loadModels } = require('./scoringEngine');

const app = express();
app.use(bodyParser.json());

app.post('/score', async (req, res) => {
  try {
    const tx = req.body;
    const result = await scoreTransaction(tx);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// simple feedback endpoint: accept {tx, label}
app.post('/feedback', (req, res) => {
  try {
    const { tx, label } = req.body;
    // store feedback for later retraining
    const fbDir = require('path').resolve(__dirname, 'data');
    require('fs').mkdirSync(fbDir, { recursive: true });
    const fbPath = require('path').join(fbDir, 'feedback.json');
    const arr = require('fs').existsSync(fbPath) ? JSON.parse(require('fs').readFileSync(fbPath)) : [];
    arr.push({ tx, label, timestamp: Date.now() });
    require('fs').writeFileSync(fbPath, JSON.stringify(arr, null, 2));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT || 4001;
app.listen(port, () => {
  console.log('ML scoring server running on port', port);
});
