import { describe, expect, it } from 'vitest';

import { phaseFromOpenfootballRound } from './round-map';

describe('phaseFromOpenfootballRound', () => {
  it('"Matchday N" para cualquier N → grupos (openfootball numera por día natural)', () => {
    expect(phaseFromOpenfootballRound('Matchday 1')).toBe('grupos');
    expect(phaseFromOpenfootballRound('Matchday 3')).toBe('grupos');
    expect(phaseFromOpenfootballRound('Matchday 8')).toBe('grupos');
    expect(phaseFromOpenfootballRound('Matchday 14')).toBe('grupos');
    expect(phaseFromOpenfootballRound('Matchday 18')).toBe('grupos');
  });

  it('strings de eliminatorias mapean a su fase canónica', () => {
    expect(phaseFromOpenfootballRound('Round of 32')).toBe('1/16');
    expect(phaseFromOpenfootballRound('Round of 16')).toBe('1/8');
    expect(phaseFromOpenfootballRound('Quarter-finals')).toBe('cuartos');
    expect(phaseFromOpenfootballRound('Quarterfinals')).toBe('cuartos');
    expect(phaseFromOpenfootballRound('Semi-finals')).toBe('semi');
    expect(phaseFromOpenfootballRound('Semifinals')).toBe('semi');
    expect(phaseFromOpenfootballRound('Third-place playoff')).toBe('3-4');
    expect(phaseFromOpenfootballRound('Match for third place')).toBe('3-4');
    expect(phaseFromOpenfootballRound('Final')).toBe('final');
  });

  it('es robusto frente a espacios/caso en "Matchday"', () => {
    expect(phaseFromOpenfootballRound('  Matchday 5  ')).toBe('grupos');
    expect(phaseFromOpenfootballRound('matchday 5')).toBe('grupos');
  });

  it('devuelve null para strings no reconocidos', () => {
    expect(phaseFromOpenfootballRound('Friendly')).toBeNull();
    expect(phaseFromOpenfootballRound('Group A')).toBeNull();
    expect(phaseFromOpenfootballRound('')).toBeNull();
  });
});
