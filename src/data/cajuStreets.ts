import { DeliveryData } from '../types';

// Áreas / Ruas Principais de Atendimento no Caju para seleção diária
export const CAJU_PRIMARY_AREAS = [
  'Rua Carlos Seidl',
  'Rua General Sampaio',
  'Rua General Gurjão',
  'Rua Praia do Caju',
  'Rua Monsenhor Manuel Gomes',
  'Rua Tavares Guerra',
  'Manilha', // Setor unificado do Parque Nossa Senhora da Penha
  'Quinta do Caju', // Setor Quinta do Caju (Hub com travessas e becos)
];

// Cards do Wireframe 3x3 de Seleção Diária
export interface DailyStreetCardItem {
  id: string;
  streetName: string;
  label: string;
  type: 'street' | 'hub' | 'associacao';
  shortDescription?: string;
}

export const DAILY_STREET_CARDS: DailyStreetCardItem[] = [
  // Linha 1 do wireframe
  { id: 'carlos_seidl', streetName: 'Rua Carlos Seidl', label: 'rua carlos seidl', type: 'street' },
  { id: 'manilha', streetName: 'Manilha', label: 'manilha', type: 'hub', shortDescription: 'Pq. N. Sra. da Penha' },
  { id: 'general_sampaio', streetName: 'Rua General Sampaio', label: 'rua general sampaio', type: 'street' },

  // Linha 2 do wireframe
  { id: 'general_gurjao', streetName: 'Rua General Gurjão', label: 'rua general gurjao', type: 'street' },
  { id: 'quinta_do_caju', streetName: 'Quinta do Caju', label: 'quinta do caju', type: 'hub', shortDescription: 'Travessas e Acessos' },
  { id: 'praia_do_caju', streetName: 'Rua Praia do Caju', label: 'rua praia do caju', type: 'street' },

  // Linha 3 do wireframe
  { id: 'tavares_guerra', streetName: 'Rua Tavares Guerra', label: 'rua tavares guerra', type: 'street' },
  { id: 'monsenhor_manuel_gomes', streetName: 'Rua Monsenhor Manuel Gomes', label: 'rua monsenhor manoel gomes', type: 'street' },
  { id: 'associacoes', streetName: 'Associações', label: 'associaçoes', type: 'associacao', shortDescription: 'Associações Comunitárias' },
];

// Sub-ruas estruturadas dentro da Manilha (Parque Nossa Senhora da Penha • Caju)
export interface ManilhaSubStreetDef {
  id: string;
  name: string;
  type: 'principal' | 'letra';
  role: string;
  shortLabel: string;
  order: number;
}

export const MANILHA_SUB_STREETS: ManilhaSubStreetDef[] = [
  // 1. Vias Principais da Manilha
  {
    id: 'leao_xiii',
    name: 'Rua Leão XIII',
    type: 'principal',
    role: 'Rua do Meio (Espinha Central)',
    shortLabel: 'Rua do Meio',
    order: 1,
  },
  {
    id: 'canal',
    name: 'Rua do Canal',
    type: 'principal',
    role: 'Rua da Direita',
    shortLabel: 'Rua da Direita',
    order: 2,
  },
  {
    id: 'nossa_senhora_penha',
    name: 'Rua Nossa Senhora da Penha',
    type: 'principal',
    role: 'Rua da Esquerda (a partir da Rua G)',
    shortLabel: 'Rua da Esquerda',
    order: 3,
  },

  // 2. Travessas de Ligação com Letras (Ordenadas Alfabeticamente de A a K)
  { id: 'rua_a', name: 'Rua A', type: 'letra', role: 'Ligação para a Rua do Canal', shortLabel: 'Letra A', order: 10 },
  { id: 'rua_b', name: 'Rua B', type: 'letra', role: 'Ligação para a Rua do Canal', shortLabel: 'Letra B', order: 11 },
  { id: 'rua_c', name: 'Rua C', type: 'letra', role: 'Ligação para a Rua do Canal', shortLabel: 'Letra C', order: 12 },
  { id: 'rua_d', name: 'Rua D', type: 'letra', role: 'Ligação para a Rua do Canal', shortLabel: 'Letra D', order: 13 },
  { id: 'rua_e', name: 'Rua E', type: 'letra', role: 'Ligação para a Rua do Canal', shortLabel: 'Letra E', order: 14 },
  { id: 'rua_f', name: 'Rua F', type: 'letra', role: 'Ligação para a Rua do Canal', shortLabel: 'Letra F', order: 15 },
  { id: 'rua_g', name: 'Rua G', type: 'letra', role: 'Ligação para o Canal e Acesso N. Sra. da Penha', shortLabel: 'Letra G', order: 16 },
  { id: 'rua_h', name: 'Rua H', type: 'letra', role: 'Ligação para a Rua do Canal', shortLabel: 'Letra H', order: 17 },
  { id: 'rua_i', name: 'Rua I', type: 'letra', role: 'Ligação para a Rua do Canal', shortLabel: 'Letra I', order: 18 },
  { id: 'rua_j', name: 'Rua J', type: 'letra', role: 'Ligação para a Rua do Canal', shortLabel: 'Letra J', order: 19 },
  { id: 'rua_k', name: 'Rua K', type: 'letra', role: 'Ligação para a Rua do Canal', shortLabel: 'Letra K', order: 20 },
];

