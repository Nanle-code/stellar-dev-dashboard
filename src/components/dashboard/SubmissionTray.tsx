import '../../styles/submission-tray.css';

import { useSubmissions, useSubmissionActions } from '../../hooks/useSubmissionTracker';
import {
  submissionTracker,
  type SubmissionRecord,
  type SubmissionStatus,
  type SubmissionTracker as Tracker,
} from '../../lib/submissionTracker';

/**
 * Tray showing the lifecycle of every transaction this session has submitted.
 *
 * The issue asks for a tray that "survives view changes". That works because the
 * state lives in the tracker's module singleton and this component only
 * subscribes — navigating away unmounts the tray, not the submissions.
 *
 * Accessibility notes:
 * - the list is a `status` region with `aria-live="polite"`, so a submission
 *   reaching a terminal state is announced without interrupting the user;
 * - an in-flight item is `aria-busy`, so a screen reader can say it is still
 *   working;
 * - the status is text, not only a colour, so it does not rely on colour alone;
 * - failed and expired items get `role="alert"`, because the error is the thing
 *   the user needs to act on.
 */

const STATUS_TEXT: Record<SubmissionStatus, string> = {
  SUBMITTING: 'Submitting',
  PENDING: 'Pending',
  DUPLICATE: 'Already submitted',
  TRY_AGAIN_LATER: 'Retrying',
  SUCCESS: 'Confirmed',
  FAILED: 'Failed',
  EXPIRED: 'Unconfirmed',
};

function isTerminal(status: SubmissionStatus): boolean {
  return status === 'SUCCESS' || status === 'FAILED' || status === 'EXPIRED';
}

function shortHash(hash: string): string {
  return hash.length <= 12 ? hash : `${hash.slice(0, 8)}…${hash.slice(-4)}`;
}

/**
 * `tracker` is injectable for tests. Production always uses the module
 * singleton, which is what makes the tray survive route changes.
 */
export default function SubmissionTray({ tracker = submissionTracker }: { tracker?: Tracker } = {}) {
  const submissions = useSubmissions(tracker);
  const { clearTerminal } = useSubmissionActions(tracker);

  if (submissions.length === 0) return null;

  const finished = submissions.filter((record) => isTerminal(record.status)).length;

  return (
    <aside className="submission-tray" aria-label="Transaction submissions">
      <div className="submission-tray__header">
        <span className="submission-tray__title">
          Submissions{submissions.length > finished ? ` (${submissions.length - finished} pending)` : ''}
        </span>
        {finished > 0 && (
          <button type="button" className="submission-tray__clear" onClick={clearTerminal}>
            Clear {finished} finished
          </button>
        )}
      </div>

      {/* Polite live region: announces progress without stealing focus. */}
      <ul className="submission-tray__list" aria-live="polite" aria-relevant="additions text">
        {submissions.map((record) => (
          <SubmissionRow key={record.id} record={record} />
        ))}
      </ul>
    </aside>
  );
}

function SubmissionRow({ record }: { record: SubmissionRecord }) {
  const terminal = isTerminal(record.status);
  const failed = record.status === 'FAILED' || record.status === 'EXPIRED';

  return (
    <li
      className={`submission-tray__item submission-tray__item--${record.status}`}
      aria-busy={!terminal}
      // A failure is the one state that needs to interrupt, because it carries
      // an action the user has to take.
      role={failed ? 'alert' : undefined}
    >
      <div className="submission-tray__row">
        <span className="submission-tray__label">{record.label}</span>
        <span className="submission-tray__status">{STATUS_TEXT[record.status]}</span>
      </div>

      {record.hash && <div className="submission-tray__hash">{shortHash(record.hash)}</div>}

      {record.error && (
        <>
          <div className="submission-tray__error">{record.error.message}</div>
          {record.error.suggestion && <div className="submission-tray__suggestion">{record.error.suggestion}</div>}
        </>
      )}
    </li>
  );
}
