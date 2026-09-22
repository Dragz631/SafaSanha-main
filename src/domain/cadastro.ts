/**
 * Cadastro e correção de pacotes contra a memória de destinos.
 * Regra: vincula sozinho só quando a identidade é clara (`exato`/`novo`);
 * em `sugestao`/`ambiguo` o pacote entra SEM vínculo e a memória NÃO aprende nada até o operador confirmar.
 */
import type { DeliveryData } from '../types';
import { enderecoDoPacote } from './agrupamento';
import type { Resolucao } from './destino';
import { limparEspacos } from './texto';
import { registrarPacote, resolverDestino, type MemoriaOperacional } from './memoria';

export interface EntradaPacote {
  /** Rua de exibição/agrupamento (na Manilha, a aba: "Manilha"). */
  rua: string;
  /** Só na Manilha: a sub-rua real (ex.: "Rua B"). */
  subRuaManilha?: string;
  numero: string;
  complemento?: string;
  nome?: string;
  codigo?: string;
  origem?: 'auto' | 'manual' | 'ocr_ai';
}

export function gerarCodigoManual(existentes: Iterable<string>, sorteio: () => number = Math.random): string {
  const usados = new Set(Array.from(existentes, (c) => c.toLowerCase()));
  for (let i = 0; i < 200; i++) {
    const c = `#${Math.floor(1000 + sorteio() * 9000)}`;
    if (!usados.has(c.toLowerCase())) return c;
  }
  return `#${Date.now().toString().slice(-6)}`;
}

export function montarPacote(entrada: EntradaPacote, agora: string, codigosExistentes: Iterable<string> = [], idSufixo = ''): DeliveryData {
  const rua = limparEspacos(entrada.rua);
  const numero = limparEspacos(entrada.numero) || 'S/N';
  const comp = limparEspacos(entrada.complemento);
  const nome = limparEspacos(entrada.nome) || 'Morador';
  const sub = limparEspacos(entrada.subRuaManilha);
  const via = sub || rua;
  const endereco_completo = `${via}, ${numero}${comp ? ` (${comp})` : ''}${sub ? ' (Manilha • Caju)' : ''}`;

  return {
    id_entrega: `del_${Date.parse(agora) || Date.now()}${idSufixo || `_${Math.random().toString(36).slice(2, 6)}`}`,
    codigo_pacote: entrada.codigo?.trim() || gerarCodigoManual(codigosExistentes),
    nome_destinatario: nome,
    recebedor_detalhes: nome,
    recebedor_tipo: 'proprio_morador',
    endereco_rua: rua,
    sub_rua_manilha: sub || undefined,
    numero_casa: numero,
    endereco_numero: numero,
    complemento: comp || undefined,
    endereco_completo,
    foto_pacote_path: '',
    foto_local_path: '',
    data_hora: agora,
    data_hora_entrada: agora,
    status: 'aguardando_rua',
    origem_leitura: entrada.origem ?? 'manual',
  };
}

export interface ResultadoCadastro {
  memoria: MemoriaOperacional;
  pacote: DeliveryData;
  resolucao: Resolucao;
  /** true quando ficou aguardando confirmação do operador. */
  pendente: boolean;
}

export function cadastrarPacote(mem: MemoriaOperacional, pacote: DeliveryData, agora: string): ResultadoCadastro {
  const end = enderecoDoPacote(pacote);
  const resolucao = resolverDestino(mem, end);
  if (resolucao.status === 'novo' || resolucao.status === 'exato') {
    const { memoria } = registrarPacote(mem, end, pacote.nome_destinatario, agora);
    return { memoria, pacote: { ...pacote, destino_id: resolucao.destinoId }, resolucao, pendente: false };
  }
  return { memoria: mem, pacote: { ...pacote, destino_id: undefined }, resolucao, pendente: true };
}

/**
 * O operador confirmou o destino de um pacote pendente (um candidato sugerido ou o "endereço simples" novo).
 * Só aqui a memória aprende com o pacote.
 */
export function confirmarDestino(
  mem: MemoriaOperacional,
  pacote: DeliveryData,
  destinoId: string,
  agora: string
): { memoria: MemoriaOperacional; pacote: DeliveryData } {
  const end = enderecoDoPacote(pacote);
  const alvo = destinoId === end.destinoId ? end : { ...end, destinoId };
  const { memoria } = registrarPacote(mem, alvo, pacote.nome_destinatario, agora);
  return { memoria, pacote: { ...pacote, destino_id: destinoId } };
}

/** Correção manual: reinterpreta o endereço editado e vincula de novo (o histórico anterior permanece na memória). */
export function corrigirPacote(
  mem: MemoriaOperacional,
  original: DeliveryData,
  novos: Pick<EntradaPacote, 'rua' | 'subRuaManilha' | 'numero' | 'complemento' | 'nome'> & { codigo?: string },
  agora: string
): ResultadoCadastro {
  const base = montarPacote({ ...novos, codigo: novos.codigo || original.codigo_pacote }, agora, []);
  const editado: DeliveryData = {
    ...original,
    codigo_pacote: base.codigo_pacote,
    nome_destinatario: base.nome_destinatario,
    endereco_rua: base.endereco_rua,
    sub_rua_manilha: base.sub_rua_manilha,
    numero_casa: base.numero_casa,
    endereco_numero: base.endereco_numero,
    complemento: base.complemento,
    endereco_complemento: undefined,
    endereco_completo: base.endereco_completo,
    destino_id: undefined,
  };
  return cadastrarPacote(mem, editado, agora);
}
