import { useEffect, useId, useRef, useState, type ComponentProps } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMarkFormDirty } from '@/components/ui/form-dirty-context';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { isCalendarDate } from '@/lib/calendar-date';
import { cn } from '@/lib/utils';

const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
const dayLabel = new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeZone: 'UTC' });
const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function localToday(): string {
  const today = new Date();
  return [today.getFullYear(), today.getMonth() + 1, today.getDate()]
    .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, '0')).join('-');
}

interface DateFieldProps extends Omit<ComponentProps<typeof Input>, 'onChange' | 'type' | 'value' | 'defaultValue' | 'ref'> {
  value?: string;
  defaultValue?: string | undefined;
  onValueChange?: (value: string) => void;
  calendarOnly?: boolean;
  min?: string;
  max?: string;
}

export function DateField({ value, defaultValue = '', onValueChange, calendarOnly, min, max, className, ...props }: DateFieldProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const selected = value ?? internalValue;
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => (isCalendarDate(selected) ? selected : localToday()).slice(0, 7));
  const input = useRef<HTMLInputElement>(null);
  const markDirty = useMarkFormDirty();
  const labelId = useId();

  function update(next: string) {
    if (next === selected) return;
    setInternalValue(next);
    markDirty();
    onValueChange?.(next);
  }

  useEffect(() => {
    const invalid = selected && (!isCalendarDate(selected) || (min && selected < min) || (max && selected > max));
    input.current?.setCustomValidity(invalid ? 'Enter a valid date within the allowed range (YYYY-MM-DD).' : '');
  }, [selected, min, max]);

  useEffect(() => {
    const form = input.current?.form;
    const reset = () => setInternalValue(defaultValue);
    form?.addEventListener('reset', reset);
    return () => form?.removeEventListener('reset', reset);
  }, [defaultValue]);

  const first = new Date(month + '-01T00:00:00Z');
  const adjacentMonth = (offset: number) => {
    const date = new Date(first);
    date.setUTCMonth(first.getUTCMonth() + offset);
    return date;
  };
  const finalDay = new Date(adjacentMonth(1).getTime() - 86_400_000).getUTCDate();

  return (
    <div className={cn('relative min-w-0', className)}>
      <Input ref={input} {...props} type="text" className="pr-10" placeholder="YYYY-MM-DD"
        readOnly={calendarOnly || props.readOnly} value={selected}
        onChange={(event) => update(event.target.value)} />
      <Popover open={open} onOpenChange={(next) => {
        if (next) {
          const date = isCalendarDate(selected) ? selected : localToday();
          setMonth((min && date < min ? min : max && date > max ? max : date).slice(0, 7));
        }
        setOpen(next);
      }}>
        <PopoverTrigger asChild>
          <Button aria-label={props['aria-label'] ? 'Open calendar for ' + props['aria-label'] : 'Open calendar'}
            className="absolute right-0.5 top-0.5 size-9" disabled={props.disabled || props.readOnly} size="icon" variant="ghost">
            <CalendarDays aria-hidden="true" className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" aria-labelledby={labelId} className="max-w-[calc(100vw-1rem)] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <Button aria-label="Previous month" size="icon" type="button" variant="ghost"
              disabled={month === '0001-01' || Boolean(min && month <= min.slice(0, 7))}
              onClick={() => setMonth(adjacentMonth(-1).toISOString().slice(0, 7))}><ChevronLeft aria-hidden="true" /></Button>
            <p aria-live="polite" className="text-sm font-semibold" id={labelId}>{monthLabel.format(first)}</p>
            <Button aria-label="Next month" size="icon" type="button" variant="ghost"
              disabled={month === '9999-12' || Boolean(max && month >= max.slice(0, 7))}
              onClick={() => setMonth(adjacentMonth(1).toISOString().slice(0, 7))}><ChevronRight aria-hidden="true" /></Button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {weekdays.map((day) => <span aria-hidden="true" className="py-1 text-xs text-muted-foreground" key={day}>{day}</span>)}
            {Array.from({ length: first.getUTCDay() }, (_, index) => <span aria-hidden="true" key={'offset-' + index} />)}
            {Array.from({ length: finalDay }, (_, index) => {
              const day = index + 1;
              const date = month + '-' + String(day).padStart(2, '0');
              return <Button aria-label={dayLabel.format(new Date(date + 'T00:00:00Z'))}
                aria-pressed={date === selected} className="h-8 min-w-0 px-0 text-xs"
                disabled={Boolean((min && date < min) || (max && date > max))}
                key={date} onClick={() => { update(date); setOpen(false); }} type="button"
                variant={date === selected ? 'default' : 'ghost'}>{day}</Button>;
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
