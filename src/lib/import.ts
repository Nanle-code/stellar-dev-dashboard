/**
 * Data import functionality (#114).
 *
 * Reads backup JSON files produced by the export utilities and
 * validates them before handing them to the store for restoration.
 */

const SUPPORTED_VERSIONS = [1];

/**
 * Parse and validate a backup JSON string.
 * @param {string} jsonString - Raw file contents
 * @returns {{ ok: true, data: Object } | { ok: false, error: string }}
 */
export function parseBackup(jsonString) {
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return { ok: false, error: "File is not valid JSON." };
  }

  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "Backup file has an unexpected format." };
  }

  if (!SUPPORTED_VERSIONS.includes(parsed.version)) {
    return {
      ok: false,
      error: `Unsupported backup version: ${parsed.version}. Expected one of: ${SUPPORTED_VERSIONS.join(", ")}.`,
    };
  }

  return { ok: true, data: parsed };
}

/**
 * Read a File object and return its text content as a promise.
 * @param {File} file
 * @returns {Promise<string>}
 */
export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsText(file);
  });
}

/**
 * Validate that a backup payload has all required top-level keys.
 * @param {Object} data - Parsed backup object
 * @returns {string[]}  - Array of validation error messages (empty = valid)
 */
export function validateBackupPayload(data) {
  const errors = [];
  if (!data.exportedAt) errors.push("Missing exportedAt timestamp.");
  if (!data.account || typeof data.account !== "object")
    errors.push("Missing or invalid account section.");
  return errors;
}

/**
 * Merge imported backup data into the given Zustand store.
 * Only whitelisted keys are applied to prevent prototype pollution.
 * @param {Object} data  - Validated backup payload
 * @param {Object} store - Zustand store with setter actions
 */
export function applyBackupToStore(data, store) {
  if (data.theme && ["dark", "light"].includes(data.theme)) {
    store.setTheme?.(data.theme);
  }
  if (data.account?.network) {
    store.setNetwork?.(data.account.network);
  }
  if (Array.isArray(data.watchedAddresses)) {
    store.setWatchedAddresses?.(data.watchedAddresses);
  }
}
