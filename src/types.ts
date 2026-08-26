export type ReceiverType = 'proprio_morador' | 'vizinho' | 'estabelecimento' | 'associacao';

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

export interface DeliveryData {
  id_entrega: string;
  codigo_pacote: string;
  recebedor_tipo: ReceiverType;
  recebedor_detalhes: string;
  foto_pacote_path: string; // Base64 or object URL
  foto_local_path: string;  // Base64 or object URL
  data_hora: string;
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
  endereco_numero?: string;
  endereco_complemento?: string; // e.g. Apto 101, Bloco B
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
}

export interface GeofenceConfig {
  tipo: 'circulo' | 'poligono';
  centro_lat?: number;
  centro_lng?: number;
  raio_metros?: number;
  pontos?: Array<{ lat: number; lng: number }>;
  descricao_area?: string;
}

export interface AssociationArea {
  id: string;
  nome: string; // e.g. "Associação do Cremate"
  recebedor_padrao: string; // e.g. "Sede da Associação (Sr. Antenor)"
  ruas: string[]; // e.g. ["Travessa do Cremate", "Rua Esperança"]
  ruasVinculadas?: string[]; // Alias for ruas
  bairros?: string[]; // e.g. ["Parque Alegria", "Vila Cremate"]
  moradores?: string[]; // e.g. ["Dona Maria", "Sr. Antenor", "João da Silva"]
  moradoresVinculados?: string[]; // Alias for moradores
  excecoes_enderecos?: string[]; // Endereços/prédios excluídos da cerca virtual (entrega em rua comum)
  cor: string; // e.g. "emerald", "blue", "purple", "amber"
  descricao?: string;
  cerca_virtual?: GeofenceConfig;
}

export interface AssociationMemoryRecord {
  id: string;
  nome_destinatario: string; // e.g. "João da Silva"
  endereco: string; // e.g. "Rua Paraíso, 123"
  bairro?: string;
  associacao_id: string;
  associacao_nome: string;
  data_vinculo: string;
  origem: 'manual' | 'ia' | 'historico';
}

export interface BarcodeScanResult {
  success: boolean;
  code: string | null;
  format?: string;
  message?: string;
}

