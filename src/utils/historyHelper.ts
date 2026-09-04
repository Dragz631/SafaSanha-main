import { DeliveryData, CompletedDayRecord, DeliveryTimelineEvent } from '../types';

export const HISTORY_STORAGE_KEY = 'logiscan_completed_history_v1';

/**
 * Consolida registros históricos para que NUNCA haja mais de um card para a mesma data (ex: múltiplos dia 03/09).
 * Se houver dias repetidos no localStorage, mescla as entregas sem duplicação de pacotes.
 */
export const consolidateHistoryRecords = (records: CompletedDayRecord[]): CompletedDayRecord[] => {
  const map = new Map<string, CompletedDayRecord>();

  records.forEach((rec) => {
    // Chave única pela data de referência (YYYY-MM-DD)
    const refDate = rec.data_referencia || (rec.data_fechamento ? rec.data_fechamento.split('T')[0] : 'sem_data');

    if (!map.has(refDate)) {
      map.set(refDate, {
        ...rec,
        id_dia: `dia_${refDate}`,
        data_referencia: refDate,
      });
    } else {
      const existing = map.get(refDate)!;

      // Mescla entregas sem duplicar pacotes por id_entrega ou codigo_pacote
      const deliveryMap = new Map<string, DeliveryData>();
      (existing.entregas || []).forEach((d) => deliveryMap.set(d.id_entrega || d.codigo_pacote, d));
      (rec.entregas || []).forEach((d) => deliveryMap.set(d.id_entrega || d.codigo_pacote, d));
      const mergedDeliveries = Array.from(deliveryMap.values());

      // Recalcula resumo por ruas
      const streetCount = new Map<string, number>();
      mergedDeliveries.forEach((d) => {
        const rua = d.sub_rua_manilha ? `Manilha (${d.sub_rua_manilha})` : d.endereco_rua || 'Caju';
        streetCount.set(rua, (streetCount.get(rua) || 0) + 1);
      });
      const mergedResumoRuas = Array.from(streetCount.entries()).map(([nome_rua, qtd_entregues]) => ({
        nome_rua,
        qtd_entregues,
      }));

      const newerDate =
        new Date(rec.data_fechamento || 0).getTime() > new Date(existing.data_fechamento || 0).getTime()
          ? rec.data_fechamento
          : existing.data_fechamento;

      map.set(refDate, {
        ...existing,
        id_dia: `dia_${refDate}`,
        data_referencia: refDate,
        data_fechamento: newerDate,
        total_entregues: mergedDeliveries.length,
        total_remanejados: Math.max(existing.total_remanejados || 0, rec.total_remanejados || 0),
        total_devolvidos: Math.max(existing.total_devolvidos || 0, rec.total_devolvidos || 0),
        entregas: mergedDeliveries,
        resumo_ruas: mergedResumoRuas,
      });
    }
  });

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.data_referencia).getTime() - new Date(a.data_referencia).getTime()
  );
};

/**
 * Carrega todos os registros de dias concluídos salvos no histórico permanente
 * (Garante deduplicação automática de dias iguais)
 */
export const loadCompletedHistory = (): CompletedDayRecord[] => {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const consolidated = consolidateHistoryRecords(parsed);
        if (consolidated.length !== parsed.length) {
          saveCompletedHistory(consolidated);
        }
        return consolidated;
      }
    }
  } catch (err) {
    console.warn('Aviso: Erro ao carregar histórico de entregas concluídas:', err);
  }
  return [];
};

/**
 * Salva a lista de dias concluídos no histórico permanente
 */
export const saveCompletedHistory = (history: CompletedDayRecord[]): void => {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch (err) {
    console.warn('Aviso: Erro ao salvar histórico de entregas concluídas:', err);
  }
};

/**
 * Garante que o pacote tenha uma linha do tempo (timeline) completa e consistente
 */
