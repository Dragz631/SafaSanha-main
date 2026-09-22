/**
 * Migração (pura) da memória das versões anteriores para o modelo por DESTINO.
 *  - v2 "Casas salvas": moradores por rua+número (+ sub-rua na Manilha).
 *  - v1 porteiros/familiares/vizinhos: chave "rua:::número" e a chave perigosa "number_only:::N"
 *    (SEM rua — o porteiro do Nº 100 da Rua A aparecia no Nº 100 da Rua B). Essas são descartadas.
 * Os dados DEMO que a versão antiga injetava no primeiro uso (ids fixos) não são migrados.
 */
import { interpretarEndereco, interpretarNumero } from './endereco';
import { registrarPacote, registrarRecebedor, candidatosNoNumero, type MemoriaOperacional } from './memoria';
import { chaveTexto } from './texto';

export interface LegadoMoradorV2 {
  id: string;
  name: string;
  complement?: string;
  timesDelivered?: number;
  lastSeen?: string;
}

export interface LegadoCasaV2 {
  street: string;
  subStreet?: string;
  houseNumber: string;
  residents: LegadoMoradorV2[];
  lastUpdated?: string;
}

export type LegadoV2 = Record<string, LegadoCasaV2[]>;

/** Ids dos moradores fictícios que a versão antiga gravava sozinha (DEFAULT_SEEDED_MEMORY). */
export const IDS_DEMO_V2 = new Set([
  'res_21_1', 'res_21_2', 'res_23_1', 'res_23_2', 'res_34_1', 'res_142_1', 'res_142_2', 'res_m_15', 'res_m_8',
]);

export function migrarMemoriaV2(
  legado: LegadoV2,
  base: MemoriaOperacional,
  agora: string
): { memoria: MemoriaOperacional; migrados: number; demoDescartados: number } {
  let memoria = base;
  let migrados = 0;
  let demoDescartados = 0;
  for (const casas of Object.values(legado ?? {})) {
    for (const casa of casas ?? []) {
      for (const r of casa.residents ?? []) {
        if (IDS_DEMO_V2.has(r.id)) {
          demoDescartados++;
          continue;
        }
        const end = interpretarEndereco({
          rua: casa.subStreet || casa.street,
          numero: casa.houseNumber,
          complemento: r.complement,
        });
        memoria = registrarPacote(memoria, end, r.name, r.lastSeen || casa.lastUpdated || agora, Math.max(1, r.timesDelivered ?? 1)).memoria;
        migrados++;
      }
    }
  }
  return { memoria, migrados, demoDescartados };
}

export interface LegadoRecebedores {
  portaria?: Record<string, string[]>;
  familiar?: Record<string, string[]>;
  vizinho?: Record<string, string[]>;
}

const PEQUENAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
export function tituloDeRua(chave: string): string {
  return chave
    .split(' ')
    .map((p, i) => (i > 0 && PEQUENAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
}

export function migrarRecebedoresLegados(
  mem: MemoriaOperacional,
  legado: LegadoRecebedores,
  agora: string
): { memoria: MemoriaOperacional; migrados: number; ignorados: number } {
  let memoria = mem;
  let migrados = 0;
  let ignorados = 0;
  const categorias: Array<[keyof LegadoRecebedores, string]> = [['portaria', 'portaria'], ['familiar', 'familiar'], ['vizinho', 'vizinho']];

  for (const [campo, categoria] of categorias) {
    for (const [chave, nomes] of Object.entries(legado[campo] ?? {})) {
      if (chave.startsWith('number_only:::')) {
        ignorados += nomes.length; // sem rua: não dá para saber a que destino pertence
        continue;
      }
      const [ruaBruta, numeroBruto] = chave.split(':::');
      const ruaChave = chaveTexto(ruaBruta);
      const numero = interpretarNumero(numeroBruto);
      if (!ruaChave) {
        ignorados += nomes.length;
        continue;
      }
      let candidatos = candidatosNoNumero(memoria, ruaChave, numero.chave);
      if (candidatos.length === 0) {
        const end = interpretarEndereco({ rua: tituloDeRua(ruaChave), numero: numeroBruto });
        memoria = registrarPacote(memoria, end, undefined, agora, 0).memoria;
        candidatos = candidatosNoNumero(memoria, ruaChave, numero.chave);
      }
      if (candidatos.length !== 1) {
        ignorados += nomes.length; // vários destinos no número: não escolhe
        continue;
      }
      for (const nome of nomes) {
        memoria = registrarRecebedor(memoria, candidatos[0].id, { categoria, rotulo: nome }, agora);
        migrados++;
      }
    }
  }
  return { memoria, migrados, ignorados };
}
