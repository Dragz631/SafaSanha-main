import { describe, expect, it } from 'vitest';
import { type ItemSaida, marcarExportados } from '../domain/cargaHub';
import { URL_PADRAO_HUB, transporteHttp, urlDoHub } from './transporteHub';

describe('endereço do HUB', () => {
  it('em produção (Vercel) sem endereço salvo = vazio: o Street não fala com o HUB', () => {
    expect(urlDoHub(null, 'safa-sanha.vercel.app')).toBe('');
    expect(urlDoHub('', 'safa-sanha.vercel.app')).toBe('');
    expect(urlDoHub('   ', 'safa-sanha.vercel.app')).toBe('');
  });
  it('em desenvolvimento local o padrão continua sendo localhost:4100', () => {
    expect(urlDoHub(null, 'localhost')).toBe(URL_PADRAO_HUB);
    expect(urlDoHub(undefined, '127.0.0.1')).toBe(URL_PADRAO_HUB);
  });
  it('o endereço que o Hugo informou vale em qualquer lugar (sem barra no fim)', () => {
    expect(urlDoHub('http://localhost:4100/', 'safa-sanha.vercel.app')).toBe('http://localhost:4100');
  });
});

describe('fila de envio', () => {
  const ev = (id: string): ItemSaida => ({
    id_evento: id, tipo: 'ENTREGA_REGISTRADA', carga_id: 'c1', hub_pacote_id: id, codigo: id,
    ocorrido_em: 'x', recebedor: null, exportado_em: null,
  });
  it('marca só os eventos enviados: o que nasceu durante o envio continua pendente', () => {
    const r = marcarExportados([ev('a'), ev('b')], 'agora', new Set(['a']));
    expect(r.map((e) => e.exportado_em)).toEqual(['agora', null]);
  });
});

describe('token vencido', () => {
  it('renova uma vez com o refresh token e repete o pedido', async () => {
    const chamadas: string[] = [];
    const resp = (status: number, corpo: unknown) => ({ ok: status < 400, status, json: async () => corpo }) as Response;
    const original = globalThis.fetch;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      const auth = (init?.headers as Record<string, string> | undefined)?.Authorization ?? '';
      chamadas.push(`${url.split('/api/street')[1]} ${auth}`);
      if (url.endsWith('/renovar')) return resp(200, { token: 'novo', renovar: 'r2' });
      return auth === 'Bearer novo' ? resp(200, []) : resp(401, { codigo: 'TOKEN_EXPIRADO' });
    }) as typeof fetch;
    try {
      let token = 'velho';
      let renovar = 'r1';
      const t = transporteHttp('http://hub', { token: () => token, renovar: () => renovar, aoRenovar: (n, r) => { token = n; if (r) renovar = r; } });
      await expect(t.cargasDoPerfil('p1')).resolves.toEqual([]);
      expect(chamadas).toEqual(['/perfis/p1/cargas Bearer velho', '/renovar Bearer velho', '/perfis/p1/cargas Bearer novo']);
      expect([token, renovar]).toEqual(['novo', 'r2']);
    } finally {
      globalThis.fetch = original;
    }
  });
});
