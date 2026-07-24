"""
Automation Suggestion System

This module provides intelligent automation suggestions based on workflow pattern mining.
It analyzes user interaction patterns and suggests automations with user approval workflows.
"""

export interface UserFeedback {
  opportunityId: string
  action: 'approve' | 'deny' | 'modify'
  feedback: string
  customConfig?: any
  timestamp: number
  userId: string
}