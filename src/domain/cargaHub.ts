/**
 * PONTE COM O LOGISCAN HUB (puro, sem DOM/storage).
 *
 *   HUB ──logiscan.carga/v0──▶ Street ──logiscan.street-eventos/v0──▶ HUB
 *
 * - A carga traz SOMENTE os pacotes do ajudante dono dela.
 * - Carregar a mesma carga de novo não duplica nada (id do pacote no aparelho = id do HUB).
 * - Quando um pacote da carga é entregue, nasce um evento com id DETERMINÍSTICO:
 *   o mesmo acontecimento, detectado ou enviado duas vezes, continua sendo um só.
 * - Sem provas/fotos nesta etapa: o evento leva só o fato, quando e quem recebeu.
 *
 * O Street não conhece o HUB por dentro — só estes dois documentos.
 */
import type { DeliveryData } from '../types';
import { confirmarDestino, cadastrarPacote, montarPacote } from './cadastro';
import type { MemoriaOperacional } from './memoria';
import { statusEntregue } from './ruas';

export const SCHEMA_CARGA = 'logiscan.carga/v0';
export const SCHEMA_EVENTOS = 'logiscan.street-eventos/v0';

export interface AjudanteHub {
  id: string;
  nome: string;
}

export interface PacoteCarga {
  hub_pacote_id: string;
  transportadora: string;
  codigo: string;
  destinatario: string;
  rua: string;
  rua_detalhe: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  destino_id: string | null;
}

export interface DocumentoCarga {
  schema: typeof SCHEMA_CARGA;
  gerado_em: string;
  carga: { id: string; codigo: string; criada_em: string; criada_por: string };
  ajudante: AjudanteHub;
  pacotes: PacoteCarga[];
}

export interface EventoStreet {
  id_evento: string;
  tipo: 'ENTREGA_REGISTRADA';
  carga_id: string;
  hub_pacote_id: string;
  codigo: string;
  ocorrido_em: string;
  recebedor: { tipo: string; detalhes: string } | null;
}

export interface DocumentoEventos {
  schema: typeof SCHEMA_EVENTOS;
  gerado_em: string;
  ajudante: AjudanteHub;
  eventos: EventoStreet[];
}

// ---------------------------------------------------------------------------
// Validação da carga recebida
// ---------------------------------------------------------------------------

const ehTexto = (v: unknown) => typeof v === 'string';
const ehTextoCheio = (v: unknown) => typeof v === 'string' && v.trim() !== '';
const CAMPOS_TEXTO: (keyof PacoteCarga)[] = [
  'destinatario', 'rua', 'rua_detalhe', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'cep',
];

export function validarCarga(bruto: unknown): { ok: true; carga: DocumentoCarga } | { ok: false; erros: string[] } {
  const erros: string[] = [];
  const d = bruto as Record<string, any>;
  if (!d || typeof d !== 'object') return { ok: false, erros: ['o arquivo não contém um objeto JSON'] };
  if (d.schema !== SCHEMA_CARGA) return { ok: false, erros: [`não é uma carga do HUB (schema "${String(d.schema)}", esperado "${SCHEMA_CARGA}")`] };
  if (!d.carga || !ehTextoCheio(d.carga.id) || !ehTextoCheio(d.carga.codigo)) erros.push('carga sem id/código');
  if (!d.ajudante || !ehTextoCheio(d.ajudante.id) || !ehTextoCheio(d.ajudante.nome)) erros.push('carga sem ajudante');
  if (!Array.isArray(d.pacotes)) erros.push('carga sem lista de pacotes');
  else
    d.pacotes.forEach((p: Record<string, unknown>, i: number) => {
      if (!p || !ehTextoCheio(p.hub_pacote_id) || !ehTextoCheio(p.codigo) || !ehTextoCheio(p.transportadora)) {
        erros.push(`pacote ${i + 1}: sem id do HUB, código ou transportadora`);
        return;
      }
      for (const c of CAMPOS_TEXTO) if (!ehTexto(p[c])) erros.push(`pacote ${i + 1} (${p.codigo}): campo "${c}" inválido`);
      if (p.destino_id !== null && !ehTexto(p.destino_id)) erros.push(`pacote ${i + 1} (${p.codigo}): destino_id inválido`);
    });
  return erros.length ? { ok: false, erros } : { ok: true, carga: d as DocumentoCarga };
}

/** De quem é este aparelho × de quem é a carga. */
export function donoDaCarga(aparelho: AjudanteHub | null, carga: DocumentoCarga): 'mesmo' | 'primeira_carga' | 'outro_ajudante' {
  if (!aparelho) return 'primeira_carga';
  return aparelho.id === carga.ajudante.id ? 'mesmo' : 'outro_ajudante';
}

/** Pacotes de carga do ajudante ainda não entregues neste aparelho (impede trocar de dono no meio da rota). */
export function pendentesDoAjudante(noAparelho: DeliveryData[], ajudanteId: string): number {
  return noAparelho.filter((d) => d.hub?.ajudante_id === ajudanteId && !statusEntregue(d)).length;
}

// ---------------------------------------------------------------------------
// Carga → pacotes do Street
// ---------------------------------------------------------------------------

export const idNoAparelho = (hubPacoteId: string) => `hub_${hubPacoteId}`;

