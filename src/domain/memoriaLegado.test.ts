import { describe, expect, it } from 'vitest';
import { IDS_DEMO_V2, migrarMemoriaV2, migrarRecebedoresLegados, tituloDeRua, type LegadoV2 } from './memoriaLegado';
import { memoriaVazia, sugerirRecebedores } from './memoria';
import { interpretarEndereco } from './endereco';

const AGORA = '2026-09-21T10:00:00.000Z';

describe('migração da memória antiga', () => {
  const legado: LegadoV2 = {
    'rua carlos seidl': [
      {
        street: 'Rua Carlos Seidl',
        houseNumber: '21',
        lastUpdated: '2026-08-01T00:00:00.000Z',
        residents: [
          { id: 'res_21_1', name: 'Antônio Silva', complement: 'Casa Principal', timesDelivered: 5 }, // DEMO
          { id: 'res_real_1', name: 'Paulo', complement: 'Apto 101', timesDelivered: 3, lastSeen: '2026-09-10T00:00:00.000Z' },
        ],
      },
      { street: 'Rua Carlos Seidl', houseNumber: '100', residents: [{ id: 'res_real_2', name: 'Lia', timesDelivered: 1 }] },
    ],
    manilha: [{ street: 'Manilha', subStreet: 'Rua B', houseNumber: '8', residents: [{ id: 'res_m_8', name: 'Valter Silva' }] }],
  };

  it('descarta os moradores DEMO injetados pela versão antiga e preserva os reais', () => {
    const r = migrarMemoriaV2(legado, memoriaVazia(), AGORA);
    expect(r.demoDescartados).toBe(2); // res_21_1 e res_m_8
    expect(r.migrados).toBe(2);
    const nomes = Object.values(r.memoria.destinos).flatMap((d) => [...d.pessoas, ...d.unidades.flatMap((u) => u.pessoas)].map((p) => p.nome));
    expect(nomes.sort()).toEqual(['Lia', 'Paulo']);
    expect(nomes).not.toContain('Antônio Silva');
    expect(IDS_DEMO_V2.size).toBe(9);
  });

  it('reinterpreta o complemento antigo com as regras novas e preserva vezes/datas', () => {
    const r = migrarMemoriaV2(legado, memoriaVazia(), AGORA);
    const id = interpretarEndereco({ rua: 'Rua Carlos Seidl', numero: '21' }).destinoId;
    const d = r.memoria.destinos[id];
    expect(d.unidades[0]).toMatchObject({ rotulo: 'Apto 101', vezes: 3, ultimaVezEm: '2026-09-10T00:00:00.000Z' });
  });
});

describe('migração de porteiros/familiares/vizinhos', () => {
  it('descarta as chaves "number_only" (sem rua) — vazavam entre ruas', () => {
    const r = migrarRecebedoresLegados(memoriaVazia(), { portaria: { 'number_only:::100': ['José'] } }, AGORA);
    expect(r.ignorados).toBe(1);
    expect(r.migrados).toBe(0);
    expect(r.memoria.destinos).toEqual({});
  });

  it('associa por rua+número quando há um único destino; cria endereço simples se não existe', () => {
    const r = migrarRecebedoresLegados(
      memoriaVazia(),
      { portaria: { 'rua carlos seidl:::142': ['José'] }, vizinho: { 'rua carlos seidl:::142': ['Nº 144 (Dona Maria)'] } },
      AGORA
    );
    expect(r.migrados).toBe(2);
    const id = interpretarEndereco({ rua: 'Rua Carlos Seidl', numero: '142' }).destinoId;
    expect(r.memoria.destinos[id].ruaNome).toBe('Rua Carlos Seidl');
    expect(sugerirRecebedores(r.memoria, id).map((x) => x.rotulo).sort()).toEqual(['José', 'Nº 144 (Dona Maria)']);
    expect(r.memoria.destinos[id].pacotesRegistrados).toBe(0);
  });

  it('vários destinos no mesmo número → não escolhe (ignora e conta)', () => {
    let m = memoriaVazia();
    const lo = migrarMemoriaV2({ x: [{ street: 'Rua X', houseNumber: '100', residents: [{ id: 'a', name: 'A', complement: 'Loja ABC' }, { id: 'b', name: 'B', complement: 'Condomínio Y' }] }] }, m, AGORA);
    const r = migrarRecebedoresLegados(lo.memoria, { portaria: { 'rua x:::100': ['José'] } }, AGORA);
    expect(r.ignorados).toBe(1);
    expect(r.migrados).toBe(0);
  });

  it('tituloDeRua', () => {
    expect(tituloDeRua('rua monsenhor manuel gomes')).toBe('Rua Monsenhor Manuel Gomes');
    expect(tituloDeRua('rua das flores')).toBe('Rua das Flores');
  });
});
