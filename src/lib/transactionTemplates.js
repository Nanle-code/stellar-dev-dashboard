/**
 * Pre-built transaction templates (#111).
 *
 * Each template provides a human-readable description, a list of
 * default operation parameters, and field-level documentation so
 * the Builder UI can render the right form fields automatically.
 */

export const TRANSACTION_TEMPLATES = [
  {
    id: "simple_payment",
    label: "Simple XLM Payment",
    description: "Send XLM from one account to another.",
    operations: [
      {
        type: "payment",
        params: {
          destination: "",
          assetType: "native",
          assetCode: "",
          assetIssuer: "",
          amount: "10",
        },
      },
    ],
    memo: "",
    memoType: "text",
  },
  {
    id: "asset_payment",
    label: "Custom Asset Payment",
    description: "Send a non-XLM Stellar asset to another account.",
    operations: [
      {
        type: "payment",
        params: {
          destination: "",
          assetType: "credit_alphanum4",
          assetCode: "USDC",
          assetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
          amount: "10",
        },
      },
    ],
    memo: "",
    memoType: "text",
  },
  {
    id: "add_trustline",
    label: "Add Trustline",
    description: "Allow your account to hold a specific asset by adding a trustline.",
    operations: [
      {
        type: "changeTrust",
        params: {
          assetCode: "USDC",
          assetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
          limit: "",
        },
      },
    ],
    memo: "",
    memoType: "text",
  },
  {
    id: "create_account",
    label: "Create & Fund Account",
    description: "Create a new Stellar account with a minimum starting balance.",
    operations: [
      {
        type: "createAccount",
        params: {
          destination: "",
          startingBalance: "1",
        },
      },
    ],
    memo: "Account created via Stellar Dev Dashboard",
    memoType: "text",
  },
  {
    id: "path_payment",
    label: "Path Payment (Cross-Asset)",
    description:
      "Send a payment that automatically converts between assets using Stellar's DEX path finding.",
    operations: [
      {
        type: "pathPaymentStrictSend",
        params: {
          sendAssetType: "native",
          sendAssetCode: "",
          sendAssetIssuer: "",
          sendAmount: "10",
          destination: "",
          destAssetType: "credit_alphanum4",
          destAssetCode: "USDC",
          destAssetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
          destMin: "1",
          path: [],
        },
      },
    ],
    memo: "",
    memoType: "text",
  },
  {
    id: "set_home_domain",
    label: "Set Home Domain",
    description: "Associate a home domain with your account for federation and TOML lookups.",
    operations: [
      {
        type: "setOptions",
        params: {
          homeDomain: "example.com",
          setFlags: "",
          clearFlags: "",
        },
      },
    ],
    memo: "",
    memoType: "text",
  },
  {
    id: "account_merge",
    label: "Merge Account",
    description:
      "Merge all XLM from this account into a destination account and delete this account.",
    operations: [
      {
        type: "accountMerge",
        params: {
          destination: "",
        },
      },
    ],
    memo: "",
    memoType: "text",
  },
  {
    id: "bump_sequence",
    label: "Bump Sequence",
    description: "Invalidate a set of in-flight transactions by bumping the sequence number.",
    operations: [
      {
        type: "bumpSequence",
        params: {
          bumpTo: "",
        },
      },
    ],
    memo: "",
    memoType: "text",
  },
];

/**
 * Look up a template by id.
 * @param {string} id
 * @returns {Object|undefined}
 */
export function getTemplate(id) {
  return TRANSACTION_TEMPLATES.find((t) => t.id === id);
}

/**
 * Deep-clone a template so edits don't mutate the original.
 * @param {string} id
 * @returns {Object|null}
 */
export function cloneTemplate(id) {
  const tpl = getTemplate(id);
  return tpl ? JSON.parse(JSON.stringify(tpl)) : null;
}
