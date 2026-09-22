/**
 * Migração única: devolve aos pacotes (do dia e do histórico) as fotos que só existiam na fila do SafaSanhaso.
 * A fila antiga só é apagada se TODOS os itens dela foram casados e regravados com sucesso;
 * caso contrário fica intacta (nada de prova se perde).
 */
import type { CompletedDayRecord, DeliveryData } from '../types';
import { recuperarFotosDaFila, type ItemFilaLegada } from '../domain/fotosLegado';
import { HISTORY_STORAGE_KEY } from './historyHelper';
import { gravarJSON, lerJSON, removerChave } from './persistencia';

const CHAVE_FILA_ANTIGA = 'safasanhaso_sync_queue';

export function recuperarFotosDaFilaAntiga(chavePacotes: string): void {
  let bruto: string | null = null;
  try {
    bruto = localStorage.getItem(CHAVE_FILA_ANTIGA);
  } catch {
    return;
  }
  if (bruto === null) return;
  if (bruto.trim() === '[]') {
    removerChave(CHAVE_FILA_ANTIGA); // fila vazia: só lixo
    return;
  }
  const fila = lerJSON<ItemFilaLegada[]>(CHAVE_FILA_ANTIGA, []);
  if (!Array.isArray(fila) || fila.length === 0) return; // ilegível: não mexe

  const pacotes = lerJSON<DeliveryData[]>(chavePacotes, []);
  const historico = lerJSON<CompletedDayRecord[]>(HISTORY_STORAGE_KEY, []);

  const doDia = recuperarFotosDaFila(Array.isArray(pacotes) ? pacotes : [], fila);
  const historicoNovo = (Array.isArray(historico) ? historico : []).map((dia) => {
    const r = recuperarFotosDaFila(dia.entregas ?? [], fila);
    r.idsCasados.forEach((id) => doDia.idsCasados.add(id));
    return { dia: { ...dia, entregas: r.pacotes }, recuperadas: r.recuperadas };
  });

  const total = doDia.recuperadas + historicoNovo.reduce((acc, h) => acc + h.recuperadas, 0);
  let gravou = true;
  if (doDia.recuperadas > 0) gravou = gravarJSON(chavePacotes, doDia.pacotes) && gravou;
  if (historicoNovo.some((h) => h.recuperadas > 0)) gravou = gravarJSON(HISTORY_STORAGE_KEY, historicoNovo.map((h) => h.dia)) && gravou;

  const todosCasaram = fila.every((f) => f && f.id_entrega && doDia.idsCasados.has(f.id_entrega));
  if (gravou && todosCasaram) removerChave(CHAVE_FILA_ANTIGA);
  if (total > 0) console.info(`Fotos recuperadas da fila antiga: ${total}`);
}