/**
 * Converte a carga em pacotes do Street, pulando os que já estão no aparelho.
 * O destino vem do HUB (mesma regra); sem destino no HUB, o Street resolve pela própria memória
 * (e pede confirmação se houver dúvida, como em qualquer cadastro).
 */
export function receberCarga(
  mem: MemoriaOperacional,
  carga: DocumentoCarga,
  noAparelho: DeliveryData[],
  agora: string,
): { memoria: MemoriaOperacional; novos: DeliveryData[]; jaNoAparelho: number; destinoPendente: number } {
  const existentes = new Set(noAparelho.map((d) => d.hub?.pacote_id).filter(Boolean));
  let memoria = mem;
  let jaNoAparelho = 0;
  let destinoPendente = 0;
  const novos: DeliveryData[] = [];

  for (const p of carga.pacotes) {
    if (existentes.has(p.hub_pacote_id)) {
      jaNoAparelho++;
      continue;
    }
    existentes.add(p.hub_pacote_id);
    const base: DeliveryData = {
      ...montarPacote(
        { rua: p.rua, numero: p.numero, complemento: p.complemento, nome: p.destinatario, codigo: p.codigo, origem: 'auto' },
        agora,
      ),
      id_entrega: idNoAparelho(p.hub_pacote_id),
      bairro: p.bairro || undefined,
      ajudante_nome: carga.ajudante.nome,
      hub: {
        pacote_id: p.hub_pacote_id,
        transportadora: p.transportadora,
        carga_id: carga.carga.id,
        carga_codigo: carga.carga.codigo,
        ajudante_id: carga.ajudante.id,
      },
      historico_timeline: [
        {
          id: `${idNoAparelho(p.hub_pacote_id)}_entrada`,
          timestamp: agora,
          tipo: 'entrada_app',
          titulo: `Recebido na carga ${carga.carga.codigo}`,
          descricao: `Carga do LogiScan HUB para ${carga.ajudante.nome}`,
          responsavel: carga.ajudante.nome,
        },
      ],
    };
    if (p.destino_id) {
      const r = confirmarDestino(memoria, base, p.destino_id, agora);
      memoria = r.memoria;
      novos.push(r.pacote);
    } else {
      const r = cadastrarPacote(memoria, base, agora);
      memoria = r.memoria;
      if (r.pendente) destinoPendente++;
      novos.push(r.pacote);
    }
  }
  return { memoria, novos, jaNoAparelho, destinoPendente };
}

// ---------------------------------------------------------------------------
// Street → eventos para o HUB
// ---------------------------------------------------------------------------

/**
 * Compara o antes/depois da lista do aparelho e devolve as ENTREGAS novas de pacotes da carga.
 * Pega qualquer caminho de baixa do app (modal, lote, atalho) sem precisar mexer em cada tela.
 */
export function detectarEntregas(antes: DeliveryData[], depois: DeliveryData[]): EventoStreet[] {
  const anterior = new Map(antes.map((d) => [d.id_entrega, d]));
  const eventos: EventoStreet[] = [];
  for (const d of depois) {
    if (!d.hub || !statusEntregue(d)) continue;
    const a = anterior.get(d.id_entrega);
    if (!a || statusEntregue(a)) continue; // já estava entregue (ou acabou de chegar assim): nada novo
    const quando = d.data_hora_entrega || d.data_hora;
    eventos.push({
      id_evento: `${d.hub.pacote_id}:entrega:${quando}`,
      tipo: 'ENTREGA_REGISTRADA',
      carga_id: d.hub.carga_id,
      hub_pacote_id: d.hub.pacote_id,
      codigo: d.codigo_pacote.replace(/^#/, ''),
      ocorrido_em: quando,
      recebedor: d.recebedor_tipo || d.recebedor_detalhes ? { tipo: d.recebedor_tipo || '', detalhes: d.recebedor_detalhes || '' } : null,
    });
  }
  return eventos;
}

export interface ItemSaida extends EventoStreet {
  /** Quando este evento foi colocado num arquivo para o HUB (null = ainda não). */
  exportado_em: string | null;
}

/** Junta eventos novos à fila de saída sem duplicar (mesmo id = mesmo acontecimento). */
export function acumularSaida(saida: ItemSaida[], novos: EventoStreet[]): ItemSaida[] {
  const ids = new Set(saida.map((e) => e.id_evento));
  const adicionar = novos.filter((e) => !ids.has(e.id_evento)).map((e) => ({ ...e, exportado_em: null }));
  return adicionar.length ? [...saida, ...adicionar] : saida;
}

/**
 * Documento para o HUB com TODOS os eventos da fila (os já exportados também: o HUB ignora repetidos,
 * então reenviar é seguro e cobre um arquivo perdido no caminho).
 */
export function montarDocumentoEventos(saida: ItemSaida[], ajudante: AjudanteHub, agora: string): DocumentoEventos {
  return {
    schema: SCHEMA_EVENTOS,
    gerado_em: agora,
    ajudante,
    eventos: saida.map(({ exportado_em: _x, ...e }) => e),
  };
}

export function marcarExportados(saida: ItemSaida[], agora: string): ItemSaida[] {
  return saida.map((e) => (e.exportado_em ? e : { ...e, exportado_em: agora }));
}
