import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

export function ActionConfirmation({ title, description, action, cancelLabel = 'Keep record', pending, error, onCancel, onConfirm }: {
  title: string;
  description: string;
  action: string;
  cancelLabel?: string;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open onOpenChange={(open) => { if (!open && !pending) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel asChild><Button disabled={pending} variant="outline">{cancelLabel}</Button></AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button loading={pending} variant="destructive" onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}>{action}</Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ConfirmRemoveButton({ title, disabled, onRemove }: {
  title: string;
  disabled: boolean;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button disabled={disabled} onClick={() => setOpen(true)} size="sm" type="button" variant="outline">Remove</Button>
      {open && <ActionConfirmation title={title} description="This removes the association from the workspace."
        action="Remove" pending={false} error={null} onCancel={() => setOpen(false)}
        onConfirm={() => { setOpen(false); onRemove(); }} />}
    </>
  );
}
