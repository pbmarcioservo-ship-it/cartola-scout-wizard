import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ClubeEscudo } from '@/components/ClubeEscudo';
import { CartolaAtleta, CartolaClube, CartolaScout, CartolaPartida } from '@/lib/cartola-api';
import { POSICOES } from '@/hooks/useCartolaData';
import { cn } from '@/lib/utils';

const LS_KEY_LATERAL = 'statusfc_lateral_side_by_id';
function getLateralSideFromStore(atletaId: number): 'LD' | 'LE' | null {
  try {
    const raw = localStorage.getItem(LS_KEY_LATERAL);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, 'LD' | 'LE'>;
    return map[String(atletaId)] || null;
  } catch { return null; }
}

// Scout definitions: abbreviation → { label, pointsPerUnit }
const SCOUT_CONFIG: { key: keyof CartolaScout; label: string; pts: number }[] = [
  { key: 'G', label: 'Gol', pts: 8.0 },
  { key: 'A', label: 'Assistência', pts: 5.0 },
  { key: 'FT', label: 'Finalização na Trave', pts: 3.5 },
  { key: 'FD', label: 'Finalização Defendida', pts: 1.2 },
  { key: 'FF', label: 'Finalização pra Fora', pts: 0.8 },
  { key: 'FS', label: 'Falta Sofrida', pts: 0.5 },
  { key: 'RB', label: 'Roubada de Bola', pts: 1.5 },
  { key: 'PS', label: 'Passe Certo', pts: 0.08 },
  { key: 'DS', label: 'Desarme', pts: 1.2 },
  { key: 'SG', label: 'Jogo sem Gol', pts: 5.0 },
  { key: 'DE', label: 'Defesa', pts: 1.0 },
  { key: 'DP', label: 'Defesa de Pênalti', pts: 7.0 },
  { key: 'GC', label: 'Gol Contra', pts: -5.0 },
  { key: 'CA', label: 'Cartão Amarelo', pts: -2.0 },
  { key: 'CV', label: 'Cartão Vermelho', pts: -5.0 },
  { key: 'FC', label: 'Falta Cometida', pts: -0.5 },
  { key: 'PP', label: 'Pênalti Perdido', pts: -4.0 },
  { key: 'I', label: 'Impedimento', pts: -0.5 },
  { key: 'PE', label: 'Passe Errado', pts: -0.08 },
  { key: 'GS', label: 'Gol Sofrido', pts: -2.0 },
];

interface ParcialCardProps {
  atleta: CartolaAtleta | null;
  clube?: CartolaClube;
  clubes: Record<string, CartolaClube>;
  partidas: CartolaPartida[];
  scout?: CartolaScout;
  pontuacao?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isCaptain?: boolean;
}

