import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string | undefined;
  helperText?: string | undefined;
  error?: string | undefined;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, helperText, id, label, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    const helperTextId = `${inputId}-description`;
    const descriptionIds = [
      helperText ? helperTextId : null,
      error ? errorId : null,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className="grid gap-2">
        {label ? (
          <label className="text-sm font-medium leading-none" htmlFor={inputId}>
            {label}
          </label>
        ) : null}
        <input
          {...props}
          aria-describedby={
            [props['aria-describedby'], descriptionIds].filter(Boolean).join(' ') || undefined
          }
          aria-invalid={error ? true : props['aria-invalid']}
          className={cn(
            'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            error ? 'border-destructive' : '',
            className,
          )}
          id={inputId}
          ref={ref}
        />
        {helperText ? (
          <p className="text-sm leading-5 text-muted-foreground" id={helperTextId}>
            {helperText}
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-destructive" id={errorId} role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = 'Input';

export { Input };
