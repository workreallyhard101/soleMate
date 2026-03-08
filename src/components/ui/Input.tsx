import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  showPasswordToggle?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', type, showPasswordToggle, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    const isPassword = type === 'password';
    const canToggle = isPassword && showPasswordToggle;
    const inputType = canToggle && visible ? 'text' : type;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-secondary">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            type={inputType}
            className={`
              w-full bg-elevated border rounded-lg px-4 py-2.5 text-primary text-sm
              placeholder:text-muted
              focus:outline-none focus:ring-2 focus:border-transparent
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors
              ${error ? 'border-red-500' : 'border-strong hover:border-strong/80'}
              ${canToggle ? 'pr-10' : ''}
              ${className}
            `}
            style={{ '--tw-ring-color': 'var(--color-accent-raw)' } as React.CSSProperties}
            {...props}
          />
          {canToggle && (
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted hover:text-primary hover:bg-white/5 transition-colors"
              tabIndex={-1}
              aria-label={visible ? 'Hide password' : 'Show password'}
            >
              {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-secondary">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={`
            bg-elevated border rounded-lg px-4 py-2.5 text-primary text-sm
            placeholder:text-muted
            focus:outline-none focus:ring-2 focus:border-transparent
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors resize-none
            ${error ? 'border-red-500' : 'border-strong hover:border-strong/80'}
            ${className}
          `}
          style={{ '--tw-ring-color': 'var(--color-accent-raw)' } as React.CSSProperties}
          {...props}
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
