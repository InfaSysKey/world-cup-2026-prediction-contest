'use client';

// Selector reutilizable de "elige un equipo" sobre los 48 equipos del torneo.
// Es un <select> nativo (con type-ahead del navegador) para no añadir
// dependencias ni complejidad: cubre el autocompletado básico que necesita el
// podio. Si una categoría futura necesita búsqueda más rica, se sustituye aquí
// sin tocar a los consumidores.

// Las opciones de un <select> nativo solo pueden llevar texto (no imágenes), así
// que aquí va solo el nombre; la bandera se muestra allá donde el equipo se pinta
// visualmente (cromos, listas, calendario).
export type TeamOption = {
  code: string;
  name: string;
};

type TeamSelectProps = {
  value: string | null;
  options: TeamOption[];
  disabled?: boolean;
  placeholder?: string;
  testId?: string;
  ariaLabel?: string;
  onChange: (code: string | null) => void;
};

export function TeamSelect({
  value,
  options,
  disabled = false,
  placeholder = 'Elige un equipo…',
  testId,
  ariaLabel,
  onChange,
}: TeamSelectProps) {
  return (
    <select
      data-testid={testId}
      aria-label={ariaLabel}
      disabled={disabled}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
      className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
    >
      <option value="">{placeholder}</option>
      {options.map((team) => (
        <option key={team.code} value={team.code}>
          {team.name}
        </option>
      ))}
    </select>
  );
}
