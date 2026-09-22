/**
 * ORGANIZAÇÃO DE UMA RUA: Rua → Nº → destino → unidade → pacotes.
 *
 * Substitui `classifyComplementType` + `groupedHouses`. Diferenças de princípio:
 *  - número igual NÃO agrupa por si só: o que agrupa é a identidade do DESTINO;
 *  - condomínio/vila só aparecem com evidência explícita (unidade ou local nomeado);
 *  - se um pacote sem evidência cai num número com mais de um destino possível,
 *    ele fica PENDENTE de confirmação (nada é escolhido automaticamente).
 */
import type { DeliveryData } from '../types';
import { interpretarEndereco, type EnderecoInterpretado, type FamiliaUnidade, type TipoContexto } from './endereco';
import { resolverContraCandidatos, tipoDoDestino, type CandidatoDestino, type TipoDestino } from './destino';
import { compararNumeros, memoriaVazia, paraCandidato, type MemoriaOperacional } from './memoria';
import { dataLocal } from './data';
import { ruaRealDoPacote } from './ruas';

export function enderecoDoPacote(d: DeliveryData): EnderecoInterpretado {
  return interpretarEndereco({
    // Na Manilha a rua "real" do destino é a sub-rua (Rua B, Leão XIII…), não a área "Manilha".
    rua: ruaRealDoPacote(d),
    numero: d.numero_casa || d.endereco_numero || '',
    complemento: d.complemento || d.endereco_complemento || '',
  });
}

/**
 * Destino a que o pacote pertence: o vínculo gravado ou, para dados antigos sem vínculo, o deduzido pelo
 * agrupamento da rua. Indefinido quando o pacote está pendente de confirmação.
 */
export function destinoIdDoPacote(
  p: DeliveryData,
  pacotesDaMesmaRua: DeliveryData[],
  memoria: MemoriaOperacional = memoriaVazia()
): string | undefined {
  if (p.destino_id) return p.destino_id;
  for (const n of agruparRua(pacotesDaMesmaRua, memoria)) {
    for (const d of n.destinos) if (d.pacotes.some((x) => x.id_entrega === p.id_entrega)) return d.id;
  }
  return undefined;
}

export interface GrupoUnidade {
  chave: string;
  rotulo: string;
  pacotes: DeliveryData[];
}

export interface GrupoDestino {
  id: string;
  tipo: TipoDestino;
  /** Nome do local (ex.: "Loja ABC"); ausente = endereço sem local informado. */
  contextoNome?: string;
  /** Já existia na memória de um dia anterior ("destino conhecido"). */
  conhecidoDeAntes: boolean;
  unidades: GrupoUnidade[];
  /** Pacotes deste destino sem unidade informada — só preenchido se o destino tem unidades. */
  semUnidade: DeliveryData[];
  pacotes: DeliveryData[];
}

export interface CandidatoInfo {
  id: string;
  contextoNome?: string;
  tipo: TipoDestino;
}

export interface PacotePendente {
  pacote: DeliveryData;
  motivo: 'sugestao' | 'ambiguo';
  candidatos: CandidatoInfo[];
  /** Id que o pacote teria como destino novo (para "é outro local"). */
  novoDestinoId: string;
}

export interface GrupoNumero {
  numeroChave: string;
  numeroNome: string;
  destinos: GrupoDestino[];
  pendentes: PacotePendente[];
  totalPacotes: number;
}

interface Item {
  p: DeliveryData;
  end: EnderecoInterpretado;
}

interface CandInfo extends CandidatoDestino {
  familias: FamiliaUnidade[];
  tipoContexto?: TipoContexto;
}

const chaveDoNumero = (e: EnderecoInterpretado) => `${e.ruaChave}|${e.numeroChave}`;

/**
 * Mostra só os pacotes visíveis (busca/filtro de status) SEM reclassificar: o agrupamento é calculado
 * sobre todos os pacotes da rua; esconder um pacote não pode mudar em que destino os outros caem.
 */
