import { useId, type ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  label: string;
  description?: string | undefined;
  error?: string | undefined;
  htmlFor: string;
  required?: boolean;
  children: (controlProps: FormControlProps) => ReactNode;
  className?: string | undefined;
}

interface FormControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

function FormField({
  children,
  className,
  description,
  error,
  htmlFor,
  label,
  required = false,
}: FormFieldProps) {
  const generatedId = useId();
  const descriptionId = `${generatedId}-description`;
  const errorId = `${generatedId}-error`;
  const describedBy = [
    description ? descriptionId : null,
    error ? errorId : null,
  ]
    .filter(Boolean)
    .join(' ');
  const controlProps: FormControlProps = {
    id: htmlFor,
    ...(describedBy ? { 'aria-describedby': describedBy } : {}),
    ...(error ? { 'aria-invalid': true } : {}),
  };

  return (
    <div className={cn('grid gap-2', className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span aria-hidden="true" className="ml-1 text-destructive">*</span> : null}
      </Label>
      {children(controlProps)}
      {description ? (
        <p className="text-sm leading-5 text-muted-foreground" id={descriptionId}>
          {description}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm leading-5 text-destructive" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export { FormField, type FormControlProps };
