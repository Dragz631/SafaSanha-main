/**
 * Street ENCAIXA a carga do HUB nos cards que já existem (identidade da rua = street_id, regra comum
 * com o HUB em logradouro.ts). Rua não reconhecida vai para revisão — nenhum card nasce sozinho.
 * Numeração = lista de testes do Hugo (V0.4).
 */
import { describe, expect, it } from 'vitest';
import { DAILY_STREET_CARDS, MANILHA_SUB_STREETS } from '../data/cajuStreets';
import {
  type CatalogoRuas,
  type DocumentoCarga,
  type PacoteCarga,
  cargaDoPerfil,
  chaveRegiao,
  podeCarregar,
  receberCarga,
  reencaixar,
  semEncaixe,
} from './cargaHub';
import { idLogradouro } from './logradouro';
import { memoriaVazia } from './memoria';
import { pacotesDaRua, pertenceARua, ruasDosPacotes } from './ruas';

const AGORA = '2026-09-26T12:00:00.000Z';
const HUGO = { id: 'aj-hugo', nome: 'Hugo' };
const ANA = { id: 'aj-ana', nome: 'Ana' };

/** Cards do Street como no aparelho: presets do Caju + sub-ruas da Manilha + Quinta como região. */
const CATALOGO: CatalogoRuas = {
  ruas: DAILY_STREET_CARDS.filter((c) => c.type === 'street').map((c) => c.streetName),
  manilha: MANILHA_SUB_STREETS.map((m) => m.name),
  regioes: ['Quinta do Caju'],
  apelidos: {},
};

let n = 0;
/** Pacote como o HUB V0.4 manda: texto da J&T + street_id + região. */
function pac(rua: string, regiao: string | null = null, extra: Partial<PacoteCarga> = {}): PacoteCarga {
  n++;
  return {
    hub_pacote_id: `p${n}`,
    transportadora: 'jtexpress',
    codigo: `88800000000${String(n).padStart(4, '0')}`,
    destinatario: 'João',
    rua,
    rua_detalhe: '',
    numero: String(10 + n),
    complemento: '',
    bairro: 'CAJU',
    cidade: 'Rio de Janeiro',
    uf: 'RJ',
    cep: '20931002',
    destino_id: null,
    rua_id: idLogradouro(rua),
    rua_nome: rua,
    regiao: regiao ? { id: `reg-${idLogradouro(regiao)}`, nome: regiao, repasse_unico: false } : null,
    ...extra,
  };
}

function carga(pacotes: PacoteCarga[], ajudante = HUGO): DocumentoCarga {
  return {
    schema: 'logiscan.carga/v0',
    gerado_em: AGORA,
    carga: { id: `carga-${ajudante.id}`, codigo: `C-20260926-${ajudante.nome.toUpperCase()}-1`, criada_em: AGORA, criada_por: 'Galpão', situacao: 'EM_ROTA' },
    ajudante,
    pacotes,
  };
}

const receber = (doc: DocumentoCarga, cat = CATALOGO, noAparelho = []) => receberCarga(memoriaVazia(), doc, noAparelho, AGORA, cat);

describe('perfil: a carga é do helper_id certo', () => {
  it('16. carga do Hugo aparece no perfil Hugo', () => {
    const doc = carga([pac('Rua Carlos Seidl')]);
    expect(cargaDoPerfil(HUGO, doc)).toBe(true);
    expect(podeCarregar(HUGO, doc)).toBe('ok');
  });

  it('17. carga da Ana não aparece no perfil do Hugo', () => {
    const doc = carga([pac('Rua General Gurjão')], ANA);
    expect(cargaDoPerfil(HUGO, doc)).toBe(false);
    expect(podeCarregar(HUGO, doc)).toBe('outro_ajudante');
  });
});

