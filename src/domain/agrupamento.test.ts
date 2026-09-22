import { describe, expect, it } from 'vitest';
import { agruparRua } from './agrupamento';
import { interpretarEndereco } from './endereco';
import { memoriaVazia, registrarPacote } from './memoria';
import { pacote } from './fixtures';

const AGORA = new Date('2026-09-21T15:00:00');

describe('agruparRua — organização Rua → Nº → destino → unidade', () => {
  it('CASO 1: mesmo número, sem complemento → 1 destino simples, sem condomínio', () => {
    const g = agruparRua([pacote({ nome: 'João' }), pacote({ nome: 'Maria' }), pacote({ nome: 'Carlos' })]);
    expect(g).toHaveLength(1);
    expect(g[0].destinos).toHaveLength(1);
    expect(g[0].destinos[0]).toMatchObject({ tipo: 'simples', unidades: [], semUnidade: [] });
    expect(g[0].destinos[0].pacotes).toHaveLength(3);
    expect(g[0].pendentes).toEqual([]);
  });

  it('CASO 2: mesmo número + unidades diferentes → 1 destino (prédio) com 2 unidades', () => {
    const g = agruparRua([pacote({ comp: 'Apto 101' }), pacote({ comp: 'Apto 102' })]);
    expect(g).toHaveLength(1);
    expect(g[0].destinos).toHaveLength(1);
    expect(g[0].destinos[0].tipo).toBe('predio');
    expect(g[0].destinos[0].unidades.map((u) => u.rotulo)).toEqual(['Apto 101', 'Apto 102']);
  });

  it('CASO 3: Loja ABC e Condomínio XYZ no mesmo número → dois destinos, sem misturar', () => {
    const g = agruparRua([pacote({ comp: 'Loja ABC' }), pacote({ comp: 'Condomínio XYZ' }), pacote({ comp: 'Condomínio XYZ Apto 5' })]);
    expect(g).toHaveLength(1);
    expect(g[0].destinos).toHaveLength(2);
    const loja = g[0].destinos.find((d) => d.contextoNome === 'Loja ABC')!;
    const cond = g[0].destinos.find((d) => d.contextoNome === 'Condomínio XYZ')!;
    expect(loja.tipo).toBe('comercio');
    expect(loja.pacotes).toHaveLength(1);
    expect(cond.tipo).toBe('predio');
    expect(cond.pacotes).toHaveLength(2);
  });

  it('CASO 4: números diferentes → dois grupos, em ordem numérica', () => {
    const g = agruparRua([pacote({ numero: '101' }), pacote({ numero: '100' }), pacote({ numero: '9' }), pacote({ numero: 'S/N' })]);
    expect(g.map((x) => x.numeroNome)).toEqual(['9', '100', '101', 'S/N']);
    // a chave do grupo é só o número (sem prefixo de rua) — usada em ordenação e identificação
    expect(g.map((x) => x.numeroChave)).toEqual(['9', '100', '101', 'sn']);
  });

  it('CASO 5/6/7 no agrupamento: "Ap 101" e "Apto 101" são a mesma unidade; Apt e Bl reconhecidos', () => {
    const g = agruparRua([pacote({ comp: 'Ap 101' }), pacote({ comp: 'Apto 101' }), pacote({ comp: 'Apt 202' }), pacote({ comp: 'Bl 2' })]);
    const d = g[0].destinos[0];
    expect(d.tipo).toBe('predio');
    expect(d.unidades.map((u) => u.rotulo).sort()).toEqual(['Apto 101', 'Apto 202', 'Bloco 2']);
    expect(d.unidades.find((u) => u.rotulo === 'Apto 101')!.pacotes).toHaveLength(2);
  });

  it('vila: Casa 1 e Casa 2 no mesmo número', () => {
    const g = agruparRua([pacote({ comp: 'Casa 1' }), pacote({ comp: 'Casa 2' })]);
    expect(g[0].destinos[0].tipo).toBe('vila');
    expect(g[0].destinos[0].unidades).toHaveLength(2);
  });

  it('41A, "41 A" e 41a ficam no MESMO número', () => {
    const g = agruparRua([pacote({ numero: '41A' }), pacote({ numero: '41 A' }), pacote({ numero: '41a' })]);
    expect(g).toHaveLength(1);
    expect(g[0].destinos[0].pacotes).toHaveLength(3);
  });

  it('pacote sem unidade num prédio conhecido fica no prédio, sinalizado como "sem unidade" (não vira outro destino)', () => {
    const pedro = pacote({ nome: 'Pedro', numero: '200' });
    const g = agruparRua([pacote({ numero: '200', comp: 'Apto 101' }), pacote({ numero: '200', comp: 'Apto 102' }), pedro]);
    expect(g[0].destinos).toHaveLength(1);
    expect(g[0].destinos[0].semUnidade).toEqual([pedro]);
    expect(g[0].pendentes).toEqual([]);
  });

  it('CASO 10 (agrupamento): pacote simples ao lado de Loja ABC + Condomínio → PENDENTE, não é colocado em nenhum', () => {
    const solto = pacote({ nome: 'Zé' });
    const g = agruparRua([pacote({ comp: 'Loja ABC' }), pacote({ comp: 'Condomínio XYZ' }), solto]);
    expect(g[0].pendentes).toHaveLength(1);
    expect(g[0].pendentes[0]).toMatchObject({ pacote: solto, motivo: 'ambiguo' });
    expect(g[0].pendentes[0].candidatos.map((c) => c.contextoNome).sort()).toEqual(['Condomínio XYZ', 'Loja ABC']);
    expect(g[0].destinos.flatMap((d) => d.pacotes)).not.toContain(solto);
  });

  it('um único local nomeado → pendente com SUGESTÃO', () => {
    const solto = pacote({});
    const g = agruparRua([pacote({ comp: 'Loja ABC' }), solto]);
    expect(g[0].pendentes[0]).toMatchObject({ pacote: solto, motivo: 'sugestao' });
    expect(g[0].pendentes[0].candidatos).toHaveLength(1);
  });

  it('vínculo confirmado (destino_id) é respeitado', () => {
    const idLoja = interpretarEndereco({ rua: 'Rua A', numero: '100', complemento: 'Loja ABC' }).destinoId;
    const confirmado = pacote({ destino_id: idLoja });
    const g = agruparRua([pacote({ comp: 'Loja ABC' }), pacote({ comp: 'Condomínio XYZ' }), confirmado]);
    expect(g[0].pendentes).toEqual([]);
    expect(g[0].destinos.find((d) => d.contextoNome === 'Loja ABC')!.pacotes).toContain(confirmado);
  });

  it('a memória participa: destino conhecido de dias anteriores gera pendência e é marcado como conhecido', () => {
    const fim = (c: string) => interpretarEndereco({ rua: 'Rua A', numero: '100', complemento: c });
    let m = registrarPacote(memoriaVazia(), fim('Loja ABC'), 'João', '2026-09-20T10:00:00.000Z').memoria;
    m = registrarPacote(m, fim('Condomínio XYZ'), 'Maria', '2026-09-20T10:00:00.000Z').memoria;

    const simples = pacote({});
    const g = agruparRua([simples], m, AGORA);
    expect(g[0].pendentes[0].motivo).toBe('ambiguo');

    const daLoja = pacote({ comp: 'Loja ABC' });
    const g2 = agruparRua([daLoja], m, AGORA);
    expect(g2[0].destinos[0]).toMatchObject({ contextoNome: 'Loja ABC', conhecidoDeAntes: true });
  });

  it('destino criado hoje NÃO é "conhecido de antes"', () => {
    const fim = interpretarEndereco({ rua: 'Rua A', numero: '100', complemento: 'Loja ABC' });
    const m = registrarPacote(memoriaVazia(), fim, undefined, '2026-09-21T09:00:00').memoria;
    const g = agruparRua([pacote({ comp: 'Loja ABC' })], m, AGORA);
    expect(g[0].destinos[0].conhecidoDeAntes).toBe(false);
  });

  it('mesmo número em ruas diferentes não se mistura', () => {
    const g = agruparRua([pacote({ rua: 'Rua A', numero: '100' }), pacote({ rua: 'Rua B', numero: '100' })]);
    expect(g).toHaveLength(2);
  });

  it('mesmo local em ordem de entrada diferente dá o mesmo resultado (determinístico)', () => {
    const a = [pacote({ comp: 'Loja ABC' }), pacote({}), pacote({ comp: 'Apto 1' })];
    const forma = (l: typeof a) => agruparRua(l).map((n) => ({ n: n.numeroChave, d: n.destinos.map((d) => d.id).sort(), p: n.pendentes.map((p) => p.pacote.id_entrega).sort() }));
    expect(forma([...a].reverse()).map((x) => x.d)).toEqual(forma(a).map((x) => x.d));
  });
});
