/**
 * Natural Language Transaction Builder (#551).
 *
 * Plain-English input becomes a set of parsed operations the user reviews and
 * corrects before anything is built. Corrections are persisted, so a recipient
 * or issuer only has to be identified once.
 *
 * The confirmation step is not optional. Parsed operations are never handed to
 * the transaction builder until the user has seen every resolved field, because
 * a misread amount or destination is unrecoverable once submitted.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2, Pencil, Sparkles, X } from "lucide-react";
import {
  isReadyToBuild,
  parseTransaction,
  REVIEW_THRESHOLD,
  toBuilderOperations,
} from "../lib/nlp/parser";
import { PATTERN_EXAMPLES } from "../lib/nlp/patterns";
import {
  learnFromConfirmation,
  loadCorrections,
  recordCorrection,
} from "../lib/nlp/correctionStore";

const DEBOUNCE_MS = 250;

/** Fields the user is allowed to edit inline, per operation type. */
const EDITABLE_FIELDS = {
  payment: ["destination", "amount", "assetCode", "assetIssuer"],
  createAccount: ["destination", "startingBalance"],
  changeTrust: ["assetCode", "assetIssuer", "limit"],
  manageSellOffer: ["amount", "price", "sellingAssetCode", "buyingAssetCode"],
  manageBuyOffer: ["buyAmount", "price", "sellingAssetCode", "buyingAssetCode"],
  accountMerge: ["destination"],
  manageData: ["name", "value"],
  pathPaymentStrictSend: ["destination", "sendAmount", "destMin"],
  pathPaymentStrictReceive: ["destination", "sendMax", "destAmount"],
  claimClaimableBalance: ["balanceId"],
  bumpSequence: ["bumpTo"],
  beginSponsoringFutureReserves: ["sponsoredId"],
  endSponsoringFutureReserves: [],
  clawback: ["from", "amount", "assetCode", "assetIssuer"],
};

const FIELD_LABELS = {
  destination: "Recipient",
  destinationRaw: "Recipient (as written)",
  amount: "Amount",
  buyAmount: "Buy amount",
  startingBalance: "Starting balance",
  assetCode: "Asset",
  assetIssuer: "Issuer",
  sellingAssetCode: "Selling",
  buyingAssetCode: "Buying",
  price: "Price",
  limit: "Limit",
  name: "Key",
  value: "Value",
  balanceId: "Balance ID",
  bumpTo: "Bump to",
  sponsoredId: "Sponsored account",
  from: "From",
  sendAmount: "Send amount",
  sendMax: "Max to send",
  destMin: "Minimum received",
  destAmount: "Amount received",
};

const TYPE_LABELS = {
  payment: "Payment",
  createAccount: "Create Account",
  changeTrust: "Change Trust",
  manageSellOffer: "Sell Offer",
  manageBuyOffer: "Buy Offer",
  accountMerge: "Account Merge",
  manageData: "Manage Data",
  pathPaymentStrictSend: "Path Payment (Strict Send)",
  pathPaymentStrictReceive: "Path Payment (Strict Receive)",
  claimClaimableBalance: "Claim Balance",
  bumpSequence: "Bump Sequence",
  beginSponsoringFutureReserves: "Begin Sponsoring",
  endSponsoringFutureReserves: "End Sponsoring",
  clawback: "Clawback",
};

function confidenceTone(score) {
  if (score >= REVIEW_THRESHOLD) return "high";
  if (score >= 0.4) return "medium";
  return "low";
}

function truncateKey(value) {
  if (typeof value !== "string") return value;
  return /^[GMC][A-Z2-7]{54,68}$/.test(value)
    ? `${value.slice(0, 6)}...${value.slice(-4)}`
    : value;
}

/**
 * @param {object} props
 * @param {(ops: Array, meta: object) => void} props.onConfirm Receives builder-ready operations.
 * @param {Record<string,string>} [props.addressBook] alias -> public key
 * @param {Record<string,string>} [props.knownIssuers] asset code -> issuer
 * @param {string} [props.sourceAccount]
 */
