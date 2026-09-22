/**
 * MEMÓRIA OPERACIONAL — histórico/conhecimento sobre destinos, unidades, pessoas e recebedores.
 *
 * Princípios:
 *  - É uma camada SEPARADA da lista de pacotes: pacote ≠ destino ≠ recebedor conhecido.
 *  - Só acumula (contadores + datas). Nunca sobrescreve nem apaga histórico sozinha;
 *    remoção só por ação explícita do operador (`esquecer*`).
 *  - Pode SUGERIR; não inventa. Histórico conhecido ≠ prova de que a pessoa recebeu hoje:
 *    o recebedor real vai no registro da entrega, a memória apenas aprende com ele.
 *  - Funções puras e imutáveis; o relógio entra como parâmetro (`agora`).
 */
import type { EnderecoInterpretado, FamiliaUnidade, TipoContexto, TipoUnidade } from './endereco';
import { chaveTexto, limparEspacos } from './texto';
import {
  type CandidatoDestino,
  type Resolucao,
  type TipoDestino,
  resolverContraCandidatos,
  tipoDoDestino,
} from './destino';

export interface PessoaConhecida {
  nome: string;
  chave: string;
  vezes: number;
  primeiraVezEm: string;
  ultimaVezEm: string;
}

export interface UnidadeConhecida {
  chave: string;
  rotulo: string;
  tipo: TipoUnidade;
  familia: FamiliaUnidade;
  vezes: number;
  primeiraVezEm: string;
  ultimaVezEm: string;
  pessoas: PessoaConhecida[];
}

/** categoria: 'portaria' | 'familiar' | 'vizinho' | 'funcionario' | 'estabelecimento' | 'proprio_morador' | 'terceiros' | 'outro'… */
export interface RecebedorConhecido {
  chave: string;
  categoria: string;
  rotulo: string;
  unidadeChave?: string;
  vezes: number;
  primeiraVezEm: string;
  ultimaVezEm: string;
}

export interface DestinoConhecido {
  id: string;
  ruaChave: string;
  ruaNome: string;
  numeroChave: string;
  numeroNome: string;
  contextoChave: string;
  contextoNome?: string;
  contextoTipo?: TipoContexto;
  criadoEm: string;
  atualizadoEm: string;
  /** Quantos pacotes já foram registrados para este destino (histórico acumulado). */
  pacotesRegistrados: number;
  unidades: UnidadeConhecida[];
  /** Destinatários vistos neste destino sem unidade informada. */
  pessoas: PessoaConhecida[];
  recebedores: RecebedorConhecido[];
}

export interface MemoriaOperacional {
  versao: 3;
  destinos: Record<string, DestinoConhecido>;
}

export function memoriaVazia(): MemoriaOperacional {
  return { versao: 3, destinos: {} };
}

const NOMES_GENERICOS = new Set(['', 'morador', 'moradora', 'cliente', 'nao informado', 'desconhecido']);

export function ehNomeGenerico(nome?: string | null): boolean {
  return NOMES_GENERICOS.has(chaveTexto(nome));
}

// ---------------------------------------------------------------------------
// Escrita (sempre acumulativa)
// ---------------------------------------------------------------------------

function tocarPessoa(lista: PessoaConhecida[], nome: string, agora: string, vezes: number): PessoaConhecida[] {
  const chave = chaveTexto(nome);
  const i = lista.findIndex((p) => p.chave === chave);
  if (i < 0) return [...lista, { nome, chave, vezes, primeiraVezEm: agora, ultimaVezEm: agora }];
  const atual = lista[i];
  const nova = [...lista];
  nova[i] = { ...atual, vezes: atual.vezes + vezes, ultimaVezEm: agora };
  return nova;
}

function criarDestino(end: EnderecoInterpretado, agora: string): DestinoConhecido {
  return {
    id: end.destinoId,
    ruaChave: end.ruaChave,
    ruaNome: end.ruaNome,
    numeroChave: end.numeroChave,
    numeroNome: end.numeroNome,
    contextoChave: end.contexto?.chave ?? '',
    contextoNome: end.contexto?.nome,
    contextoTipo: end.contexto?.tipo,
    criadoEm: agora,
    atualizadoEm: agora,
    pacotesRegistrados: 0,
    unidades: [],
    pessoas: [],
    recebedores: [],
  };
}

