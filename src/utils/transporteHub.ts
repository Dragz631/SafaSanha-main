/**
 * TRANSPORTE Street ↔ HUB — separado do domínio.
 *
 * Leva e traz os MESMOS documentos do arquivo (logiscan.carga/v0 e logiscan.street-eventos/v0).
 * Hoje: HTTP local para o HUB (/api/street/*). O arquivo continua como fallback e diagnóstico.
 * Trocar o transporte depois (fila, nuvem) não muda o domínio nem os contratos.
 */
import type { AjudanteHub, DocumentoCarga, DocumentoEventos } from '../domain/cargaHub';
import { lerJSON, gravarJSON } from './persistencia';

export interface TransporteHub {
  /** Perfis que podem usar o Street ("Quem está usando este aparelho?"). */
  perfis(): Promise<AjudanteHub[]>;
  /** Carga ativa do perfil (vazio = nenhuma). O HUB só devolve carga DESTE perfil. */
  cargasDoPerfil(ajudanteId: string): Promise<DocumentoCarga[]>;
  confirmarRecebimento(cargaId: string, ajudanteId: string, quantidade: number): Promise<void>;
  enviarEventos(doc: DocumentoEventos): Promise<{ aceitos: number; repetidos: number; recusados: { codigo: string; motivo: string }[] }>;
}

const CHAVE_URL = 'logiscan_street_hub_url_v0';
export const URL_PADRAO_HUB = 'http://localhost:4100';
export const lerUrlHub = () => lerJSON<string>(CHAVE_URL, URL_PADRAO_HUB) || URL_PADRAO_HUB;
export const gravarUrlHub = (url: string) => gravarJSON(CHAVE_URL, url.trim().replace(/\/+$/, ''));

export class ErroTransporte extends Error {}

export function transporteHttp(baseUrl: string): TransporteHub {
  const chamar = async <T>(caminho: string, corpo?: unknown): Promise<T> => {
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/api/street${caminho}`, {
        method: corpo === undefined ? 'GET' : 'POST',
        headers: corpo === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
      });
    } catch {
      throw new ErroTransporte(`HUB não respondeu em ${baseUrl}`);
    }
    const dados = await res.json().catch(() => ({}));
    if (!res.ok) throw new ErroTransporte(dados.mensagem ?? (dados.erros ? dados.erros.join('; ') : `HUB respondeu ${res.status}`));
    return dados as T;
  };
  return {
    perfis: () => chamar('/perfis'),
    cargasDoPerfil: (id) => chamar(`/perfis/${encodeURIComponent(id)}/cargas`),
    confirmarRecebimento: async (cargaId, ajudanteId, quantidade) => {
      await chamar(`/cargas/${encodeURIComponent(cargaId)}/recebida`, { ajudanteId, quantidade });
    },
    enviarEventos: (doc) => chamar('/eventos', doc),
  };
}