export const ensurePackageTimeline = (delivery: DeliveryData): DeliveryTimelineEvent[] => {
  if (delivery.historico_timeline && delivery.historico_timeline.length > 0) {
    return delivery.historico_timeline;
  }

  const events: DeliveryTimelineEvent[] = [];
  const entradaTime = delivery.data_hora_entrada || delivery.data_original_recebimento || delivery.data_hora;

  // 1. Evento de Entrada
  events.push({
    id: `evt_in_${delivery.id_entrega}`,
    timestamp: entradaTime,
    tipo: 'entrada_app',
    titulo: '📥 Entrada no LogiScan / Custódia do Entregador',
    descricao: `Pacote recebido da J&T Express e registrado para a rota do Caju.`,
    detalhes: `Código: ${delivery.codigo_pacote} • Destinatário: ${delivery.nome_destinatario || 'Morador'}`,
  });

  // 2. Evento de Em Rota
  const rua = delivery.sub_rua_manilha
    ? `${delivery.sub_rua_manilha} (Manilha • Caju)`
    : `${delivery.endereco_rua || 'Caju'}, Nº ${delivery.numero_casa || 'S/N'}`;

  events.push({
    id: `evt_route_${delivery.id_entrega}`,
    timestamp: entradaTime,
    tipo: 'em_rota',
    titulo: '🚚 Em Rota no Caju',
    descricao: `Pacote alocado na rota para entrega em: ${rua}`,
  });

  // 3. Evento de Tentativa / Falha anterior (se houver)
  if (delivery.status === 'insucesso' && delivery.motivo_insucesso) {
    events.push({
      id: `evt_fail_${delivery.id_entrega}`,
      timestamp: delivery.data_hora,
      tipo: 'tentativa_insucesso',
      titulo: '⚠️ Insucesso na Entrega',
      descricao: `Tentativa não concluída. Motivo: ${delivery.motivo_insucesso}`,
      detalhes: delivery.motivo_insucesso,
    });
  }

  // 4. Evento de Entrega Concluída (se entregue)
  if (delivery.status === 'entregue' || delivery.status === 'concluido') {
    const entregaTime = delivery.data_hora_entrega || delivery.data_hora;
    events.push({
      id: `evt_done_${delivery.id_entrega}`,
      timestamp: entregaTime,
      tipo: 'entrega_concluida',
      titulo: '✅ Entrega Concluída no Local (Prova Definitiva)',
      descricao: `Recebido por: ${delivery.recebedor_detalhes || 'Morador no endereço'}.`,
      detalhes: `Tipo: ${delivery.recebedor_tipo === 'proprio_morador' ? 'Próprio Morador' : delivery.recebedor_tipo === 'vizinho' ? 'Vizinho' : delivery.recebedor_tipo === 'associacao' ? 'Associação de Moradores' : 'Estabelecimento'}`,
      foto_url: delivery.foto_local_path || delivery.foto_pacote_path,
    });
  }

  return events;
};

/**
 * Adiciona um novo evento à timeline de um pacote
 */
export const appendTimelineEvent = (
  delivery: DeliveryData,
  event: Omit<DeliveryTimelineEvent, 'id'>
): DeliveryData => {
  const currentTimeline = ensurePackageTimeline(delivery);
  const newEvent: DeliveryTimelineEvent = {
    ...event,
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
  };

  return {
    ...delivery,
    historico_timeline: [...currentTimeline, newEvent],
  };
};

/**
 * Encerra o dia atual:
 * - Separa os pacotes entregues para arquivamento definitivo no histórico permanente.
 * - Trata os pacotes não entregues (remanejando para o dia seguinte ou marcando como devolução).
 */
