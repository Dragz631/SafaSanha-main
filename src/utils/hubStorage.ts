/**
 * Estado local da ponte com o HUB (neste aparelho): de quem é o aparelho e a fila de eventos a enviar.
 * Prova com dados locais: a fila vive no aparelho até virar arquivo para o HUB.
 * (Sincronização real, com fila controlada e confirmação do HUB, vem depois.)
 */
import type { AjudanteHub, Guardados, ItemSaida } from '../domain/cargaHub';
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
