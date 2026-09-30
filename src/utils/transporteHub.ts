/**
 * TRANSPORTE Street ↔ HUB — separado do domínio.
 *
 * Leva e traz os MESMOS documentos do arquivo (logiscan.carga/v0 e logiscan.street-eventos/v0).
 * Hoje: HTTP local para o HUB (/api/street/*). O arquivo continua como fallback e diagnóstico.
 * Trocar o transporte depois (fila, nuvem) não muda o domínio nem os contratos.
 */
import type { AjudanteHub, DocumentoCarga, DocumentoEventos } from '../domain/cargaHub';
import { corpoNovaConta, type DadosNovaConta, type PapelConta } from '../domain/conta';
import { lerJSON, gravarJSON } from './persistencia';

export interface RespostaLogin {
  token: string;
  /** Refresh token: troca por um token novo quando o JWT (~1h) expira. */
  renovar?: string;
  /** `id` = ajudante ligado à conta (null = conta só de administração, sem rota para entregar). */
  perfil: { id: string | null; nome: string; papel: PapelConta };
}

export interface TransporteHub {
  /** Conta nova: vai para o HUB como PENDENTE até o Hugo aprovar. */
  criarConta(dados: DadosNovaConta): Promise<{ situacao: string }>;
  /** Entrar com usuário + PIN. Recusas chegam como ErroTransporte com status/codigo. */
  login(usuario: string, pin: string): Promise<RespostaLogin>;
  /** Troca o refresh token por um token novo (POST /renovar). */
  renovar(renovar: string): Promise<{ token: string; renovar?: string }>;
  /** Perfis que podem usar o Street ("Quem está usando este aparelho?"). */
  perfis(): Promise<AjudanteHub[]>;
  /** Carga ativa do perfil (vazio = nenhuma). O HUB só devolve carga DESTE perfil. */
  cargasDoPerfil(ajudanteId: string): Promise<DocumentoCarga[]>;
  confirmarRecebimento(cargaId: string, ajudanteId: string, quantidade: number): Promise<void>;
  enviarEventos(doc: DocumentoEventos): Promise<{ aceitos: number; repetidos: number; recusados: { codigo: string; motivo: string }[] }>;
}

const CHAVE_URL = 'logiscan_street_hub_url_v0';
export const URL_PADRAO_HUB = 'http://localhost:4100';

/**
 * Endereço do HUB. Só existe se o Hugo informou (ou, em desenvolvimento local, o padrão localhost:4100).
 * Em produção (Vercel) sem endereço salvo = '' = o Street NÃO fala com o HUB, nem tenta.
 */
export function urlDoHub(salva: string | null | undefined, hostname: string): string {
  const s = (salva ?? '').trim().replace(/\/+$/, '');
  if (s) return s;
  // Produção: o HUB (https) vem da variável de ambiente VITE_HUB_URL na Vercel; sem ela, nada é chamado.
  const doAmbiente = (import.meta.env?.VITE_HUB_URL as string | undefined)?.trim().replace(/\/+$/, '');
  if (doAmbiente) return doAmbiente;
  return /^(localhost|127\.0\.0\.1)$/.test(hostname) ? URL_PADRAO_HUB : '';
}
export const lerUrlHub = () =>
  urlDoHub(lerJSON<string>(CHAVE_URL, ''), typeof window === 'undefined' ? '' : window.location.hostname);
export const gravarUrlHub = (url: string) => gravarJSON(CHAVE_URL, url.trim().replace(/\/+$/, ''));

export class ErroTransporte extends Error {
  constructor(mensagem: string, readonly status = 0, readonly corpo: { codigo?: string; mensagem?: string; ate?: string } | null = null) {
    super(mensagem);
  }
}

/** Credenciais da sessão de conta; `aoRenovar` é chamado quando o HUB deu um token novo. */
export interface CredenciaisConta {
  token: () => string | null;
  renovar: () => string | null;
  aoRenovar: (token: string, renovar?: string) => void;
}

/** `cred.token()` devolve o token da sessão de conta (null = nenhuma credencial é enviada). */
export function transporteHttp(baseUrl: string, cred: CredenciaisConta = { token: () => null, renovar: () => null, aoRenovar: () => undefined }): TransporteHub {
  const chamar = async <T>(caminho: string, corpo?: unknown, jaRenovou = false): Promise<T> => {
    let res: Response;
    const token = cred.token();
    try {
      const headers: Record<string, string> = {};
      if (corpo !== undefined) headers['Content-Type'] = 'application/json';
      if (token) headers.Authorization = `Bearer ${token}`;
      res = await fetch(`${baseUrl}/api/street${caminho}`, {
        method: corpo === undefined ? 'GET' : 'POST',
        headers: Object.keys(headers).length ? headers : undefined,
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
      });
    } catch {
      throw new ErroTransporte(`HUB não respondeu em ${baseUrl}`);
    }
    const dados = await res.json().catch(() => ({}));
    // Token vencido (JWT dura ~1h): renova uma vez com o refresh token e repete o pedido.
    const renovar = cred.renovar();
    if (res.status === 401 && !jaRenovou && token && renovar && caminho !== '/renovar' && caminho !== '/login') {
      try {
        const novo = await chamar<{ token: string; renovar?: string }>('/renovar', { renovar }, true);
        cred.aoRenovar(novo.token, novo.renovar);
        return await chamar<T>(caminho, corpo, true);
      } catch {
        // renovar falhou: segue com o 401 original (o Street volta ao login)
      }
    }
    if (!res.ok) throw new ErroTransporte(dados.mensagem ?? (dados.erros ? dados.erros.join('; ') : `HUB respondeu ${res.status}`), res.status, dados);
    return dados as T;
  };
  return {
    criarConta: (dados) => chamar('/contas', corpoNovaConta(dados)),
    login: (usuario, pin) => chamar('/login', { usuario, pin }),
    renovar: (renovar) => chamar('/renovar', { renovar }),
    perfis: () => chamar('/perfis'),
    cargasDoPerfil: (id) => chamar(`/perfis/${encodeURIComponent(id)}/cargas`),
    confirmarRecebimento: async (cargaId, ajudanteId, quantidade) => {
      await chamar(`/cargas/${encodeURIComponent(cargaId)}/recebida`, { ajudanteId, quantidade });
    },
    enviarEventos: (doc) => chamar('/eventos', doc),
  };
}
