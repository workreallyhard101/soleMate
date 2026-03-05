import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-secondary">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`
            bg-elevated border rounded-lg px-4 py-2.5 text-primary text-sm
            placeholder:text-muted
            focus:outline-none focus:ring-2 focus:border-transparent
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors
            ${error ? 'border-red-500' : 'border-strong hover:border-strong/80'}
            ${className}
          `}
          style={{ '--tw-ring-color': 'var(--color-accent-raw)' } as React.CSSProperties}
          {...props}
        />
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