export const ALL_PRESET_STREETS: string[] = [
  ...CAJU_PRIMARY_AREAS,
  ...MANILHA_SUB_STREETS.map(m => m.name),
];

// Identifica se um pacote pertence EXCLUSIVAMENTE ao Setor Manilha (Parque N. Sra. da Penha)
export const isManilhaDelivery = (d: DeliveryData): boolean => {
  const rua = (d.endereco_rua || '').toLowerCase().trim();
  const completo = (d.endereco_completo || '').toLowerCase().trim();

  // GUARD ABSOLUTO: Se for Carlos Seidl ou qualquer rua principal fora da Manilha, NUNCA é Manilha
  if (
    rua.includes('carlos seidl') ||
    rua.includes('general sampaio') ||
    rua.includes('general gurjão') ||
    rua.includes('praia do caju') ||
    rua.includes('monsenhor') ||
    rua.includes('tavares') ||
    completo.includes('carlos seidl') ||
    completo.includes('general sampaio') ||
    completo.includes('general gurjão') ||
    completo.includes('praia do caju') ||
    completo.includes('monsenhor') ||
    completo.includes('tavares')
  ) {
    return false;
  }

  // 1. Se foi cadastrado com sub-rua da Manilha
  if (d.sub_rua_manilha) return true;

  // 2. Se a rua cadastrada for explicitamente "Manilha"
  if (rua === 'manilha' || rua.startsWith('manilha')) return true;

  // 3. Se a rua for explicitamente uma das vias centrais da Manilha
  if (rua === 'rua leão xiii' || rua === 'rua leao xiii' || rua === 'leão xiii' || rua === 'leao xiii') return true;
  if (rua === 'rua do canal' || rua === 'canal') return true;
  if (rua === 'rua nossa senhora da penha' || rua === 'nossa senhora da penha' || rua === 'parque nossa senhora da penha') return true;

  // 4. Se for uma das travessas de letras da Manilha (com match exato: "Rua A", "Rua B", etc.)
  if (/^rua\s+[a-k]$/i.test(rua)) return true;

  // 5. Se o endereço completo mencionar explicitamente "(Manilha"
  if (completo.includes('(manilha') || completo.includes('setor manilha')) return true;

  return false;
};

// Extrai a sub-rua exata da Manilha de um pacote
export const getManilhaSubStreet = (d: DeliveryData): string => {
  if (d.sub_rua_manilha) {
    return d.sub_rua_manilha;
  }

  const rua = (d.endereco_rua || '').toLowerCase().trim();
  const completo = (d.endereco_completo || '').toLowerCase().trim();

  if (rua.includes('leão') || rua.includes('leao') || completo.includes('leão') || completo.includes('leao')) {
    return 'Rua Leão XIII';
  }
  if (rua.includes('canal') || completo.includes('canal')) {
    return 'Rua do Canal';
  }
  if (rua.includes('penha') || completo.includes('penha')) {
    return 'Rua Nossa Senhora da Penha';
  }

  // Procura por Letras isoladas (Ex: "Rua A", "Rua B", "Rua C"...)
  const letterMatch = rua.match(/^rua\s+([a-k])$/i) || completo.match(/\brua\s+([a-k])\b/i);
  if (letterMatch) {
    const letter = letterMatch[1].toUpperCase();
    return `Rua ${letter}`;
  }

  return 'Rua Leão XIII'; // Padrão principal da Manilha
};

export const getStreetInfo = (streetName: string) => {
  const clean = (streetName || '').toLowerCase().trim();

  if (clean === 'manilha' || clean.includes('manilha')) {
    return {
      sector: 'Caju • Setor Manilha',
      category: 'manilha_hub',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      description: 'Hub Unificado (Pq. N. Sra. da Penha: Leão XIII, Canal, Penha e Letras A a K)',
    };
  }

  const manilhaSub = MANILHA_SUB_STREETS.find(s => s.name.toLowerCase() === clean);
  if (manilhaSub) {
    return {
      sector: `Caju • Manilha (${manilhaSub.shortLabel})`,
      category: 'manilha_sub',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      description: `${manilhaSub.role} (Setor Manilha • Caju)`,
    };
  }

  if (clean === 'quinta do caju' || clean.includes('quinta')) {
    return {
      sector: 'Caju • Quinta do Caju',
      category: 'quinta_hub',
      badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      description: 'Setor Quinta do Caju (Hub de travessas e acessos locais)',
    };
  }

  if (clean === 'associações' || clean === 'associacoes' || clean.includes('associa')) {
    return {
      sector: 'Caju • Associações',
      category: 'associacao',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      description: 'Entregas especiais em associações comunitárias do Caju',
    };
  }

  if (CAJU_PRIMARY_AREAS.some(s => s.toLowerCase() === clean)) {
    return {
      sector: 'Caju • Principal',
      category: 'caju_principal',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      description: 'Via Arterial do Caju',
    };
  }

  return {
    sector: 'Caju • Outra Rua',
    category: 'custom',
    badgeColor: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    description: 'Rua cadastrada no Caju',
  };
};
