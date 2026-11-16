import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMarkFormDirty } from '@/components/ui/form-dirty-context';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const colors = [
  ['Blue', '#3B82F6'], ['Indigo', '#6366F1'], ['Purple', '#A855F7'],
  ['Pink', '#EC4899'], ['Red', '#EF4444'], ['Orange', '#F97316'],
  ['Amber', '#F59E0B'], ['Green', '#22C55E'], ['Teal', '#14B8A6'],
] as const;

export function ColorField({ name, value, onValueChange }: { name: string; value: string; onValueChange: (value: string) => void }) {
  const markDirty = useMarkFormDirty();
  const [open, setOpen] = useState(false);
  const isHexColor = /^#[\da-f]{6}$/i.test(value);
  return (
    <div className="relative">
      <Input aria-label="Color" className="pr-10" maxLength={7} name={name} placeholder="#3B82F6"
        value={value} onChange={(event) => onValueChange(event.target.value)} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button aria-label="Choose a color" className="absolute right-0.5 top-0.5 size-9" size="icon" variant="ghost">
            <span aria-hidden="true" className="size-4 rounded-sm border border-input" style={isHexColor ? { backgroundColor: value } : undefined} />
          </Button>
        </PopoverTrigger>
        <PopoverContent aria-label="Color palette" align="end" className="grid w-auto grid-cols-3 gap-2 p-2">
          {colors.map(([label, color]) => (
            <Button aria-label={label} aria-pressed={color.toLowerCase() === value.toLowerCase()} key={color}
              onClick={() => { onValueChange(color); markDirty(); setOpen(false); }} size="icon" type="button" variant="outline">
              <span aria-hidden="true" className="size-5 rounded-sm border border-input" style={{ backgroundColor: color }} />
            </Button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}
