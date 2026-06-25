// Mapping del nombre inglés que usa openfootball/worldcup.json (campos team1 y
// team2) al código FIFA 3-letras que usa `teams.code` en este repo. La lista
// está construida a partir del JSON canónico
// https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json
// y replica exactamente las grafías que aparecen allí, incluyendo casos
// peculiares ("DR Congo", "Ivory Coast", "Czech Republic"). Se añaden alias
// defensivos (con/sin diacríticos, formas oficiales alternativas como
// "Côte d'Ivoire", "Czechia", "Türkiye") por si openfootball cambia la
// grafía en una futura actualización del JSON.

const TEAM_NAME_TO_CODE: Record<string, string> = {
  Algeria: 'DZA',
  Argentina: 'ARG',
  Australia: 'AUS',
  Austria: 'AUT',
  Belgium: 'BEL',
  'Bosnia & Herzegovina': 'BIH',
  Brazil: 'BRA',
  Canada: 'CAN',
  'Cape Verde': 'CPV',
  Colombia: 'COL',
  Croatia: 'HRV',
  'Curaçao': 'CUW',
  'Czech Republic': 'CZE',
  'DR Congo': 'COD',
  Ecuador: 'ECU',
  Egypt: 'EGY',
  England: 'ENG',
  France: 'FRA',
  Germany: 'DEU',
  Ghana: 'GHA',
  Haiti: 'HTI',
  Iran: 'IRN',
  Iraq: 'IRQ',
  'Ivory Coast': 'CIV',
  Japan: 'JPN',
  Jordan: 'JOR',
  Mexico: 'MEX',
  Morocco: 'MAR',
  Netherlands: 'NLD',
  'New Zealand': 'NZL',
  Norway: 'NOR',
  Panama: 'PAN',
  Paraguay: 'PRY',
  Portugal: 'PRT',
  Qatar: 'QAT',
  'Saudi Arabia': 'SAU',
  Scotland: 'SCO',
  Senegal: 'SEN',
  'South Africa': 'ZAF',
  'South Korea': 'KOR',
  Spain: 'ESP',
  Sweden: 'SWE',
  Switzerland: 'CHE',
  Tunisia: 'TUN',
  Turkey: 'TUR',
  Uruguay: 'URY',
  USA: 'USA',
  Uzbekistan: 'UZB',

  // Alias defensivos.
  'Bosnia and Herzegovina': 'BIH',
  Curacao: 'CUW',
  Czechia: 'CZE',
  "Côte d'Ivoire": 'CIV',
  "Cote d'Ivoire": 'CIV',
  'Democratic Republic of the Congo': 'COD',
  'DR of the Congo': 'COD',
  'Republic of Korea': 'KOR',
  Türkiye: 'TUR',
  Turkiye: 'TUR',
  'United States': 'USA',
  'United States of America': 'USA',
};

// Mapa público con normalización del nombre (trim + lowercase) — robusto frente
// a diferencias de mayúsculas o espacios extra. Construido una vez en módulo.
const NORMALIZED: ReadonlyMap<string, string> = new Map(
  Object.entries(TEAM_NAME_TO_CODE).map(([name, code]) => [
    name.trim().toLowerCase(),
    code,
  ]),
);

// Resuelve el código FIFA 3-letras a partir del nombre inglés tal como llega
// del JSON de openfootball. Devuelve null si el nombre no se reconoce — el
// importer lo logueará y skipeará el partido, sin escribir nada.
export function teamCodeFromOpenfootball(name: string): string | null {
  if (!name) {
    return null;
  }
  return NORMALIZED.get(name.trim().toLowerCase()) ?? null;
}

// Para tests y dev: lista de los nombres canónicos esperados.
export function knownOpenfootballNames(): string[] {
  return Object.keys(TEAM_NAME_TO_CODE).sort();
}
