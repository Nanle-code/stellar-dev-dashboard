// src/ml/train_phishing.cjs
const fs = require('fs');
const path = require('path');
const tf = require('@tensorflow/tfjs-node');

// Phishing keywords/patterns for matching in memo
const SUSPICIOUS_MEMOS = [
  /verify.*account/i,
  /claim.*reward/i,
  /urgent.*action/i,
  /suspended.*account/i,
  /security.*alert/i,
  /confirm.*identity/i,
  /wallet.*upgrade/i,
  /airdrop/i,
  /free.*tokens/i
];

// Typosquatting / homoglyph domains
const SUSPICIOUS_DOMAINS = [
  /stellàr\.org/i,
  /stellar-reward\.org/i,
  /coinbase-verify\.com/i,
  /stellar-airdrop\.com/i,
  /stelllar\.org/i,
  /stella-upgrade\.org/i
];

function memoHasPhishing(memo) {
  if (!memo) return 0;
  return SUSPICIOUS_MEMOS.some(regex => regex.test(memo)) ? 1 : 0;
}

function hasDomainImpersonation(domain) {
  if (!domain) return 0;
  return SUSPICIOUS_DOMAINS.some(regex => regex.test(domain)) ? 1 : 0;
}

function hasAssetImpersonation(assetCode, assetIssuer, isNative) {
  if (isNative) return 0;
  const isImpersonation = ['XXLM', 'USDCC', 'USDTD', 'USDT-FREE', 'XLM-REWARD'].includes(assetCode);
  return isImpersonation ? 1 : 0;
}

// Generate synthetic transaction dataset
function generateDataset(size = 1500) {
  const dataset = [];
  
  for (let i = 0; i < size; i++) {
    const isPhishing = Math.random() < 0.3; // 30% phishing, 70% legit
    
    if (isPhishing) {
      // 1. Phishing Transaction
      const amount = 5000 + Math.random() * 95000; // Phishing transactions usually request larger amounts
      const recipientIsNew = Math.random() < 0.85 ? 1 : 0; // Usually new/unestablished accounts
      const memo = Math.random() < 0.7 
        ? "Claim your Stellar airdrop reward now"
        : (Math.random() < 0.5 ? "Verify your account urgently" : "Security Alert - upgrade wallet");
      const assetCode = Math.random() < 0.4 ? "USDCC" : "XLM";
      const domain = Math.random() < 0.6 ? "stellar-reward.org" : "legit-looking-domain.com";
      const reputation = Math.max(0, 0.1 + Math.random() * 0.3 - (recipientIsNew * 0.1)); // Very low reputation
      
      const features = [
        Math.log1p(amount) / 10,
        recipientIsNew,
        memoHasPhishing(memo),
        hasAssetImpersonation(assetCode, "G_FAKE_ISSUER", false),
        hasDomainImpersonation(domain),
        reputation
      ];
      
      dataset.push({ features, label: 1 });
    } else {
      // 2. Legitimate Transaction
      const amount = 1 + Math.random() * 2000; // Normal amounts
      const recipientIsNew = Math.random() < 0.15 ? 1 : 0; // Mostly established accounts
      const memo = Math.random() < 0.5 ? "Invoice #1042" : (Math.random() < 0.5 ? "Transfer to friend" : "");
      const assetCode = "XLM";
      const domain = "stellar.org";
      const reputation = Math.min(1.0, 0.7 + Math.random() * 0.3 + (recipientIsNew ? -0.1 : 0.1)); // High reputation
      
      const features = [
        Math.log1p(amount) / 10,
        recipientIsNew,
        memoHasPhishing(memo),
        hasAssetImpersonation(assetCode, "G_LEGIT_ISSUER", true),
        hasDomainImpersonation(domain),
        reputation
      ];
      
      dataset.push({ features, label: 0 });
    }
  }
  
  return dataset;
}

