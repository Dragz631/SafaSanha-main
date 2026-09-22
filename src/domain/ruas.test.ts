import { describe, expect, it } from 'vitest';
import { contarPacotes, ehAreaManilha, pacotesDaRua, pacotesSemRua, pertenceARua, ruasDosPacotes } from './ruas';
import { pacote } from './fixtures';

describe('pacotes da rua — fonte única, sem substring', () => {
  it('igualdade por chave normalizada (caixa/acento/espaço não importam)', () => {
    const p = pacote({ rua: 'Rua Carlos Seidl' });
    expect(pertenceARua(p, 'rua  CARLOS seidl ')).toBe(true);
    expect(pertenceARua(pacote({ rua: 'Rua General Gurjão' }), 'Rua General Gurjao')).toBe(true);
  });

  it('"Rua A" NÃO pertence a "Rua Alfa" (o filtro antigo usava includes)', () => {
    expect(pertenceARua(pacote({ rua: 'Rua Alfa' }), 'Rua A')).toBe(false);
    expect(pertenceARua(pacote({ rua: 'Rua A' }), 'Rua Alfa')).toBe(false);
  });

  it('pacote sem endereço não vaza para nenhuma rua', () => {
    const orfao = pacote({ endereco_rua: '', endereco_completo: '' });
    expect(pertenceARua(orfao, 'Rua Carlos Seidl')).toBe(false);
    expect(pertenceARua(orfao, 'Rua General Sampaio')).toBe(false);
    expect(pacotesSemRua([orfao, pacote({})])).toEqual([orfao]);
  });

  it('a soma das ruas nunca passa do total (contagem única)', () => {
    const lista = [
      pacote({ rua: 'Rua Carlos Seidl' }),
      pacote({ rua: 'Rua Carlos Seidl' }),
      pacote({ rua: 'Rua General Sampaio' }),
      pacote({ endereco_rua: '', endereco_completo: '' }),
    ];
    const ruas = ['Rua Carlos Seidl', 'Rua General Sampaio', 'Rua Praia do Caju'];
    const soma = ruas.reduce((acc, r) => acc + pacotesDaRua(lista, r).length, 0);
    expect(soma).toBe(3);
    expect(soma).toBeLessThanOrEqual(lista.length);
  });

  it('Manilha reúne suas sub-ruas e não "rouba" pacotes de outras ruas', () => {
    const m1 = pacote({ endereco_rua: 'Manilha', sub_rua_manilha: 'Rua B' });
    const m2 = pacote({ endereco_rua: 'Rua Leão XIII' });
    const outra = pacote({ rua: 'Rua Carlos Seidl' });
    expect(ehAreaManilha('Manilha')).toBe(true);
    expect(pacotesDaRua([m1, m2, outra], 'Manilha')).toEqual([m1, m2]);
    expect(pacotesDaRua([m1, m2, outra], 'Rua Carlos Seidl')).toEqual([outra]);
  });

  it('lista as ruas presentes sem duplicar', () => {
    const l = [pacote({ rua: 'Rua X' }), pacote({ rua: 'rua x' }), pacote({ rua: 'Rua Y' }), pacote({ endereco_rua: 'Manilha' })];
    expect(ruasDosPacotes(l)).toEqual(['Rua X', 'Rua Y']);
  });
});

describe('contarPacotes', () => {
  it('total = entregues + insucessos + pendentes', () => {
    const l = [pacote({ status: 'entregue' }), pacote({ status: 'concluido' }), pacote({ status: 'insucesso' }), pacote({})];
    expect(contarPacotes(l)).toEqual({ total: 4, entregues: 2, insucessos: 1, pendentes: 1 });
  });
});
