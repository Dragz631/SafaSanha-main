/**
 * Persistência da memória operacional (destinos/unidades/pessoas/recebedores).
 * Na primeira execução com o modelo novo, migra UMA vez a memória das versões anteriores
 * (descartando os dados demo e as chaves sem rua). As chaves antigas ficam intactas no navegador.
 */
import { memoriaVazia, type MemoriaOperacional } from '../domain/memoria';
import { migrarMemoriaV2, migrarRecebedoresLegados, type LegadoRecebedores, type LegadoV2 } from '../domain/memoriaLegado';
import { gravarJSON, lerJSON } from './persistencia';

export const CHAVE_MEMORIA = 'logiscan_memoria_operacional_v3';
const CHAVES_LEGADAS = {
  casas: 'logiscan_street_address_memory_v2',
  portaria: 'logiscan_saved_doormen_v1',
  familiar: 'logiscan_saved_family_v1',
  vizinho: 'logiscan_saved_neighbors_v1',
};

function memoriaValida(x: unknown): x is MemoriaOperacional {
  const m = x as MemoriaOperacional | null;
  return !!m && m.versao === 3 && typeof m.destinos === 'object' && m.destinos !== null;
}

export function carregarMemoria(agora: string = new Date().toISOString()): MemoriaOperacional {
  const salva = lerJSON<unknown>(CHAVE_MEMORIA, null);
  if (memoriaValida(salva)) return salva;

  // Existe algo ilegível? Guarda uma cópia antes de recomeçar (nunca perde em silêncio).
  try {
    const bruto = localStorage.getItem(CHAVE_MEMORIA);
    if (bruto) localStorage.setItem(`${CHAVE_MEMORIA}_ilegivel`, bruto);
  } catch {
    /* melhor esforço */
  }

  let memoria = memoriaVazia();
  const casas = lerJSON<LegadoV2 | null>(CHAVES_LEGADAS.casas, null);
  if (casas && typeof casas === 'object') memoria = migrarMemoriaV2(casas, memoria, agora).memoria;

  const recebedores: LegadoRecebedores = {
    portaria: lerJSON(CHAVES_LEGADAS.portaria, {}),
    familiar: lerJSON(CHAVES_LEGADAS.familiar, {}),
    vizinho: lerJSON(CHAVES_LEGADAS.vizinho, {}),
  };
  memoria = migrarRecebedoresLegados(memoria, recebedores, agora).memoria;

  gravarJSON(CHAVE_MEMORIA, memoria);
  return memoria;
}

export function salvarMemoria(memoria: MemoriaOperacional): boolean {
  return gravarJSON(CHAVE_MEMORIA, memoria);
}