/** Garante que o destino exista, sem contar pacote. */
export function garantirDestino(mem: MemoriaOperacional, end: EnderecoInterpretado, agora: string): MemoriaOperacional {
  if (mem.destinos[end.destinoId]) return mem;
  return { ...mem, destinos: { ...mem.destinos, [end.destinoId]: criarDestino(end, agora) } };
}

/**
 * Registra que um pacote foi cadastrado neste destino (e unidade/pessoa, se houver).
 * O ID do destino é determinístico; por isso o chamador já sabe o `destinoId` antes de gravar.
 */
export function registrarPacote(
  mem: MemoriaOperacional,
  end: EnderecoInterpretado,
  pessoa: string | undefined,
  agora: string,
  vezes = 1
): { memoria: MemoriaOperacional; destinoId: string } {
  const base = mem.destinos[end.destinoId] ?? criarDestino(end, agora);
  const nome = ehNomeGenerico(pessoa) ? undefined : limparEspacos(pessoa);

  let unidades = base.unidades;
  let pessoas = base.pessoas;

  if (end.unidade) {
    const u = end.unidade;
    const i = unidades.findIndex((x) => x.chave === u.chave);
    const existente = i >= 0 ? unidades[i] : undefined;
    const atualizada: UnidadeConhecida = {
      chave: u.chave,
      rotulo: existente?.rotulo ?? u.rotulo,
      tipo: u.tipo,
      familia: u.familia,
      vezes: (existente?.vezes ?? 0) + vezes,
      primeiraVezEm: existente?.primeiraVezEm ?? agora,
      ultimaVezEm: agora,
      pessoas: nome ? tocarPessoa(existente?.pessoas ?? [], nome, agora, vezes) : existente?.pessoas ?? [],
    };
    unidades = existente ? unidades.map((x, k) => (k === i ? atualizada : x)) : [...unidades, atualizada];
  } else if (nome) {
    pessoas = tocarPessoa(pessoas, nome, agora, vezes);
  }

  const destino: DestinoConhecido = {
    ...base,
    unidades,
    pessoas,
    pacotesRegistrados: base.pacotesRegistrados + vezes,
    atualizadoEm: agora,
  };
  return { memoria: { ...mem, destinos: { ...mem.destinos, [destino.id]: destino } }, destinoId: destino.id };
}

/**
 * Aprende com quem RECEBEU de fato. Não altera contagens de outros recebedores
 * (histórico conhecido ≠ prova de que aquela pessoa recebeu hoje).
 * Se o destino não existe, não inventa: devolve a memória como está.
 */
export function registrarRecebedor(
  mem: MemoriaOperacional,
  destinoId: string,
  recebedor: { categoria: string; rotulo: string; unidadeChave?: string },
  agora: string
): MemoriaOperacional {
  const destino = mem.destinos[destinoId];
  const rotulo = limparEspacos(recebedor.rotulo);
  if (!destino || !rotulo) return mem;

  const chave = `${chaveTexto(recebedor.categoria)}|${chaveTexto(rotulo)}|${recebedor.unidadeChave ?? ''}`;
  const i = destino.recebedores.findIndex((r) => r.chave === chave);
  const recebedores = [...destino.recebedores];
  if (i < 0) {
    recebedores.push({
      chave,
      categoria: recebedor.categoria,
      rotulo,
      unidadeChave: recebedor.unidadeChave,
      vezes: 1,
      primeiraVezEm: agora,
      ultimaVezEm: agora,
    });
  } else {
    recebedores[i] = { ...recebedores[i], vezes: recebedores[i].vezes + 1, ultimaVezEm: agora };
  }
  return { ...mem, destinos: { ...mem.destinos, [destinoId]: { ...destino, recebedores, atualizadoEm: agora } } };
}

// ---------------------------------------------------------------------------
// Leitura / sugestão
// ---------------------------------------------------------------------------

