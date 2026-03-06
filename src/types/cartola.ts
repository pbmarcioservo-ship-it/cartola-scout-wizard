export interface Time {
  id: string;
  nome: string;
  abreviacao: string;
  escudo: string;
  shieldClass: string;
}

export interface Partida {
  id: string;
  mandante: Time;
  visitante: Time;
  rodada: number;
}

export interface Atleta {
  id: number;
  nome: string;
  apelido: string;
  foto: string;
  posicao: string;
  posicaoAbrev: string;
  clube: Time;
  pontuacao: number;
  media: number;
  preco: number;
  variacao: number;
  jogos: number;
  scouts: AtletaScouts;
  ultimasPontuacoes: number[];
}

export interface AtletaScouts {
  // Scouts positivos
  gols: number;
  assistencias: number;
  finalizacaoTrave: number;
  finalizacaoDefendida: number;
  finalizacaoFora: number;
  faltaSofrida: number;
  roubadaBola: number;
  passeCerto: number;
  golContra: number;
  
  // Scouts negativos
  cartaoAmarelo: number;
  cartaoVermelho: number;
  faltaCometida: number;
  penaltiPerdido: number;
  impedimento: number;
  passeErrado: number;
  
  // Scouts de goleiro/defesa
  defesa: number;
  defesaDificil: number;
  golSofrido: number;
  semGol: number;
  desarme: number;
}

export interface StatusRodada {
  rodadaAtual: number;
  status: 'aberto' | 'fechado' | 'em_andamento';
  inicio: string;
  fim: string;
}

export type PosicaoFilter = 'todos' | 'goleiro' | 'lateral' | 'zagueiro' | 'meia' | 'atacante' | 'tecnico';

export type ScoutFilter = 
  | 'gols' 
  | 'assistencias' 
  | 'desarmes' 
  | 'finalizacaoDefendida' 
  | 'finalizacaoFora' 
  | 'finalizacaoTrave'
  | 'defesas' 
  | 'defesaPenalti'
  | 'semGol'
  | 'roubadaBola'
  | 'faltaSofrida'
  | 'passeCerto'
  | 'cartaoAmarelo'
  | 'cartaoVermelho'
  | 'faltaCometida'
  | 'golContra'
  | 'penaltiPerdido'
  | 'impedimento'
  | 'passeErrado'
  | 'golSofrido';

export type ViewType = 
  | 'cruzamento' 
  | 'atletas' 
  | 'medias' 
  | 'tops' 
  | 'provaveis' 
  | 'batedores'
  | 'escalados'
  | 'intocaveis'
  | 'time-rodada'
  | 'artilheiros'
  | 'acompanhamento'
  | 'agente-tecnico'
  | 'minha-conta';
