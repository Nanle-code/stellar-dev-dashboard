/**
 * Schedule Manager Component
 * Manages scheduled export jobs
 */

import React, { useState, useCallback } from 'react';
import './ScheduleManager.css';

interface ScheduleManagerProps {
  jobs: any[];
  onAddJob: (name: string, format: string, schedule: any) => void;
  onUpdateJob: (jobId: string, updates: any) => void;
  onRemoveJob: (jobId: string) => void;
  history?: any[];
}

export function ScheduleManager({
  jobs = [],
  onAddJob,
  onUpdateJob,
  onRemoveJob,
  history = [],
}: ScheduleManagerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    format: 'json',
    cronExpression: '0 0 * * *', // Daily
  });

  const handleFormChange = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleAddJob = useCallback(() => {
    if (!formData.name.trim()) {
      alert('Please enter a job name');
      return;
    }

    onAddJob(formData.name, formData.format, {
      expression: formData.cronExpression,
    });

    setFormData({ name: '', format: 'json', cronExpression: '0 0 * * *' });
    setShowForm(false);
  }, [formData, onAddJob]);

  const getNextRunTime = (job) => {
    if (!job.nextRun) return 'Never';
    return new Date(job.nextRun).toLocaleString();
  };

  const getLastRunTime = (job) => {
    if (!job.lastRun) return 'Never';
    return new Date(job.lastRun).toLocaleString();
  };

  const getJobStatus = (job) => {
    switch (job.status) {
      case 'running':
        return '⏳ Running';
      case 'completed':
        return '✓ Completed';
      case 'failed':
        return '✗ Failed';
      default:
        return '⊙ Idle';
    }
  };

  return (
    <div className="schedule-manager">
      <div className="schedule-header">
        <h3>Scheduled Exports</h3>
        <button
          className="schedule-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? '−' : '+'}
        </button>
      </div>

      {isExpanded && (
        <>
          {/* Add Job Form */}
          {!showForm && (
            <div className="schedule-add-button-container">
              <button
                className="schedule-add-button"
                onClick={() => setShowForm(true)}
              >
                + New Scheduled Job
              </button>
            </div>
          )}

          {showForm && (
            <div className="schedule-form">
              <div className="schedule-form-group">
                <label htmlFor="job-name">Job Name</label>
                <input
                  id="job-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  placeholder="e.g., Daily Portfolio Export"
                />
              </div>

              <div className="schedule-form-group">
                <label htmlFor="job-format">Format</label>
                <select
                  id="job-format"
                  value={formData.format}
                  onChange={(e) => handleFormChange('format', e.target.value)}
                >
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                  <option value="xml">XML</option>
                  <option value="parquet">Parquet</option>
                  <option value="pdf">PDF</option>
                </select>
              </div>

              <div className="schedule-form-group">
                <label htmlFor="cron-expr">Cron Expression</label>
                <input
                  id="cron-expr"
                  type="text"
                  value={formData.cronExpression}
                  onChange={(e) =>
                    handleFormChange('cronExpression', e.target.value)
                  }
                  placeholder="0 0 * * * (daily at midnight)"
                />
                <small>
                  Format: minute hour day month dayOfWeek
                </small>
              </div>

              <div className="schedule-form-presets">
                <strong>Quick presets:</strong>
                <button
                  className="preset-button"
                  onClick={() => handleFormChange('cronExpression', '0 0 * * *')}
                >
                  Daily
                </button>
                <button
                  className="preset-button"
                  onClick={() => handleFormChange('cronExpression', '0 0 * * 0')}
                >
                  Weekly
                </button>
                <button
                  className="preset-button"
                  onClick={() => handleFormChange('cronExpression', '0 0 1 * *')}
                >
                  Monthly
                </button>
                <button
                  className="preset-button"
                  onClick={() => handleFormChange('cronExpression', '*/15 * * * *')}
                >
                  Every 15min
                </button>
              </div>

              <div className="schedule-form-buttons">
                <button
                  className="form-button-cancel"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
                <button
                  className="form-button-save"
                  onClick={handleAddJob}
                >
                  Create Job
                </button>
              </div>
            </div>
          )}

          {/* Jobs List */}
          {jobs.length > 0 && (
            <div className="schedule-jobs">
              <label>Active Jobs:</label>
              {jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onUpdate={(updates) => onUpdateJob(job.id, updates)}
                  onRemove={() => onRemoveJob(job.id)}
                  getNextRunTime={getNextRunTime}
                  getLastRunTime={getLastRunTime}
                  getJobStatus={getJobStatus}
                />
              ))}
            </div>
          )}

          {jobs.length === 0 && !showForm && (
            <div className="schedule-empty">
              <p>No scheduled jobs</p>
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className="schedule-history">
              <label>Recent Exports:</label>
              <div className="history-items">
                {history.slice(0, 5).map((item) => (
                  <div key={item.id} className="history-item">
                    <span className={`history-status ${item.status}`}>
                      {item.status === 'success' ? '✓' : '✗'}
                    </span>
                    <span className="history-filename">{item.filename}</span>
                    <span className="history-time">
                      {new Date(item.exportedAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function JobCard({
  job,
  onUpdate,
  onRemove,
  getNextRunTime,
  getLastRunTime,
  getJobStatus,
}) {
  return (
    <div className={`job-card job-${job.status}`}>
      <div className="job-header">
        <div className="job-title">
          <strong>{job.name}</strong>
          <span className="job-format">{job.format.toUpperCase()}</span>
        </div>
        <span className="job-status">{getJobStatus(job)}</span>
      </div>

      <div className="job-details">
        <div className="job-detail-row">
          <span className="job-label">Schedule:</span>
          <code>{job.schedule?.expression || 'N/A'}</code>
        </div>
        <div className="job-detail-row">
          <span className="job-label">Next Run:</span>
          <span>{getNextRunTime(job)}</span>
        </div>
        <div className="job-detail-row">
          <span className="job-label">Last Run:</span>
          <span>{getLastRunTime(job)}</span>
        </div>
      </div>

      <div className="job-actions">
        <label className="job-toggle">
          <input
            type="checkbox"
            checked={job.enabled}
            onChange={(e) => onUpdate({ enabled: e.target.checked })}
          />
          Enabled
        </label>
        <button
          className="job-remove-button"
          onClick={onRemove}
          title="Delete job"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