export function sugerirRecebedores(
  mem: MemoriaOperacional,
  destinoId: string | undefined,
  filtro: { categoria?: string; unidadeChave?: string } = {}
): RecebedorConhecido[] {
  const destino = destinoId ? mem.destinos[destinoId] : undefined;
  if (!destino) return [];
  const peso = (r: RecebedorConhecido) => (filtro.unidadeChave && r.unidadeChave === filtro.unidadeChave ? 0 : !r.unidadeChave ? 1 : 2);
  return destino.recebedores
    .filter((r) => !filtro.categoria || r.categoria === filtro.categoria)
    .sort((a, b) => peso(a) - peso(b) || b.vezes - a.vezes || b.ultimaVezEm.localeCompare(a.ultimaVezEm));
}

export function candidatosNoNumero(mem: MemoriaOperacional, ruaChave: string, numeroChave: string): DestinoConhecido[] {
  return Object.values(mem.destinos).filter((d) => d.ruaChave === ruaChave && d.numeroChave === numeroChave);
}

export function paraCandidato(d: DestinoConhecido): CandidatoDestino {
  return { id: d.id, contextoChave: d.contextoChave, contextoNome: d.contextoNome, contextoTipo: d.contextoTipo };
}

/** Resolve um endereço contra a memória (não altera nada). */
export function resolverDestino(mem: MemoriaOperacional, end: EnderecoInterpretado): Resolucao {
  return resolverContraCandidatos(candidatosNoNumero(mem, end.ruaChave, end.numeroChave).map(paraCandidato), end);
}

export function tipoDeDestinoConhecido(d: DestinoConhecido): TipoDestino {
  return tipoDoDestino({ contextoTipo: d.contextoTipo, familias: d.unidades.map((u) => u.familia) });
}

/** Destinos das ruas pedidas (ex.: as sub-ruas da Manilha), ordenados por número. */
export function destinosDasRuas(mem: MemoriaOperacional, ruaChaves: string[]): DestinoConhecido[] {
  const set = new Set(ruaChaves);
  return Object.values(mem.destinos)
    .filter((d) => set.has(d.ruaChave))
    .sort((a, b) => compararNumeros(a.numeroChave, b.numeroChave) || a.contextoChave.localeCompare(b.contextoChave));
}

export function compararNumeros(a: string, b: string): number {
  if (a === 'sn' && b !== 'sn') return 1;
  if (b === 'sn' && a !== 'sn') return -1;
  const na = parseInt(a, 10);
  const nb = parseInt(b, 10);
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
  return a.localeCompare(b, 'pt-BR', { numeric: true });
}

// ---------------------------------------------------------------------------
// Remoção EXPLÍCITA (ação do operador)
// ---------------------------------------------------------------------------

export function esquecerDestino(mem: MemoriaOperacional, destinoId: string): MemoriaOperacional {
  if (!mem.destinos[destinoId]) return mem;
  const { [destinoId]: _removido, ...resto } = mem.destinos;
  return { ...mem, destinos: resto };
}

export function esquecerPessoa(
  mem: MemoriaOperacional,
  destinoId: string,
  unidadeChave: string | undefined,
  chavePessoa: string
): MemoriaOperacional {
  const d = mem.destinos[destinoId];
  if (!d) return mem;
  const nova: DestinoConhecido = unidadeChave
    ? {
        ...d,
        unidades: d.unidades.map((u) =>
          u.chave === unidadeChave ? { ...u, pessoas: u.pessoas.filter((p) => p.chave !== chavePessoa) } : u
        ),
      }
    : { ...d, pessoas: d.pessoas.filter((p) => p.chave !== chavePessoa) };
  return { ...mem, destinos: { ...mem.destinos, [destinoId]: nova } };
}

export function esquecerRecebedor(mem: MemoriaOperacional, destinoId: string, chaveRecebedor: string): MemoriaOperacional {
  const d = mem.destinos[destinoId];
  if (!d) return mem;
  return {
    ...mem,
    destinos: { ...mem.destinos, [destinoId]: { ...d, recebedores: d.recebedores.filter((r) => r.chave !== chaveRecebedor) } },
  };
}
