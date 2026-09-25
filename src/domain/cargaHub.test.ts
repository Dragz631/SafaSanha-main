import { describe, expect, it } from 'vitest';
import {
  type DocumentoCarga,
  acumularSaida,
  detectarEntregas,
  donoDaCarga,
  marcarExportados,
  montarDocumentoEventos,
  receberCarga,
  validarCarga,
} from './cargaHub';
import { aplicarEntrega, aplicarInsucesso } from './entrega';
import { memoriaVazia } from './memoria';

const AGORA = '2026-09-24T12:00:00.000Z';

/** Formato exato do que o HUB exporta (logiscan.carga/v0). */
function carga(over: Partial<DocumentoCarga> = {}): DocumentoCarga {
  const pac = (id: string, codigo: string, rua: string, numero: string, complemento = '', destino_id: string | null = null) => ({
    hub_pacote_id: id,
    transportadora: 'jtexpress',
    codigo,
    destinatario: 'João',
    rua,
    rua_detalhe: '',
    numero,
    complemento,
    bairro: 'CAJU',
    cidade: 'Rio de Janeiro',
    uf: 'RJ',
    cep: '20931002',
    destino_id,
  });
  return {
    schema: 'logiscan.carga/v0',
    gerado_em: AGORA,
    carga: { id: 'carga-1', codigo: 'C-20260924-HUGO-1', criada_em: AGORA, criada_por: 'Galpão' },
    ajudante: { id: 'aj-hugo', nome: 'Hugo' },
    pacotes: [
      pac('p1', '888000000000001', 'Rua Carlos Seidl', '133', '', 'rua carlos seidl|133|'),
      pac('p2', '888000000000002', 'Rua Leão XIII', '24', 'Loja ABC', 'rua leao xiii|24|comercio:loja abc'),
      pac('p3', '888000000000003', 'Rua Carlos Seidl', '133'),
    ],
    ...over,
  };
}

describe('validarCarga', () => {
  it('aceita a carga do HUB', () => {
    expect(validarCarga(JSON.parse(JSON.stringify(carga()))).ok).toBe(true);
  });

  it('recusa arquivo que não é carga, com motivo', () => {
    const r = validarCarga({ schema: 'logiscan.import/v0', packages: [] });
    expect(r).toEqual({ ok: false, erros: [expect.stringMatching(/não é uma carga do HUB/)] });
  });

  it('recusa pacote sem id do HUB', () => {
    const c = carga();
    (c.pacotes[1] as { hub_pacote_id: string }).hub_pacote_id = '';
    const r = validarCarga(c);
    expect(r.ok).toBe(false);
    if ('erros' in r) expect(r.erros[0]).toMatch(/pacote 2/);
  });
});

describe('donoDaCarga', () => {
  it('identifica primeira carga, mesmo ajudante e outro ajudante', () => {
    expect(donoDaCarga(null, carga())).toBe('primeira_carga');
    expect(donoDaCarga({ id: 'aj-hugo', nome: 'Hugo' }, carga())).toBe('mesmo');
    expect(donoDaCarga({ id: 'aj-ana', nome: 'Ana' }, carga())).toBe('outro_ajudante');
  });
});

describe('receberCarga', () => {
  it('vira pacotes do Street com vínculo ao HUB, destino do HUB e timeline de entrada', () => {
    const r = receberCarga(memoriaVazia(), carga(), [], AGORA);
    expect(r.novos).toHaveLength(3);
    const [p1, p2] = r.novos;
    expect(p1).toMatchObject({
      id_entrega: 'hub_p1',
      codigo_pacote: '888000000000001',
      status: 'aguardando_rua',
      endereco_rua: 'Rua Carlos Seidl',
      numero_casa: '133',
      destino_id: 'rua carlos seidl|133|',
      ajudante_nome: 'Hugo',
      hub: { pacote_id: 'p1', carga_id: 'carga-1', carga_codigo: 'C-20260924-HUGO-1', ajudante_id: 'aj-hugo' },
    });
    expect(p1.historico_timeline?.[0].titulo).toBe('Recebido na carga C-20260924-HUGO-1');
    expect(p2.destino_id).toBe('rua leao xiii|24|comercio:loja abc');
  });

  it('dois pacotes no mesmo endereço continuam sendo dois pacotes', () => {
    const r = receberCarga(memoriaVazia(), carga(), [], AGORA);
    const mesmos = r.novos.filter((p) => p.destino_id === 'rua carlos seidl|133|');
    expect(mesmos.map((p) => p.codigo_pacote)).toEqual(['888000000000001', '888000000000003']);
  });

  it('carregar a mesma carga de novo não duplica', () => {
    const r1 = receberCarga(memoriaVazia(), carga(), [], AGORA);
    const r2 = receberCarga(r1.memoria, carga(), r1.novos, AGORA);
    expect(r2.novos).toEqual([]);
    expect(r2.jaNoAparelho).toBe(3);
  });
});

describe('detectarEntregas → fila → documento para o HUB', () => {
  const entregar = (d: ReturnType<typeof receberCarga>['novos'][number], quando: string) =>
    aplicarEntrega(d, { recebedor_tipo: 'vizinho', recebedor_detalhes: 'Maria' }, quando);

  it('entrega de um pacote da carga gera UM evento simples com id determinístico', () => {
    const { novos } = receberCarga(memoriaVazia(), carga(), [], AGORA);
    const depois = novos.map((d) => (d.id_entrega === 'hub_p1' ? entregar(d, '2026-09-24T14:37:00.000Z') : d));
    expect(detectarEntregas(novos, depois)).toEqual([
      {
        id_evento: 'p1:entrega:2026-09-24T14:37:00.000Z',
        tipo: 'ENTREGA_REGISTRADA',
        carga_id: 'carga-1',
        hub_pacote_id: 'p1',
        codigo: '888000000000001',
        ocorrido_em: '2026-09-24T14:37:00.000Z',
        recebedor: { tipo: 'vizinho', detalhes: 'Maria' },
      },
    ]);
    // nada mudou desde então → nenhum evento novo
    expect(detectarEntregas(depois, depois)).toEqual([]);
  });

  it('insucesso e pacotes sem vínculo com o HUB não geram evento nesta etapa', () => {
    const { novos } = receberCarga(memoriaVazia(), carga(), [], AGORA);
    const semHub = { ...novos[0], id_entrega: 'manual_1', hub: undefined };
    const antes = [...novos, semHub];
    const depois = [aplicarInsucesso(novos[0], 'ausente', AGORA), ...novos.slice(1), entregar(semHub, AGORA)];
    expect(detectarEntregas(antes, depois)).toEqual([]);
  });

  it('a fila não duplica o mesmo evento e o documento segue o contrato', () => {
    const { novos } = receberCarga(memoriaVazia(), carga(), [], AGORA);
    const depois = novos.map((d) => (d.id_entrega === 'hub_p2' ? entregar(d, '2026-09-24T15:00:00.000Z') : d));
    const ev = detectarEntregas(novos, depois);
    let saida = acumularSaida([], ev);
    saida = acumularSaida(saida, ev); // detectado de novo (ex.: re-render) → continua 1
    expect(saida).toHaveLength(1);
    const doc = montarDocumentoEventos(saida, { id: 'aj-hugo', nome: 'Hugo' }, AGORA);
    expect(doc).toMatchObject({ schema: 'logiscan.street-eventos/v0', ajudante: { id: 'aj-hugo' } });
    expect(doc.eventos[0]).not.toHaveProperty('exportado_em');
    expect(marcarExportados(saida, AGORA)[0].exportado_em).toBe(AGORA);
  });
});
