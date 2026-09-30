/**
 * O texto que o ajudante copia e cola para o cliente vai junto com a baixa para o HUB (só texto; fotos vêm depois).
 * E a carga do HUB pode trazer o aviso de repasse na hora ("Repasse do Hugo para João").
 */
import { describe, expect, it } from 'vitest';
import { type DocumentoCarga, detectarEventos, receberCarga, validarCarga } from './cargaHub';
import { aplicarEntrega, aplicarInsucesso } from './entrega';
import { memoriaVazia } from './memoria';

const AGORA = '2026-09-30T12:00:00.000Z';
const HUGO = { id: 'aj-hugo', nome: 'Hugo' };
const JOAO = { id: 'aj-joao', nome: 'João' };

const pac = (id: string) => ({
  hub_pacote_id: id,
  transportadora: 'jtexpress',
  codigo: `88800000${id}`,
  destinatario: 'Maria',
  rua: 'Rua Carlos Seidl',
  rua_detalhe: '',
  numero: '10',
  complemento: '',
  bairro: 'CAJU',
  cidade: 'Rio de Janeiro',
  uf: 'RJ',
  cep: '20931002',
  destino_id: null,
});

const carga = (extra: Partial<DocumentoCarga['carga']> = {}): DocumentoCarga => ({
  schema: 'logiscan.carga/v0',
  gerado_em: AGORA,
  carga: { id: 'c1', codigo: 'C-20260930-HUGO-1', criada_em: AGORA, criada_por: 'Galpão', situacao: 'EM_ROTA', ...extra },
  ajudante: HUGO,
  pacotes: [pac('p1'), pac('p2')],
});

const TEXTO = '📦 *Entrega realizada*\n👤 *Cliente:* Maria\n🤝 *Recebedor:* Próprio Morador';
const dados = { recebedor_tipo: 'proprio_morador' as const, recebedor_detalhes: 'Maria' };

describe('texto da entrega no evento para o HUB', () => {
  const { novos } = receberCarga(memoriaVazia(), carga(), [], AGORA);

  it('a entrega leva o texto que foi copiado', () => {
    const depois = novos.map((d) => (d.hub?.pacote_id === 'p1' ? aplicarEntrega(d, { ...dados, texto: TEXTO }, AGORA) : d));
    const ev = detectarEventos(novos, depois);
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ tipo: 'ENTREGA_REGISTRADA', hub_pacote_id: 'p1', texto: TEXTO, recebedor: { tipo: 'proprio_morador', detalhes: 'Maria' } });
  });

  it('entrega em grupo: cada pacote leva o texto do grupo', () => {
    const depois = novos.map((d) => aplicarEntrega(d, { ...dados, texto: TEXTO }, AGORA));
    const ev = detectarEventos(novos, depois);
    expect(ev.map((e) => [e.hub_pacote_id, e.texto])).toEqual([['p1', TEXTO], ['p2', TEXTO]]);
  });

  it('o insucesso leva o motivo E o texto', () => {
    const depois = novos.map((d) => (d.hub?.pacote_id === 'p2' ? aplicarInsucesso(d, 'Morador ausente', AGORA, '⚠️ Insucesso\nMorador ausente') : d));
    const ev = detectarEventos(novos, depois);
    expect(ev[0]).toMatchObject({ tipo: 'INSUCESSO_REGISTRADO', motivo: 'Morador ausente', texto: '⚠️ Insucesso\nMorador ausente' });
  });

  it('sem texto, o evento não carrega o campo (compatível com o HUB antigo)', () => {
    const depois = novos.map((d) => (d.hub?.pacote_id === 'p1' ? aplicarEntrega(d, dados, AGORA) : d));
    const [ev] = detectarEventos(novos, depois);
    expect('texto' in ev).toBe(false);
  });

  it('o texto não muda a identidade do evento: reenviar continua sendo o mesmo acontecimento', () => {
    const com = detectarEventos(novos, novos.map((d) => (d.hub?.pacote_id === 'p1' ? aplicarEntrega(d, { ...dados, texto: TEXTO }, AGORA) : d)));
    const sem = detectarEventos(novos, novos.map((d) => (d.hub?.pacote_id === 'p1' ? aplicarEntrega(d, dados, AGORA) : d)));
    expect(com[0].id_evento).toBe(sem[0].id_evento);
  });
});

describe('repasse na hora no documento da carga', () => {
  it('a carga de quem assume traz de quem veio; a de quem repassou traz para quem foi', () => {
    const assumiu = carga({
      repassada_de: { carga_codigo: 'C-20260930-HUGO-1', ajudante: HUGO, em: AGORA, motivo: 'caiu da moto', pacotes: 3 },
    });
    const repassou = carga({
      repassada_para: { carga_codigo: 'C-20260930-JOAO-1', ajudante: JOAO, em: AGORA, motivo: 'caiu da moto', pacotes: 3 },
    });
    expect(validarCarga(assumiu).ok).toBe(true);
    expect(validarCarga(repassou).ok).toBe(true);
    expect(validarCarga(carga()).ok).toBe(true); // HUB sem repasse continua válido
  });
});
