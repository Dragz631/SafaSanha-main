/**
 * PONTE COM O LOGISCAN HUB (puro, sem DOM/storage).
 *
 *   HUB ──logiscan.carga/v0──▶ Street ──logiscan.street-eventos/v0──▶ HUB
 *
 * - A carga traz SOMENTE os pacotes do ajudante dono dela.
 * - Carregar a mesma carga de novo não duplica nada (id do pacote no aparelho = id do HUB).
 * - Quando um pacote da carga é ENTREGUE ou tem INSUCESSO, nasce um evento com id DETERMINÍSTICO:
 *   o mesmo acontecimento, detectado ou enviado duas vezes, continua sendo um só.
 * - Sem provas/fotos nesta etapa: o evento leva o fato, quando, quem recebeu ou o motivo do insucesso.
 * - O aparelho NÃO é a pessoa: a identidade vem da SESSÃO do ajudante. Trocar de ajudante é explícito
 *   (encerrar a sessão guarda cargas/pacotes/eventos dele à parte) — nunca se misturam dois ajudantes.
 *
 * O Street não conhece o HUB por dentro — só estes dois documentos.
 */
import type { DeliveryData } from '../types';
import { confirmarDestino, cadastrarPacote, montarPacote } from './cadastro';
import { idLogradouro, resolverLogradouro } from './logradouro';
import type { MemoriaOperacional } from './memoria';
import { ehAreaManilha, statusEntregue } from './ruas';

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
  /** Opcionais (HUB V0.4): street_id calculado pela regra comum (logradouro.ts), nome e região operacional. */
  rua_id?: string;
  rua_nome?: string;
  regiao?: { id: string; nome: string; repasse_unico: boolean } | null;
}

/** Unidade da carga: uma rua (street_id) com os pacotes dela. */
export interface ItemCarga {
  rua_id: string;
  rua_nome: string;
  regiao_id: string | null;
  regiao_nome: string | null;
  pacote_ids: string[];
}

export interface DocumentoCarga {
  schema: typeof SCHEMA_CARGA;
  gerado_em: string;
  carga: {
    id: string;
    codigo: string;
    criada_em: string;
    criada_por: string;
    /** Opcional: MONTADA = ainda no galpão (rota não iniciada no HUB); EM_ROTA = rota iniciada. */
    situacao?: 'MONTADA' | 'EM_ROTA';
    rota_iniciada_em?: string | null;
  };
  ajudante: AjudanteHub;
  pacotes: PacoteCarga[];
  itens?: ItemCarga[];
}

export interface EventoStreet {
  id_evento: string;
  tipo: 'ENTREGA_REGISTRADA' | 'INSUCESSO_REGISTRADO';
  carga_id: string;
  hub_pacote_id: string;
  codigo: string;
  ocorrido_em: string;
  recebedor: { tipo: string; detalhes: string } | null;
  /** Só INSUCESSO_REGISTRADO. */
  motivo?: string;
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
      if (p.rua_id !== undefined && !ehTexto(p.rua_id)) erros.push(`pacote ${i + 1} (${p.codigo}): rua_id inválido`);
    });
  return erros.length ? { ok: false, erros } : { ok: true, carga: d as DocumentoCarga };
}

// ---------------------------------------------------------------------------
// Sessão do ajudante (aparelho ≠ pessoa)
// ---------------------------------------------------------------------------

/** A carga só entra na sessão do PRÓPRIO ajudante; sem sessão, é preciso iniciá-la explicitamente. */
export function podeCarregar(sessao: AjudanteHub | null, carga: DocumentoCarga): 'ok' | 'sem_sessao' | 'outro_ajudante' {
  if (!sessao) return 'sem_sessao';
  return sessao.id === carga.ajudante.id ? 'ok' : 'outro_ajudante';
}

/**
 * Tudo que é do PERFIL de um ajudante, guardado enquanto a sessão dele está encerrada:
 * pacotes da carga, fila de eventos e a MEMÓRIA PESSOAL dele (conhecimento de endereços do Street).
 * A memória do HUB (regiões) e o histórico oficial dos pacotes vivem no HUB — não aqui.
 */
