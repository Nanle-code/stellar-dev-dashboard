/**
 * Validated Input Component - D-027
 * Accessible form input with real-time validation and error display
 */

import React, { useState, useEffect, useCallback } from 'react';

interface ValidatedInputProps {
  name: string;
  label?: string;
  value: string | number;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string | null;
  touched?: boolean;
  type?: 'text' | 'email' | 'url' | 'password' | 'number';
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  autoComplete?: string;
  ariaDescribedBy?: string;
}

export function ValidatedInput({
  name,
  label,
  value,
  onChange,
  onBlur,
  error = null,
  touched = false,
  type = 'text',
  placeholder,
  disabled = false,
  required = false,
  autoComplete,
  ariaDescribedBy,
}: ValidatedInputProps) {
  const [focused, setFocused] = useState(false);
  const showError = touched && error !== null;
  const errorId = `${name}-error`;

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  const handleBlur = useCallback(() => {
    setFocused(false);
    onBlur?.();
  }, [onBlur]);

  const handleFocus = useCallback(() => {
    setFocused(true);
  }, []);

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label 
          htmlFor={name}
          className="text-sm font-medium text-[#e8f4f8]"
        >
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          aria-invalid={showError}
          aria-describedby={showError ? errorId : ariaDescribedBy}
          aria-required={required}
          className={`w-full px-3 py-2 rounded border outline-none transition ${
            showError
              ? 'border-red-500 bg-red-900/10 text-red-400'
              : focused
              ? 'border-[#00e5ff] bg-[#0f1820] text-[#e8f4f8]'
              : 'border-[#1e2d3d] bg-[#0f1820] text-[#e8f4f8]'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
      </div>

      {showError && (
        <div 
          id={errorId}
          role="alert"
          aria-live="polite"
          className="text-sm text-red-400 mt-1"
        >
          {error}
        </div>
      )}
    </div>
  );
}
