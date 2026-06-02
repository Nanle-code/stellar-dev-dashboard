export const EXPLORERS = {
  stellarExpert: {
    name: "Stellar Expert",
    baseUrl: "https://stellar.expert/explorer",
    logo: "🔍",
  },
  steexp: {
    name: "Steexp",
    baseUrl: "https://steexp.com",
    logo: "📊",
  },
};

export function getAccountUrl(explorer, network, publicKey) {
  const networkPath = network === "mainnet" ? "public" : "testnet";

  switch (explorer) {
    case "stellarExpert":
      return `${EXPLORERS.stellarExpert.baseUrl}/${networkPath}/account/${publicKey}`;
    case "steexp":
      return `${EXPLORERS.steexp.baseUrl}/${networkPath}/account/${publicKey}`;
    default:
      return null;
  }
}

export function getTransactionUrl(explorer, network, txHash) {
  const networkPath = network === "mainnet" ? "public" : "testnet";

  switch (explorer) {
    case "stellarExpert":
      return `${EXPLORERS.stellarExpert.baseUrl}/${networkPath}/tx/${txHash}`;
    case "steexp":
      return `${EXPLORERS.steexp.baseUrl}/${networkPath}/tx/${txHash}`;
    default:
      return null;
  }
}

export function getContractUrl(explorer, network, contractId) {
  const networkPath = network === "mainnet" ? "public" : "testnet";

  switch (explorer) {
    case "stellarExpert":
      return `${EXPLORERS.stellarExpert.baseUrl}/${networkPath}/contract/${contractId}`;
    case "steexp":
      return `${EXPLORERS.steexp.baseUrl}/${networkPath}/contract/${contractId}`;
    default:
      return null;
  }
}

export function getAssetUrl(explorer, network, assetCode, assetIssuer) {
  const networkPath = network === "mainnet" ? "public" : "testnet";

  switch (explorer) {
    case "stellarExpert":
      return `${EXPLORERS.stellarExpert.baseUrl}/${networkPath}/asset/${assetCode}-${assetIssuer}`;
    case "steexp":
      return `${EXPLORERS.steexp.baseUrl}/${networkPath}/asset/${assetCode}-${assetIssuer}`;
    default:
      return null;
  }
}

export function getLedgerUrl(explorer, network, ledgerSeq) {
  const networkPath = network === "mainnet" ? "public" : "testnet";

  switch (explorer) {
    case "stellarExpert":
      return `${EXPLORERS.stellarExpert.baseUrl}/${networkPath}/ledger/${ledgerSeq}`;
    case "steexp":
      return `${EXPLORERS.steexp.baseUrl}/${networkPath}/ledger/${ledgerSeq}`;
    default:
      return null;
  }
}

export function getOperationUrl(explorer, network, operationId) {
  const networkPath = network === "mainnet" ? "public" : "testnet";

  switch (explorer) {
    case "stellarExpert":
      return `${EXPLORERS.stellarExpert.baseUrl}/${networkPath}/op/${operationId}`;
    case "steexp":
      return `${EXPLORERS.steexp.baseUrl}/${networkPath}/operation/${operationId}`;
    default:
      return null;
  }
}
