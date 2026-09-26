/**
 * Estado local da ponte com o HUB (neste aparelho): de quem é o aparelho e a fila de eventos a enviar.
 * Prova com dados locais: a fila vive no aparelho até virar arquivo para o HUB.
 * (Sincronização real, com fila controlada e confirmação do HUB, vem depois.)
 */
import type { AjudanteHub, Guardados, ItemSaida } from '../domain/cargaHub';
import type { MemoriaOperacional } from '../domain/memoria';
import { gravarJSON, lerJSON } from './persistencia';

/** Ajudante da SESSÃO ativa (não do aparelho). */
const CHAVE_AJUDANTE = 'logiscan_street_ajudante_hub_v0';
const CHAVE_SAIDA = 'logiscan_street_saida_hub_v0';
/** Cargas/pacotes/eventos de ajudantes com sessão encerrada, guardados à parte. */
const CHAVE_GUARDADOS = 'logiscan_street_sessoes_guardadas_v0';

export const lerAjudanteDoAparelho = () => lerJSON<AjudanteHub | null>(CHAVE_AJUDANTE, null);
export const gravarAjudanteDoAparelho = (a: AjudanteHub | null) => gravarJSON(CHAVE_AJUDANTE, a);
export const lerSaida = () => {
  const s = lerJSON<unknown>(CHAVE_SAIDA, []);
  return Array.isArray(s) ? (s as ItemSaida[]) : [];
};
export const gravarSaida = (s: ItemSaida[]) => gravarJSON(CHAVE_SAIDA, s);
export const lerGuardados = () => {
  const g = lerJSON<unknown>(CHAVE_GUARDADOS, {});
  return g && typeof g === 'object' && !Array.isArray(g) ? (g as Guardados) : {};
};
export const gravarGuardados = (g: Guardados) => gravarJSON(CHAVE_GUARDADOS, g);

/** Memória do aparelho usada quando NENHUM perfil está em sessão (uso livre do Street). */
const CHAVE_MEMORIA_SEM_PERFIL = 'logiscan_street_memoria_sem_perfil_v0';
export const lerMemoriaSemPerfil = () => lerJSON<MemoriaOperacional | null>(CHAVE_MEMORIA_SEM_PERFIL, null);
export const gravarMemoriaSemPerfil = (m: MemoriaOperacional) => gravarJSON(CHAVE_MEMORIA_SEM_PERFIL, m);

/**
 * Conhecimento de ruas DESTE aparelho decidido na revisão (vale para todos os perfis):
 * "esta rua/região que veio do HUB fica neste card". Chave = street_id (regra comum com o HUB)
 * ou `regiao:<id do nome>`. Não é memória de endereços (essa continua por perfil).
 */
const CHAVE_APELIDOS = 'logiscan_street_encaixe_ruas_v0';
const CHAVE_REGIOES = 'logiscan_street_cards_regiao_v0';
export const lerApelidosRua = () => {
  const a = lerJSON<unknown>(CHAVE_APELIDOS, {});
  return a && typeof a === 'object' && !Array.isArray(a) ? (a as Record<string, string>) : {};
};
export const gravarApelidosRua = (a: Record<string, string>) => gravarJSON(CHAVE_APELIDOS, a);
export const lerCardsDeRegiao = () => {
  const r = lerJSON<unknown>(CHAVE_REGIOES, []);
  return Array.isArray(r) ? (r as string[]) : [];
};
export const gravarCardsDeRegiao = (r: string[]) => gravarJSON(CHAVE_REGIOES, r);
