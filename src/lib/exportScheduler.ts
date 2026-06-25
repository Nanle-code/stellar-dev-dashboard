/**
 * Export Scheduling System
 * Cron-based scheduling for periodic data exports
 */

import type { CronSchedule, ExportJob, ExportHistory } from '../types/dataExport';

/**
 * Parse a cron expression
 * Format: minute hour day month dayOfWeek
 * @param {string} expression - Cron expression
 * @returns {Object | null}
 */
export function parseCronExpression(expression) {
  const parts = expression.trim().split(/\s+/);

  if (parts.length !== 5) {
    return null;
  }

  const [minute, hour, day, month, dayOfWeek] = parts;

  return {
    minute: parseCronField(minute, 0, 59),
    hour: parseCronField(hour, 0, 23),
    day: parseCronField(day, 1, 31),
    month: parseCronField(month, 1, 12),
    dayOfWeek: parseCronField(dayOfWeek, 0, 6),
  };
}

/**
 * Parse a single cron field
 * @param {string} field - Field value (number, range, list, or *)
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number[] | null}
 */
function parseCronField(field, min, max) {
  if (field === '*') {
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }

  const values = [];

  // Handle ranges (e.g., "1-5")
  if (field.includes('-')) {
    const [start, end] = field.split('-').map(Number);
    for (let i = start; i <= end; i++) {
      if (i >= min && i <= max) values.push(i);
    }
    return values;
  }

  // Handle lists (e.g., "1,3,5")
  if (field.includes(',')) {
    return field
      .split(',')
      .map(Number)
      .filter((v) => v >= min && v <= max);
  }

  // Handle step values (e.g., "*/15")
  if (field.includes('/')) {
    const [range, step] = field.split('/');
    const stepNum = Number(step);
    let start = min;

    if (range !== '*') {
      start = Number(range);
    }

    for (let i = start; i <= max; i += stepNum) {
      if (i >= min && i <= max) values.push(i);
    }
    return values;
  }

  // Single value
  const num = Number(field);
  if (!isNaN(num) && num >= min && num <= max) {
    return [num];
  }

  return null;
}

/**
 * Check if a date matches a cron expression
 * @param {Date} date - Date to check
 * @param {string} cronExpression - Cron expression
 * @returns {boolean}
 */
export function matchesCronExpression(date, cronExpression) {
  const parsed = parseCronExpression(cronExpression);

  if (!parsed) return false;

  const minute = date.getMinutes();
  const hour = date.getHours();
  const day = date.getDate();
  const month = date.getMonth() + 1; // JS months are 0-11
  const dayOfWeek = date.getDay();

  return (
    parsed.minute.includes(minute) &&
    parsed.hour.includes(hour) &&
    parsed.day.includes(day) &&
    parsed.month.includes(month) &&
    parsed.dayOfWeek.includes(dayOfWeek)
  );
}

/**
 * Calculate the next execution time for a cron schedule
 * @param {CronSchedule} schedule - Cron schedule
 * @param {Date} fromDate - Starting date (default: now)
 * @returns {Date}
 */
export function getNextExecutionTime(schedule, fromDate = new Date()) {
  const { expression, timezone } = schedule;
  let date = new Date(fromDate);

  // Add 1 minute to start checking from the next minute
  date.setMinutes(date.getMinutes() + 1);
  date.setSeconds(0);
  date.setMilliseconds(0);

  // Check next 4 years to find a matching time
  const maxDate = new Date(date);
  maxDate.setFullYear(maxDate.getFullYear() + 4);

  while (date < maxDate) {
    if (matchesCronExpression(date, expression)) {
      return date;
    }
    date.setMinutes(date.getMinutes() + 1);
  }

  // No execution time found in next 4 years
  return null;
}

/**
 * Create an export job
 * @param {string} name - Job name
 * @param {string} format - Export format
 * @param {CronSchedule} schedule - Cron schedule
 * @param {Object} options - Additional options
 * @returns {ExportJob}
 */
export function createExportJob(name, format, schedule, options = {}) {
  const job = {
    id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    format,
    schedule,
    transformations: options.transformations || [],
    createdAt: new Date(),
    enabled: true,
    status: 'idle' as const,
  };

  // Calculate next execution
  if (schedule) {
    job.nextRun = getNextExecutionTime(schedule);
  }

  return job;
}

/**
 * Scheduler class for managing periodic export jobs
 */
export class ExportScheduler {
  private jobs = new Map();
  private timers = new Map();
  private history = [];
  private checkInterval = 60000; // Check every minute

  constructor(checkInterval = 60000) {
    this.checkInterval = checkInterval;
  }

  /**
   * Add a job to the scheduler
   */
  addJob(job) {
    if (!job.schedule) {
      throw new Error('Job must have a schedule');
    }

    this.jobs.set(job.id, job);
    this.scheduleJob(job);

    return job.id;
  }

