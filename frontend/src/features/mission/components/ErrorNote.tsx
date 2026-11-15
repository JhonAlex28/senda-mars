import { Icon } from '@/shared/ui/Icon';
import { Phrase } from '@/shared/ui/Text';

export function ErrorNote({ message, onClose }: { message: string; onClose?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-sm rounded-md border border-error/50 bg-error/10 p-sm font-body text-body-sm text-on-surface">
      <Icon name="error" className="mt-px shrink-0 text-[18px] text-error" />
      <Phrase className="flex-1">{message}</Phrase>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Dismiss" className="text-on-surface-variant hover:text-on-surface">
          <Icon name="close" className="text-[16px]" />
        </button>
      )}
    </div>
  );
}