export type Guardados = Record<
  string,
  { ajudante: AjudanteHub; pacotes: DeliveryData[]; saida: ItemSaida[]; memoria?: MemoriaOperacional }
>;

/**
 * Encerra a sessão: os pacotes de carga e a fila de eventos do ajudante saem da tela e ficam guardados
 * com ele (nada é apagado). Pacotes cadastrados à mão no Street não são afetados.
 */
export function encerrarSessao(
  sessao: AjudanteHub,
  deliveries: DeliveryData[],
  saida: ItemSaida[],
  guardados: Guardados,
  memoria?: MemoriaOperacional,
): { deliveries: DeliveryData[]; saida: ItemSaida[]; guardados: Guardados } {
  const dele = deliveries.filter((d) => d.hub?.ajudante_id === sessao.id);
  const anterior = guardados[sessao.id];
  const idsDele = new Set(dele.map((d) => d.id_entrega));
  return {
    deliveries: deliveries.filter((d) => d.hub?.ajudante_id !== sessao.id),
    saida: [],
    guardados: {
      ...guardados,
      [sessao.id]: {
        ajudante: sessao,
        pacotes: [...dele, ...(anterior?.pacotes ?? []).filter((d) => !idsDele.has(d.id_entrega))],
        saida: [...(anterior?.saida ?? []).filter((e) => !saida.some((x) => x.id_evento === e.id_evento)), ...saida],
        memoria: memoria ?? anterior?.memoria,
      },
    },
  };
}

/** Inicia (ou retoma) a sessão de um ajudante; o que estava guardado com ele volta. */
export function iniciarSessao(
  ajudante: AjudanteHub,
  deliveries: DeliveryData[],
  guardados: Guardados,
): { deliveries: DeliveryData[]; saida: ItemSaida[]; guardados: Guardados; memoria: MemoriaOperacional | null } {
  const outros = deliveries.filter((d) => d.hub && d.hub.ajudante_id !== ajudante.id);
  if (outros.length > 0) {
    throw new Error(`há ${outros.length} pacote(s) de carga de outro ajudante na tela: encerre a sessão dele antes`);
  }
  const g = guardados[ajudante.id];
  const { [ajudante.id]: _retomado, ...resto } = guardados;
  const naTela = new Set(deliveries.map((d) => d.id_entrega));
  return {
    deliveries: [...(g?.pacotes ?? []).filter((d) => !naTela.has(d.id_entrega)), ...deliveries],
    saida: g?.saida ?? [],
    guardados: resto,
    /** Memória pessoal do perfil (null = perfil novo neste aparelho, sem memória ainda). */
    memoria: g?.memoria ?? null,
  };
}

/** A carga que chegou pelo transporte é deste perfil? Nunca aceitar a de outro em silêncio. */
export function cargaDoPerfil(sessao: AjudanteHub | null, carga: DocumentoCarga): boolean {
  return !!sessao && carga.ajudante.id === sessao.id;
}

/**
 * Pacotes da carga que estão no aparelho mas SAÍRAM da carga no HUB (rua removida/reatribuída antes
 * da rota). Só os ainda pendentes saem da tela; um pacote com desfecho local nunca some.
 */
export function retiradosDaCarga(carga: DocumentoCarga, noAparelho: DeliveryData[]): { remover: string[]; comDesfecho: number } {
  const naCarga = new Set(carga.pacotes.map((p) => p.hub_pacote_id));
  const fora = noAparelho.filter((d) => d.hub?.carga_id === carga.carga.id && !naCarga.has(d.hub.pacote_id));
  const comDesfecho = fora.filter((d) => statusEntregue(d) || d.status === 'insucesso');
  return { remover: fora.filter((d) => !comDesfecho.includes(d)).map((d) => d.id_entrega), comDesfecho: comDesfecho.length };
}

