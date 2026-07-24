import type {
  ContractSpec,
  ContractFunction,
  ContractEvent,
  ABIDiffResult,
  FunctionDiff,
  EventDiff,
  ParamDiff,
  StorageDiff,
  ChangeRecord,
  ChangeSeverity,
  StorageSlot,
} from './types';

function signatureOf(fn: ContractFunction): string {
  return `${fn.name}(${fn.inputs.map((p) => p.type).join(',')})`;
}

function eventSignatureOf(ev: ContractEvent): string {
  return `${ev.name}(${ev.params.map((p) => p.type).join(',')})`;
}

function compareParams(a: ContractFunction, b: ContractFunction): ParamDiff[] {
  const diffs: ParamDiff[] = [];
  const maxLen = Math.max(a.inputs.length, b.inputs.length);

  for (let i = 0; i < maxLen; i++) {
    const before = a.inputs[i];
    const after = b.inputs[i];

    if (!before) {
      diffs.push({ paramName: after?.name ?? `param_${i}`, added: true });
    } else if (!after) {
      diffs.push({ paramName: before.name, removed: true });
    } else if (before.type !== after.type) {
      diffs.push({
        paramName: before.name,
        type: { before: before.type, after: after.type },
      });
    }
  }

  for (let i = 0; i < Math.max(a.outputs.length, b.outputs.length); i++) {
    const before = a.outputs[i];
    const after = b.outputs[i];

    if (!before && after) {
      diffs.push({ paramName: after?.name ?? `out_${i}`, added: true });
    } else if (before && !after) {
      diffs.push({ paramName: before.name, removed: true });
    } else if (before && after && before.type !== after.type) {
      diffs.push({
        paramName: before.name,
        type: { before: before.type, after: after.type },
      });
    }
  }

  return diffs;
}

function buildBreakingChange(
  category: ChangeRecord['category'],
  severity: ChangeSeverity,
  description: string,
  affectedFunction?: string,
): ChangeRecord {
  return { category, severity, description, affectedFunction };
}

function buildStorageDiffs(
  before: StorageSlot[],
  after: StorageSlot[],
): StorageDiff[] {
  const beforeMap = new Map(before.map((s) => [s.name, s]));
  const afterMap = new Map(after.map((s) => [s.name, s]));
  const diffs: StorageDiff[] = [];

  for (const [name] of beforeMap) {
    if (!afterMap.has(name)) {
      diffs.push({ slot: name, removed: true });
    }
  }

  for (const [name, slot] of afterMap) {
    if (!beforeMap.has(name)) {
      diffs.push({ slot: name, added: true });
    } else {
      const old = beforeMap.get(name)!;
      const changes: StorageDiff = { slot: name };
      if (old.type !== slot.type) {
        changes.type = { before: old.type, after: slot.type };
      }
      if (old.persistent !== slot.persistent) {
        changes.persistentChanged = true;
      }
      if (changes.type || changes.persistentChanged) {
        diffs.push(changes);
      }
    }
  }

  return diffs;
}

