import { describe, expect, it } from 'vitest';

import { flagIconCode } from './flags';

// Inglaterra/Escocia se construyen por code points para evitar problemas de
// copia del emoji de secuencia de etiquetas.
const ENGLAND = String.fromCodePoint(
  0x1f3f4,
  0xe0067,
  0xe0062,
  0xe0065,
  0xe006e,
  0xe0067,
  0xe007f,
);
const SCOTLAND = String.fromCodePoint(
  0x1f3f4,
  0xe0067,
  0xe0062,
  0xe0073,
  0xe0063,
  0xe0074,
  0xe007f,
);

describe('flagIconCode', () => {
  it('deriva alpha-2 de indicadores regionales', () => {
    expect(flagIconCode('🇲🇽', 'MEX')).toBe('mx');
    expect(flagIconCode('🇰🇷', 'KOR')).toBe('kr');
    expect(flagIconCode('🇿🇦', 'ZAF')).toBe('za');
    expect(flagIconCode('🇪🇸', 'ESP')).toBe('es');
  });

  it('mapea Inglaterra y Escocia a sus subregiones gb-eng/gb-sct', () => {
    expect(flagIconCode(ENGLAND, 'ENG')).toBe('gb-eng');
    expect(flagIconCode(SCOTLAND, 'SCO')).toBe('gb-sct');
  });

  it('usa el respaldo por código si el emoji no es parseable', () => {
    expect(flagIconCode('', 'ENG')).toBe('gb-eng');
    expect(flagIconCode('?', 'FRA')).toBe('fra');
  });
});
