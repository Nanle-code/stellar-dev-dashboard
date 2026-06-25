/**
 * Transformation Builder Component
 * Allows users to create and manage data transformation rules
 */

import React, { useState, useCallback } from 'react';
import './TransformationBuilder.css';

interface TransformationBuilderProps {
  transformations: any[];
  templates?: any[];
  onAddRule: (rule: any) => void;
  onRemoveRule: (ruleId: string) => void;
  onApplyTemplate: (template: any) => void;
}

export function TransformationBuilder({
  transformations = [],
  templates = [],
  onAddRule,
  onRemoveRule,
  onApplyTemplate,
}: TransformationBuilderProps) {
  const [selectedType, setSelectedType] = useState('filter');
  const [isExpanded, setIsExpanded] = useState(false);

  const handleAddRule = useCallback(() => {
    const newRule = {
      id: `rule_${Date.now()}`,
      name: `New ${selectedType} rule`,
      type: selectedType,
      config: getDefaultConfig(selectedType),
      order: transformations.length,
      enabled: true,
    };

    onAddRule(newRule);
  }, [selectedType, transformations.length, onAddRule]);

  return (
    <div className="transformation-builder">
      <div className="transformation-header">
        <h3>Data Transformations</h3>
        <button
          className="transformation-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? '−' : '+'}
        </button>
      </div>

      {isExpanded && (
        <>
          {/* Templates Section */}
          {templates.length > 0 && (
            <div className="transformation-templates">
              <label>Quick Templates:</label>
              <div className="template-buttons">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    className="template-button"
                    onClick={() => onApplyTemplate(template)}
                    title={template.description}
                  >
                    {template.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Add Rule Section */}
          <div className="transformation-add-rule">
            <label htmlFor="rule-type">Rule Type:</label>
            <select
              id="rule-type"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="filter">Filter</option>
              <option value="map">Map/Rename</option>
              <option value="aggregate">Aggregate</option>
              <option value="custom">Custom</option>
            </select>
            <button
              className="add-rule-button"
              onClick={handleAddRule}
            >
              Add Rule
            </button>
          </div>

          {/* Applied Rules */}
          {transformations.length > 0 && (
            <div className="transformation-rules">
              <label>Applied Rules:</label>
              {transformations.map((rule) => (
                <RuleItem
                  key={rule.id}
                  rule={rule}
                  onRemove={() => onRemoveRule(rule.id)}
                />
              ))}
            </div>
          )}

          {transformations.length === 0 && (
            <div className="transformation-empty">
              <p>No transformations applied</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RuleItem({ rule, onRemove }) {
  const getRuleDescription = (rule) => {
    switch (rule.type) {
      case 'filter':
        return `${rule.config.field} ${rule.config.operator} ${rule.config.value}`;
      case 'map':
        return rule.config.operations?.length
          ? `${rule.config.operations.length} operations`
          : 'Map rule';
      case 'aggregate':
        return `Group by ${rule.config.groupBy?.join(', ') || 'N/A'}`;
      case 'custom':
        return 'Custom function';
      default:
        return rule.type;
    }
  };

  return (
    <div className="rule-item">
      <div className="rule-info">
        <strong>{rule.name}</strong>
        <small>{getRuleDescription(rule)}</small>
      </div>
      <button
        className="rule-remove-button"
        onClick={onRemove}
        title="Remove rule"
      >
        ×
      </button>
    </div>
  );
}

function getDefaultConfig(type) {
  switch (type) {
    case 'filter':
      return { field: '', operator: 'equals', value: '' };
    case 'map':
      return { operations: [] };
    case 'aggregate':
      return { groupBy: [], aggregations: [] };
    case 'custom':
      return { functionBody: 'return row;' };
    default:
      return {};
  }
}
