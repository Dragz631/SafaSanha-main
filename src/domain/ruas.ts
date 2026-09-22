/**
 * FONTE ÚNICA de "quais pacotes pertencem a esta rua" e "quantos pacotes há".
 * Antes existiam 5 implementações diferentes (com `includes` em substring), que geravam números
 * divergentes na mesma tela e faziam pacotes sem endereço aparecerem em TODAS as ruas.
 * Aqui a comparação é por igualdade da chave normalizada — nunca por substring.
 */
import type { DeliveryData } from '../types';
import { getManilhaSubStreet, isManilhaDelivery } from '../data/cajuStreets';
import { chaveTexto, limparEspacos } from './texto';

export function statusEntregue(d: Pick<DeliveryData, 'status'>): boolean {
  return d.status === 'entregue' || d.status === 'concluido';
}

export interface ContagemPacotes {
  total: number;
  entregues: number;
  insucessos: number;
  pendentes: number;
}

export function contarPacotes(lista: DeliveryData[]): ContagemPacotes {
  const entregues = lista.filter(statusEntregue).length;
  const insucessos = lista.filter((d) => d.status === 'insucesso').length;
  return { total: lista.length, entregues, insucessos, pendentes: lista.length - entregues - insucessos };
}

/** A aba "Manilha" agrupa várias sub-ruas; é a única área composta. */
export function ehAreaManilha(nomeRua: string): boolean {
  return chaveTexto(nomeRua).startsWith('manilha');
}

/** Nome da rua do pacote (sem a lógica da Manilha). Legado: cai para o 1º trecho do endereço completo. */
export function ruaBaseDoPacote(d: DeliveryData): string {
  return limparEspacos(d.endereco_rua || d.endereco_completo?.split(',')[0] || '');
}

/** Rua "real" onde o pacote está (na Manilha, a sub-rua). */
export function ruaRealDoPacote(d: DeliveryData): string {
  return isManilhaDelivery(d) ? getManilhaSubStreet(d) : ruaBaseDoPacote(d);
}

export function pertenceARua(d: DeliveryData, rua: string): boolean {
  const chave = chaveTexto(rua);
  if (!chave) return false;
  if (ehAreaManilha(rua)) return isManilhaDelivery(d);
  if (isManilhaDelivery(d)) return false;
  return chaveTexto(ruaBaseDoPacote(d)) === chave;
}

export function pacotesDaRua(lista: DeliveryData[], rua: string): DeliveryData[] {
  return lista.filter((d) => pertenceARua(d, rua));
}

/** Pacotes que não pertencem a nenhuma rua (dados inconsistentes) — nunca contam para uma rua. */
export function pacotesSemRua(lista: DeliveryData[]): DeliveryData[] {
  return lista.filter((d) => !isManilhaDelivery(d) && !chaveTexto(ruaBaseDoPacote(d)));
}

/** Ruas presentes nos pacotes (exceto Manilha), sem duplicar por caixa/acento. */
export function ruasDosPacotes(lista: DeliveryData[]): string[] {
  const mapa = new Map<string, string>();
  for (const d of lista) {
    if (isManilhaDelivery(d)) continue;
    const nome = ruaBaseDoPacote(d);
    const chave = chaveTexto(nome);
    if (chave && !mapa.has(chave)) mapa.set(chave, nome);
  }
  return Array.from(mapa.values());
}
