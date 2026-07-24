/**
 * Error Explanation Panel Component
 * Displays AI-powered error explanations with user feedback capabilities
 */

import React, { useState, useEffect } from 'react';
import {
  explainErrorWithAI,
  getQuickExplanation,
  recordErrorFeedback,
  searchErrors,
  type EnhancedErrorDetails,
  type ErrorExplanationOptions
} from '../../lib/errorExplanation/errorExplanationIntegration';

interface ErrorExplanationPanelProps {
  error: unknown;
  options?: ErrorExplanationOptions;
  onClose?: () => void;
}

export default function ErrorExplanationPanel({ error, options, onClose }: ErrorExplanationPanelProps) {
  const [errorDetails, setErrorDetails] = useState<EnhancedErrorDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showTechnical, setShowTechnical] = useState(false);

  useEffect(() => {
    loadErrorExplanation();
  }, [error, options]);

  const loadErrorExplanation = async () => {
    setLoading(true);
    try {
      const details = await explainErrorWithAI(error, options);
      setErrorDetails(details);
    } catch (err) {
      console.error('Failed to load error explanation:', err);
      // Fallback to quick explanation
      const quick = getQuickExplanation(error);
      setErrorDetails({
        originalError: error,
        errorMessage: quick.message,
        category: 'unknown' as any,
        explanation: null,
        suggestionResult: null,
        context: {
          errorCode: 'unknown',
          operation: options?.operation || 'unknown',
          component: options?.component || 'global',
          userAction: options?.userAction || 'unknown',
          timestamp: Date.now(),
          previousErrors: [],
          accountState: options?.accountState,
          networkState: options?.networkState
        },
        timestamp: new Date().toISOString()
      } as any);
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = (helpful: boolean, rating: number, suggestionUsed: string) => {
    const errorId = errorDetails?.context.errorCode || 'unknown';
    recordErrorFeedback(errorId, helpful, rating, suggestionUsed);
    setFeedbackGiven(true);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.length > 2) {
      const results = searchErrors(query);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Analyzing error...</span>
        </div>
      </div>
    );
  }

  const quickExplanation = errorDetails ? getQuickExplanation(errorDetails.originalError) : null;
  const suggestionResult = errorDetails?.suggestionResult;
  const explanation = errorDetails?.explanation;

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mr-3">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-white font-semibold text-lg">Error Explanation</h3>
            <p className="text-blue-100 text-sm">{quickExplanation?.title || 'Unknown Error'}</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="p-6">
        {/* Error Code Badge */}
        <div className="mb-4">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
            Code: {errorDetails?.context.errorCode || 'unknown'}
          </span>
          <span className="ml-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
            Category: {errorDetails?.category || 'unknown'}
          </span>
        </div>

        {/* Plain Language Explanation */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">What happened?</h4>
          <p className="text-gray-600 leading-relaxed">
            {quickExplanation?.message || explanation?.plainExplanation || 'An error occurred.'}
          </p>
        </div>

        {/* AI-Enhanced Suggestions */}
        {suggestionResult && (
          <div className="mb-6 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 border border-purple-100">
            <div className="flex items-center mb-3">
              <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center mr-2">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h4 className="text-sm font-semibold text-purple-900">AI-Powered Suggestions</h4>
              <span className="ml-auto text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded-full">
                {(suggestionResult.confidence * 100).toFixed(0)}% confidence
              </span>
            </div>
            
            <ul className="space-y-2">
              {suggestionResult.contextAwareSuggestions.map((suggestion, index) => (
                <li key={index} className="flex items-start text-sm text-gray-700">
                  <span className="text-purple-600 mr-2">•</span>
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
              <span>Priority: <span className={`font-medium ${
                suggestionResult.priority === 'high' ? 'text-red-600' :
                suggestionResult.priority === 'medium' ? 'text-yellow-600' :
                'text-green-600'
              }`}>{suggestionResult.priority}</span></span>
              <span>Est. resolution: ~{suggestionResult.estimatedResolutionTime} min</span>
            </div>
          </div>
        )}

        {/* Standard Suggestions */}
        {!suggestionResult && quickExplanation?.suggestions && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Suggested Solutions</h4>
            <ul className="space-y-2">
              {quickExplanation.suggestions.map((suggestion, index) => (
                <li key={index} className="flex items-start text-sm text-gray-600">
                  <span className="text-blue-600 mr-2">•</span>
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Technical Details Toggle */}
        <div className="mb-6">
          <button
            onClick={() => setShowTechnical(!showTechnical)}
            className="flex items-center text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            <svg
              className={`w-4 h-4 mr-1 transition-transform ${showTechnical ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {showTechnical ? 'Hide' : 'Show'} Technical Details
          </button>
          
          {showTechnical && (
            <div className="mt-3 bg-gray-50 rounded-lg p-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-medium text-gray-700">Error Code:</span>
                  <span className="ml-2 text-gray-600">{errorDetails?.context.errorCode || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Category:</span>
                  <span className="ml-2 text-gray-600">{errorDetails?.category || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Operation:</span>
                  <span className="ml-2 text-gray-600">{errorDetails?.context.operation || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Component:</span>
                  <span className="ml-2 text-gray-600">{errorDetails?.context.component || 'N/A'}</span>
                </div>
              </div>
              <div className="mt-3">
                <span className="font-medium text-gray-700">Original Error:</span>
                <pre className="mt-1 text-xs text-gray-600 overflow-x-auto">
                  {errorDetails?.errorMessage || 'N/A'}
                </pre>
              </div>
              {explanation?.technicalDetails && (
                <div className="mt-3">
                  <span className="font-medium text-gray-700">Technical Details:</span>
                  <p className="mt-1 text-xs text-gray-600">{explanation.technicalDetails}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Related Errors */}
        {suggestionResult?.relatedErrors && suggestionResult.relatedErrors.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Related Errors</h4>
            <div className="flex flex-wrap gap-2">
              {suggestionResult.relatedErrors.map((relatedCode, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-700"
                >
                  {relatedCode}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* User Feedback */}
        {!feedbackGiven && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Was this explanation helpful?</h4>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => handleFeedback(true, 5, suggestionResult?.contextAwareSuggestions[0] || '')}
                className="flex items-center px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                </svg>
                Yes, helpful
              </button>
              <button
                onClick={() => handleFeedback(false, 1, '')}
                className="flex items-center px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018c.163 0 .326.02.485.06L17 4m-7 10v5a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                </svg>
                No, not helpful
              </button>
            </div>
          </div>
        )}

        {feedbackGiven && (
          <div className="border-t pt-4">
            <p className="text-sm text-green-600 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Thank you for your feedback!
            </p>
          </div>
        )}

        {/* Search Other Errors */}
        <div className="border-t pt-4 mt-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Search Error Database</h4>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search for error codes or messages..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <svg
              className="w-5 h-5 text-gray-400 absolute right-3 top-2.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          
          {searchResults.length > 0 && (
            <div className="mt-3 max-h-48 overflow-y-auto bg-gray-50 rounded-lg">
              {searchResults.map((result, index) => (
                <div
                  key={index}
                  className="p-3 border-b last:border-b-0 hover:bg-gray-100 cursor-pointer"
                  onClick={() => {
                    setSearchQuery(result.code);
                    setSearchResults([]);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-gray-800">{result.code}</span>
                    <span className="text-xs text-gray-500">{result.category}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{result.title}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
