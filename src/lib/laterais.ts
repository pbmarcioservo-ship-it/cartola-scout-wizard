export type LateralSide = 'LD' | 'LE';

function normalizeName(value?: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

const LATERAL_SIDE_BY_NAME: Record<string, LateralSide> = {
  // BAHIA
  'ROMAN GOMEZ': 'LD', 'LUCIANO JUBA': 'LE', 'GILBERTO': 'LD', 'IAGO': 'LE',
  // BOTAFOGO
  'MARCAL': 'LE', 'VITINHO': 'LD', 'ALEX TELLES': 'LE', 'MATEO PONTE': 'LD',
  // ATLETICO MINEIRO
  'RENAN LODI': 'LE', 'PRECIADO': 'LD', 'KAUA PASCINI': 'LE', 'NATANAEL': 'LD',
  // ATLETICO PARANAENSE
  'BENAVIDEZ': 'LD', 'LEO DERIK': 'LE', 'ESQUIVEL': 'LE',
  // CORITIBA
  'TINGA': 'LD', 'BRUNO MELO': 'LE', 'FELIPE JONATAN': 'LE', 'JP CHERMONT': 'LD',
  // CHAPECOENSE
  'WALTER CLAR': 'LE', 'EVERTON': 'LD', 'MARCOS VINICIUS': 'LD', 'BRUNO PACHECO': 'LE',
  // CORINTHIANS
  'MATHEUS BIDU': 'LE', 'MATHEUZINHO': 'LD', 'MILANS': 'LD', 'ANGILERI': 'LE', 'HUGO': 'LE',
  // CRUZEIRO
  'KAIKI BRUNO': 'LE', 'WILLIAM': 'LD', 'FAGNER': 'LD', 'KAUA MORAES': 'LD',
  // FLAMENGO
  'VARELA': 'LE', 'ALEX SANDRO': 'LE', 'EMERSON ROYAL': 'LD', 'AYRTON LUCAS': 'LE',
  // FLUMINENSE
  'RENE': 'LE', 'SAMUEL XAVIER': 'LD', 'GUILHERME ARANA': 'LE', 'GUGA': 'LD',
  // GREMIO
  'MARLON': 'LE', 'JOAO PEDRO': 'LD', 'MARCOS ROCHA': 'LD', 'CAIO PAULISTA': 'LE',
  // INTERNACIONAL
  'BERNABEI': 'LE', 'AGUIRRE': 'LD', 'MATHEUS BAHIA': 'LE', 'ALISSON': 'LE',
  // MIRASSOL
  'IGOR FORMIGA': 'LD', 'IGOR CARIUS': 'LD', 'REINALDO': 'LE', 'DANIEL BORGES': 'LD', 'VICTOR LUIS': 'LE',
  // PALMEIRAS
  'PIQUEREZ': 'LE', 'KHELLVEN': 'LD', 'GIAY': 'LD', 'JEFTE': 'LE',
  // RB BRAGANTINO
  'JUNINHO CAPIXABA': 'LE', 'SANT ANNA': 'LD', 'ANDRES HURTADO': 'LD', 'CAUE': 'LE', 'VANDERLAN': 'LE',
  // REMO
  'SAVIO': 'LE', 'JOAO LUCAS': 'LD', 'MARCELINHO': 'LD', 'CUFRE': 'LE',
  // SANTOS
  'IGOR VINICIUS': 'LD', 'ESCOBAR': 'LE', 'VINICIUS LIRA': 'LE', 'MAYKE': 'LD', 'SOUZA': 'LE',
  // SAO PAULO
  'LUCAS RAMON': 'LD', 'ENZO DIAZ': 'LE', 'WENDELL': 'LE', 'MAIK': 'LD', 'CEDRIC SOARES': 'LD',
  // VASCO
  'PUMA RODRIGUEZ': 'LD', 'PAULO HENRIQUE': 'LD', 'CUIABANO': 'LE', 'LUCAS PITON': 'LE',
  // VITORIA
  'JAMERSON': 'LE', 'RAMON': 'LE', 'MATEUS SILVA': 'LD', 'NATHAN MENDES': 'LD', 'LUAN CANDIDO': 'LE',
};

export function getLateralSideByName(apelido?: string, nome?: string): LateralSide | null {
  const byApelido = LATERAL_SIDE_BY_NAME[normalizeName(apelido)];
  if (byApelido) return byApelido;

  const byNome = LATERAL_SIDE_BY_NAME[normalizeName(nome)];
  if (byNome) return byNome;

  return null;
}
