import { useEffect, type ReactNode } from 'react';
import { Icon } from './Icon';

interface DialogProps {
  title: string;
  icon?: string;
  onClose: () => void;
  children: ReactNode;
}

export function Dialog({ title, icon, onClose, children }: DialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-surface/70 p-md backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md animate-fade-up rounded-lg border border-outline bg-surface-container p-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-md flex items-center justify-between gap-sm">
          <h2 className="flex items-center gap-sm font-headline text-headline-sm uppercase">
            {icon && <Icon name={icon} className="text-[22px] text-warning" />}
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-xs text-on-surface-variant hover:text-on-surface"
          >
            <Icon name="close" className="text-[20px]" />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