  /**
   * Remove a job from the scheduler
   */
  removeJob(jobId) {
    const timer = this.timers.get(jobId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(jobId);
    }

    return this.jobs.delete(jobId);
  }

  /**
   * Update a job
   */
  updateJob(jobId, updates) {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    // Remove old timer
    const timer = this.timers.get(jobId);
    if (timer) {
      clearTimeout(timer);
    }

    // Update job
    const updatedJob = { ...job, ...updates };
    this.jobs.set(jobId, updatedJob);

    // Reschedule if needed
    if (updates.schedule || updates.enabled !== undefined) {
      this.scheduleJob(updatedJob);
    }

    return updatedJob;
  }

  /**
   * Get a job by ID
   */
  getJob(jobId) {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs
   */
  getAllJobs() {
    return Array.from(this.jobs.values());
  }

  /**
   * Schedule a job for execution
   */
  private scheduleJob(job) {
    if (!job.enabled || !job.schedule) {
      return;
    }

    const checkAndExecute = () => {
      const now = new Date();

      if (matchesCronExpression(now, job.schedule.expression)) {
        this.executeJob(job);
      }

      // Reschedule check
      const timer = setTimeout(checkAndExecute, this.checkInterval);
      this.timers.set(job.id, timer);
    };

    // Initial check
    const timer = setTimeout(checkAndExecute, this.checkInterval);
    this.timers.set(job.id, timer);
  }

  /**
   * Execute a job
   */
  private async executeJob(job) {
    const jobCopy = { ...job, status: 'running' as const };
    this.jobs.set(job.id, jobCopy);

    const startTime = Date.now();

    try {
      // Emit event for actual export to be handled by consuming code
      this.onJobExecute(jobCopy);

      // Record success
      const duration = Date.now() - startTime;
      this.recordHistory({
        id: `history_${Date.now()}`,
        jobId: job.id,
        filename: `${job.name}_${new Date().toISOString().split('T')[0]}`,
        format: job.format,
        recordCount: 0, // Set by executor
        fileSize: 0, // Set by executor
        exportedAt: new Date(),
        duration,
        status: 'success' as const,
      });

      jobCopy.lastRun = new Date();
      jobCopy.nextRun = getNextExecutionTime(job.schedule);
      jobCopy.status = 'completed' as const;
    } catch (error) {
      // Record failure
      const duration = Date.now() - startTime;
      this.recordHistory({
        id: `history_${Date.now()}`,
        jobId: job.id,
        filename: `${job.name}_${new Date().toISOString().split('T')[0]}`,
        format: job.format,
        recordCount: 0,
        fileSize: 0,
        exportedAt: new Date(),
        duration,
        status: 'failed' as const,
        error: error.message,
      });

      jobCopy.status = 'failed' as const;
      jobCopy.error = error.message;
    }

    this.jobs.set(job.id, jobCopy);
  }

  /**
   * Record export history
   */
  recordHistory(record) {
    this.history.push(record);

    // Keep only last 1000 records
    if (this.history.length > 1000) {
      this.history = this.history.slice(-1000);
    }
  }

  /**
   * Get export history
   */
  getHistory(jobId = null, limit = 100) {
    if (jobId) {
      return this.history.filter((h) => h.jobId === jobId).slice(-limit);
    }

    return this.history.slice(-limit);
  }

  /**
   * Clear history
   */
  clearHistory(jobId = null) {
    if (jobId) {
      this.history = this.history.filter((h) => h.jobId !== jobId);
    } else {
      this.history = [];
    }
  }

  /**
   * Override this to handle job execution
   * In a real app, emit an event or call a handler function
   */
  onJobExecute(job) {
    // To be implemented by consuming code
    console.log('Export job would execute:', job);
  }

  /**
   * Shutdown the scheduler
   */
  shutdown() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.jobs.clear();
  }
}

// Export scheduler instance for singleton usage
let schedulerInstance = null;

export function getExportScheduler() {
  if (!schedulerInstance) {
    schedulerInstance = new ExportScheduler();
  }
  return schedulerInstance;
}

/**
 * Predefined common cron schedules
 */
export const COMMON_SCHEDULES = {
  hourly: { expression: '0 * * * *', timezone: 'UTC' },
  daily: { expression: '0 0 * * *', timezone: 'UTC' },
  weekly: { expression: '0 0 * * 0', timezone: 'UTC' }, // Sunday
  monthly: { expression: '0 0 1 * *', timezone: 'UTC' }, // 1st of month
  everyFifteenMinutes: { expression: '*/15 * * * *', timezone: 'UTC' },
  businessDays: { expression: '0 9 * * 1-5', timezone: 'UTC' }, // 9 AM Mon-Fri
  weekends: { expression: '0 10 * * 0,6', timezone: 'UTC' }, // 10 AM Sat-Sun
};