describe('encaixe nos cards existentes (sem recriar ruas)', () => {
  it('18. a mesma rua não aparece duplicada por diferença de maiúscula/minúscula', () => {
    const r = receber(carga([pac('RUA CARLOS SEIDL'), pac('Rua Carlos Seidl'), pac('rua general gurjão')]));
    expect(r.novos.map((d) => d.rua_operacional)).toEqual(['Rua Carlos Seidl', 'Rua Carlos Seidl', 'Rua General Gurjão']);
    expect(ruasDosPacotes(r.novos)).toEqual(['Rua Carlos Seidl', 'Rua General Gurjão']);
    expect(pacotesDaRua(r.novos, 'Rua Carlos Seidl')).toHaveLength(2);
    expect(r.revisar).toEqual([]);
  });

  it('19. "PRAIA DO CAJU" e "praia do caju" convergem para o mesmo street_id e o card "Rua Praia do Caju"', () => {
    expect(idLogradouro('PRAIA DO CAJU')).toBe(idLogradouro('praia do caju'));
    const r = receber(carga([pac('PRAIA DO CAJU'), pac('praia do caju')]));
    expect(r.novos.map((d) => d.rua_operacional)).toEqual(['Rua Praia do Caju', 'Rua Praia do Caju']);
    expect(new Set(r.novos.map((d) => d.hub?.rua_id)).size).toBe(1);
    expect(ruasDosPacotes(r.novos)).toEqual(['Rua Praia do Caju']);
    // o endereço original não muda: só o card onde o pacote fica
    expect(r.novos[0].endereco_rua).toBe('PRAIA DO CAJU');
  });

  it('20. rua desconhecida NÃO vira card sozinha: fica em revisão (e parecida não é igual)', () => {
    const r = receber(carga([pac('Rua Carlos Seixas'), pac('Rua Carlos Seidl')]));
    const seixas = r.novos[0];
    expect(seixas.hub?.revisar_rua).toBe(true);
    expect(seixas.rua_operacional).toBeUndefined();
    expect(ruasDosPacotes(r.novos)).toEqual(['Rua Carlos Seidl']);
    expect(pacotesDaRua(r.novos, 'Rua Carlos Seidl')).toHaveLength(1);
    expect(pertenceARua(seixas, 'Rua Carlos Seixas')).toBe(false);
    expect(r.revisar).toEqual([{ chave: 'rua carlos seixas', nome: 'Rua Carlos Seixas', regiao: null, pacotes: 1 }]);
  });

  it('20. depois da decisão (criar card / encaixar), o pacote entra no card escolhido', () => {
    const r = receber(carga([pac('Rua Carlos Seixas'), pac('Travessa Sem Nome')]));
    const cat = { ...CATALOGO, ruas: [...CATALOGO.ruas, 'Rua Carlos Seixas'], apelidos: { 'rua carlos seixas': 'Rua Carlos Seixas', 'travessa sem nome': 'Rua Tavares Guerra' } };
    const depois = reencaixar(r.novos, cat);
    expect(depois.map((d) => [d.rua_operacional, d.hub?.revisar_rua])).toEqual([['Rua Carlos Seixas', false], ['Rua Tavares Guerra', false]]);
  });

  it('21. região conhecida é preservada: Quinta do Caju → card Quinta; Manilha → sub-rua', () => {
    const r = receber(carga([pac('Beco Antônio Faria Salgado', 'Quinta do caju'), pac('Rua B', 'Manilha'), pac('RUA LEAO XIII', 'Manilha')]));
    const [beco, ruaB, leao] = r.novos;
    expect(beco.rua_operacional).toBe('Quinta do Caju');
    expect(beco.endereco_rua).toBe('Beco Antônio Faria Salgado');
    expect(pacotesDaRua(r.novos, 'Quinta do Caju')).toEqual([beco]);
    expect(ruaB.sub_rua_manilha).toBe('Rua B');
    expect(leao.sub_rua_manilha).toBe('Rua Leão XIII');
    expect(pacotesDaRua(r.novos, 'Manilha')).toHaveLength(2);
    expect(ruasDosPacotes(r.novos)).toEqual(['Quinta do Caju']);
    expect(r.revisar).toEqual([]);
  });

  it('região não funde ruas: "região" Carlos Seidl com a Seixas dentro não põe a Seixas no card da Seidl', () => {
    const r = receber(carga([pac('Rua Carlos Seidl', 'Rua Carlos Seidl'), pac('Rua Carlos Seixas', 'Rua Carlos Seidl')]));
    expect(r.novos[0].rua_operacional).toBe('Rua Carlos Seidl');
    expect(r.novos[1].hub?.revisar_rua).toBe(true);
  });

  it('rua da Manilha fora das 14 sub-ruas do Street vai para revisão (não some dentro da aba Manilha)', () => {
    const r = receber(carga([pac('Travessa Arnaldo da Costa', 'Manilha')]));
    expect(r.novos[0].hub?.revisar_rua).toBe(true);
    expect(r.revisar[0]).toMatchObject({ nome: 'Travessa Arnaldo da Costa', regiao: 'Manilha' });
  });

  it('região nova do HUB (sem card no Street) → revisão; criar o card da região encaixa todas as ruas dela', () => {
    const r = receber(carga([pac('Rua Mestre Camargo', 'Vila Militar'), pac('Rua General Ponde', 'Vila Militar')]));
    expect(r.revisar.map((x) => x.regiao)).toEqual(['Vila Militar', 'Vila Militar']);
    const cat = { ...CATALOGO, regioes: [...CATALOGO.regioes, 'Vila Militar'], apelidos: { [chaveRegiao('Vila Militar')]: 'Vila Militar' } };
    expect(reencaixar(r.novos, cat).map((d) => d.rua_operacional)).toEqual(['Vila Militar', 'Vila Militar']);
  });

  it('aba antiga duplicada ("PRAIA DO CAJU" salva no aparelho) não ganha do card oficial', () => {
    const cat = { ...CATALOGO, ruas: [...CATALOGO.ruas, 'PRAIA DO CAJU'] };
    expect(receber(carga([pac('PRAIA DO CAJU')]), cat).novos[0].rua_operacional).toBe('Rua Praia do Caju');
  });

  it('pacote que já estava no aparelho (carga antiga, sem street_id) é encaixado quando a carga chega de novo', () => {
    const antigo = receberCarga(memoriaVazia(), carga([{ ...pac('PRAIA DO CAJU'), rua_id: undefined, rua_nome: undefined, regiao: undefined }]), [], AGORA);
    expect(antigo.novos[0].rua_operacional).toBeUndefined();
    const doc = carga([{ ...pac('PRAIA DO CAJU'), hub_pacote_id: antigo.novos[0].hub!.pacote_id }]);
    expect(semEncaixe(doc, antigo.novos)).toBe(1);
    const r = receberCarga(memoriaVazia(), doc, antigo.novos, AGORA, CATALOGO);
    expect(r.novos).toEqual([]);
    expect(r.atualizados.map((d) => d.rua_operacional)).toEqual(['Rua Praia do Caju']);
  });

  it('carga de HUB antigo (sem identidade de rua) continua funcionando como antes', () => {
    const r = receberCarga(memoriaVazia(), carga([{ ...pac('Rua X'), rua_id: undefined, rua_nome: undefined, regiao: undefined }]), [], AGORA, CATALOGO);
    expect(r.novos[0].rua_operacional).toBeUndefined();
    expect(r.novos[0].hub?.revisar_rua).toBeUndefined();
    expect(ruasDosPacotes(r.novos)).toEqual(['Rua X']);
  });
});