export function analyzeABIDiff(
  beforeSpec: ContractSpec,
  afterSpec: ContractSpec,
): ABIDiffResult {
  const beforeFnMap = new Map(beforeSpec.functions.map((f) => [f.name, f]));
  const afterFnMap = new Map(afterSpec.functions.map((f) => [f.name, f]));

  const addedFunctions: ContractFunction[] = [];
  const removedFunctions: ContractFunction[] = [];
  const modifiedFunctions: FunctionDiff[] = [];

  for (const [name, fn] of afterFnMap) {
    if (!beforeFnMap.has(name)) {
      addedFunctions.push(fn);
    }
  }

  for (const [name, fn] of beforeFnMap) {
    if (!afterFnMap.has(name)) {
      removedFunctions.push(fn);
    }
  }

  for (const [name, beforeFn] of beforeFnMap) {
    if (!afterFnMap.has(name)) continue;
    const afterFn = afterFnMap.get(name)!;

    const sigBefore = signatureOf(beforeFn);
    const sigAfter = signatureOf(afterFn);

    const authChanged = beforeFn.authRequired !== afterFn.authRequired;
    const mutabilityChanged = beforeFn.mutability !== afterFn.mutability;

    if (sigBefore !== sigAfter) {
      const inputChanges = compareParams(beforeFn, afterFn);
      modifiedFunctions.push({
        name,
        before: beforeFn,
        after: afterFn,
        inputChanges,
        outputChanges: [],
        mutabilityChanged,
        authChanged,
      });
    } else if (authChanged || mutabilityChanged) {
      modifiedFunctions.push({
        name,
        before: beforeFn,
        after: afterFn,
        inputChanges: [],
        outputChanges: [],
        mutabilityChanged,
        authChanged,
      });
    }
  }

  const beforeEvMap = new Map(beforeSpec.events.map((e) => [e.name, e]));
  const afterEvMap = new Map(afterSpec.events.map((e) => [e.name, e]));

  const addedEvents = afterSpec.events.filter((e) => !beforeEvMap.has(e.name));
  const removedEvents = beforeSpec.events.filter((e) => !afterEvMap.has(e.name));

  const modifiedEvents: EventDiff[] = [];
  for (const [name, beforeEv] of beforeEvMap) {
    if (!afterEvMap.has(name)) continue;
    const afterEv = afterEvMap.get(name)!;
    if (eventSignatureOf(beforeEv) !== eventSignatureOf(afterEv)) {
      const paramChanges: ParamDiff[] = [];
      const maxLen = Math.max(beforeEv.params.length, afterEv.params.length);
      for (let i = 0; i < maxLen; i++) {
        const bp = beforeEv.params[i];
        const ap = afterEv.params[i];
        if (!bp) paramChanges.push({ paramName: ap?.name ?? `p_${i}`, added: true });
        else if (!ap) paramChanges.push({ paramName: bp.name, removed: true });
        else if (bp.type !== ap.type)
          paramChanges.push({ paramName: bp.name, type: { before: bp.type, after: ap.type } });
      }
      modifiedEvents.push({ name, before: beforeEv, after: afterEv, paramChanges });
    }
  }

  const addedErrors = afterSpec.errors.filter(
    (e) => !beforeSpec.errors.some((b) => b.name === e.name),
  );
  const removedErrors = beforeSpec.errors.filter(
    (e) => !afterSpec.errors.some((a) => a.name === e.name),
  );

  const storageChanges = buildStorageDiffs(beforeSpec.storageSlots, afterSpec.storageSlots);

  const breakingChanges: ChangeRecord[] = [];
  const nonBreakingChanges: ChangeRecord[] = [];
  const deprecations: ChangeRecord[] = [];

  for (const fn of removedFunctions) {
    breakingChanges.push(
      buildBreakingChange('function-removed', 'breaking', `Function "${fn.name}" removed`, fn.name),
    );
  }
  for (const fn of addedFunctions) {
    nonBreakingChanges.push(
      buildBreakingChange('function-added', 'additive', `New function "${fn.name}" added`, fn.name),
    );
  }
  for (const diff of modifiedFunctions) {
    const hasInputRemoval = diff.inputChanges.some((c) => c.removed);
    const hasTypeChange = diff.inputChanges.some((c) => c.type);
    const hasOutputChange = diff.outputChanges.some((c) => c.removed || c.type);

    if (hasInputRemoval || hasOutputChange) {
      breakingChanges.push(
        buildBreakingChange(
          'function-signature-changed',
          'breaking',
          `Function "${diff.name}" signature changed (inputs/outputs modified)`,
          diff.name,
        ),
      );
    } else if (hasTypeChange) {
      breakingChanges.push(
        buildBreakingChange(
          'parameter-type-changed',
          'breaking',
          `Parameter type changed in "${diff.name}"`,
          diff.name,
        ),
      );
    }

    if (diff.mutabilityChanged) {
      deprecations.push(
        buildBreakingChange(
          'behavior-changed',
          'deprecation',
          `Mutability changed from "${diff.before.mutability}" to "${diff.after.mutability}" in "${diff.name}"`,
          diff.name,
        ),
      );
    }

    if (diff.authChanged) {
      breakingChanges.push(
        buildBreakingChange(
          'behavior-changed',
          'breaking',
          `Auth requirement changed in "${diff.name}"`,
          diff.name,
        ),
      );
    }
  }

  for (const ev of removedEvents) {
    breakingChanges.push(
      buildBreakingChange('event-removed', 'breaking', `Event "${ev.name}" removed`),
    );
  }
  for (const ev of addedEvents) {
    nonBreakingChanges.push(
      buildBreakingChange('event-added', 'additive', `New event "${ev.name}" added`),
    );
  }
  for (const diff of modifiedEvents) {
    const hasRemoval = diff.paramChanges.some((c) => c.removed);
    if (hasRemoval) {
      breakingChanges.push(
        buildBreakingChange(
          'event-signature-changed',
          'breaking',
          `Event "${diff.name}" signature changed`,
        ),
      );
    }
  }

  for (const sc of storageChanges) {
    if (sc.removed) {
      breakingChanges.push(
        buildBreakingChange('storage-layout-changed', 'breaking', `Storage slot "${sc.slot}" removed`),
      );
    } else if (sc.added) {
      nonBreakingChanges.push(
        buildBreakingChange('storage-layout-changed', 'additive', `Storage slot "${sc.slot}" added`),
      );
    } else if (sc.type || sc.persistentChanged) {
      breakingChanges.push(
        buildBreakingChange('storage-layout-changed', 'breaking', `Storage slot "${sc.slot}" layout changed`),
      );
    }
  }

  for (const err of removedErrors) {
    breakingChanges.push(
      buildBreakingChange('error-removed', 'breaking', `Error "${err.name}" removed`),
    );
  }
  for (const err of addedErrors) {
    nonBreakingChanges.push(
      buildBreakingChange('error-added', 'additive', `Error "${err.name}" added`),
    );
  }

  return {
    addedFunctions,
    removedFunctions,
    modifiedFunctions,
    addedEvents,
    removedEvents,
    modifiedEvents,
    addedErrors,
    removedErrors,
    storageChanges,
    breakingChanges,
    nonBreakingChanges,
    deprecations,
  };
}
