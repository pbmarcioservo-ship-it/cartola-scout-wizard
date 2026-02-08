import { Time, Partida } from '@/types/cartola';

export const times: Time[] = [
  { id: 'fla', nome: 'Flamengo', abreviacao: 'FLA', escudo: '', shieldClass: 'shield-fla' },
  { id: 'pal', nome: 'Palmeiras', abreviacao: 'PAL', escudo: '', shieldClass: 'shield-pal' },
  { id: 'sao', nome: 'São Paulo', abreviacao: 'SAO', escudo: '', shieldClass: 'shield-sao' },
  { id: 'cor', nome: 'Corinthians', abreviacao: 'COR', escudo: '', shieldClass: 'shield-cor' },
  { id: 'int', nome: 'Internacional', abreviacao: 'INT', escudo: '', shieldClass: 'shield-int' },
  { id: 'gre', nome: 'Grêmio', abreviacao: 'GRE', escudo: '', shieldClass: 'shield-gre' },
  { id: 'cam', nome: 'Atlético MG', abreviacao: 'CAM', escudo: '', shieldClass: 'shield-cam' },
  { id: 'bot', nome: 'Botafogo', abreviacao: 'BOT', escudo: '', shieldClass: 'shield-bot' },
  { id: 'vas', nome: 'Vasco', abreviacao: 'VAS', escudo: '', shieldClass: 'shield-vas' },
  { id: 'flu', nome: 'Fluminense', abreviacao: 'FLU', escudo: '', shieldClass: 'shield-flu' },
  { id: 'bah', nome: 'Bahia', abreviacao: 'BAH', escudo: '', shieldClass: 'shield-bah' },
  { id: 'for', nome: 'Fortaleza', abreviacao: 'FOR', escudo: '', shieldClass: 'shield-for' },
  { id: 'cap', nome: 'Athletico PR', abreviacao: 'CAP', escudo: '', shieldClass: 'shield-cap' },
  { id: 'vit', nome: 'Vitória', abreviacao: 'VIT', escudo: '', shieldClass: 'shield-vit' },
  { id: 'cru', nome: 'Cruzeiro', abreviacao: 'CRU', escudo: '', shieldClass: 'shield-cru' },
  { id: 'san', nome: 'Santos', abreviacao: 'SAN', escudo: '', shieldClass: 'shield-san' },
  { id: 'bgt', nome: 'Red Bull Bragantino', abreviacao: 'BGT', escudo: '', shieldClass: 'shield-bgt' },
  { id: 'mir', nome: 'Mirassol', abreviacao: 'MIR', escudo: '', shieldClass: 'shield-mir' },
  { id: 'cha', nome: 'Chapecoense', abreviacao: 'CHA', escudo: '', shieldClass: 'shield-cha' },
  { id: 'cba', nome: 'Cuiabá', abreviacao: 'CBA', escudo: '', shieldClass: 'shield-cba' },
];

export const getTimeById = (id: string): Time | undefined => {
  return times.find(t => t.id === id);
};

export const getTimeByAbreviacao = (abrev: string): Time | undefined => {
  return times.find(t => t.abreviacao === abrev);
};

// Partidas da rodada atual (mock - será substituído pela API)
export const partidasRodada: Partida[] = [
  { id: '1', mandante: times[0], visitante: times[13], rodada: 1 },
  { id: '2', mandante: times[1], visitante: times[15], rodada: 1 },
  { id: '3', mandante: times[2], visitante: times[11], rodada: 1 },
  { id: '4', mandante: times[3], visitante: times[18], rodada: 1 },
  { id: '5', mandante: times[4], visitante: times[17], rodada: 1 },
  { id: '6', mandante: times[5], visitante: times[12], rodada: 1 },
  { id: '7', mandante: times[6], visitante: times[10], rodada: 1 },
  { id: '8', mandante: times[7], visitante: times[14], rodada: 1 },
  { id: '9', mandante: times[8], visitante: times[16], rodada: 1 },
  { id: '10', mandante: times[9], visitante: times[19], rodada: 1 },
];
