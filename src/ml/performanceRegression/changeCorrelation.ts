/**
 * Performance Regression Detection — Change Impact Correlation
 * 
 * Correlates detected performance regressions with recent code changes by
 * querying git commit history. Used to provide context in regression warnings.
 * 
 * Implementation:
 *   - Executes `git log` via child_process to retrieve recent commits
 *   - Filters commits within a configurable time window (default: 7 days)
 *   - Sanitizes commit author information to avoid PII leakage
 *   - Returns structured commit data for inclusion in warning payloads
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

const DEFAULT_LOOKBACK_DAYS = 7;
const MAX_COMMITS = 20;

/**
 * Sanitize commit author information to avoid PII in CI logs.
 * Truncates email domain and masks full email addresses.
 * 
 * @param {string} author - Git author string (e.g., "John Doe <john@example.com>")
 * @returns {string} Sanitized author string
 */
export function sanitizeAuthor(author) {
  if (!author) return 'Unknown';
  
  // Extract name and email
  const match = author.match(/^(.+?)\s*<(.+?)>$/);
  if (!match) return author;
  
  const [, name, email] = match;
  
  // Mask email domain for privacy
  const emailParts = email.split('@');
  if (emailParts.length === 2) {
    const [localPart] = emailParts;
    // Only show first 3 chars of local part
    const masked = localPart.slice(0, 3) + '***@***';
    return `${name} <${masked}>`;
  }
  
  return name;
}

/**
 * Query git log for recent commits within a time window.
 * 
 * @param {object} [options={}] - Query options
 * @param {number} [options.lookbackDays=7] - Number of days to look back
 * @param {number} [options.maxCommits=20] - Maximum commits to return
 * @param {string} [options.cwd] - Working directory (defaults to process.cwd())
 * @returns {Promise<Array<{ hash: string, author: string, timestamp: number, message: string }>>}
 */
export async function getRecentCommits(options = {}) {
  const {
    lookbackDays = DEFAULT_LOOKBACK_DAYS,
    maxCommits = MAX_COMMITS,
    cwd = process.cwd(),
  } = options;
  
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
  
  // Git log format: hash|author|timestamp|subject
  const gitCommand = [
    'git log',
    `--since="${since}"`,
    `--max-count=${maxCommits}`,
    '--pretty=format:%H|%an <%ae>|%at|%s',
  ].join(' ');
  
  try {
    const { stdout, stderr } = await execAsync(gitCommand, { cwd, timeout: 5000 });
    
    if (stderr) {
      console.warn('Git log stderr:', stderr);
    }
    
    if (!stdout.trim()) {
      return [];
    }
    
    const commits = stdout
      .trim()
      .split('\n')
      .map(line => {
        const [hash, author, timestamp, message] = line.split('|');
        return {
          hash: hash?.trim() || '',
          author: sanitizeAuthor(author?.trim() || ''),
          timestamp: parseInt(timestamp, 10) * 1000, // Convert to ms
          message: message?.trim() || '',
        };
      })
      .filter(commit => commit.hash && commit.timestamp);
    
    return commits;
  } catch (error) {
    console.error('Failed to query git log:', error.message);
    return [];
  }
}

/**
 * Correlate a regression with recent commits.
 * Filters commits that occurred before the regression was detected.
 * 
 * @param {object} regression - Regression object with timestamp
 * @param {object} [options={}] - Correlation options
 * @returns {Promise<Array<object>>} Relevant commits
 */
export async function correlateWithCommits(regression, options = {}) {
  const commits = await getRecentCommits(options);
  
  if (!commits.length) {
    return [];
  }
  
  // Filter commits that occurred before regression detection
  const regressionTime = regression.timestamp || Date.now();
  const relevantCommits = commits.filter(commit => commit.timestamp <= regressionTime);
  
  return relevantCommits;
}

/**
 * Format commits for inclusion in warning payloads or CI output.
 * 
 * @param {Array<object>} commits - Array of commit objects
 * @param {number} [maxLength=5] - Maximum commits to include
 * @returns {string} Formatted commit summary
 */
export function formatCommitSummary(commits, maxLength = 5) {
  if (!commits.length) {
    return 'No recent commits found.';
  }
  
  const limited = commits.slice(0, maxLength);
  const lines = limited.map(commit => {
    const date = new Date(commit.timestamp).toISOString().split('T')[0];
    return `- ${commit.hash.slice(0, 8)} (${date}) ${commit.message.slice(0, 60)}`;
  });
  
  if (commits.length > maxLength) {
    lines.push(`... and ${commits.length - maxLength} more commits`);
  }
  
  return lines.join('\n');
}

export { DEFAULT_LOOKBACK_DAYS, MAX_COMMITS };
