/**
 * Recuperação (pura) das fotos que a versão antiga guardava SOMENTE na fila de sincronização do SafaSanhaso:
 * o registro principal da entrega perdia as fotos (bug), então a fila era a única cópia da prova.
 * Só preenche campos de foto VAZIOS; nunca sobrescreve foto existente.
 */
import type { DeliveryData } from '../types';

export interface ItemFilaLegada {
  id_entrega?: string;
  foto_pacote_base64?: string;
  foto_local_base64?: string;
}

export function recuperarFotosDaFila<T extends Pick<DeliveryData, 'id_entrega' | 'foto_pacote_path' | 'foto_local_path'>>(
  pacotes: T[],
  fila: ItemFilaLegada[]
): { pacotes: T[]; recuperadas: number; idsCasados: Set<string> } {
  const porId = new Map(fila.filter((f) => f && f.id_entrega).map((f) => [f.id_entrega as string, f]));
  const idsCasados = new Set<string>();
  let recuperadas = 0;
  const saida = pacotes.map((p) => {
    const item = porId.get(p.id_entrega);
    if (!item) return p;
    idsCasados.add(p.id_entrega);
    const pacote = !p.foto_pacote_path && item.foto_pacote_base64 ? item.foto_pacote_base64 : p.foto_pacote_path;
    const local = !p.foto_local_path && item.foto_local_base64 ? item.foto_local_base64 : p.foto_local_path;
    if (pacote === p.foto_pacote_path && local === p.foto_local_path) return p;
    recuperadas += (pacote !== p.foto_pacote_path ? 1 : 0) + (local !== p.foto_local_path ? 1 : 0);
    return { ...p, foto_pacote_path: pacote, foto_local_path: local };
  });
  return { pacotes: saida, recuperadas, idsCasados };
}
