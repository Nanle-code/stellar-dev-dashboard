import type {
  ABIDiffResult,
  BytecodeDiffResult,
  CompatibilityScore,
  CompatibilityDetail,
} from './types';

function scoreFromSeverityWeighted(
  breaking: number,
  deprecation: number,
  additive: number,
  total: number,
): number {
  if (total === 0) return 100;
  const penalty = breaking * 20 + deprecation * 8 - additive * 2;
  return Math.max(0, Math.min(100, 100 - (penalty / total) * 100));
}

function functionCompatScore(diff: ABIDiffResult): { score: number; details: CompatibilityDetail[] } {
  const details: CompatibilityDetail[] = [];
  const totalFunctions =
    diff.removedFunctions.length +
    diff.addedFunctions.length +
    diff.modifiedFunctions.length;

  if (totalFunctions === 0) {
    return { score: 100, details };
  }

  const removedCount = diff.removedFunctions.length;
  if (removedCount > 0) {
    for (const fn of diff.removedFunctions) {
      details.push({
        area: `function:${fn.name}`,
        score: 0,
        message: `Function "${fn.name}" has been removed — all callers will break`,
        severity: 'breaking',
      });
    }
  }

  const typeChanges = diff.modifiedFunctions.filter((f) =>
    f.inputChanges.some((c) => c.type),
  ).length;
  const authChanges = diff.modifiedFunctions.filter((f) => f.authChanged).length;

  if (typeChanges > 0) {
    for (const fn of diff.modifiedFunctions.filter((f) => f.inputChanges.some((c) => c.type))) {
      details.push({
        area: `function:${fn.name}`,
        score: 0,
        message: `Parameter types changed in "${fn.name}"`,
        severity: 'breaking',
      });
    }
  }

  if (authChanges > 0) {
    for (const fn of diff.modifiedFunctions.filter((f) => f.authChanged)) {
      details.push({
        area: `function:${fn.name}`,
        score: 30,
        message: `Auth requirement changed in "${fn.name}" — callers may need to update auth handling`,
        severity: 'deprecation',
      });
    }
  }

  for (const fn of diff.addedFunctions) {
    details.push({
      area: `function:${fn.name}`,
      score: 100,
      message: `New function "${fn.name}" added — no existing callers affected`,
      severity: 'additive',
    });
  }

  const score = scoreFromSeverityWeighted(
    removedCount + typeChanges,
    authChanges,
    diff.addedFunctions.length,
    totalFunctions,
  );

  return { score, details };
}

function eventCompatScore(diff: ABIDiffResult): { score: number; details: CompatibilityDetail[] } {
  const details: CompatibilityDetail[] = [];
  const totalEvents = diff.removedEvents.length + diff.addedEvents.length + diff.modifiedEvents.length;

  if (totalEvents === 0) return { score: 100, details };

  for (const ev of diff.removedEvents) {
    details.push({
      area: `event:${ev.name}`,
      score: 0,
      message: `Event "${ev.name}" removed — indexers relying on it will break`,
      severity: 'breaking',
    });
  }

  for (const ev of diff.addedEvents) {
    details.push({
      area: `event:${ev.name}`,
      score: 100,
      message: `New event "${ev.name}" added`,
      severity: 'additive',
    });
  }

  const score = scoreFromSeverityWeighted(
    diff.removedEvents.length,
    diff.modifiedEvents.length,
    diff.addedEvents.length,
    totalEvents,
  );

  return { score, details };
}

function storageCompatScore(diff: ABIDiffResult): { score: number; details: CompatibilityDetail[] } {
  const details: CompatibilityDetail[] = [];
  const changes = diff.storageChanges;

  if (changes.length === 0) return { score: 100, details }  ;

  let breaking = 0;
  let additive = 0;

  for (const sc of changes) {
    if (sc.removed) {
      breaking++;
      details.push({
        area: `storage:${sc.slot}`,
        score: 0,
        message: `Storage slot "${sc.slot}" removed — may break persisted data`,
        severity: 'breaking',
      });
    } else if (sc.added) {
      additive++;
      details.push({
        area: `storage:${sc.slot}`,
        score: 100,
        message: `Storage slot "${sc.slot}" added`,
        severity: 'additive',
      });
    } else if (sc.type || sc.persistentChanged) {
      breaking++;
      details.push({
        area: `storage:${sc.slot}`,
        score: 0,
        message: `Storage slot "${sc.slot}" layout changed — may corrupt existing data`,
        severity: 'breaking',
      });
    }
  }

  const score = scoreFromSeverityWeighted(breaking, 0, additive, changes.length);
  return { score, details };
}

function errorCompatScore(diff: ABIDiffResult): { score: number; details: CompatibilityDetail[] } {
  const details: CompatibilityDetail[] = [];
  const total = diff.removedErrors.length + diff.addedErrors.length;

  if (total === 0) return { score: 100, details };

  for (const err of diff.removedErrors) {
    details.push({
      area: `error:${err.name}`,
      score: 0,
      message: `Error "${err.name}" removed — callers checking for it will break`,
      severity: 'breaking',
    });
  }

  for (const err of diff.addedErrors) {
    details.push({
      area: `error:${err.name}`,
      score: 100,
      message: `New error "${err.name}" added`,
      severity: 'additive',
    });
  }

  const score = scoreFromSeverityWeighted(
    diff.removedErrors.length,
    0,
    diff.addedErrors.length,
    total,
  );

  return { score, details };
}

function gradeFromScore(score: number): CompatibilityScore['grade'] {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 55) return 'C';
  if (score >= 30) return 'D';
  return 'F';
}

export function computeCompatibilityScore(
  abiDiff: ABIDiffResult,
  bytecodeDiff: BytecodeDiffResult,
): CompatibilityScore {
  const fn = functionCompatScore(abiDiff);
  const ev = eventCompatScore(abiDiff);
  const st = storageCompatScore(abiDiff);
  const er = errorCompatScore(abiDiff);
  const bytecodeSimilarity = Math.round(bytecodeDiff.similarityScore * 100);

  const overall = Math.round(
    fn.score * 0.35 +
      ev.score * 0.15 +
      st.score * 0.25 +
      er.score * 0.1 +
      bytecodeSimilarity * 0.15,
  );

  const allDetails = [...fn.details, ...ev.details, ...st.details, ...er.details];

  return {
    overall,
    functionCompat: fn.score,
    eventCompat: ev.score,
    storageCompat: st.score,
    errorCompat: er.score,
    bytecodeSimilarity,
    grade: gradeFromScore(overall),
    details: allDetails,
  };
}
