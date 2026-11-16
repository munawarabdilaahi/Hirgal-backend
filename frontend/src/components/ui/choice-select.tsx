import { Children, isValidElement, useId, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMarkFormDirty } from '@/components/ui/form-dirty-context';
import { cn } from '@/lib/utils';

interface ChoiceOptionProps {
  value: string | number;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

function ChoiceOption({ children }: ChoiceOptionProps) {
  return children;
}

interface ChoiceSelectProps extends Omit<ComponentProps<typeof SelectTrigger>, 'onChange' | 'value' | 'defaultValue'> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
}

// Radix reserves the empty string for placeholders. Unnamed filters can
// still offer a selectable empty choice.
const emptyChoice = '__hirgal_empty_choice__';

function ChoiceSelect({ children, className, defaultValue, disabled, form, name, onValueChange, required, value, ...triggerProps }: ChoiceSelectProps) {
  const markDirty = useMarkFormDirty();
  const trigger = useRef<HTMLButtonElement>(null);
  const errorId = useId();
  const [invalid, setInvalid] = useState(false);
  const options = Children.toArray(children).flatMap(
    (child) => isValidElement<ChoiceOptionProps>(child) && child.type === ChoiceOption ? [child.props] : [],
  );
  const emptyOption = options.find((option) => option.value === '');
  const hasEmptyChoice = !name && Boolean(emptyOption);
  const encode = (raw: string) => raw === '' && hasEmptyChoice ? emptyChoice : raw;

  return (
    <span className="contents" onInvalidCapture={(event) => {
      event.preventDefault();
      setInvalid(true);
      trigger.current?.focus();
    }}>
      <Select defaultValue={encode(defaultValue ?? String(options[0]?.value ?? ''))}
        disabled={disabled} form={form} name={name} required={required}
        onValueChange={(next) => {
          setInvalid(false);
          markDirty();
          onValueChange?.(next === emptyChoice ? '' : next);
        }}
        value={value === undefined ? undefined : encode(value)}>
        <SelectTrigger className={cn('min-w-0', invalid && 'border-destructive', className)} {...triggerProps}
          ref={trigger} aria-invalid={invalid || triggerProps['aria-invalid']}
          aria-describedby={[triggerProps['aria-describedby'], invalid && errorId].filter(Boolean).join(' ') || undefined}>
          <SelectValue placeholder={emptyOption?.children ?? 'Choose an option'} />
        </SelectTrigger>
        <SelectContent className="max-h-[min(20rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] max-w-[var(--radix-select-content-available-width)]">
          {options.filter((option) => option.value !== '' || hasEmptyChoice).map((option) => (
            <SelectItem className={option.className} disabled={option.disabled} key={option.value} value={encode(String(option.value))}>
              {option.children}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {invalid && <span className="block text-sm text-destructive" id={errorId} role="alert">Choose an option to continue.</span>}
    </span>
  );
}

export { ChoiceOption, ChoiceSelect };