export const closeCurrentDeliveryDay = (params: {
  deliveries: DeliveryData[];
  dayDate?: string; // YYYY-MM-DD
  rolloverNonDeliveredToNextDay?: boolean;
}): {
  completedDay: CompletedDayRecord;
  nextDayDeliveries: DeliveryData[];
  totalDelivered: number;
  totalRolledOver: number;
} => {
  const { deliveries, dayDate, rolloverNonDeliveredToNextDay = true } = params;
  const now = new Date();
  const dateRef = dayDate || now.toISOString().split('T')[0];

  const deliveredList: DeliveryData[] = [];
  const nonDeliveredList: DeliveryData[] = [];

  deliveries.forEach((d) => {
    const isDelivered = d.status === 'entregue' || d.status === 'concluido';
    if (isDelivered) {
      // Garante que o pacote entregue tenha timestamps exatos e timeline completa
      const withTimeline: DeliveryData = {
        ...d,
        data_hora_entrada: d.data_hora_entrada || d.data_original_recebimento || d.data_hora,
        data_hora_entrega: d.data_hora_entrega || d.data_hora,
        historico_timeline: ensurePackageTimeline(d),
      };
      deliveredList.push(withTimeline);
    } else {
      nonDeliveredList.push(d);
    }
  });

  // Agrupamento por rua para o resumo do dia
  const streetsSummaryMap = new Map<string, number>();
  deliveredList.forEach((d) => {
    const rua = d.sub_rua_manilha ? `Manilha (${d.sub_rua_manilha})` : d.endereco_rua || 'Caju';
    streetsSummaryMap.set(rua, (streetsSummaryMap.get(rua) || 0) + 1);
  });

  const resumo_ruas = Array.from(streetsSummaryMap.entries()).map(([nome_rua, qtd_entregues]) => ({
    nome_rua,
    qtd_entregues,
  }));

  // Salva no histórico permanente (se já existir o mesmo dia, mescla as entregas para nunca ter dias duplicados)
  const existingHistory = loadCompletedHistory();
  const existingDay = existingHistory.find((h) => h.data_referencia === dateRef);

  let completedDay: CompletedDayRecord;

  if (existingDay) {
    const deliveryMap = new Map<string, DeliveryData>();
    (existingDay.entregas || []).forEach((d) => deliveryMap.set(d.id_entrega || d.codigo_pacote, d));
    deliveredList.forEach((d) => deliveryMap.set(d.id_entrega || d.codigo_pacote, d));
    const mergedDeliveries = Array.from(deliveryMap.values());

    const streetCount = new Map<string, number>();
    mergedDeliveries.forEach((d) => {
      const rua = d.sub_rua_manilha ? `Manilha (${d.sub_rua_manilha})` : d.endereco_rua || 'Caju';
      streetCount.set(rua, (streetCount.get(rua) || 0) + 1);
    });
    const mergedResumoRuas = Array.from(streetCount.entries()).map(([nome_rua, qtd_entregues]) => ({
      nome_rua,
      qtd_entregues,
    }));

    completedDay = {
      ...existingDay,
      id_dia: `dia_${dateRef}`,
      data_referencia: dateRef,
      data_fechamento: now.toISOString(),
      total_entregues: mergedDeliveries.length,
      total_remanejados: rolloverNonDeliveredToNextDay ? nonDeliveredList.length : existingDay.total_remanejados,
      total_devolvidos: rolloverNonDeliveredToNextDay ? 0 : nonDeliveredList.length,
      entregas: mergedDeliveries,
      resumo_ruas: mergedResumoRuas,
    };
  } else {
    completedDay = {
      id_dia: `dia_${dateRef}`,
      data_referencia: dateRef,
      data_fechamento: now.toISOString(),
      total_entregues: deliveredList.length,
      total_remanejados: rolloverNonDeliveredToNextDay ? nonDeliveredList.length : 0,
      total_devolvidos: rolloverNonDeliveredToNextDay ? 0 : nonDeliveredList.length,
      entregas: deliveredList,
      resumo_ruas,
    };
  }

  const updatedHistory = [
    completedDay,
    ...existingHistory.filter((h) => h.data_referencia !== dateRef && h.id_dia !== completedDay.id_dia),
  ];
  saveCompletedHistory(updatedHistory);

  // Prepara os pacotes que vão para o dia seguinte com histórico mantido
  const nextDayDeliveries: DeliveryData[] = rolloverNonDeliveredToNextDay
    ? nonDeliveredList.map((d) => {
        const attempts = (d.tentativas_anteriores || 0) + (d.status === 'insucesso' ? 1 : 0);
        const originalIntake = d.data_original_recebimento || d.data_hora_entrada || d.data_hora;

        const updated = appendTimelineEvent(
          {
            ...d,
            status: 'aguardando_rua', // Volta para pendente na nova rota
            tentativas_anteriores: attempts,
            data_original_recebimento: originalIntake,
            data_reentrega: now.toISOString().split('T')[0],
          },
          {
            timestamp: now.toISOString(),
            tipo: 'reagendamento_dia_seguinte',
            titulo: '🔄 Transferido para Nova Rota no Dia Seguinte',
            descricao: `Pacote mantido em custódia para nova tentativa de entrega na próxima rota.`,
            detalhes: d.motivo_insucesso ? `Último insucesso: ${d.motivo_insucesso}` : 'Pendente de atendimento',
          }
        );

        return updated;
      })
    : [];

  return {
    completedDay,
    nextDayDeliveries,
    totalDelivered: deliveredList.length,
    totalRolledOver: nextDayDeliveries.length,
  };
};

