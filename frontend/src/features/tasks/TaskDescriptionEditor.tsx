import { Bold, Italic, List, ListOrdered, Quote } from 'lucide-react';
import { useId, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useMarkFormDirty } from '@/components/ui/form-dirty-context';
import { cn } from '@/lib/utils';

const tools = [
  { label: 'Bold', command: 'bold', icon: Bold },
  { label: 'Italic', command: 'italic', icon: Italic },
  { label: 'Bulleted list', command: 'insertUnorderedList', icon: List },
  { label: 'Numbered list', command: 'insertOrderedList', icon: ListOrdered },
  { label: 'Quote', command: 'formatBlock', icon: Quote },
];
const formatting = 'wrap-anywhere [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5';

export function TaskDescriptionEditor({ defaultValue = '', onChange, name }: {
  defaultValue?: string;
  onChange?: (html: string) => void;
  name?: string;
}) {
  const id = useId();
  const editable = useRef<HTMLDivElement>(null);
  const selection = useRef<Range>(null);
  const initial = useRef(defaultValue);
  const [html, setHtml] = useState(defaultValue);
  const markDirty = useMarkFormDirty();
  useLayoutEffect(() => {
    if (editable.current) editable.current.innerHTML = initial.current;
  }, []);

  function save() {
    const field = editable.current;
    if (!field) return;
    const value = field.textContent?.trim() ? field.innerHTML : '';
    setHtml(value);
    onChange?.(value);
    markDirty();
  }

  function apply(command: string) {
    const field = editable.current;
    if (!field) return;
    const restoreSelection = field !== document.activeElement;
    field.focus();
    if (restoreSelection && selection.current && field.contains(selection.current.commonAncestorContainer)) {
      const current = window.getSelection();
      current?.removeAllRanges();
      current?.addRange(selection.current);
    }
    document.execCommand('styleWithCSS', false, 'false');
    const block = String(document.queryCommandValue('formatBlock')).toLowerCase();
    document.execCommand(command, false, command === 'formatBlock' ? (block === 'blockquote' ? 'div' : 'blockquote') : undefined);
    save();
  }

  return (
    <div className="grid gap-1.5">
      <span className="text-sm font-medium" id={id}>Description</span>
      <div className="overflow-hidden rounded-md border bg-background focus-within:border-ring">
        <div className="flex flex-wrap gap-1 border-b bg-muted/35 p-1" role="group" aria-label="Description formatting">
          {tools.map(({ icon: Icon, label, command }) => (
            <Button key={label} type="button" variant="ghost" size="icon" className="size-8" aria-label={label} title={label}
              onMouseDown={(event) => event.preventDefault()} onClick={() => apply(command)}>
              <Icon className="size-4" aria-hidden="true" />
            </Button>
          ))}
        </div>
        <div ref={editable} className={cn('min-h-28 px-3 py-2 text-sm leading-6 outline-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]', formatting)}
          role="textbox" aria-multiline="true" aria-labelledby={id} aria-invalid={html.length > 10000} contentEditable data-placeholder="Describe the task…"
          onInput={save}
          onBlur={() => {
            const current = window.getSelection();
            if (current?.rangeCount && editable.current?.contains(current.anchorNode)) selection.current = current.getRangeAt(0).cloneRange();
          }}
          onPaste={(event) => {
            event.preventDefault();
            document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
            save();
          }}
          onDrop={(event) => event.preventDefault()}
        />
      </div>
      {name && <input name={name} type="hidden" value={html} />}
      {html.length > 10000 && <p role="alert" className="text-sm text-destructive">Shorten the description to continue.</p>}
    </div>
  );
}

export function FormattedTaskDescription({ html }: { html: string }) {
  return <div className={cn('text-sm leading-6 text-muted-foreground', formatting)} dangerouslySetInnerHTML={{ __html: html }} />;
}
