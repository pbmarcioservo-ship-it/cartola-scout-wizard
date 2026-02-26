import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ClubeEscudo } from '@/components/ClubeEscudo';
import { CartolaAtleta, CartolaClube, CartolaScout, CartolaPartida } from '@/lib/cartola-api';
import { POSICOES, useRodada, useHistoricoRodadas } from '@/hooks/useCartolaData';
import { cn } from '@/lib/utils';
const LS_KEY_LATERAL = 'statusfc_lateral_side_by_id';
function getLateralSideFromStore(atletaId: number): 'LD' | 'LE' | null {
  try {
    const raw = localStorage.getItem(LS_KEY_LATERAL);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, 'LD' | 'LE'>;
    return map[String(atletaId)] || null;
  } catch {
    return null;
  }
}

interface CompareModalProps {
  atletas: [CartolaAtleta, CartolaAtleta] | null;
  clubes: Record<string, CartolaClube>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SCOUT_LABELS: Record<string, { label: string; positive: boolean }> = {
  G: { label: 'Gols', positive: true },
  A: { label: 'Assistências', positive: true },
  FT: { label: 'Fin. Trave', positive: true },
  FD: { label: 'Fin. Defendida', positive: true },
  FF: { label: 'Fin. Fora', positive: true },
  FS: { label: 'Falta Sofrida', positive: true },
  RB: { label: 'Roubada de Bola', positive: true },
  PS: { label: 'Passe Certo', positive: true },
  DS: { label: 'Desarme', positive: true },
  SG: { label: 'Sem Gol', positive: true },
  DE: { label: 'Defesa', positive: true },
  DP: { label: 'Def. Pênalti', positive: true },
  CA: { label: 'C. Amarelo', positive: false },
  CV: { label: 'C. Vermelho', positive: false },
  FC: { label: 'Falta Cometida', positive: false },
  GC: { label: 'Gol Contra', positive: false },
  PP: { label: 'Pênalti Perdido', positive: false },
  I: { label: 'Impedimento', positive: false },
  PE: { label: 'Passe Errado', positive: false },
  GS: { label: 'Gol Sofrido', positive: false },
};

interface StatRow {
  label: string;
  valueA: number;
  valueB: number;
  higherIsBetter: boolean;
}

function CompareRow({ row }: { row: StatRow }) {
  const aWins = row.higherIsBetter ? row.valueA > row.valueB : row.valueA < row.valueB;
  const bWins = row.higherIsBetter ? row.valueB > row.valueA : row.valueB < row.valueA;
  const tie = row.valueA === row.valueB;

  return (
    <div className="grid grid-cols-3 items-center py-2 px-3 border-b border-border/50 hover:bg-muted/20 transition-colors">
      <div className="text-right">
        <span className={cn(
          'text-sm font-bold tabular-nums',
          aWins && !tie ? 'text-primary font-black text-base' : 'text-muted-foreground'
        )}>
          {row.valueA}
        </span>
      </div>
      <div className="text-center">
        <span className="text-xs font-bold text-foreground">{row.label}</span>
      </div>
      <div className="text-left">
        <span className={cn(
          'text-sm font-bold tabular-nums',
          bWins && !tie ? 'text-primary font-black text-base' : 'text-muted-foreground'
        )}>
          {row.valueB}
        </span>
      </div>
    </div>
  );
}

function PlayerHeader({ atleta, clube }: { atleta: CartolaAtleta; clube?: CartolaClube }) {
  const posicao = POSICOES[atleta.posicao_id];
  return (
    <div className="flex flex-col items-center gap-2 p-4">
      <img
        src={atleta.foto?.replace('FORMATO', '140x140')}
        alt={atleta.apelido}
        className="w-20 h-20 rounded-full object-cover bg-muted border-2 border-primary"
        onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
      />
      <h3 className="font-black text-foreground text-center text-sm">
        {atleta.apelido}
        {atleta.posicao_id === 2 && (() => {
          const side = getLateralSideFromStore(atleta.atleta_id);
          return side ? <span className="ml-1 text-[11px] text-muted-foreground">({side})</span> : null;
        })()}
      </h3>
      <div className="flex items-center gap-2">
        {clube && <ClubeEscudo clube={clube} size="sm" />}
        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-bold">
          {posicao?.abreviacao}
        </span>
      </div>
    </div>
  );
}

export function CompareModal({ atletas, clubes, open, onOpenChange }: CompareModalProps) {
  if (!atletas) return null;

  const [a, b] = atletas;
  const clubeA = clubes[a.clube_id];
  const clubeB = clubes[b.clube_id];

  const { data: rodadaData } = useRodada();
  const { data: historico } = useHistoricoRodadas(rodadaData?.rodada_atual, 10);

  const findMatchForClub = (partidas: CartolaPartida[] | undefined, clubeId: number) =>
    partidas?.find(p => p.clube_casa_id === clubeId || p.clube_visitante_id === clubeId);

  const computeHomeAwayAvg = (atleta: CartolaAtleta) => {
    let sumHome = 0, cntHome = 0, sumAway = 0, cntAway = 0;
    if (historico) {
      for (const h of historico) {
        const atletaData = h.data?.atletas?.[String(atleta.atleta_id)];
        if (!atletaData) continue;
        const partida = findMatchForClub(h.partidas?.partidas, atletaData.clube_id);
        if (!partida) continue;
        const isHome = partida.clube_casa_id === atletaData.clube_id;
        if (isHome) { sumHome += Number(atletaData.pontuacao || 0); cntHome += 1; }
        else { sumAway += Number(atletaData.pontuacao || 0); cntAway += 1; }
      }
    }
    const avgHome = cntHome > 0 ? parseFloat((sumHome / cntHome).toFixed(2)) : 0;
    const avgAway = cntAway > 0 ? parseFloat((sumAway / cntAway).toFixed(2)) : 0;
    return { avgHome, avgAway };
  };

  const aAvg = computeHomeAwayAvg(a);
  const bAvg = computeHomeAwayAvg(b);

  const mainStats: StatRow[] = [
    { label: 'Média', valueA: parseFloat(a.media_num.toFixed(2)), valueB: parseFloat(b.media_num.toFixed(2)), higherIsBetter: true },
    { label: 'Média Casa', valueA: aAvg.avgHome, valueB: bAvg.avgHome, higherIsBetter: true },
    { label: 'Média Fora', valueA: aAvg.avgAway, valueB: bAvg.avgAway, higherIsBetter: true },
    { label: 'Jogos', valueA: a.jogos_num, valueB: b.jogos_num, higherIsBetter: true },
  ];

  // Build scout rows - collect all scouts from both players
  const allScoutKeys = new Set<string>();
  if (a.scout) Object.keys(a.scout).forEach(k => allScoutKeys.add(k));
  if (b.scout) Object.keys(b.scout).forEach(k => allScoutKeys.add(k));

  const scoutRowsBase: StatRow[] = Array.from(allScoutKeys)
    .filter(k => SCOUT_LABELS[k])
    .sort((x, y) => {
      const xPos = SCOUT_LABELS[x]?.positive ? 0 : 1;
      const yPos = SCOUT_LABELS[y]?.positive ? 0 : 1;
      return xPos - yPos;
    })
    .map(k => ({
      label: SCOUT_LABELS[k].label,
      valueA: (a.scout as any)?.[k] || 0,
      valueB: (b.scout as any)?.[k] || 0,
      higherIsBetter: SCOUT_LABELS[k].positive,
    }))
    .filter(r => r.valueA > 0 || r.valueB > 0);

  const scoutRows = scoutRowsBase.filter(r => r.label !== SCOUT_LABELS.FD.label);
  const fdRow: StatRow = {
    label: SCOUT_LABELS.FD.label,
    valueA: (a.scout as any)?.FD || 0,
    valueB: (b.scout as any)?.FD || 0,
    higherIsBetter: SCOUT_LABELS.FD.positive,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] p-0 overflow-hidden bg-card">
        <ScrollArea className="h-[80vh]">
          <div className="p-4">
            <DialogHeader>
              <DialogTitle className="text-center text-lg font-black text-primary uppercase">
                Comparativo de Atletas
              </DialogTitle>
            </DialogHeader>

            {/* Player Headers */}
            <div className="grid grid-cols-2 gap-0 mt-4 border-b-2 border-primary sticky top-0 z-20 bg-card">
              <PlayerHeader atleta={a} clube={clubeA} />
              <PlayerHeader atleta={b} clube={clubeB} />
            </div>

            {/* Main Stats */}
            <div className="mt-2">
              <p className="text-xs font-bold text-muted-foreground uppercase px-3 py-2">Estatísticas</p>
              {mainStats.map(row => (
                <CompareRow key={row.label} row={row} />
              ))}
            </div>

            {/* Scouts */}
            {(scoutRows.length > 0 || fdRow.valueA > 0 || fdRow.valueB > 0) && (
              <div className="mt-4">
                <p className="text-xs font-bold text-muted-foreground uppercase px-3 py-2">Scouts</p>
                {scoutRows.map(row => (
                  <CompareRow key={row.label} row={row} />
                ))}
                <CompareRow row={fdRow} />
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
