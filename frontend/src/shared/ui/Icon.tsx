interface IconProps {
  name: string;
  className?: string;
  filled?: boolean;
}

/**
 * Icono de Material Symbols. Es decorativo: el texto accesible va en el control que lo contiene.
 * translate="no": el nombre del icono es una palabra ("close", "warning"); si el traductor la
 * cambiara, el icono dejaría de verse.
 */
export function Icon({ name, className = '', filled = false }: IconProps) {
  return (
    <span
      translate="no"
      className={`material-symbols-outlined notranslate ${filled ? 'icon-filled' : ''} ${className}`}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
