import { describe, expect, it } from 'vitest';
import {
  type DocumentoCarga,
  acumularSaida,
  cargaDoPerfil,
  detectarEventos,
  encerrarSessao,
  iniciarSessao,
  marcarExportados,
  montarDocumentoEventos,
  podeCarregar,
  receberCarga,
  retiradosDaCarga,
  validarCarga,
} from './cargaHub';
import { aplicarEntrega, aplicarInsucesso } from './entrega';
import { type MemoriaOperacional, memoriaVazia } from './memoria';

const AGORA = '2026-09-24T12:00:00.000Z';
const HUGO = { id: 'aj-hugo', nome: 'Hugo' };
const ANA = { id: 'aj-ana', nome: 'Ana' };

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

/** Formato exato do que o HUB exporta (logiscan.carga/v0). */
function carga(over: Partial<DocumentoCarga> = {}): DocumentoCarga {
  return {
    schema: 'logiscan.carga/v0',
    gerado_em: AGORA,
    carga: { id: 'carga-1', codigo: 'C-20260924-HUGO-1', criada_em: AGORA, criada_por: 'Galpão' },
    ajudante: HUGO,
    pacotes: [
      pac('p1', '888000000000001', 'Rua Carlos Seidl', '133', '', 'rua carlos seidl|133|'),
      pac('p2', '888000000000002', 'Rua Leão XIII', '24', 'Loja ABC', 'rua leao xiii|24|comercio:loja abc'),
      pac('p3', '888000000000003', 'Rua Carlos Seidl', '133'),
    ],
    ...over,
  };
}

const cargaDaAna = () =>
  carga({
    carga: { id: 'carga-ana', codigo: 'C-20260924-ANA-1', criada_em: AGORA, criada_por: 'Galpão' },
    ajudante: ANA,
    pacotes: [pac('a1', '999000000000001', 'Rua General Gurjão', '10')],
  });

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

