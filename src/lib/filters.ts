function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function isBeforeDate(value, date) {
  if (!hasValue(date)) return false;
  const timestamp = new Date(value).getTime();
  const boundary = new Date(`${date}T00:00:00`).getTime();
  return Number.isFinite(timestamp) && Number.isFinite(boundary) && timestamp < boundary;
}

function isAfterDate(value, date) {
  if (!hasValue(date)) return false;
  const timestamp = new Date(value).getTime();
  const boundary = new Date(`${date}T23:59:59.999`).getTime();
  return Number.isFinite(timestamp) && Number.isFinite(boundary) && timestamp > boundary;
}

export function applyTransactionFilters(transactions = [], filters = {}) {
  return transactions.filter((tx) => {
    if (filters.status === "success" && !tx.successful) return false;
    if (filters.status === "failed" && tx.successful) return false;

    if (filters.memoOnly && !String(tx.memo || "").trim()) return false;

    if (hasValue(filters.minFee) && toNumber(tx.fee_charged) < toNumber(filters.minFee)) {
      return false;
    }

    if (hasValue(filters.maxFee) && toNumber(tx.fee_charged) > toNumber(filters.maxFee)) {
      return false;
    }

    if (isBeforeDate(tx.created_at, filters.startDate)) {
      return false;
    }

    if (isAfterDate(tx.created_at, filters.endDate)) {
      return false;
    }

    return true;
  });
}

export function applyOperationFilters(operations = [], filters = {}) {
  return operations.filter((op) => {
    if (filters.type && filters.type !== "all" && op.type !== filters.type) {
      return false;
    }

    if (filters.account && !String(op.from || op.to || "").includes(filters.account)) {
      return false;
    }

    if (hasValue(filters.minAmount) && toNumber(op.amount) < toNumber(filters.minAmount)) {
      return false;
    }

    if (hasValue(filters.maxAmount) && toNumber(op.amount) > toNumber(filters.maxAmount)) {
      return false;
    }

    if (isBeforeDate(op.created_at, filters.startDate)) {
      return false;
    }

    if (isAfterDate(op.created_at, filters.endDate)) {
      return false;
    }

    return true;
  });
}

export function applyAssetFilters(assets = [], filters = {}) {
  return assets.filter((asset) => {
    if (filters.verifiedOnly && !asset.is_verified) return false;
    if (filters.minHolders && toNumber(asset.num_accounts) < toNumber(filters.minHolders)) {
      return false;
    }
    if (filters.assetCode && asset.code !== filters.assetCode) return false;
    return true;
  });
}

export default {
  applyTransactionFilters,
  applyOperationFilters,
  applyAssetFilters,
};
