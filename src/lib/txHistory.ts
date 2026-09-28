import {
  type OfflineDraft,
  saveOfflineDraft,
  getOfflineDraft,
  listOfflineDrafts,
  deleteOfflineDraft,
} from './offlineDrafts';

export type TxSnapshot = {
  sourceAccount: string;
  memo: string;
  memoType: string;
  baseFee: string;
  timeout: string;
  operations: any[];
  [key: string]: any;
};

export type Draft = OfflineDraft;

const MAX_HISTORY = 50;

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

export function useTransactionHistory(opts: {
  initialSnapshot: TxSnapshot;
  onRestore: (_snapshot: TxSnapshot) => void;
}) {
  const undoStack: TxSnapshot[] = [];
  const redoStack: TxSnapshot[] = [];
  let current: TxSnapshot = clone(opts.initialSnapshot);
  let isApplying = false;

  let drafts = listOfflineDrafts();

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
    } catch {
      /* ignore */
    }

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
    if (redoStack.length > MAX_HISTORY) undoStack.shift();
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
    drafts = listOfflineDrafts();
    return drafts;
  }

  function saveDraft(name: string, snapshot: TxSnapshot) {
    const d = saveOfflineDraft({
      name,
      snapshot: clone(snapshot),
    });
    drafts = listOfflineDrafts();
    return d;
  }

  function loadDraft(id: string) {
    const d = getOfflineDraft(id);
    if (!d) return null;
    isApplying = true;
    try {
      opts.onRestore(clone(d.snapshot as TxSnapshot));
      current = clone(d.snapshot as TxSnapshot);
      // after restoring a draft, clear redo stack (new branch)
      redoStack.length = 0;
      undoStack.push(clone(current));
      if (undoStack.length > MAX_HISTORY) undoStack.shift();
    } finally {
      isApplying = false;
    }
    return d.snapshot as TxSnapshot;
  }

  function deleteDraft(id: string) {
    deleteOfflineDraft(id);
    drafts = listOfflineDrafts();
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