describe('detectarEventos → fila → documento para o HUB', () => {
  const entregar = (d: ReturnType<typeof receberCarga>['novos'][number], quando: string) =>
    aplicarEntrega(d, { recebedor_tipo: 'vizinho', recebedor_detalhes: 'Maria' }, quando);

  it('entrega de um pacote da carga gera UM evento simples com id determinístico', () => {
    const { novos } = receberCarga(memoriaVazia(), carga(), [], AGORA);
    const depois = novos.map((d) => (d.id_entrega === 'hub_p1' ? entregar(d, '2026-09-24T14:37:00.000Z') : d));
    expect(detectarEventos(novos, depois)).toEqual([
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
    expect(detectarEventos(depois, depois)).toEqual([]);
  });

  it('insucesso gera evento com motivo e horário', () => {
    const { novos } = receberCarga(memoriaVazia(), carga(), [], AGORA);
    const depois = novos.map((d) => (d.id_entrega === 'hub_p2' ? aplicarInsucesso(d, 'Morador ausente', '2026-09-24T15:02:00.000Z') : d));
    expect(detectarEventos(novos, depois)).toEqual([
      {
        id_evento: 'p2:insucesso:2026-09-24T15:02:00.000Z',
        tipo: 'INSUCESSO_REGISTRADO',
        carga_id: 'carga-1',
        hub_pacote_id: 'p2',
        codigo: '888000000000002',
        ocorrido_em: '2026-09-24T15:02:00.000Z',
        recebedor: null,
        motivo: 'Morador ausente',
      },
    ]);
  });

  it('pacote sem vínculo com o HUB não gera evento', () => {
    const { novos } = receberCarga(memoriaVazia(), carga(), [], AGORA);
    const semHub = { ...novos[0], id_entrega: 'manual_1', hub: undefined };
    expect(detectarEventos([semHub], [entregar(semHub, AGORA)])).toEqual([]);
  });

  it('a fila não duplica o mesmo evento (retry) e o documento segue o contrato', () => {
    const { novos } = receberCarga(memoriaVazia(), carga(), [], AGORA);
    const depois = novos.map((d) => (d.id_entrega === 'hub_p2' ? entregar(d, '2026-09-24T15:00:00.000Z') : d));
    const ev = detectarEventos(novos, depois);
    let saida = acumularSaida([], ev);
    saida = acumularSaida(saida, ev);
    expect(saida).toHaveLength(1);
    const doc = montarDocumentoEventos(saida, HUGO, AGORA);
    expect(doc).toMatchObject({ schema: 'logiscan.street-eventos/v0', ajudante: { id: 'aj-hugo' } });
    expect(doc.eventos[0]).not.toHaveProperty('exportado_em');
    expect(marcarExportados(saida, AGORA)[0].exportado_em).toBe(AGORA);
  });
});

describe('sessão do ajudante (aparelho ≠ pessoa)', () => {
  it('carga só entra na sessão do próprio ajudante; sem sessão, pede para iniciar', () => {
    expect(podeCarregar(null, carga())).toBe('sem_sessao');
    expect(podeCarregar(HUGO, carga())).toBe('ok');
    expect(podeCarregar(ANA, carga())).toBe('outro_ajudante');
  });

  it('troca explícita de ajudante não mistura cargas, pacotes nem eventos — e nada é apagado', () => {
    const manual = { ...receberCarga(memoriaVazia(), carga(), [], AGORA).novos[0], id_entrega: 'manual_1', hub: undefined };

    // Sessão do Hugo: carga dele + uma entrega na fila
    let tela = iniciarSessao(HUGO, [manual], {});
    const doHugo = receberCarga(memoriaVazia(), carga(), tela.deliveries, AGORA).novos;
    const antes = [...doHugo, ...tela.deliveries];
    const depois = antes.map((d) => (d.id_entrega === 'hub_p1' ? aplicarEntrega(d, { recebedor_tipo: 'vizinho', recebedor_detalhes: 'Maria' }, AGORA) : d));
    const saidaHugo = acumularSaida([], detectarEventos(antes, depois, HUGO.id));
    expect(saidaHugo).toHaveLength(1);

    // Encerra: pacotes e fila do Hugo saem da tela e ficam guardados; o manual fica
    const fim = encerrarSessao(HUGO, depois, saidaHugo, {});
    expect(fim.deliveries.map((d) => d.id_entrega)).toEqual(['manual_1']);
    expect(fim.saida).toEqual([]);
    expect(fim.guardados[HUGO.id].pacotes).toHaveLength(3);
    expect(fim.guardados[HUGO.id].saida).toHaveLength(1);

    // Sessão da Ana: só a carga dela aparece, a fila começa vazia
    tela = iniciarSessao(ANA, fim.deliveries, fim.guardados);
    const daAna = receberCarga(memoriaVazia(), cargaDaAna(), tela.deliveries, AGORA).novos;
    const telaAna = [...daAna, ...tela.deliveries];
    expect(telaAna.filter((d) => d.hub).map((d) => d.hub!.ajudante_id)).toEqual([ANA.id]);
    expect(tela.saida).toEqual([]);
    // entrega de pacote do Hugo nunca entra na fila da Ana
    expect(detectarEventos(depois, depois.map((d) => ({ ...d, status: 'entregue' as const })), ANA.id)).toEqual([]);
    // abrir outra sessão com pacotes da Ana na tela é bloqueado
    expect(() => iniciarSessao(HUGO, telaAna, tela.guardados)).toThrow(/outro ajudante/);

    // Ana encerra; Hugo retoma e recebe de volta os pacotes e a fila dele
    const fimAna = encerrarSessao(ANA, telaAna, [], tela.guardados);
    const volta = iniciarSessao(HUGO, fimAna.deliveries, fimAna.guardados);
    expect(volta.deliveries.filter((d) => d.hub).map((d) => d.hub!.ajudante_id)).toEqual([HUGO.id, HUGO.id, HUGO.id]);
    expect(volta.saida.map((e) => e.id_evento)).toEqual(saidaHugo.map((e) => e.id_evento));
    expect(volta.guardados).toHaveProperty(ANA.id);
    expect(volta.guardados).not.toHaveProperty(HUGO.id);
    expect(montarDocumentoEventos(volta.saida, HUGO, AGORA).eventos.every((e) => e.carga_id === 'carga-1')).toBe(true);
  });
});

describe('perfil do ajudante no Street (V0.2 orquestração)', () => {
  it('18. só aceita a carga do perfil ativo; sem perfil, não aceita', () => {
    expect(cargaDoPerfil(HUGO, carga())).toBe(true);
    expect(cargaDoPerfil(ANA, carga())).toBe(false);
    expect(cargaDoPerfil(null, carga())).toBe(false);
  });

  it('10. a memória pessoal fica vinculada ao perfil e volta com ele', () => {
    const memHugo: MemoriaOperacional = receberCarga(memoriaVazia(), carga(), [], AGORA).memoria;
    expect(Object.keys(memHugo.destinos).length).toBeGreaterThan(0);
    const telaHugo = receberCarga(memoriaVazia(), carga(), [], AGORA).novos;

    const fim = encerrarSessao(HUGO, telaHugo, [], {}, memHugo);
    expect(fim.guardados[HUGO.id].memoria).toEqual(memHugo);

    const ana = iniciarSessao(ANA, fim.deliveries, fim.guardados);
    expect(ana.memoria).toBeNull(); // perfil novo: sem memória do Hugo
    const memAna = receberCarga(memoriaVazia(), cargaDaAna(), ana.deliveries, AGORA).memoria;
    const fimAna = encerrarSessao(ANA, [], [], ana.guardados, memAna);

    const volta = iniciarSessao(HUGO, fimAna.deliveries, fimAna.guardados);
    expect(volta.memoria).toEqual(memHugo);
    expect(Object.keys(volta.memoria!.destinos)).not.toContain(Object.keys(memAna.destinos)[0]);
  });

  it('rua removida no HUB antes da rota sai do aparelho; pacote com desfecho local nunca some', () => {
    const tela = receberCarga(memoriaVazia(), carga(), [], AGORA).novos;
    const semP2 = { ...carga(), pacotes: carga().pacotes.filter((p) => p.hub_pacote_id !== 'p2') };
    expect(retiradosDaCarga(semP2, tela)).toEqual({ remover: ['hub_p2'], comDesfecho: 0 });
    const entregueLocal = tela.map((d) => (d.id_entrega === 'hub_p2' ? aplicarEntrega(d, { recebedor_tipo: 'vizinho', recebedor_detalhes: 'x' }, AGORA) : d));
    expect(retiradosDaCarga(semP2, entregueLocal)).toEqual({ remover: [], comDesfecho: 1 });
  });

  it('19. reenvio da mesma carga pelo transporte é idempotente', () => {
    const r1 = receberCarga(memoriaVazia(), carga(), [], AGORA);
    const r2 = receberCarga(r1.memoria, carga(), r1.novos, AGORA);
    expect(r2.novos).toEqual([]);
    expect(retiradosDaCarga(carga(), r1.novos).remover).toEqual([]);
  });
});
