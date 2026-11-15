import { Icon } from '@/shared/ui/Icon';

/** 2D activo; la vista 3D del DEM está en revisión y se muestra bloqueada ("Soon"). */
export function ViewModeSwitch({ className = '' }: { className?: string }) {
  return (
    <div className={`z-30 flex items-center rounded-full border border-outline bg-surface-container/95 p-0.5 font-mono text-mono-sm shadow-lg backdrop-blur-sm ${className}`}>
      <span className="rounded-full bg-primary px-md py-1 font-bold text-on-primary">2D</span>
      <span className="flex items-center gap-xs px-md py-1 text-on-surface-variant opacity-60" title="3D · soon" aria-disabled="true">
        <Icon name="lock" className="text-[14px]" />
        3D
        <span className="font-label text-label-sm uppercase">Soon</span>
      </span>
    </div>
  );
}
