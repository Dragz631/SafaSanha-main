import { describe, expect, it } from 'vitest';
import { cadastrarPacote, confirmarDestino, corrigirPacote, gerarCodigoManual, montarPacote } from './cadastro';
import { agruparRua, destinoIdDoPacote, enderecoDoPacote } from './agrupamento';
import { memoriaVazia } from './memoria';
import { interpretarEndereco } from './endereco';

const T = (h: number) => `2026-09-21T${String(h).padStart(2, '0')}:00:00.000Z`;
const novo = (numero: string, complemento = '', nome = 'Ana', rua = 'Rua A') =>
  montarPacote({ rua, numero, complemento, nome }, T(9), [], `_${numero}${complemento}${nome}`);

describe('cadastro contra a memória', () => {
  it('primeiro pacote cria o destino e vincula; o segundo no mesmo endereço reaproveita (CASO 1)', () => {
    const a = cadastrarPacote(memoriaVazia(), novo('100', '', 'João'), T(9));
    expect(a.resolucao.status).toBe('novo');
    expect(a.pendente).toBe(false);
    const b = cadastrarPacote(a.memoria, novo('100', '', 'Maria'), T(10));
    expect(b.resolucao.status).toBe('exato');
    expect(b.pacote.destino_id).toBe(a.pacote.destino_id);
    expect(Object.keys(b.memoria.destinos)).toHaveLength(1);
    expect(b.memoria.destinos[a.pacote.destino_id!].pacotesRegistrados).toBe(2);
  });

  it('CASO 3: Loja ABC e Condomínio XYZ no mesmo número viram destinos separados na memória', () => {
    let r = cadastrarPacote(memoriaVazia(), novo('100', 'Loja ABC', 'João'), T(9));
    r = cadastrarPacote(r.memoria, novo('100', 'Condomínio XYZ Apto 101', 'Maria'), T(10));
    expect(Object.keys(r.memoria.destinos)).toHaveLength(2);
    expect(r.pacote.destino_id).not.toBe(enderecoDoPacote(novo('100', 'Loja ABC')).destinoId);
  });

  it('ambiguidade: NÃO vincula e NÃO ensina nada à memória', () => {
    let r = cadastrarPacote(memoriaVazia(), novo('100', 'Loja ABC'), T(9));
    r = cadastrarPacote(r.memoria, novo('100', 'Condomínio XYZ'), T(9));
    const antes = JSON.stringify(r.memoria);
    const solto = cadastrarPacote(r.memoria, novo('100', '', 'Zé'), T(10));
    expect(solto.pendente).toBe(true);
    expect(solto.resolucao.status).toBe('ambiguo');
    expect(solto.pacote.destino_id).toBeUndefined();
    expect(JSON.stringify(solto.memoria)).toBe(antes);
  });

  it('confirmar o destino vincula o pacote e só então a memória aprende (unidade e pessoa)', () => {
    let r = cadastrarPacote(memoriaVazia(), novo('100', 'Loja ABC'), T(9));
    r = cadastrarPacote(r.memoria, novo('100', 'Condomínio XYZ'), T(9));
    const solto = cadastrarPacote(r.memoria, novo('100', 'Apto 7', 'Zé'), T(10));
    expect(solto.resolucao.status).toBe('sugestao'); // apto exclui a loja
    const idCond = interpretarEndereco({ rua: 'Rua A', numero: '100', complemento: 'Condomínio XYZ' }).destinoId;
    const c = confirmarDestino(solto.memoria, solto.pacote, idCond, T(11));
    expect(c.pacote.destino_id).toBe(idCond);
    const cond = c.memoria.destinos[idCond];
    expect(cond.unidades.map((u) => u.rotulo)).toContain('Apto 7');
    expect(cond.unidades.find((u) => u.rotulo === 'Apto 7')!.pessoas.map((p) => p.nome)).toEqual(['Zé']);
  });

  it('"é outro endereço": confirmar com o id do endereço simples cria esse destino', () => {
    let r = cadastrarPacote(memoriaVazia(), novo('100', 'Loja ABC'), T(9));
    r = cadastrarPacote(r.memoria, novo('100', 'Condomínio XYZ'), T(9));
    const solto = cadastrarPacote(r.memoria, novo('100', '', 'Zé'), T(10));
    if (solto.resolucao.status !== 'ambiguo') throw new Error('esperava ambíguo');
    const c = confirmarDestino(solto.memoria, solto.pacote, solto.resolucao.novoDestinoId, T(11));
    expect(Object.keys(c.memoria.destinos)).toHaveLength(3);
    expect(c.pacote.destino_id).toBe(solto.resolucao.novoDestinoId);
  });

  it('correção manual reinterpreta e vincula de novo sem apagar o histórico', () => {
    const inicial = cadastrarPacote(memoriaVazia(), novo('100', '', 'Zé'), T(9));
    const corrigido = corrigirPacote(inicial.memoria, inicial.pacote, { rua: 'Rua A', numero: '100', complemento: 'Loja ABC', nome: 'Zé' }, T(10));
    expect(corrigido.pacote.complemento).toBe('Loja ABC');
    expect(corrigido.pacote.destino_id).not.toBe(inicial.pacote.destino_id);
    expect(Object.keys(corrigido.memoria.destinos)).toHaveLength(2); // o antigo permanece
    expect(corrigido.pacote.id_entrega).toBe(inicial.pacote.id_entrega);
  });

  it('destinoIdDoPacote: usa o vínculo; sem vínculo, deduz pelo agrupamento; pendente → indefinido', () => {
    const legado = novo('100', 'Apto 1'); // sem destino_id (dados antigos)
    expect(destinoIdDoPacote(legado, [legado], memoriaVazia())).toBe(enderecoDoPacote(legado).destinoId);

    const loja = novo('100', 'Loja ABC');
    const cond = novo('100', 'Condomínio XYZ');
    const solto = novo('100', '', 'Zé');
    expect(destinoIdDoPacote(solto, [loja, cond, solto], memoriaVazia())).toBeUndefined();
    expect(agruparRua([loja, cond, solto])[0].pendentes).toHaveLength(1);
  });
});

describe('montarPacote / código', () => {
  it('códigos manuais nunca colidem com os existentes', () => {
    const existentes = ['#1000', '#1001', '#1002'];
    let i = 0;
    const seq = [0.0, 0.0001, 0.0002, 0.5]; // 3 primeiros colidem
    const c = gerarCodigoManual(existentes, () => seq[Math.min(i++, seq.length - 1)]);
    expect(existentes).not.toContain(c);
  });

  it('monta endereço completo e mantém a hora de entrada', () => {
    const p = montarPacote({ rua: 'Manilha', subRuaManilha: 'Rua B', numero: '5', complemento: 'Apto 2', nome: 'Ana' }, T(9), []);
    expect(p.endereco_completo).toBe('Rua B, 5 (Apto 2) (Manilha • Caju)');
    expect(p.data_hora_entrada).toBe(T(9));
    expect(p.status).toBe('aguardando_rua');
  });

  it('dois pacotes criados no mesmo milissegundo têm ids distintos', () => {
    const a = montarPacote({ rua: 'Rua A', numero: '1' }, T(9), []);
    const b = montarPacote({ rua: 'Rua A', numero: '1' }, T(9), []);
    expect(a.id_entrega).not.toBe(b.id_entrega);
  });
});