export function filtrarGrupos(grupos: GrupoNumero[], visivel: (p: DeliveryData) => boolean): GrupoNumero[] {
  const saida: GrupoNumero[] = [];
  for (const g of grupos) {
    const destinos = g.destinos
      .map((d) => ({
        ...d,
        pacotes: d.pacotes.filter(visivel),
        unidades: d.unidades.map((u) => ({ ...u, pacotes: u.pacotes.filter(visivel) })).filter((u) => u.pacotes.length > 0),
        semUnidade: d.semUnidade.filter(visivel),
      }))
      .filter((d) => d.pacotes.length > 0);
    const pendentes = g.pendentes.filter((p) => visivel(p.pacote));
    const total = destinos.reduce((acc, d) => acc + d.pacotes.length, 0) + pendentes.length;
    if (total > 0) saida.push({ ...g, destinos, pendentes, totalPacotes: total });
  }
  return saida;
}

export function agruparRua(
  pacotes: DeliveryData[],
  memoria: MemoriaOperacional = memoriaVazia(),
  agora: Date = new Date()
): GrupoNumero[] {
  const hoje = dataLocal(agora);
  const itens: Item[] = pacotes.map((p) => ({ p, end: enderecoDoPacote(p) }));

  // Candidatos por número: começam com a memória.
  const porNumero = new Map<string, Map<string, CandInfo>>();
  for (const d of Object.values(memoria.destinos)) {
    const k = `${d.ruaChave}|${d.numeroChave}`;
    if (!porNumero.has(k)) porNumero.set(k, new Map());
    porNumero.get(k)!.set(d.id, { ...paraCandidato(d), familias: d.unidades.map((u) => u.familia) });
  }
  const candidatosDe = (e: EnderecoInterpretado) => {
    const k = chaveDoNumero(e);
    if (!porNumero.has(k)) porNumero.set(k, new Map());
    return porNumero.get(k)!;
  };
  const ancorar = (item: Item, id: string) => {
    const mapa = candidatosDe(item.end);
    const existente = mapa.get(id);
    const familias = item.end.unidade ? [item.end.unidade.familia] : [];
    if (existente) {
      mapa.set(id, { ...existente, familias: [...existente.familias, ...familias] });
      return;
    }
    const contextoChave = id.split('|')[2] ?? '';
    const proprio = id === item.end.destinoId;
    mapa.set(id, {
      id,
      contextoChave,
      contextoNome: proprio ? item.end.contexto?.nome : undefined,
      contextoTipo: proprio ? item.end.contexto?.tipo : undefined,
      familias,
    });
  };

  const destinoDoPacote = new Map<string, string>();
  const pendencias = new Map<string, { motivo: 'sugestao' | 'ambiguo'; candidatos: string[]; novoDestinoId: string }>();
  const resolvidos = new Set<string>();

  // Passo 1 — âncoras: vínculo já confirmado (destino_id) ou local nomeado explicitamente.
  for (const item of itens) {
    const id = item.p.destino_id || (item.end.contexto ? item.end.destinoId : undefined);
    if (!id) continue;
    destinoDoPacote.set(item.p.id_entrega, id);
    resolvidos.add(item.p.id_entrega);
    ancorar(item, id);
  }

  // Passo 2 e 3 — sem local nomeado: primeiro os que trazem unidade (evidência), depois os simples.
  const resolverAnonimos = (lista: Item[]) => {
    for (const item of lista) {
      const r = resolverContraCandidatos(Array.from(candidatosDe(item.end).values()), item.end);
      if (r.status === 'novo' || r.status === 'exato') {
        destinoDoPacote.set(item.p.id_entrega, r.destinoId);
        resolvidos.add(item.p.id_entrega);
        ancorar(item, r.destinoId);
      } else {
        pendencias.set(item.p.id_entrega, { motivo: r.status, candidatos: r.candidatos, novoDestinoId: r.novoDestinoId });
      }
    }
  };
  const anonimos = itens.filter((i) => !resolvidos.has(i.p.id_entrega));
  resolverAnonimos(anonimos.filter((i) => i.end.unidade));
  resolverAnonimos(anonimos.filter((i) => !i.end.unidade));

  // Monta os grupos.
  const numeros = new Map<string, GrupoNumero>();
  const grupoNumero = (e: EnderecoInterpretado) => {
    const k = chaveDoNumero(e);
    if (!numeros.has(k)) numeros.set(k, { numeroChave: e.numeroChave, numeroNome: e.numeroNome, destinos: [], pendentes: [], totalPacotes: 0 });
    return numeros.get(k)!;
  };
  const infoCandidato = (e: EnderecoInterpretado, id: string): CandidatoInfo => {
    const c = candidatosDe(e).get(id);
    const memoriaDestino = memoria.destinos[id];
    const tipo = tipoDoDestino({ contextoTipo: c?.contextoTipo, familias: c?.familias ?? [] });
    return { id, contextoNome: c?.contextoNome ?? memoriaDestino?.contextoNome, tipo };
  };

  const porDestino = new Map<string, { item: Item; itens: Item[] }>();
  for (const item of itens) {
    const g = grupoNumero(item.end);
    g.totalPacotes++;
    // (o id do destino já contém rua|número|contexto; a chave abaixo só precisa ser única)
    const pend = pendencias.get(item.p.id_entrega);
    if (pend) {
      g.pendentes.push({
        pacote: item.p,
        motivo: pend.motivo,
        candidatos: pend.candidatos.map((id) => infoCandidato(item.end, id)),
        novoDestinoId: pend.novoDestinoId,
      });
      continue;
    }
    const id = destinoDoPacote.get(item.p.id_entrega)!;
    const chave = `${chaveDoNumero(item.end)}#${id}`;
    if (!porDestino.has(chave)) porDestino.set(chave, { item, itens: [] });
    porDestino.get(chave)!.itens.push(item);
  }

  for (const [chave, { item: primeiro, itens: doDestino }] of porDestino) {
    const id = chave.slice(chave.indexOf('#') + 1);
    const g = grupoNumero(primeiro.end);
    const cand = candidatosDe(primeiro.end).get(id);
    const doMemoria = memoria.destinos[id];

    const unidades = new Map<string, GrupoUnidade>();
    const semUnidade: DeliveryData[] = [];
    for (const it of doDestino) {
      if (!it.end.unidade) {
        semUnidade.push(it.p);
        continue;
      }
      const u = it.end.unidade;
      if (!unidades.has(u.chave)) unidades.set(u.chave, { chave: u.chave, rotulo: u.rotulo, pacotes: [] });
      unidades.get(u.chave)!.pacotes.push(it.p);
    }
    const listaUnidades = Array.from(unidades.values()).sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR', { numeric: true }));

    const familias = [
      ...(cand?.familias ?? []),
      ...doDestino.flatMap((it) => (it.end.unidade ? [it.end.unidade.familia] : [])),
    ];
    g.destinos.push({
      id,
      tipo: tipoDoDestino({ contextoTipo: cand?.contextoTipo ?? doMemoria?.contextoTipo, familias }),
      contextoNome: cand?.contextoNome ?? doMemoria?.contextoNome,
      conhecidoDeAntes: !!doMemoria && dataLocal(new Date(doMemoria.criadoEm)) < hoje,
      unidades: listaUnidades,
      semUnidade: listaUnidades.length > 0 ? semUnidade : [],
      pacotes: doDestino.map((it) => it.p),
    });
  }

  const lista = Array.from(numeros.values());
  for (const g of lista) {
    g.destinos.sort((a, b) => Number(!!a.contextoNome) - Number(!!b.contextoNome) || (a.contextoNome ?? '').localeCompare(b.contextoNome ?? '', 'pt-BR'));
  }
  return lista.sort((a, b) => compararNumeros(a.numeroChave, b.numeroChave));
}
