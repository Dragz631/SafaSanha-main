import { describe, expect, it } from 'vitest';
import { aplicarEntrega, aplicarInsucesso, reabrirPacote } from './entrega';
import { pacote } from './fixtures';

const CRIACAO = '2026-09-21T12:00:00.000Z';
const AGORA = '2026-09-21T15:30:00.000Z';

describe('transições de entrega (bugs da auditoria)', () => {
  it('INSUCESSO continua insucesso (antes virava "entregue" e perdia o motivo)', () => {
    const p = pacote({ data_hora: CRIACAO });
    const r = aplicarInsucesso(p, 'Morador ausente', AGORA);
    expect(r.status).toBe('insucesso');
    expect(r.motivo_insucesso).toBe('Morador ausente');
    expect(r.data_hora_entrega).toBeUndefined();
    expect(r.recebedor_detalhes).toBe(p.recebedor_detalhes);
  });

  it('ENTREGA grava recebedor real, fotos e horários', () => {
    const p = pacote({ data_hora: CRIACAO });
    const r = aplicarEntrega(
      p,
      { recebedor_tipo: 'portaria', recebedor_detalhes: 'Portaria (José)', foto_pacote_path: 'data:pacote', foto_local_path: 'data:local' },
      AGORA
    );
    expect(r.status).toBe('entregue');
    expect(r.recebedor_tipo).toBe('portaria');
    expect(r.recebedor_detalhes).toBe('Portaria (José)');
    expect(r.foto_pacote_path).toBe('data:pacote');
    expect(r.foto_local_path).toBe('data:local');
    expect(r.data_hora_entrada).toBe(CRIACAO);
    expect(r.data_hora_entrega).toBe(AGORA);
    expect(r.data_hora).toBe(AGORA);
  });

  it('não descarta fotos já existentes quando a nova baixa não traz foto', () => {
    const p = pacote({ foto_pacote_path: 'data:antiga' });
    expect(aplicarEntrega(p, { recebedor_tipo: 'proprio_morador', recebedor_detalhes: 'x' }, AGORA).foto_pacote_path).toBe('data:antiga');
  });

  it('a hora de entrada nunca é sobrescrita por baixas seguintes', () => {
    const p = pacote({ data_hora: CRIACAO });
    const falhou = aplicarInsucesso(p, 'Ausente', '2026-09-21T13:00:00.000Z');
    const entregue = aplicarEntrega(falhou, { recebedor_tipo: 'vizinho', recebedor_detalhes: 'Vizinho' }, AGORA);
    expect(entregue.data_hora_entrada).toBe(CRIACAO);
    expect(entregue.motivo_insucesso).toBeUndefined();
  });

  it('reabrir volta para pendente e limpa a hora de entrega', () => {
    const entregue = aplicarEntrega(pacote({}), { recebedor_tipo: 'proprio_morador', recebedor_detalhes: 'x' }, AGORA);
    const r = reabrirPacote(entregue, '2026-09-21T16:00:00.000Z');
    expect(r.status).toBe('aguardando_rua');
    expect(r.data_hora_entrega).toBeUndefined();
  });

  it('é imutável', () => {
    const p = pacote({});
    const copia = JSON.stringify(p);
    aplicarEntrega(p, { recebedor_tipo: 'proprio_morador', recebedor_detalhes: 'x' }, AGORA);
    aplicarInsucesso(p, 'x', AGORA);
    expect(JSON.stringify(p)).toBe(copia);
  });
});
