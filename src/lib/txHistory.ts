type TxSnapshot = {
  sourceAccount: string;
  memo: string;
  memoType: string;
  baseFee: string;
  timeout: string;
  operations: any[];
};

type Draft = {
  id: string;
  name: string;
  createdAt: number;
  snapshot: TxSnapshot;
};

const DRAFT_KEY = "tx_builder_drafts_v1";
const MAX_DRAFTS = 20;
const MAX_HISTORY = 50;

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function loadDraftsFromStorage(): Draft[] {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveDraftsToStorage(drafts: Draft[]) {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
  } catch {}
}

export function useTransactionHistory(opts: {
  initialSnapshot: TxSnapshot;
  onRestore: (snapshot: TxSnapshot) => void;
}) {
  const undoStack: TxSnapshot[] = [];
  const redoStack: TxSnapshot[] = [];
  let current: TxSnapshot = clone(opts.initialSnapshot);
  let isApplying = false;

  let drafts = loadDraftsFromStorage();

  function canUndo() {
    return undoStack.length > 0;
  }

  function canRedo() {
    return redoStack.length > 0;
  }

  function record(snapshot: TxSnapshot) {
    if (isApplying) {
      current = clone(snapshot);
      return;
    }

    // avoid recording identical successive snapshots
    try {
      if (JSON.stringify(current) === JSON.stringify(snapshot)) return;
    } catch {}

    undoStack.push(clone(current));
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    // new branch clears redo
    redoStack.length = 0;
    current = clone(snapshot);
  }

  function undo() {
    if (!canUndo()) return;
    const prev = undoStack.pop()!;
    redoStack.push(clone(current));
    if (redoStack.length > MAX_HISTORY) redoStack.shift();
    isApplying = true;
    try {
      opts.onRestore(clone(prev));
      current = clone(prev);
    } finally {
      isApplying = false;
    }
  }

  function redo() {
    if (!canRedo()) return;
    const next = redoStack.pop()!;
    undoStack.push(clone(current));
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    isApplying = true;
    try {
      opts.onRestore(clone(next));
      current = clone(next);
    } finally {
      isApplying = false;
    }
  }

  function listDrafts() {
    drafts = loadDraftsFromStorage();
    return drafts;
  }

  function saveDraft(name: string, snapshot: TxSnapshot) {
    const d: Draft = { id: `${Date.now()}`, name, createdAt: Date.now(), snapshot: clone(snapshot) };
    drafts = [d, ...loadDraftsFromStorage()].slice(0, MAX_DRAFTS);
    saveDraftsToStorage(drafts);
    return d;
  }

  function loadDraft(id: string) {
    drafts = loadDraftsFromStorage();
    const d = drafts.find((x) => x.id === id);
    if (!d) return null;
    isApplying = true;
    try {
      opts.onRestore(clone(d.snapshot));
      current = clone(d.snapshot);
      // after restoring a draft, clear redo stack (new branch)
      redoStack.length = 0;
      undoStack.push(clone(current));
      if (undoStack.length > MAX_HISTORY) undoStack.shift();
    } finally {
      isApplying = false;
    }
    return d.snapshot;
  }

  function deleteDraft(id: string) {
    drafts = loadDraftsFromStorage().filter((d) => d.id !== id);
    saveDraftsToStorage(drafts);
  }

  return {
    record,
    undo,
    redo,
    canUndo: () => canUndo(),
    canRedo: () => canRedo(),
    listDrafts,
    saveDraft,
    loadDraft,
    deleteDraft,
  };
}
