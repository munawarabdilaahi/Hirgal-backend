import { Laptop, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { type ThemePreference } from '@/app/providers/theme-context';
import { useTheme } from '@/app/providers/useTheme';

const themeOptions: { label: string; value: ThemePreference }[] = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'System', value: 'system' },
];

function ThemeSwitcher() {
  const { preference, setPreference } = useTheme();
  const ActiveIcon = preference === 'dark' ? Moon : preference === 'light' ? Sun : Laptop;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label={`Color theme: ${preference}`} size="icon" variant="outline">
          <ActiveIcon aria-hidden="true" className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          onValueChange={(value) => {
            const selectedOption = themeOptions.find(
              (option) => option.value === value,
            );
            if (selectedOption) {
              setPreference(selectedOption.value);
            }
          }}
          value={preference}
        >
          {themeOptions.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { ThemeSwitcher };