async function trainAndSave() {
  console.log("Generating dataset...");
  const data = generateDataset(2000);
  
  // Shuffle data
  tf.util.shuffle(data);
  
  const X_arr = data.map(d => d.features);
  const y_arr = data.map(d => d.label);
  
  // Split into train (80%) and validation (20%)
  const splitIndex = Math.floor(X_arr.length * 0.8);
  const X_train = X_arr.slice(0, splitIndex);
  const y_train = y_arr.slice(0, splitIndex);
  const X_val = X_arr.slice(splitIndex);
  const y_val = y_arr.slice(splitIndex);
  
  const xs = tf.tensor2d(X_train);
  const ys = tf.tensor2d(y_train, [y_train.length, 1]);
  const val_xs = tf.tensor2d(X_val);
  const val_ys = tf.tensor2d(y_val, [y_val.length, 1]);
  
  // Build Sequential model
  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 16, activation: 'relu', inputShape: [6] }));
  model.add(tf.layers.dropout({ rate: 0.1 }));
  model.add(tf.layers.dense({ units: 8, activation: 'relu' }));
  model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));
  
  model.compile({
    optimizer: tf.train.adam(0.01),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy']
  });
  
  console.log("Training model...");
  await model.fit(xs, ys, {
    epochs: 25,
    batchSize: 32,
    validationData: [val_xs, val_ys],
    verbose: 0
  });
  
  console.log("Evaluating model on validation set...");
  const predictions = model.predict(val_xs).dataSync();
  
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (let i = 0; i < y_val.length; i++) {
    const actual = y_val[i];
    const predicted = predictions[i] > 0.5 ? 1 : 0;
    
    if (actual === 1 && predicted === 1) tp++;
    if (actual === 0 && predicted === 1) fp++;
    if (actual === 0 && predicted === 0) tn++;
    if (actual === 1 && predicted === 0) fn++;
  }
  
  const precision = tp / (tp + fp || 1);
  const recall = tp / (tp + fn || 1);
  const f1 = 2 * (precision * recall) / (precision + recall || 1);
  const fpr = fp / (fp + tn || 1);
  const accuracy = (tp + tn) / y_val.length;
  
  console.log(`Validation Results:`);
  console.log(`- Accuracy: ${(accuracy * 100).toFixed(2)}%`);
  console.log(`- Precision: ${(precision * 100).toFixed(2)}%`);
  console.log(`- Recall/Sensitivity: ${(recall * 100).toFixed(2)}%`);
  console.log(`- F1 Score: ${(f1 * 100).toFixed(2)}%`);
  console.log(`- False Positive Rate (FPR): ${(fpr * 100).toFixed(2)}%`);
  
  // Assertions for model quality
  if (precision < 0.95) {
    throw new Error(`Model precision (${(precision * 100).toFixed(2)}%) is below the 95% threshold requirement.`);
  }
  if (fpr >= 0.02) {
    throw new Error(`Model False Positive Rate (${(fpr * 100).toFixed(2)}%) is at or above the 2% threshold requirement.`);
  }
  
  console.log("Acceptance criteria met! Saving weights to src/ml/model_weights.json...");
  
  // Extract and save weights to a simple JSON structure for the lightweight JS client forward-pass
  const weights = {
    w1: model.layers[0].getWeights()[0].arraySync(),
    b1: model.layers[0].getWeights()[1].arraySync(),
    w2: model.layers[2].getWeights()[0].arraySync(),
    b2: model.layers[2].getWeights()[1].arraySync(),
    w3: model.layers[3].getWeights()[0].arraySync(),
    b3: model.layers[3].getWeights()[1].arraySync()
  };
  
  const outputDir = path.resolve(__dirname, '..', 'lib');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, 'model_weights.json'),
    JSON.stringify(weights, null, 2)
  );
  
  console.log(`Model weights successfully saved to ${path.join(outputDir, 'model_weights.json')}`);
  
  // Cleanup tensors
  xs.dispose();
  ys.dispose();
  val_xs.dispose();
  val_ys.dispose();
}

trainAndSave().catch(err => {
  console.error("Training failed:", err);
  process.exit(1);
});
