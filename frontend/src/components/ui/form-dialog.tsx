import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const RequestClose = createContext<() => void>(() => {});

export function FormDialog({ title, description, pending = false, onClose, children, wide = false }: {
  title: string;
  description: string;
  pending?: boolean;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const [dirty, setDirty] = useState(false);
  const [trigger] = useState(() => document.activeElement);
  useEffect(() => {
    if (!dirty && !pending) return;
    function preventUnload(event: BeforeUnloadEvent): void {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', preventUnload);
    return () => window.removeEventListener('beforeunload', preventUnload);
  }, [dirty, pending]);
  function requestClose(): void {
    if (pending || (dirty && !window.confirm('Discard unsaved changes?'))) return;
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) requestClose(); }}>
      <DialogContent
        className={`grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 ${wide ? 'max-w-2xl' : ''}`}
        showClose={!pending}
        onChangeCapture={() => setDirty(true)}
        onCloseAutoFocus={(event) => {
          if (trigger instanceof HTMLElement && trigger.isConnected) {
            event.preventDefault();
            trigger.focus();
          }
        }}
      >
        <DialogHeader className="border-b px-5 py-4 pr-12">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-5">
          <RequestClose.Provider value={requestClose}>{children}</RequestClose.Provider>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function FormDialogActions({ pending = false, submitDisabled, submitLabel }: { pending?: boolean; submitDisabled?: boolean; submitLabel: string }) {
  const requestClose = useContext(RequestClose);
  return (
    <DialogFooter>
      <Button type="button" variant="outline" disabled={pending} onClick={requestClose}>Cancel</Button>
      <Button type="submit" loading={pending} disabled={submitDisabled}>{submitLabel}</Button>
    </DialogFooter>
  );
}