// ---------------------------------------------------------------------------
// Encaixe: a rua que chega do HUB entra num card QUE O STREET JÁ TEM
// ---------------------------------------------------------------------------

/**
 * O que o Street já conhece (cards). Nada fora daqui é criado sozinho.
 *  - ruas:    cards de rua (presets do Caju primeiro, depois as ruas salvas do aparelho);
 *  - manilha: sub-ruas da Manilha (a aba Manilha só mostra estas);
 *  - regioes: cards de REGIÃO (Quinta do Caju e regiões criadas na revisão). Região só encaixa em card de região,
 *             nunca em card de rua — região organiza, não funde logradouros ("Carlos Seidl" ≠ "Carlos Seixas");
 *  - apelidos: decisões da revisão — chave (street_id ou `regiao:<id do nome>`) → card.
 */
export interface CatalogoRuas {
  ruas: string[];
  manilha: string[];
  regioes: string[];
  apelidos: Record<string, string>;
}

export const chaveRegiao = (nome: string) => `regiao:${idLogradouro(nome)}`;

export type Encaixe =
  | { tipo: 'manilha'; sub: string }
  | { tipo: 'card'; card: string; por: 'apelido' | 'regiao' | 'rua' }
  /** NOVA RUA / CONHECIMENTO NÃO RECONHECIDO: vai para revisão, sem criar card. */
  | { tipo: 'revisar'; chave: string; nome: string; regiao: string | null };

type IdentidadeRua = Pick<PacoteCarga, 'rua' | 'rua_id' | 'rua_nome' | 'regiao'>;

/**
 * Decide o card do pacote, nesta ordem:
 *  1. decisão já tomada na revisão (apelido da rua ou da região);
 *  2. região do HUB que o Street tem como card de região (Manilha → sub-rua conhecida; Quinta → card Quinta);
 *  3. identidade da rua nos cards de rua (mesmo street_id; sem tipo só com UM candidato);
 *  4. senão: revisão.
 */
export function encaixarRua(p: IdentidadeRua, cat: CatalogoRuas): Encaixe {
  const nome = (p.rua_nome || p.rua).trim();
  const id = p.rua_id || idLogradouro(nome);
  if (cat.apelidos[id]) return { tipo: 'card', card: cat.apelidos[id], por: 'apelido' };
  const regiao = p.regiao?.nome ?? null;
  if (regiao) {
    const porApelido = cat.apelidos[chaveRegiao(regiao)];
    if (porApelido) return { tipo: 'card', card: porApelido, por: 'apelido' };
    if (!ehAreaManilha(regiao)) {
      const reg = cat.regioes.find((r) => idLogradouro(r) === idLogradouro(regiao));
      if (reg) return { tipo: 'card', card: reg, por: 'regiao' };
    }
  }
  if (!regiao || ehAreaManilha(regiao)) {
    const sub = resolverLogradouro(nome, cat.manilha);
    if (sub.como !== 'desconhecido') return { tipo: 'manilha', sub: sub.nome };
  }
  const rua = resolverLogradouro(nome, cat.ruas);
  if (rua.como !== 'desconhecido') return { tipo: 'card', card: rua.nome, por: 'rua' };
  return { tipo: 'revisar', chave: id, nome, regiao };
}

/** Aplica o encaixe no pacote (endereço original intacto; só diz em qual card ele fica). */
export function aplicarEncaixe(d: DeliveryData, e: Encaixe): DeliveryData {
  const hub = d.hub ? { ...d.hub, revisar_rua: e.tipo === 'revisar' } : d.hub;
  const base: DeliveryData = { ...d, hub, rua_operacional: undefined };
  if (e.tipo === 'manilha') return { ...base, sub_rua_manilha: e.sub };
  if (e.tipo === 'card') return { ...base, rua_operacional: e.card };
  return base;
}

/** Revisão pendente: uma linha por rua não reconhecida, com quantos pacotes estão esperando. */
export interface RuaEmRevisao {
  chave: string;
  nome: string;
  regiao: string | null;
  pacotes: number;
}

