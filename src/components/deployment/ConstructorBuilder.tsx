import React, { useMemo, useState } from 'react';

const ARGUMENT_TYPES = [
  { value: 'string', label: 'String' },
  { value: 'int', label: 'Integer' },
  { value: 'bool', label: 'Boolean' },
  { value: 'address', label: 'Address' },
  { value: 'bytes', label: 'Bytes (hex)' },
];

const DEFAULT_ARGUMENT = { name: '', type: 'string', value: '' };

function validateArg(arg) {
  if (!arg) {
    return 'Argument is missing';
  }

  const value = String(arg.value ?? '').trim();
  if (!value) {
    return 'Value cannot be empty';
  }

  switch (arg.type) {
    case 'int':
      return /^-?\d+$/.test(value) ? null : 'Enter a whole number';
    case 'bool':
      return /^(true|false|0|1)$/i.test(value) ? null : 'Use true or false';
    case 'address':
      return /^[GC][A-Z0-9]{20,}$/i.test(value) ? null : 'Enter a valid Stellar account or contract address';
    case 'bytes':
      return /^(0x)?[0-9a-f]+$/i.test(value) ? null : 'Enter a hex string such as 0xabc123';
    default:
      return null;
  }
}

export default function ConstructorBuilder({ args = [], setArgs, onError }) {
  const [localErrors, setLocalErrors] = useState({});

  const hasArgs = args.length > 0;

  const errorMessage = useMemo(() => {
    const firstError = Object.values(localErrors).find(Boolean);
    return firstError || null;
  }, [localErrors]);

  const syncValidation = (nextArgs) => {
    const errors = {};
    nextArgs.forEach((arg, index) => {
      const validationError = validateArg(arg);
      if (validationError) {
        errors[index] = validationError;
      }
    });
    setLocalErrors(errors);
    onError?.(Object.values(errors)[0] || null);
  };

  const handleArgChange = (index, field, value) => {
    const nextArgs = args.map((arg, argIndex) => (
      argIndex === index ? { ...arg, [field]: value } : arg
    ));
    setArgs(nextArgs);
    syncValidation(nextArgs);
  };

  const addArgument = () => {
    const nextArgs = [...args, { ...DEFAULT_ARGUMENT }];
    setArgs(nextArgs);
    syncValidation(nextArgs);
  };

  const removeArgument = (index) => {
    const nextArgs = args.filter((_, argIndex) => argIndex !== index);
    setArgs(nextArgs);
    syncValidation(nextArgs);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              fontWeight: 600,
            }}
          >
            Constructor Parameters
          </div>
          <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            Add only the arguments your contract constructor expects. Zero-argument constructors are supported.
          </div>
        </div>
        <button
          type="button"
          onClick={addArgument}
          style={{
            padding: '8px 12px',
            fontSize: '11px',
            fontWeight: 700,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-bright)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            transition: 'var(--transition)',
            whiteSpace: 'nowrap',
          }}
        >
          + Add Parameter
        </button>
      </div>

      {!hasArgs ? (
        <div
          style={{
            padding: '22px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '12px',
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
          }}
        >
          No constructor parameters added. Leave this empty if the contract constructor takes no arguments.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {args.map((arg, index) => (
            <div
              key={index}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 140px 1.5fr auto',
                gap: '10px',
                alignItems: 'flex-start',
                padding: '14px',
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${localErrors[index] ? 'var(--red)' : 'var(--border)'}`,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Name
                </label>
                <input
                  value={arg.name || ''}
                  onChange={(e) => handleArgChange(index, 'name', e.target.value)}
                  placeholder="Optional label"
                  style={{
                    padding: '9px 10px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-bright)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    outline: 'none',
                    transition: 'var(--transition)',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Type
                </label>
                <select
                  value={arg.type || 'string'}
                  onChange={(e) => handleArgChange(index, 'type', e.target.value)}
                  style={{
                    padding: '9px 10px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-bright)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  {ARGUMENT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Value
                </label>
                <input
                  value={arg.value || ''}
                  onChange={(e) => handleArgChange(index, 'value', e.target.value)}
                  placeholder={
                    arg.type === 'bool'
                      ? 'true or false'
                      : arg.type === 'address'
                        ? 'G... or C...'
                        : arg.type === 'bytes'
                          ? '0x...'
                          : `Enter ${arg.type} value`
                  }
                  style={{
                    padding: '9px 10px',
                    background: 'var(--bg-base)',
                    border: `1px solid ${localErrors[index] ? 'var(--red)' : 'var(--border-bright)'}`,
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    outline: 'none',
                    transition: 'var(--transition)',
                  }}
                />
                {localErrors[index] && (
                  <div style={{ fontSize: '10px', color: 'var(--red)' }}>
                    {localErrors[index]}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => removeArgument(index)}
                style={{
                  padding: '9px 10px',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-bright)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--red)',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 700,
                  alignSelf: 'end',
                  transition: 'var(--transition)',
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {errorMessage && (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(220, 38, 38, 0.08)',
            border: '1px solid rgba(220, 38, 38, 0.3)',
            color: 'var(--red)',
            fontSize: '11px',
            lineHeight: 1.5,
          }}
        >
          {errorMessage}
        </div>
      )}
    </div>
  );
}
