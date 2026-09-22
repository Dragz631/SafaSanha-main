import { describe, expect, it } from 'vitest';
import { interpretarEndereco } from './endereco';
import {
  candidatosNoNumero,
  esquecerDestino,
  esquecerPessoa,
  memoriaVazia,
  registrarPacote,
  registrarRecebedor,
  resolverDestino,
  sugerirRecebedores,
  type MemoriaOperacional,
} from './memoria';
import { aplicarEntrega } from './entrega';
import { pacote } from './fixtures';

const T1 = '2026-09-20T10:00:00.000Z';
const T2 = '2026-09-21T10:00:00.000Z';
const end = (rua: string, numero: string, complemento = '') => interpretarEndereco({ rua, numero, complemento });

function comLojaECondominio(): MemoriaOperacional {
  let m = memoriaVazia();
  m = registrarPacote(m, end('Rua X', '100', 'Loja ABC'), 'João', T1).memoria;
  m = registrarPacote(m, end('Rua X', '100', 'Condomínio Residencial X Apto 101'), 'Maria', T1).memoria;
  m = registrarPacote(m, end('Rua X', '100', 'Condomínio Residencial X Apto 102'), 'Carlos', T1).memoria;
  return m;
}

describe('CASO 8 — destino conhecido + recebedor conhecido: sugere, mas registra o recebedor REAL', () => {
  it('sugere o recebedor histórico e guarda quem de fato recebeu hoje', () => {
    let m = memoriaVazia();
    const cadastro = registrarPacote(m, end('Rua X', '100', 'Loja ABC'), 'João', T1);
    m = registrarRecebedor(cadastro.memoria, cadastro.destinoId, { categoria: 'estabelecimento', rotulo: 'João' }, T1);

    // Dias depois: chega outro pacote para o mesmo local
    const novo = end('Rua X', '100', 'Loja ABC');
    const r = resolverDestino(m, novo);
    expect(r).toEqual({ status: 'exato', destinoId: cadastro.destinoId });

    // O sistema SUGERE o recebedor conhecido…
    expect(sugerirRecebedores(m, cadastro.destinoId).map((x) => x.rotulo)).toEqual(['João']);

    // …mas hoje quem recebeu foi a Maria: o registro da entrega guarda a Maria.
    const entregue = aplicarEntrega(
      pacote({ rua: 'Rua X', numero: '100', comp: 'Loja ABC' }),
      { recebedor_tipo: 'estabelecimento', recebedor_detalhes: 'Maria' },
      T2
    );
    expect(entregue.recebedor_detalhes).toBe('Maria');

    // A memória aprende a Maria SEM apagar o João e SEM contar uma entrega a mais para ele.
    m = registrarRecebedor(m, cadastro.destinoId, { categoria: 'estabelecimento', rotulo: 'Maria' }, T2);
    const rec = sugerirRecebedores(m, cadastro.destinoId);
    expect(rec.map((x) => [x.rotulo, x.vezes])).toEqual(expect.arrayContaining([['João', 1], ['Maria', 1]]));
    expect(rec).toHaveLength(2);
  });

  it('recebedor repetido só incrementa o contador daquela pessoa e atualiza a última vez', () => {
    const c = registrarPacote(memoriaVazia(), end('Rua X', '100', 'Loja ABC'), undefined, T1);
    let m = registrarRecebedor(c.memoria, c.destinoId, { categoria: 'estabelecimento', rotulo: 'João' }, T1);
    m = registrarRecebedor(m, c.destinoId, { categoria: 'estabelecimento', rotulo: 'joão' }, T2);
    const [joao] = sugerirRecebedores(m, c.destinoId);
    expect(joao).toMatchObject({ vezes: 2, primeiraVezEm: T1, ultimaVezEm: T2 });
  });

  it('não inventa: recebedor para destino inexistente não cria nada', () => {
    const m = registrarRecebedor(memoriaVazia(), 'rua x|100|', { categoria: 'portaria', rotulo: 'José' }, T1);
    expect(m).toEqual(memoriaVazia());
  });

  it('filtra por categoria e prioriza quem já recebeu na mesma unidade', () => {
    const c = registrarPacote(memoriaVazia(), end('Rua X', '100', 'Condomínio Sol Apto 101'), 'Ana', T1);
    let m = registrarRecebedor(c.memoria, c.destinoId, { categoria: 'portaria', rotulo: 'José' }, T1);
    m = registrarRecebedor(m, c.destinoId, { categoria: 'familiar', rotulo: 'Mãe (Rita)', unidadeChave: 'apto:101' }, T1);
    m = registrarRecebedor(m, c.destinoId, { categoria: 'familiar', rotulo: 'Pai', unidadeChave: 'apto:202' }, T1);
    expect(sugerirRecebedores(m, c.destinoId, { categoria: 'portaria' }).map((r) => r.rotulo)).toEqual(['José']);
    expect(sugerirRecebedores(m, c.destinoId, { categoria: 'familiar', unidadeChave: 'apto:101' }).map((r) => r.rotulo)).toEqual([
      'Mãe (Rita)',
      'Pai',
    ]);
  });
});

