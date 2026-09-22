/** Fábrica de pacotes para testes (não é importada pelo app). */
import type { DeliveryData } from '../types';

let contador = 0;

export function pacote(over: Partial<DeliveryData> & { rua?: string; numero?: string; comp?: string; nome?: string }): DeliveryData {
  contador++;
  const { rua, numero, comp, nome, ...resto } = over;
  return {
    id_entrega: `t${contador}`,
    codigo_pacote: `#${1000 + contador}`,
    recebedor_tipo: 'proprio_morador',
    recebedor_detalhes: '',
    foto_pacote_path: '',
    foto_local_path: '',
    data_hora: '2026-09-21T12:00:00.000Z',
    status: 'aguardando_rua',
    endereco_rua: rua ?? 'Rua A',
    numero_casa: numero ?? '100',
    endereco_numero: numero ?? '100',
    complemento: comp || undefined,
    nome_destinatario: nome ?? 'Morador',
    ...resto,
  };
}