export function ruasEmRevisao(lista: DeliveryData[]): RuaEmRevisao[] {
  const mapa = new Map<string, RuaEmRevisao>();
  for (const d of lista) {
    if (!d.hub?.revisar_rua) continue;
    const nome = d.hub.rua_nome || d.endereco_rua || '';
    const chave = d.hub.rua_id || idLogradouro(nome);
    const atual = mapa.get(chave) ?? { chave, nome, regiao: d.hub.regiao_nome ?? null, pacotes: 0 };
    atual.pacotes++;
    mapa.set(chave, atual);
  }
  return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

const identidadeGuardada = (d: DeliveryData): IdentidadeRua => ({
  rua: d.endereco_rua || '',
  rua_id: d.hub?.rua_id,
  rua_nome: d.hub?.rua_nome,
  regiao: d.hub?.regiao_nome ? { id: '', nome: d.hub.regiao_nome, repasse_unico: false } : null,
});

/** Refaz o encaixe dos pacotes do HUB que estão em revisão (depois de uma decisão da pessoa). */
export function reencaixar(lista: DeliveryData[], cat: CatalogoRuas): DeliveryData[] {
  return lista.map((d) => {
    if (!d.hub?.revisar_rua) return d;
    const e = encaixarRua(identidadeGuardada(d), cat);
    return e.tipo === 'revisar' ? d : aplicarEncaixe(d, e);
  });
}

// ---------------------------------------------------------------------------
// Carga → pacotes do Street
// ---------------------------------------------------------------------------

export const idNoAparelho = (hubPacoteId: string) => `hub_${hubPacoteId}`;

const CATALOGO_VAZIO: CatalogoRuas = { ruas: [], manilha: [], regioes: [], apelidos: {} };

/** Identidade vinda do HUB (item da carga tem prioridade; senão, os campos do pacote). */
function identidadeDoPacote(carga: DocumentoCarga, p: PacoteCarga): IdentidadeRua {
  const item = carga.itens?.find((i) => i.pacote_ids.includes(p.hub_pacote_id));
  return {
    rua: p.rua,
    rua_id: item?.rua_id ?? p.rua_id,
    rua_nome: item?.rua_nome ?? p.rua_nome,
    regiao: p.regiao ?? (item?.regiao_nome ? { id: item.regiao_id ?? '', nome: item.regiao_nome, repasse_unico: false } : null),
  };
}

const semDesfecho = (d: DeliveryData) => !statusEntregue(d) && d.status !== 'insucesso';

/** Pacotes da carga já no aparelho que ainda não foram encaixados pela identidade do HUB (cargas antigas). */
export function semEncaixe(carga: DocumentoCarga, noAparelho: DeliveryData[]): number {
  const comId = new Set(carga.pacotes.filter((p) => identidadeDoPacote(carga, p).rua_id).map((p) => p.hub_pacote_id));
  return noAparelho.filter((d) => d.hub?.carga_id === carga.carga.id && comId.has(d.hub.pacote_id) && !d.hub.rua_id && semDesfecho(d)).length;
}

/**
 * Converte a carga em pacotes do Street, pulando os que já estão no aparelho.
 * O destino vem do HUB (mesma regra); sem destino no HUB, o Street resolve pela própria memória
 * (e pede confirmação se houver dúvida, como em qualquer cadastro).
 * A RUA é encaixada nos cards que o Street já tem (identidade do logradouro, não o texto);
 * o que não for reconhecido fica em REVISÃO — nenhum card novo nasce sozinho.
 * Pacotes que já estavam no aparelho sem identidade de rua (carga antiga) são encaixados agora (`atualizados`).
 */
export function receberCarga(
  mem: MemoriaOperacional,
  carga: DocumentoCarga,
  noAparelho: DeliveryData[],
  agora: string,
  catalogo: CatalogoRuas = CATALOGO_VAZIO,
): {
  memoria: MemoriaOperacional;
  novos: DeliveryData[];
  atualizados: DeliveryData[];
  jaNoAparelho: number;
  destinoPendente: number;
  revisar: RuaEmRevisao[];
} {
  const existentes = new Map(noAparelho.filter((d) => d.hub).map((d) => [d.hub!.pacote_id, d]));
  let memoria = mem;
  let jaNoAparelho = 0;
  let destinoPendente = 0;
  const novos: DeliveryData[] = [];
  const atualizados: DeliveryData[] = [];
  const vistos = new Set<string>();
  const comIdentidade = (d: DeliveryData, p: PacoteCarga): DeliveryData => {
    const ident = identidadeDoPacote(carga, p);
    if (!ident.rua_id && !ident.regiao) return d; // HUB antigo (sem identidade): regra antiga do Street
    const comHub: DeliveryData = d.hub
      ? { ...d, hub: { ...d.hub, rua_id: ident.rua_id, rua_nome: ident.rua_nome, regiao_nome: ident.regiao?.nome ?? null } }
      : d;
    return aplicarEncaixe(comHub, encaixarRua(ident, catalogo));
  };

  for (const p of carga.pacotes) {
    if (vistos.has(p.hub_pacote_id)) continue;
    vistos.add(p.hub_pacote_id);
    const ja = existentes.get(p.hub_pacote_id);
    if (ja) {
      jaNoAparelho++;
      if (ja.hub && !ja.hub.rua_id && identidadeDoPacote(carga, p).rua_id && semDesfecho(ja)) atualizados.push(comIdentidade(ja, p));
      continue;
    }
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
      novos.push(comIdentidade(r.pacote, p));
    } else {
      const r = cadastrarPacote(memoria, base, agora);
      memoria = r.memoria;
      if (r.pendente) destinoPendente++;
      novos.push(comIdentidade(r.pacote, p));
    }
  }
  return { memoria, novos, atualizados, jaNoAparelho, destinoPendente, revisar: ruasEmRevisao([...novos, ...atualizados]) };
}

