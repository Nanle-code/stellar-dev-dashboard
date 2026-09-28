/**
 * D-028 — ValidatedInput component stories.
 *
 * Covers all visual and interaction states documented in D-027:
 * default, focused, error, touched-with-error, disabled, required,
 * and a form-composition example.
 */
import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ValidatedInput } from '../src/components/validation/ValidatedInput';

const meta: Meta<typeof ValidatedInput> = {
  title: 'Forms/ValidatedInput',
  component: ValidatedInput,
  parameters: {
    docs: {
      description: {
        component:
          'Accessible form input with real-time validation. Shows error messages only after the field has been touched (blurred), preventing premature validation feedback.',
      },
    },
  },
  argTypes: {
    type: {
      control: { type: 'select' },
      options: ['text', 'email', 'url', 'password', 'number'],
      description: 'HTML input type',
    },
    disabled: { control: 'boolean', description: 'Disables the input' },
    required: { control: 'boolean', description: 'Marks the field as required' },
    error: { control: 'text', description: 'Validation error message' },
    touched: { control: 'boolean', description: 'Whether the field has been interacted with' },
    label: { control: 'text' },
    placeholder: { control: 'text' },
  },
};
export default meta;
type Story = StoryObj<typeof ValidatedInput>;

// ─── Controlled wrapper ───────────────────────────────────────────────────────

const Controlled = ({
  initialValue = '',
  error,
  type = 'text',
  label,
  placeholder,
  required,
  disabled,
}: {
  initialValue?: string;
  error?: string | null;
  type?: 'text' | 'email' | 'url' | 'password' | 'number';
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}) => {
  const [value, setValue] = useState(initialValue);
  const [touched, setTouched] = useState(false);
  return (
    <div style={{ maxWidth: '360px' }}>
      <ValidatedInput
        name="demo"
        value={value}
        onChange={setValue}
        onBlur={() => setTouched(true)}
        touched={touched}
        error={error ?? null}
        type={type}
        label={label}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
      />
    </div>
  );
};

// ─── Stories ──────────────────────────────────────────────────────────────────

export const Default: Story = {
  render: () => <Controlled label="Destination Account" placeholder="G..." />,
  parameters: {
    docs: { description: { story: 'Default idle state — no error, not yet touched.' } },
  },
};

export const WithLabel: Story = {
  render: () => <Controlled label="Webhook URL" placeholder="https://example.com/hook" type="url" />,
  parameters: {
    docs: { description: { story: 'Text input with a visible label.' } },
  },
};

export const RequiredField: Story = {
  render: () => <Controlled label="Destination Address" placeholder="G..." required />,
  parameters: {
    docs: { description: { story: 'Required fields render a red asterisk next to the label.' } },
  },
};

export const WithValidationError: Story = {
  render: () => {
    const [value, setValue] = useState('not-a-key');
    return (
      <div style={{ maxWidth: '360px' }}>
        <ValidatedInput
          name="address"
          label="Destination Address"
          value={value}
          onChange={setValue}
          onBlur={() => {}}
          touched={true}
          error="Must be a valid Stellar public key starting with G"
          placeholder="G..."
          required
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Error state after field is touched. The error message is announced via `aria-live="polite"` and the input gets `aria-invalid="true"`.',
      },
    },
  },
};

export const NoErrorWhenUntouched: Story = {
  render: () => {
    const [value, setValue] = useState('');
    return (
      <div style={{ maxWidth: '360px' }}>
        <ValidatedInput
          name="address"
          label="Destination Address"
          value={value}
          onChange={setValue}
          touched={false}
          error="This field is required"
          placeholder="G..."
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Error exists in state but `touched=false` — error is suppressed until the user blurs. Prevents premature red states on load.',
      },
    },
  },
};

export const DisabledState: Story = {
  render: () => <Controlled label="Public Key" initialValue="GABC...XYZ" disabled />,
  parameters: {
    docs: { description: { story: 'Disabled input — reduced opacity and `not-allowed` cursor.' } },
  },
};

export const EmailInput: Story = {
  render: () => {
    const [value, setValue] = useState('bad-email');
    return (
      <div style={{ maxWidth: '360px' }}>
        <ValidatedInput
          name="email"
          label="Alert Email"
          value={value}
          onChange={setValue}
          touched={true}
          error="Enter a valid email address"
          type="email"
          placeholder="you@example.com"
        />
      </div>
    );
  },
};

export const PasswordInput: Story = {
  render: () => <Controlled label="Secret Key" placeholder="S..." type="password" />,
  parameters: {
    docs: { description: { story: 'Password type — value is masked.' } },
  },
};

export const FormComposition: Story = {
  name: 'Form Composition',
  render: () => {
    const [destination, setDestination] = useState('');
    const [amount, setAmount] = useState('');
    const [destinationTouched, setDestinationTouched] = useState(false);
    const [amountTouched, setAmountTouched] = useState(false);

    const destinationError =
      destination && !/^G[A-Z2-7]{55}$/.test(destination)
        ? 'Must be a valid Stellar public key (starts with G, 56 chars)'
        : null;

    const amountError =
      amount && (isNaN(Number(amount)) || Number(amount) <= 0)
        ? 'Amount must be a positive number'
        : null;

    const canSubmit = !destinationError && !amountError && destination && amount;

    return (
      <div
        style={{
          maxWidth: '400px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '16px',
            marginBottom: '4px',
          }}
        >
          Send Payment
        </div>

        <ValidatedInput
          name="destination"
          label="Destination Address"
          value={destination}
          onChange={setDestination}
          onBlur={() => setDestinationTouched(true)}
          touched={destinationTouched}
          error={destinationError}
          placeholder="G..."
          required
        />

        <ValidatedInput
          name="amount"
          label="Amount (XLM)"
          value={amount}
          onChange={setAmount}
          onBlur={() => setAmountTouched(true)}
          touched={amountTouched}
          error={amountError}
          type="number"
          placeholder="0.00"
          required
        />

        <button
          type="button"
          disabled={!canSubmit}
          style={{
            padding: '10px',
            background: canSubmit ? 'var(--cyan)' : 'var(--bg-elevated)',
            color: canSubmit ? 'var(--bg-base)' : 'var(--text-muted)',
            border: 'none',
            borderRadius: '8px',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            fontWeight: 700,
            fontSize: '13px',
            transition: 'background 180ms ease',
          }}
        >
          Send
        </button>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Composing multiple ValidatedInput fields in a form. Validation runs on blur; errors are cleared as the user types a valid value.',
      },
    },
  },
};

export const MobileViewport: Story = {
  render: () => <FormComposition.render />,
  parameters: {
    viewport: { defaultViewport: 'mobile375' },
    docs: { description: { story: 'Form at mobile viewport.' } },
  },
};