export function ParcialCard({
  atleta,
  clube,
  clubes,
  partidas,
  scout,
  pontuacao,
  open,
  onOpenChange,
  isCaptain,
}: ParcialCardProps) {
  if (!atleta) return null;

  const posNome = POSICOES[atleta.posicao_id]?.nome || '?';
  const posAbrev = POSICOES[atleta.posicao_id]?.abreviacao || '?';
  const lateralSide = atleta.posicao_id === 2 ? getLateralSideFromStore(atleta.atleta_id) : null;
  const posLabel = lateralSide || posAbrev;

  // Find the match for this player
  const partida = partidas.find(
    p => p.clube_casa_id === atleta.clube_id || p.clube_visitante_id === atleta.clube_id
  );

  const clubeCasa = partida ? clubes[String(partida.clube_casa_id)] : undefined;
  const clubeVisitante = partida ? clubes[String(partida.clube_visitante_id)] : undefined;

  const hasPlayed = scout && Object.values(scout).some(v => v !== 0 && v !== undefined);
  const totalPts = pontuacao ?? 0;
  const captainPts = isCaptain ? totalPts * 1.5 : totalPts;

  // Build scout rows (only show scouts that have qty > 0, or show all zeroed if hasn't played)
  const scoutRows = SCOUT_CONFIG.map(cfg => {
    const qty = Number(scout?.[cfg.key] || 0);
    const pts = qty * cfg.pts;
    return { ...cfg, qty, pts };
  }).filter(r => hasPlayed ? r.qty !== 0 : false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md p-0 gap-0 rounded-2xl overflow-hidden border-0 shadow-2xl">
        {/* Header */}
        <div className="bg-primary text-primary-foreground px-4 py-3">
          <DialogHeader className="space-y-0">
            <DialogTitle className="sr-only">Parciais de {atleta.apelido}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-3">
            <img
              src={atleta.foto?.replace('FORMATO', '140x140')}
              alt={atleta.apelido}
              className="w-14 h-14 rounded-full object-cover ring-2 ring-primary-foreground/40 shadow-lg"
              onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-black text-base md:text-lg truncate">{atleta.apelido}</span>
                {isCaptain && (
                  <span className="bg-yellow-400 text-yellow-900 text-[9px] font-black px-1.5 py-0.5 rounded-full">CAP</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {clube && <ClubeEscudo clube={clube} size="xs" />}
                <span className="text-xs font-bold opacity-80">{posLabel}</span>
                <span className="text-[10px] opacity-60">#{atleta.atleta_id}</span>
              </div>
            </div>
          </div>

          {/* Live Score */}
          {partida && clubeCasa && clubeVisitante && (
            <div className="mt-3 flex items-center justify-center gap-3 bg-primary-foreground/10 rounded-lg px-3 py-2">
              <div className="flex items-center gap-1.5">
                <ClubeEscudo clube={clubeCasa} size="sm" />
                <span className="font-bold text-sm">{clubeCasa.abreviacao}</span>
              </div>
              <div className="bg-primary-foreground/20 px-3 py-1 rounded-lg">
                <span className="font-black text-lg tracking-wider">
                  {partida.placar_oficial_mandante !== null
                    ? `${partida.placar_oficial_mandante} x ${partida.placar_oficial_visitante}`
                    : '— x —'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm">{clubeVisitante.abreviacao}</span>
                <ClubeEscudo clube={clubeVisitante} size="sm" />
              </div>
            </div>
          )}
        </div>

        {/* Scout Table */}
        <div className="px-3 py-2 max-h-[50vh] overflow-y-auto">
          {!hasPlayed ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <span className="text-3xl mb-2">⏳</span>
              <span className="font-bold text-sm">Ainda não entrou em campo</span>
              <span className="text-xs mt-1 opacity-70">Os scouts aparecerão quando o jogador atuar</span>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1.5 px-2 text-[10px] md:text-xs font-bold text-muted-foreground uppercase">Scout</th>
                  <th className="text-center py-1.5 px-2 text-[10px] md:text-xs font-bold text-muted-foreground uppercase w-14">Qtd</th>
                  <th className="text-right py-1.5 px-2 text-[10px] md:text-xs font-bold text-muted-foreground uppercase w-20">Pontos</th>
                </tr>
              </thead>
              <tbody>
                {scoutRows.map(row => (
                  <tr key={row.key} className="border-b border-border/50 last:border-0">
                    <td className="py-1.5 px-2 text-xs md:text-sm font-semibold text-foreground">{row.label}</td>
                    <td className="py-1.5 px-2 text-center text-xs md:text-sm font-black text-foreground">{row.qty}</td>
                    <td className={cn(
                      "py-1.5 px-2 text-right text-xs md:text-sm font-black",
                      row.pts > 0 ? "text-green-600" : row.pts < 0 ? "text-red-500" : "text-muted-foreground"
                    )}>
                      {row.pts > 0 ? '+' : ''}{row.pts.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer - Total */}
        <div className={cn(
          "px-4 py-3 flex items-center justify-between border-t",
          captainPts > 0 ? "bg-green-50 border-green-200" : captainPts < 0 ? "bg-red-50 border-red-200" : "bg-muted/50 border-border"
        )}>
          <span className="font-bold text-sm text-foreground">
            Pontuação Total {isCaptain && <span className="text-yellow-600 text-xs">(Capitão 1.5x)</span>}
          </span>
          <span className={cn(
            "font-black text-xl",
            captainPts > 0 ? "text-green-600" : captainPts < 0 ? "text-red-500" : "text-muted-foreground"
          )}>
            {captainPts.toFixed(1)}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
