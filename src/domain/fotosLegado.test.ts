import { describe, expect, it } from 'vitest';
import { recuperarFotosDaFila } from './fotosLegado';
import { pacote } from './fixtures';

describe('recuperação das fotos da fila antiga do SafaSanhaso', () => {
  it('preenche fotos vazias a partir da fila e informa o que casou', () => {
    const p = pacote({ id_entrega: 'a' });
    const r = recuperarFotosDaFila([p], [{ id_entrega: 'a', foto_pacote_base64: 'data:P', foto_local_base64: 'data:L' }]);
    expect(r.pacotes[0]).toMatchObject({ foto_pacote_path: 'data:P', foto_local_path: 'data:L' });
    expect(r.recuperadas).toBe(2);
    expect(r.idsCasados.has('a')).toBe(true);
  });

  it('NUNCA sobrescreve uma foto que já existe', () => {
    const p = pacote({ id_entrega: 'a', foto_pacote_path: 'data:MINHA' });
    const r = recuperarFotosDaFila([p], [{ id_entrega: 'a', foto_pacote_base64: 'data:OUTRA', foto_local_base64: 'data:L' }]);
    expect(r.pacotes[0].foto_pacote_path).toBe('data:MINHA');
    expect(r.pacotes[0].foto_local_path).toBe('data:L');
    expect(r.recuperadas).toBe(1);
  });

  it('itens da fila sem pacote correspondente não casam (a fila só pode ser descartada se tudo casou)', () => {
    const r = recuperarFotosDaFila([pacote({ id_entrega: 'a' })], [{ id_entrega: 'zzz', foto_pacote_base64: 'x' }]);
    expect(r.recuperadas).toBe(0);
    expect(r.idsCasados.size).toBe(0);
  });

  it('não altera os pacotes de entrada', () => {
    const p = pacote({ id_entrega: 'a' });
    const copia = JSON.stringify(p);
    recuperarFotosDaFila([p], [{ id_entrega: 'a', foto_pacote_base64: 'x' }]);
    expect(JSON.stringify(p)).toBe(copia);
  });
});