// ---------------------------------------------------------------------------
// Street → eventos para o HUB
// ---------------------------------------------------------------------------

/**
 * Compara o antes/depois da lista do aparelho e devolve os DESFECHOS novos de pacotes da carga:
 * entrega ou insucesso. Pega qualquer caminho de baixa do app (modal, lote, atalho) sem mexer em cada tela.
 * Só considera pacotes do ajudante da sessão (quando informado).
 */
export function detectarEventos(antes: DeliveryData[], depois: DeliveryData[], sessaoId?: string): EventoStreet[] {
  const anterior = new Map(antes.map((d) => [d.id_entrega, d]));
  const eventos: EventoStreet[] = [];
  for (const d of depois) {
    if (!d.hub || (sessaoId && d.hub.ajudante_id !== sessaoId)) continue;
    const a = anterior.get(d.id_entrega);
    if (!a) continue; // acabou de chegar (carga ou sessão retomada): nada aconteceu agora
    const base = {
      carga_id: d.hub.carga_id,
      hub_pacote_id: d.hub.pacote_id,
      codigo: d.codigo_pacote.replace(/^#/, ''),
    };
    if (statusEntregue(d) && !statusEntregue(a)) {
      const quando = d.data_hora_entrega || d.data_hora;
      eventos.push({
        ...base,
        id_evento: `${d.hub.pacote_id}:entrega:${quando}`,
        tipo: 'ENTREGA_REGISTRADA',
        ocorrido_em: quando,
        recebedor: d.recebedor_tipo || d.recebedor_detalhes ? { tipo: d.recebedor_tipo || '', detalhes: d.recebedor_detalhes || '' } : null,
      });
    } else if (d.status === 'insucesso' && a.status !== 'insucesso') {
      eventos.push({
        ...base,
        id_evento: `${d.hub.pacote_id}:insucesso:${d.data_hora}`,
        tipo: 'INSUCESSO_REGISTRADO',
        ocorrido_em: d.data_hora,
        recebedor: null,
        motivo: d.motivo_insucesso || 'sem motivo informado',
      });
    }
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
