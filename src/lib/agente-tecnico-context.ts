/**
 * Builds context data strings for the Agente Técnico AI from Cartola data.
 */
import { CartolaMercado, CartolaAtleta, CartolaPartida, CartolaClube, CartolaAtletasPontuados } from '@/lib/cartola-api';
import { POSICOES } from '@/hooks/useCartolaData';

const LS_KEY_LATERAL = 'statusfc_lateral_side_by_id';

function getLateralSides(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LS_KEY_LATERAL);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

type PosicaoRapida = 'goleiros' | 'laterais' | 'zagueiros' | 'meias' | 'atacantes' | 'capitao' | 'tecnico';

const POSICAO_IDS: Record<PosicaoRapida, number[]> = {
  goleiros: [1],
  laterais: [2],
  zagueiros: [3],
  meias: [4],
  atacantes: [5],
  capitao: [4, 5], // meias e atacantes para capitão
  tecnico: [6], // técnicos
};

export function buildContextData(
  posicao: PosicaoRapida | null,
  mercado: CartolaMercado | undefined,
  partidas: { partidas: CartolaPartida[]; clubes: Record<string, CartolaClube> } | undefined,
  historico: { rodada: number; data?: CartolaAtletasPontuados; partidas?: { partidas: CartolaPartida[]; clubes: Record<string, CartolaClube> } }[],
) {
  if (!mercado || !partidas) return null;

  const clubes = { ...mercado.clubes, ...partidas.clubes };
  const lateralSides = getLateralSides();

  // 1. Build partidas string
  const partidasStr = partidas.partidas.map(p => {
    const casa = clubes[p.clube_casa_id]?.abreviacao || String(p.clube_casa_id);
    const fora = clubes[p.clube_visitante_id]?.abreviacao || String(p.clube_visitante_id);
    return `${casa} (casa) vs ${fora} (fora)`;
  }).join('\n');

  // 2. Filter relevant athletes by position
  const posIds = posicao ? POSICAO_IDS[posicao] : [1, 2, 3, 4, 5, 6];
  const statusProvavel = 7;
  
  const relevantAtletas = mercado.atletas
    .filter(a => posIds.includes(a.posicao_id) && a.status_id === statusProvavel)
    .sort((a, b) => b.media_num - a.media_num)
    .slice(0, 40); // top 40 by average

  const atletasStr = relevantAtletas.map(a => {
    const pos = POSICOES[a.posicao_id]?.abreviacao || '?';
    const clube = clubes[a.clube_id]?.abreviacao || '?';
    const lateralTag = a.posicao_id === 2 ? ` (${lateralSides[String(a.atleta_id)] || '?'})` : '';
    
    // Find opponent
    const partida = partidas.partidas.find(
      p => p.clube_casa_id === a.clube_id || p.clube_visitante_id === a.clube_id
    );
    const isHome = partida?.clube_casa_id === a.clube_id;
    const opponentId = isHome ? partida?.clube_visitante_id : partida?.clube_casa_id;
    const opponent = opponentId ? (clubes[opponentId]?.abreviacao || '?') : '?';
    const mando = isHome ? 'Casa' : 'Fora';

    const scouts = a.scout ? Object.entries(a.scout)
      .filter(([, v]) => v && (v as number) > 0)
      .map(([k, v]) => `${k}:${v}`)
      .join(' ') : 'sem scouts';

    return `${a.apelido}${lateralTag} | ${pos} | ${clube} vs ${opponent} (${mando}) | Média: ${a.media_num.toFixed(2)} | Preço: ${a.preco_num.toFixed(2)} | Jogos: ${a.jogos_num} | Scouts: ${scouts}`;
  }).join('\n');

  // 3. Build opponent concession data from history
  const cedencia: Record<number, Record<string, number[]>> = {}; // clubeId -> scoutKey -> values[]

  for (const h of historico) {
    if (!h.data?.atletas || !h.partidas?.partidas) continue;
    
    for (const [, atletaData] of Object.entries(h.data.atletas)) {
      if (!atletaData.scout) continue;
      const clubeId = atletaData.clube_id;
      
      const partida = h.partidas.partidas.find(
        (p: CartolaPartida) => p.clube_casa_id === clubeId || p.clube_visitante_id === clubeId
      );
      if (!partida) continue;

      // The opponent concedes whatever this player earned
      const opponentId = partida.clube_casa_id === clubeId 
        ? partida.clube_visitante_id 
        : partida.clube_casa_id;

      if (!cedencia[opponentId]) cedencia[opponentId] = {};
      
      for (const [key, val] of Object.entries(atletaData.scout)) {
        if (!val || (val as number) <= 0) continue;
        if (!cedencia[opponentId][key]) cedencia[opponentId][key] = [];
        cedencia[opponentId][key].push(val as number);
      }
    }
  }

  const cedenciaStr = Object.entries(cedencia)
    .map(([clubeId, scouts]) => {
      const nome = clubes[Number(clubeId)]?.abreviacao || clubeId;
      const scoutAvgs = Object.entries(scouts)
        .map(([key, vals]) => {
          const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
          return `${key}: ${avg.toFixed(1)}/jogo`;
        })
        .join(', ');
      return `${nome} cede em média: ${scoutAvgs}`;
    })
    .join('\n');

  // 4. Laterais info
  const lateraisStr = relevantAtletas
    .filter(a => a.posicao_id === 2)
    .map(a => `${a.apelido}: ${lateralSides[String(a.atleta_id)] || 'Indefinido'}`)
    .join('\n');

  return {
    rodada: mercado.rodada_atual,
    partidas: partidasStr,
    atletasRelevantes: atletasStr,
    cedenciaAdversarios: cedenciaStr,
    laterais: lateraisStr || undefined,
  };
}