describe('V0.5: a CAIXA oficial do HUB é o card do Street', () => {
  const caixa = (numero: string, nome: string, nomes_anteriores: string[] = []) => ({ id: `cx-${numero}`, numero, nome, pai: null, nomes_anteriores });

  it('caixa com card existente → encaixa nele (inclusive pelo nome antigo: "Manuel" da caixa 6 "Manoel")', () => {
    const r = receber(carga([
      pac('Rua Monsenhor Manoel Gomes', null, { caixa: caixa('6', 'Rua Monsenhor Manoel Gomes', ['Rua Monsenhor Manuel Gomes']) }),
      pac('Beco Antônio Faria Salgado', null, { caixa: caixa('9', 'Quinta do Caju') }),
    ]));
    expect(r.novos.map((d) => d.rua_operacional)).toEqual(['Rua Monsenhor Manuel Gomes', 'Quinta do Caju']);
    expect(r.cardsCriados).toEqual([]);
    expect(r.novos[0].hub?.caixa).toMatchObject({ numero: '6', nome: 'Rua Monsenhor Manoel Gomes' });
  });

  it('caixa oficial sem card no aparelho → o card nasce com o nome da caixa e o Street avisa', () => {
    const r = receber(carga([
      pac('Rua Mestre Camargo', null, { caixa: caixa('7', 'Vila Militar') }),
      pac('Rua General Ponde', null, { caixa: caixa('7', 'Vila Militar') }),
      pac('Rua Carlos Seidl', null, { caixa: caixa('10.1', 'Associação da Chatuba') }),
    ]));
    expect(r.novos.map((d) => d.rua_operacional)).toEqual(['Vila Militar', 'Vila Militar', 'Associação da Chatuba']);
    expect(r.cardsCriados).toEqual(['Vila Militar', 'Associação da Chatuba']);
    expect(r.revisar).toEqual([]);
    expect(pacotesDaRua(r.novos, 'Vila Militar')).toHaveLength(2);
    expect(r.novos[0].endereco_rua).toBe('Rua Mestre Camargo'); // endereço original intacto
  });

  it('a caixa manda mais que a rua: Seixas na caixa 1 vai para o card da Carlos Seidl; Carlos Seidl na associação vai para a associação', () => {
    const r = receber(carga([
      pac('Rua Carlos Seixas', null, { caixa: caixa('1', 'Rua Carlos Seidl') }),
      pac('Rua Carlos Seidl', null, { caixa: caixa('10.1', 'Associação da Chatuba') }),
    ]), { ...CATALOGO, ruas: [...CATALOGO.ruas, 'Associação da Chatuba'] });
    expect(r.novos.map((d) => d.rua_operacional)).toEqual(['Rua Carlos Seidl', 'Associação da Chatuba']);
  });

  it('Manilha continua com as sub-ruas; rua da Manilha fora das 14 vai para revisão (não some)', () => {
    const r = receber(carga([
      pac('Rua B', null, { caixa: caixa('8', 'Manilha') }),
      pac('Travessa Arnaldo da Costa', null, { caixa: caixa('8', 'Manilha') }),
    ]));
    expect(r.novos[0].sub_rua_manilha).toBe('Rua B');
    expect(r.novos[1].hub?.revisar_rua).toBe(true);
  });

  it('pacote que já estava no aparelho sem caixa é encaixado quando a carga chega com a caixa', () => {
    const antigo = receber(carga([pac('Rua Mestre Camargo')])); // V0.4: rua solta desconhecida → revisão
    expect(antigo.novos[0].hub?.revisar_rua).toBe(true);
    const doc = carga([{ ...pac('Rua Mestre Camargo'), hub_pacote_id: antigo.novos[0].hub!.pacote_id, caixa: caixa('7', 'Vila Militar') }]);
    expect(semEncaixe(doc, antigo.novos)).toBe(1);
    const r = receberCarga(memoriaVazia(), doc, antigo.novos, AGORA, CATALOGO);
    expect(r.atualizados.map((d) => [d.rua_operacional, d.hub?.revisar_rua])).toEqual([['Vila Militar', false]]);
    expect(r.cardsCriados).toEqual(['Vila Militar']);
  });
});
