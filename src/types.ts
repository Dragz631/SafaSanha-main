export type ReceiverType =
  | 'proprio_morador'
  | 'vizinho'
  | 'estabelecimento'
  | 'associacao'
  | 'portaria'
  | 'familiar'
  | 'terceiros'
  | 'local_seguro';

export type DeliveryStatus =
  | 'aguardando_rua'
  | 'entregue'
  | 'processado_jt'
  | 'concluido'
  | 'aguardando_pin'
  | 'insucesso'
  | 'pendente_baixa'
  | 'em_revisao'
  | 'processando_robo'
  | 'agendado_reentrega'
  | 'devolucao_galpao';

export interface DeliveryTimelineEvent {
  id: string;
  timestamp: string; // ISO string
  tipo: 'entrada_app' | 'em_rota' | 'tentativa_insucesso' | 'reagendamento_dia_seguinte' | 'entrega_concluida' | 'devolucao';
  titulo: string;
  descricao: string;
  detalhes?: string;
  responsavel?: string;
  foto_url?: string;
}

export interface DeliveryData {
  id_entrega: string;
  codigo_pacote: string;
  recebedor_tipo: ReceiverType;
  recebedor_detalhes: string;
  foto_pacote_path: string; // Base64 or object URL
  foto_local_path: string;  // Base64 or object URL
  data_hora: string; // Timestamp do último status
  data_hora_entrada?: string; // Timestamp de quando entrou no app / com o entregador
  data_hora_entrega?: string; // Timestamp de quando foi entregue no local
  data_original_recebimento?: string; // Data original de quando o pacote foi recebido da J&T
  tentativas_anteriores?: number; // Contador de tentativas de entrega
  historico_timeline?: DeliveryTimelineEvent[]; // Linha do tempo completa auditável
  status: DeliveryStatus;
  origem_leitura?: 'auto' | 'manual' | 'ocr_ai';
  // Extracted Label Data (OCR Visão Computacional)
  nome_destinatario?: string;
  endereco_completo?: string;
  numero_casa?: string;
  complemento?: string;
  bairro?: string;
  ajudante_nome?: string;
  eh_predio?: boolean;
  // Address & Association fields
  endereco_rua?: string;
  sub_rua_manilha?: string; // e.g. "Rua Leão XIII", "Rua do Canal", "Rua A", "Rua B", etc.
  endereco_numero?: string;
  endereco_complemento?: string; // e.g. Apto 101, Bloco B
  /**
   * Destino conhecido a que este pacote está vinculado (rua|número|contexto — ver src/domain).
   * Ausente = ainda não confirmado (pendente de confirmação quando há ambiguidade).
   */
  destino_id?: string;
  associacao_id?: string;
  associacao_nome?: string;
  // FASE 1 - Operational V1 Fields
  palavra_chave?: string;
  motivo_insucesso?: string;
  foto_insucesso?: string;
  data_reentrega?: string;
  historico_transferencia?: string[];
  lote_bloco_id?: string;
  qtd_pacotes_cliente?: number;
  /**
   * Presente quando o pacote veio de uma CARGA do LogiScan HUB (contrato logiscan.carga/v0).
   * É o vínculo para devolver ao HUB o que aconteceu com ele. Ausente = pacote cadastrado no próprio Street.
   */
  hub?: {
    pacote_id: string;
    transportadora: string;
    carga_id: string;
    carga_codigo: string;
    ajudante_id: string;
    /** Identidade da rua vinda do HUB (street_id, mesma regra nos dois projetos) e nome de apresentação. */
    rua_id?: string;
    rua_nome?: string;
    /** Região operacional no HUB (organização; nunca muda a identidade da rua). */
    regiao_nome?: string | null;
    /** true = o Street não reconheceu a rua/região: fica em revisão, sem criar card sozinho. */
    revisar_rua?: boolean;
    /** CAIXA oficial do HUB em que o pacote saiu (V0.5): vira o card do Street. */
    caixa?: { id: string; numero: string | null; nome: string; nomes_anteriores: string[] } | null;
  };
  /**
   * Card do Street onde o pacote foi ENCAIXADO (rua ou região já existente). Ausente = regra antiga
   * (rua escrita no pacote). Não altera o endereço original.
   */
  rua_operacional?: string;
}

export interface CompletedDayRecord {
  id_dia: string;
  data_referencia: string; // "YYYY-MM-DD" e.g. "2026-08-28"
  data_fechamento: string; // ISO timestamp
  total_entregues: number;
  total_remanejados: number; // Enviados para o dia seguinte
  total_devolvidos: number;
  entregas: DeliveryData[]; // Apenas os pacotes efetivamente entregues
  resumo_ruas: Array<{
    nome_rua: string;
    qtd_entregues: number;
  }>;
}
