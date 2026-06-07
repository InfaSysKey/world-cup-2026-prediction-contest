import { describe, expect, it } from 'vitest';

import { podioCompletion } from './podio-completion';

const NO_MISMATCH = { champion: false, runnerUp: false, third: false };

describe('podioCompletion', () => {
  it('marca empty cuando no hay ningún puesto ni mismatch', () => {
    expect(
      podioCompletion({ champion: null, runnerUp: null, third: null }, NO_MISMATCH),
    ).toBe('empty');
  });

  it('marca partial con algún puesto pero no los 3', () => {
    expect(
      podioCompletion({ champion: 'MEX', runnerUp: null, third: null }, NO_MISMATCH),
    ).toBe('partial');
  });

  it('marca complete con los 3 puestos y sin mismatches', () => {
    expect(
      podioCompletion(
        { champion: 'MEX', runnerUp: 'USA', third: 'CAN' },
        NO_MISMATCH,
      ),
    ).toBe('complete');
  });

  it('marca revisar si hay un mismatch aunque los 3 puestos tengan valor', () => {
    expect(
      podioCompletion(
        { champion: 'MEX', runnerUp: 'USA', third: 'CAN' },
        { champion: true, runnerUp: false, third: false },
      ),
    ).toBe('revisar');
  });

  it('da prioridad a revisar sobre partial cuando hay mismatch y campos vacíos', () => {
    expect(
      podioCompletion(
        { champion: 'MEX', runnerUp: null, third: null },
        { champion: false, runnerUp: true, third: false },
      ),
    ).toBe('revisar');
  });
});
