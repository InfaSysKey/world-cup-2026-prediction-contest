// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GroupCatalog } from '@/app/(porra)/porra/load-group-matches';
import type { PredictionGroupMatch } from '@/lib/db';

// Evita arrastrar el cliente de Postgres (la Server Action importa @/lib/db).
vi.mock('@/app/(porra)/porra/actions', () => ({
  saveGroupMatchPredictions: vi.fn().mockResolvedValue({ data: { saved: 0 } }),
}));

import { GroupMatchesTab } from './group-matches-tab';

const CATALOG: GroupCatalog[] = [
  {
    groupLetter: 'A',
    matches: [
      {
        id: 1,
        homeCode: 'MEX',
        homeName: 'México',
        homeFlag: '🇲🇽',
        awayCode: 'RSA',
        awayName: 'Sudáfrica',
        awayFlag: '🇿🇦',
      },
    ],
  },
];

function initial(goles: { local: number; visitante: number }): PredictionGroupMatch[] {
  return [
    {
      id: 10,
      userId: 1,
      matchId: 1,
      golesLocal: goles.local,
      golesVisitante: goles.visitante,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
}

describe('GroupMatchesTab', () => {
  afterEach(cleanup);

  it('pinta los marcadores ya guardados', () => {
    render(
      <GroupMatchesTab catalog={CATALOG} initial={initial({ local: 2, visitante: 1 })} locked={false} />,
    );
    expect(screen.getByTestId<HTMLInputElement>('gm-local-1').value).toBe('2');
    expect(screen.getByTestId<HTMLInputElement>('gm-visitante-1').value).toBe('1');
  });

  it('deshabilita los inputs cuando está bloqueada', () => {
    render(<GroupMatchesTab catalog={CATALOG} initial={[]} locked={true} />);
    expect(screen.getByTestId<HTMLInputElement>('gm-local-1').disabled).toBe(true);
    expect(screen.getByTestId<HTMLInputElement>('gm-visitante-1').disabled).toBe(true);
    expect(screen.queryByText('BLOQUEADA')).not.toBeNull();
  });
});
