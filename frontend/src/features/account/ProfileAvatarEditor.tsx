import { useEffect, useRef, useState } from 'react';
import { Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { getApiValidationErrors, getSafeErrorMessage } from '@/features/auth/auth-validation';
import { accountApi } from '@/services/api/accountApi';
import type { ApiUser } from '@/services/api/contracts';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

export function ProfileAvatarEditor({ user, onChanged }: { user: ApiUser; onChanged: (user: ApiUser) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    if (preview) {
      URL.revokeObjectURL(preview);
    }
  }, [preview]);

  function choose(selected: File | null) {
    setError(null);
    if (!selected) {
      return;
    }
    if (!ALLOWED.includes(selected.type)) {
      setError('Choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (selected.size > MAX_BYTES) {
      setError('Choose an image smaller than 5 MB.');
      return;
    }
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  }

  async function upload() {
    if (!file) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const updated = await accountApi.uploadAvatar(file);
      onChanged(updated);
      setFile(null);
      if (preview) {
        URL.revokeObjectURL(preview);
      }
      setPreview(null);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
      toast.success('Profile picture updated.');
    } catch (caught) {
      console.error('Avatar upload failed:', caught);
      const fieldErrors = getApiValidationErrors(caught);
      const validationMessage = Object.values(fieldErrors).join(' ');
      setError(validationMessage || getSafeErrorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    setPending(true);
    setError(null);
    try {
      const updated = await accountApi.removeAvatar();
      onChanged(updated);
      toast.success('Profile picture removed.');
    } catch (caught) {
      console.error('Avatar upload failed:', caught);
      const fieldErrors = getApiValidationErrors(caught);
      const validationMessage = Object.values(fieldErrors).join(' ');
      setError(validationMessage || getSafeErrorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  const source = preview ?? user.avatar_url ?? undefined;

  return (
    <div className="space-y-4">
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      <div className="flex flex-wrap items-center gap-5">
        <Avatar className="size-20 text-lg">
          {source ? <AvatarImage alt="" src={source} /> : null}
          <AvatarFallback>{initials(user.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-3">
          <input
            ref={inputRef}
            accept={ALLOWED.join(',')}
            aria-label="Choose a profile picture"
            className="block w-full cursor-pointer rounded-md border border-input bg-background text-sm file:mr-3 file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-secondary/80"
            id="account-avatar"
            type="file"
            onChange={(event) => choose(event.target.files?.[0] ?? null)}
          />
          <p className="text-xs leading-5 text-muted-foreground">
            JPEG, PNG, or WebP up to 5 MB. Images are center-cropped and resized to a square automatically.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={!file || pending} loading={pending} onClick={() => void upload()} size="sm">
              <Upload aria-hidden="true" className="size-4" /> Save picture
            </Button>
            {file ? (
              <Button
                disabled={pending}
                onClick={() => {
                  setFile(null);
                  if (preview) {
                    URL.revokeObjectURL(preview);
                  }
                  setPreview(null);
                }}
                size="sm"
                variant="outline"
              >
                Cancel
              </Button>
            ) : null}
            {user.avatar_url ? (
              <Button disabled={pending} onClick={() => void remove()} size="sm" variant="outline">
                <Trash2 aria-hidden="true" className="size-4" /> Remove
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