export default function NaturalLanguageTxBuilder({
  onConfirm,
  addressBook = {},
  knownIssuers = {},
  sourceAccount = "",
}) {
  const [input, setInput] = useState("");
  const [corrections, setCorrections] = useState([]);
  const [result, setResult] = useState(null);
  const [edited, setEdited] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [loadError, setLoadError] = useState("");
  const debounceRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    loadCorrections()
      .then((loaded) => {
        if (!cancelled) setCorrections(loaded);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError("Saved corrections could not be loaded. Parsing still works.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const ctx = useMemo(
    () => ({ addressBook, knownIssuers, corrections, sourceAccount }),
    [addressBook, knownIssuers, corrections, sourceAccount],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!input.trim()) {
      setResult(null);
      setEdited({});
      setParsing(false);
      return undefined;
    }

    setParsing(true);
    debounceRef.current = setTimeout(() => {
      setResult(parseTransaction(input, ctx));
      setEdited({});
      setConfirmed(false);
      setParsing(false);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [input, ctx]);

  /** Applies user edits on top of the parsed params. */
  const effectiveOperations = useMemo(() => {
    if (!result) return [];
    return result.operations.map((op, i) => {
      const overrides = edited[i] ?? {};
      const params = { ...op.params, ...overrides };
      const missingFields = op.missingFields.filter(
        (f) => !overrides[f] || String(overrides[f]).trim() === "",
      );
      return { ...op, params, missingFields };
    });
  }, [result, edited]);

  const ready = useMemo(() => {
    if (!result) return false;
    return isReadyToBuild({ ...result, operations: effectiveOperations });
  }, [result, effectiveOperations]);

  const handleFieldChange = useCallback((opIndex, field, value) => {
    setEdited((prev) => ({
      ...prev,
      [opIndex]: { ...(prev[opIndex] ?? {}), [field]: value },
    }));
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!result || !ready) return;

    const builderOps = toBuilderOperations(effectiveOperations);

    try {
      const learned = await learnFromConfirmation(result.operations, effectiveOperations);
      if (learned.length) setCorrections(await loadCorrections());
    } catch {
      // Learning is best-effort and must not block the transaction.
    }

    setConfirmed(true);
    onConfirm?.(builderOps, {
      memo: result.memo,
      memoType: result.memoType,
      sourceText: result.normalizedInput,
      confidence: result.confidence,
    });
  }, [result, ready, effectiveOperations, onConfirm]);

  /** Teaches the parser an alias without waiting for a confirmed transaction. */
  const handleTeachAlias = useCallback(async (alias, value) => {
    if (!alias || !value) return;
    try {
      await recordCorrection(alias, "destination", value);
      setCorrections(await loadCorrections());
    } catch {
      // Non-fatal: the edited value still applies to this transaction.
    }
  }, []);

  const showExamples = !input.trim();

  return (
    <section className="nltx" aria-labelledby="nltx-heading">
      <header className="nltx__header">
        <h2 id="nltx-heading" className="nltx__title">
          <Sparkles size={18} aria-hidden="true" /> Describe your transaction
        </h2>
        <p className="nltx__subtitle">
          Write what you want in plain English. Every field is shown for review before anything is built.
        </p>
      </header>

      <label className="nltx__label" htmlFor="nltx-input">
        Instruction
      </label>
      <textarea
        id="nltx-input"
        className="nltx__input"
        rows={3}
        value={input}
        placeholder="Send 500 XLM to Alice for rent"
        onChange={(e) => setInput(e.target.value)}
        aria-describedby="nltx-status"
      />

      <div id="nltx-status" className="nltx__status" role="status" aria-live="polite">
        {parsing ? (
          <span className="nltx__parsing">
            <Loader2 size={14} className="nltx__spin" aria-hidden="true" /> Reading your instruction
          </span>
        ) : result ? (
          <span>
            {result.operations.length} operation{result.operations.length === 1 ? "" : "s"} recognized
            {result.confidence > 0 && ` at ${Math.round(result.confidence * 100)}% confidence`}
          </span>
        ) : null}
      </div>

      {loadError && <p className="nltx__note">{loadError}</p>}

      {showExamples && (
        <div className="nltx__examples">
          <p className="nltx__examples-title">Try one of these</p>
          <ul>
            {PATTERN_EXAMPLES.slice(0, 6).map((ex) => (
              <li key={ex}>
                <button type="button" className="nltx__example" onClick={() => setInput(ex)}>
                  {ex}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result?.unparsed?.length > 0 && (
        <div className="nltx__warning" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <div>
            <p>Part of that could not be interpreted:</p>
            <ul>
              {result.unparsed.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
            <p className="nltx__hint">Try rephrasing, or build that operation manually.</p>
          </div>
        </div>
      )}

      {effectiveOperations.map((op, i) => {
        const editable = EDITABLE_FIELDS[op.type] ?? [];
        const tone = confidenceTone(op.confidence);

        return (
          <article key={`${op.patternId}-${i}`} className={`nltx__op nltx__op--${tone}`}>
            <header className="nltx__op-header">
              <span className="nltx__op-type">{TYPE_LABELS[op.type] ?? op.type}</span>
              <span className={`nltx__badge nltx__badge--${tone}`}>
                {Math.round(op.confidence * 100)}% confident
              </span>
            </header>

            <p className="nltx__op-source">&ldquo;{op.sourceText}&rdquo;</p>

            <dl className="nltx__fields">
              {editable.map((field) => {
                const value = op.params[field] ?? "";
                const isMissing = op.missingFields.includes(field);
                const fieldConf = op.fieldConfidence[field];
                const needsReview =
                  isMissing || (typeof fieldConf === "number" && fieldConf < REVIEW_THRESHOLD);
                const isEditing = editingField === `${i}:${field}`;
                const alias = op.params.destinationRaw;

                return (
                  <div
                    key={field}
                    className={`nltx__field${needsReview ? " nltx__field--review" : ""}`}
                  >
                    <dt>{FIELD_LABELS[field] ?? field}</dt>
                    <dd>
                      {isEditing ? (
                        <span className="nltx__edit">
                          <input
                            className="nltx__edit-input"
                            defaultValue={String(value)}
                            autoFocus
                            aria-label={`${FIELD_LABELS[field] ?? field} value`}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleFieldChange(i, field, e.currentTarget.value);
                                if (field === "destination" && alias) {
                                  handleTeachAlias(alias, e.currentTarget.value);
                                }
                                setEditingField(null);
                              }
                              if (e.key === "Escape") setEditingField(null);
                            }}
                            onBlur={(e) => {
                              handleFieldChange(i, field, e.currentTarget.value);
                              setEditingField(null);
                            }}
                          />
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="nltx__value"
                          onClick={() => setEditingField(`${i}:${field}`)}
                        >
                          <span>
                            {value === "" ? (
                              <em className="nltx__missing">needs a value</em>
                            ) : (
                              truncateKey(String(value))
                            )}
                          </span>
                          <Pencil size={12} aria-hidden="true" />
                        </button>
                      )}
                      {isMissing && field === "destination" && alias && (
                        <p className="nltx__hint">
                          &ldquo;{alias}&rdquo; is not in your address book. Enter the address once and it
                          will be remembered.
                        </p>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </article>
        );
      })}

      {result?.memo && (
        <p className="nltx__memo">
          Memo ({result.memoType}): <strong>{result.memo}</strong>
        </p>
      )}

      {result && result.operations.length > 0 && (
        <footer className="nltx__actions">
          <button
            type="button"
            className="nltx__confirm"
            disabled={!ready || confirmed}
            onClick={handleConfirm}
          >
            {confirmed ? (
              <>
                <Check size={16} aria-hidden="true" /> Sent to builder
              </>
            ) : (
              <>Review complete, build transaction</>
            )}
          </button>
          <button
            type="button"
            className="nltx__clear"
            onClick={() => {
              setInput("");
              setResult(null);
              setEdited({});
              setConfirmed(false);
            }}
          >
            <X size={16} aria-hidden="true" /> Clear
          </button>
          {!ready && (
            <p className="nltx__hint">
              Fill the highlighted fields before building.
            </p>
          )}
        </footer>
      )}
    </section>
  );
}