describe('CASO 9 — mesmo número, dois destinos: históricos NÃO se misturam', () => {
  it('cada destino guarda os próprios recebedores e moradores', () => {
    let m = comLojaECondominio();
    const idLoja = end('Rua X', '100', 'Loja ABC').destinoId;
    const idCond = end('Rua X', '100', 'Condomínio Residencial X').destinoId;
    expect(idLoja).not.toBe(idCond);

    m = registrarRecebedor(m, idLoja, { categoria: 'estabelecimento', rotulo: 'João' }, T1);
    m = registrarRecebedor(m, idCond, { categoria: 'portaria', rotulo: 'José' }, T1);

    expect(sugerirRecebedores(m, idLoja).map((r) => r.rotulo)).toEqual(['João']);
    expect(sugerirRecebedores(m, idCond).map((r) => r.rotulo)).toEqual(['José']);

    const loja = m.destinos[idLoja];
    const cond = m.destinos[idCond];
    expect(loja.pessoas.map((p) => p.nome)).toEqual(['João']);
    expect(cond.unidades.map((u) => u.rotulo)).toEqual(['Apto 101', 'Apto 102']);
    expect(cond.unidades.flatMap((u) => u.pessoas.map((p) => p.nome))).toEqual(['Maria', 'Carlos']);
    expect(candidatosNoNumero(m, 'rua x', '100')).toHaveLength(2);
  });

  it('o mesmo número em OUTRA rua é outro destino (o "número sem rua" da versão antiga vazava)', () => {
    let m = registrarPacote(memoriaVazia(), end('Rua A', '100', 'Portaria'), undefined, T1).memoria;
    const idA = end('Rua A', '100', 'Portaria').destinoId;
    m = registrarRecebedor(m, idA, { categoria: 'portaria', rotulo: 'José' }, T1);
    const idB = end('Rua B', '100', 'Portaria').destinoId;
    expect(sugerirRecebedores(m, idB)).toEqual([]);
  });
});