/**
 * Gera texto de Prova Definitiva / Antiacareação para compartilhamento ou auditoria
 */
export const buildProofOfDeliveryText = (delivery: DeliveryData): string => {
  const entrada = delivery.data_hora_entrada || delivery.data_original_recebimento || delivery.data_hora;
  const entrega = delivery.data_hora_entrega || delivery.data_hora;
  
  const entradaFormatada = new Date(entrada).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const entregaFormatada = new Date(entrega).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const endereco = delivery.sub_rua_manilha
    ? `${delivery.sub_rua_manilha}, Nº ${delivery.numero_casa || 'S/N'}${delivery.complemento ? ` (${delivery.complemento})` : ''} - Setor Manilha (Parque N. Sra. da Penha • Caju)`
    : `${delivery.endereco_rua || 'Caju'}, Nº ${delivery.numero_casa || 'S/N'}${delivery.complemento ? ` (${delivery.complemento})` : ''}`;

  return [
    `📦 *COMPROVANTE TEMPORAL DE ENTREGA - SAFASANHA (LOGISCAN)*`,
    `⚖️ *PROVA DEFINITIVA DE LOCAL E HORÁRIO (ANTIACAREAÇÃO)*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🏷️ *Código do Pacote:* ${delivery.codigo_pacote}`,
    `👤 *Destinatário:* ${delivery.nome_destinatario || 'Morador'}`,
    `📍 *Endereço:* ${endereco}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📥 *Entrada na Custódia (J&T):* ${entradaFormatada}`,
    `✅ *Conclusão da Entrega:* ${entregaFormatada}`,
    `🤝 *Quem Recebeu:* ${delivery.recebedor_detalhes || 'Morador no endereço'}`,
    `📌 *Tipo de Recebedor:* ${
      delivery.recebedor_tipo === 'proprio_morador'
        ? 'Próprio Morador'
        : delivery.recebedor_tipo === 'vizinho'
        ? 'Vizinho'
        : delivery.recebedor_tipo === 'associacao'
        ? 'Associação de Moradores'
        : 'Estabelecimento Comercial'
    }`,
    delivery.tentativas_anteriores && delivery.tentativas_anteriores > 0
      ? `🔄 *Tentativas Anteriores:* ${delivery.tentativas_anteriores} registro(s)`
      : `✨ *Entrega Efetuada na 1ª Rota*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🔒 _Registro gravado no LogiScan SafaSanha com rastro temporal auditável._`,
  ].join('\n');
};
