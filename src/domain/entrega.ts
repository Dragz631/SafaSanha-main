/**
 * Transições de estado de um pacote (puras). Cada baixa grava:
 *  - o status correto (insucesso NUNCA vira "entregue");
 *  - QUEM efetivamente recebeu naquele momento;
 *  - os horários (entrada, último status, entrega) — base de auditoria;
 *  - as fotos (nunca descartadas por um registro antigo).
 */
import type { DeliveryData, ReceiverType } from '../types';

export interface DadosEntrega {
  recebedor_tipo: ReceiverType;
  recebedor_detalhes: string;
  nome_destinatario?: string;
  foto_pacote_path?: string;
  foto_local_path?: string;
}

export function aplicarEntrega(d: DeliveryData, dados: DadosEntrega, agora: string): DeliveryData {
  return {
    ...d,
    nome_destinatario: dados.nome_destinatario ?? d.nome_destinatario,
    status: 'entregue',
    recebedor_tipo: dados.recebedor_tipo,
    recebedor_detalhes: dados.recebedor_detalhes,
    foto_pacote_path: dados.foto_pacote_path || d.foto_pacote_path || '',
    foto_local_path: dados.foto_local_path || d.foto_local_path || '',
    motivo_insucesso: undefined,
    data_hora_entrada: d.data_hora_entrada ?? d.data_hora,
    data_hora: agora,
    data_hora_entrega: agora,
  };
}

export function aplicarInsucesso(d: DeliveryData, motivo: string, agora: string): DeliveryData {
  return {
    ...d,
    status: 'insucesso',
    motivo_insucesso: motivo,
    data_hora_entrada: d.data_hora_entrada ?? d.data_hora,
    data_hora: agora,
    data_hora_entrega: undefined,
  };
}

export function reabrirPacote(d: DeliveryData, agora: string): DeliveryData {
  return {
    ...d,
    status: 'aguardando_rua',
    motivo_insucesso: undefined,
    data_hora_entrada: d.data_hora_entrada ?? d.data_hora,
    data_hora: agora,
    data_hora_entrega: undefined,
  };
}
