import { useId, useState } from 'react';
import { DateField } from '@/components/ui/date-field';
import { Input } from '@/components/ui/input';

export function DateTimeField({ defaultValue = '', label, name }: { defaultValue?: string | undefined; label: string; name: string }) {
  const id = useId();
  const [initialDate = '', initialTime = ''] = defaultValue.split('T');
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime.slice(0, 8));
  const [offset, setOffset] = useState(initialTime.slice(8) || 'Z');
  const timestamp = date && time && offset
    ? date + 'T' + (time.length === 5 ? time + ':00' : time) + offset.toUpperCase()
    : '';

  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="col-span-2 grid gap-2 sm:col-span-1">
          <label className="text-sm font-medium leading-none" htmlFor={id + '-date'}>Date</label>
          <DateField aria-label={label + ' date'} id={id + '-date'} onValueChange={setDate} required value={date} />
        </div>
        <Input aria-label={label + ' time'} label="Time" onChange={(event) => setTime(event.target.value)}
          pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?" placeholder="HH:MM"
          required title="Enter a 24-hour time as HH:MM or HH:MM:SS." value={time} />
        <Input aria-label={label + ' UTC offset'} label="UTC offset" onChange={(event) => setOffset(event.target.value)}
          pattern="(?:[Zz]|[+\-](?:[01][0-9]|2[0-3]):[0-5][0-9])" placeholder="+03:00"
          required title="Enter Z or a UTC offset such as +03:00." value={offset} />
      </div>
      <Input name={name} type="hidden" value={timestamp} />
    </fieldset>
  );
}
