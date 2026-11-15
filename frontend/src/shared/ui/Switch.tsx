interface SwitchProps {
  checked: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}

/** Interruptor encendido/apagado (accesible como role="switch"). */
export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-fast disabled:cursor-not-allowed disabled:opacity-40 ${
        checked ? 'bg-primary' : 'bg-surface-container-high'
      }`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-on-surface shadow transition-transform duration-fast ${checked ? 'left-0.5 translate-x-4' : 'left-0.5'}`} />
    </button>
  );
}