describe('CASO 10 — sem informação suficiente: não inventa, pede confirmação', () => {
  it('endereço simples num número com Loja ABC e Condomínio → ambíguo, nada é escolhido', () => {
    const m = comLojaECondominio();
    const r = resolverDestino(m, end('Rua X', '100'));
    expect(r.status).toBe('ambiguo');
    if (r.status === 'ambiguo') {
      expect(r.candidatos.sort()).toEqual(
        [end('Rua X', '100', 'Loja ABC').destinoId, end('Rua X', '100', 'Condomínio Residencial X').destinoId].sort()
      );
    }
  });

  it('um único destino nomeado → só SUGERE (não vincula sozinho)', () => {
    const m = registrarPacote(memoriaVazia(), end('Rua X', '100', 'Loja ABC'), undefined, T1).memoria;
    const r = resolverDestino(m, end('Rua X', '100'));
    expect(r.status).toBe('sugestao');
    if (r.status === 'sugestao') expect(r.candidatos).toEqual([end('Rua X', '100', 'Loja ABC').destinoId]);
  });

  it('apartamento explícito exclui estabelecimento comercial → sugere só o condomínio', () => {
    const m = comLojaECondominio();
    const r = resolverDestino(m, end('Rua X', '100', 'Apto 101'));
    expect(r.status).toBe('sugestao');
    if (r.status === 'sugestao') expect(r.candidatos).toEqual([end('Rua X', '100', 'Condomínio Residencial X').destinoId]);
  });

  it('dois condomínios e um apto sem nome → ambíguo', () => {
    let m = registrarPacote(memoriaVazia(), end('Rua X', '100', 'Condomínio Sol'), undefined, T1).memoria;
    m = registrarPacote(m, end('Rua X', '100', 'Condomínio Lua'), undefined, T1).memoria;
    expect(resolverDestino(m, end('Rua X', '100', 'Apto 101')).status).toBe('ambiguo');
  });

  it('local nomeado explícito e diferente do que existe → destino novo (não é ambiguidade)', () => {
    const m = registrarPacote(memoriaVazia(), end('Rua X', '100', 'Loja ABC'), undefined, T1).memoria;
    expect(resolverDestino(m, end('Rua X', '100', 'Loja DEF')).status).toBe('novo');
  });

  it('nada conhecido → novo; só o endereço simples conhecido → exato', () => {
    expect(resolverDestino(memoriaVazia(), end('Rua X', '100')).status).toBe('novo');
    const m = registrarPacote(memoriaVazia(), end('Rua X', '100'), undefined, T1).memoria;
    expect(resolverDestino(m, end('Rua X', '100')).status).toBe('exato');
    expect(resolverDestino(m, end('Rua X', '100', 'Apto 5')).status).toBe('exato');
  });
});

describe('memória: acumula, não apaga, não inventa', () => {
  it('registrar de novo incrementa contadores e preserva a primeira grafia e a data de criação', () => {
    let m = registrarPacote(memoriaVazia(), end('Rua X', '100', 'Apto 101'), 'João Silva', T1).memoria;
    m = registrarPacote(m, end('Rua X', '100', 'Ap 101'), 'joão silva', T2).memoria;
    const d = Object.values(m.destinos)[0];
    expect(d.criadoEm).toBe(T1);
    expect(d.pacotesRegistrados).toBe(2);
    expect(d.unidades).toHaveLength(1);
    expect(d.unidades[0]).toMatchObject({ vezes: 2, rotulo: 'Apto 101' });
    expect(d.unidades[0].pessoas).toHaveLength(1);
    expect(d.unidades[0].pessoas[0]).toMatchObject({ nome: 'João Silva', vezes: 2 });
  });

  it('um nome novo é ADICIONADO; o anterior continua', () => {
    let m = registrarPacote(memoriaVazia(), end('Rua X', '100', 'Apto 101'), 'João', T1).memoria;
    m = registrarPacote(m, end('Rua X', '100', 'Apto 101'), 'Pedro', T2).memoria;
    const nomes = Object.values(m.destinos)[0].unidades[0].pessoas.map((p) => p.nome);
    expect(nomes).toEqual(['João', 'Pedro']);
  });

  it('nome genérico ("Morador") não vira conhecimento', () => {
    const m = registrarPacote(memoriaVazia(), end('Rua X', '100'), 'Morador', T1).memoria;
    expect(Object.values(m.destinos)[0].pessoas).toEqual([]);
  });

  it('é imutável: não altera a memória de entrada', () => {
    const antes = registrarPacote(memoriaVazia(), end('Rua X', '100'), 'Ana', T1).memoria;
    const snapshot = JSON.stringify(antes);
    registrarPacote(antes, end('Rua X', '100'), 'Bia', T2);
    registrarRecebedor(antes, Object.keys(antes.destinos)[0], { categoria: 'vizinho', rotulo: 'Nº 102' }, T2);
    expect(JSON.stringify(antes)).toBe(snapshot);
  });

  it('só some por ação explícita (esquecer*)', () => {
    let m = registrarPacote(memoriaVazia(), end('Rua X', '100', 'Apto 101'), 'João', T1).memoria;
    const id = Object.keys(m.destinos)[0];
    m = esquecerPessoa(m, id, 'apto:101', 'joao');
    expect(m.destinos[id].unidades[0].pessoas).toEqual([]);
    expect(esquecerDestino(m, id).destinos).toEqual({});
  });
});
