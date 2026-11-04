import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface UserIdentityProps {
  name: string;
  detail?: string;
  imageUrl?: string | null;
  className?: string;
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

function UserIdentity({ className, detail, imageUrl, name }: UserIdentityProps) {
  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      <Avatar aria-hidden="true" data-slot="avatar" className="size-9">
        {imageUrl ? <AvatarImage alt="" src={imageUrl} /> : null}
        <AvatarFallback>{getInitials(name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{name}</p>
        {detail ? (
          <p className="truncate text-xs text-muted-foreground">{detail}</p>
        ) : null}
      </div>
    </div>
  );
}

export { UserIdentity };
