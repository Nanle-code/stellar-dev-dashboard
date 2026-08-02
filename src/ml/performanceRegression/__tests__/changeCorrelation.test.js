import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sanitizeAuthor,
  getRecentCommits,
  correlateWithCommits,
  formatCommitSummary,
} from '../changeCorrelation.js';

// Mock child_process
vi.mock('node:child_process', () => ({
  exec: vi.fn(),
}));

vi.mock('node:util', () => ({
  promisify: (fn) => {
    return async (...args) => {
      // Mock implementation returns predefined stdout
      const callback = args[args.length - 1];
      if (typeof callback === 'function') {
        return new Promise((resolve) => {
          fn(...args.slice(0, -1), (error, stdout, stderr) => {
            if (error) resolve({ stdout: '', stderr: error.message });
            else resolve({ stdout: stdout || '', stderr: stderr || '' });
          });
        });
      }
      return fn(...args);
    };
  },
}));

import { exec } from 'node:child_process';

describe('sanitizeAuthor', () => {
  it('masks email domain for privacy', () => {
    const sanitized = sanitizeAuthor('John Doe <john.doe@example.com>');
    
    expect(sanitized).toContain('John Doe');
    expect(sanitized).toContain('joh***@***');
    expect(sanitized).not.toContain('example.com');
  });
  
  it('handles author without email', () => {
    const sanitized = sanitizeAuthor('John Doe');
    
    expect(sanitized).toBe('John Doe');
  });
  
  it('returns Unknown for empty author', () => {
    expect(sanitizeAuthor('')).toBe('Unknown');
    expect(sanitizeAuthor(null)).toBe('Unknown');
  });
  
  it('shows only first 3 chars of email local part', () => {
    const sanitized = sanitizeAuthor('Alice <alice@example.com>');
    
    expect(sanitized).toContain('ali***@***');
  });
});

describe('getRecentCommits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('queries git log with correct parameters', async () => {
    const mockStdout = 'abc123|John Doe <john@example.com>|1640000000|feat: add feature\n';
    
    exec.mockImplementation((cmd, options, callback) => {
      callback(null, mockStdout, '');
    });
    
    const commits = await getRecentCommits({ lookbackDays: 7, maxCommits: 20 });
    
    expect(exec).toHaveBeenCalled();
    const callArgs = exec.mock.calls[0][0];
    expect(callArgs).toContain('git log');
    expect(callArgs).toContain('--max-count=20');
  });
  
  it('parses commit data correctly', async () => {
    const mockStdout = 'abc123|John Doe <john@example.com>|1640000000|feat: add feature\n';
    
    exec.mockImplementation((cmd, options, callback) => {
      callback(null, mockStdout, '');
    });
    
    const commits = await getRecentCommits();
    
    expect(commits).toHaveLength(1);
    expect(commits[0].hash).toBe('abc123');
    expect(commits[0].author).toContain('John Doe');
    expect(commits[0].timestamp).toBe(1640000000000);
    expect(commits[0].message).toBe('feat: add feature');
  });
  
  it('sanitizes author information', async () => {
    const mockStdout = 'abc123|John Doe <john@example.com>|1640000000|feat: add feature\n';
    
    exec.mockImplementation((cmd, options, callback) => {
      callback(null, mockStdout, '');
    });
    
    const commits = await getRecentCommits();
    
    expect(commits[0].author).toContain('joh***@***');
    expect(commits[0].author).not.toContain('example.com');
  });
  
  it('returns empty array on git error', async () => {
    exec.mockImplementation((cmd, options, callback) => {
      callback(new Error('Not a git repository'), '', '');
    });
    
    const commits = await getRecentCommits();
    
    expect(commits).toEqual([]);
  });
  
  it('returns empty array when no commits', async () => {
    exec.mockImplementation((cmd, options, callback) => {
      callback(null, '', '');
    });
    
    const commits = await getRecentCommits();
    
    expect(commits).toEqual([]);
  });
  
  it('filters out malformed commit lines', async () => {
    const mockStdout = [
      'abc123|John Doe <john@example.com>|1640000000|feat: add feature',
      'invalid-line',
      'def456|Alice <alice@example.com>|1640001000|fix: bug fix',
    ].join('\n');
    
    exec.mockImplementation((cmd, options, callback) => {
      callback(null, mockStdout, '');
    });
    
    const commits = await getRecentCommits();
    
    expect(commits).toHaveLength(2);
    expect(commits.map(c => c.hash)).toEqual(['abc123', 'def456']);
  });
});

describe('correlateWithCommits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('returns commits that occurred before regression', async () => {
    const regressionTime = 1640002000000;
    const mockStdout = [
      'abc123|John Doe <john@example.com>|1640000000|feat: add feature',
      'def456|Alice <alice@example.com>|1640001000|fix: bug fix',
      'ghi789|Bob <bob@example.com>|1640003000|chore: update deps', // After regression
    ].join('\n');
    
    exec.mockImplementation((cmd, options, callback) => {
      callback(null, mockStdout, '');
    });
    
    const regression = { timestamp: regressionTime };
    const commits = await correlateWithCommits(regression);
    
    expect(commits).toHaveLength(2);
    expect(commits.map(c => c.hash)).toEqual(['abc123', 'def456']);
  });
  
  it('returns empty array when no relevant commits', async () => {
    exec.mockImplementation((cmd, options, callback) => {
      callback(null, '', '');
    });
    
    const regression = { timestamp: Date.now() };
    const commits = await correlateWithCommits(regression);
    
    expect(commits).toEqual([]);
  });
});

describe('formatCommitSummary', () => {
  const mockCommits = [
    {
      hash: 'abc123def456',
      author: 'John Doe',
      timestamp: new Date('2023-01-01').getTime(),
      message: 'feat: add new feature that improves performance',
    },
    {
      hash: 'def456ghi789',
      author: 'Alice',
      timestamp: new Date('2023-01-02').getTime(),
      message: 'fix: resolve memory leak',
    },
  ];
  
  it('formats commits with hash, date, and truncated message', () => {
    const summary = formatCommitSummary(mockCommits);
    
    expect(summary).toContain('abc123de');
    expect(summary).toContain('2023-01-01');
    expect(summary).toContain('feat: add new feature that improves performance');
  });
  
  it('truncates long commit messages', () => {
    const longMessage = 'a'.repeat(100);
    const commits = [{
      hash: 'abc123',
      timestamp: Date.now(),
      message: longMessage,
    }];
    
    const summary = formatCommitSummary(commits);
    
    expect(summary.length).toBeLessThan(longMessage.length);
  });
  
  it('limits output to maxLength commits', () => {
    const manyCommits = Array.from({ length: 10 }, (_, i) => ({
      hash: `hash${i}`,
      timestamp: Date.now(),
      message: `commit ${i}`,
    }));
    
    const summary = formatCommitSummary(manyCommits, 3);
    
    const lines = summary.split('\n');
    expect(lines).toHaveLength(4); // 3 commits + "... and N more"
    expect(summary).toContain('... and 7 more commits');
  });
  
  it('returns message when no commits', () => {
    const summary = formatCommitSummary([]);
    
    expect(summary).toBe('No recent commits found.');
  });
});
