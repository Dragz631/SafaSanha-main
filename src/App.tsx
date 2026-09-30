import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Header } from './components/Header';
import { FloatingMoneyReward } from './components/FloatingMoneyReward';
import { CashCelebrationBurst } from './components/CashCelebrationBurst';
import { StreetPackageManager } from './components/StreetPackageManager';
import { GeneralSummaryTab } from './components/GeneralSummaryTab';
import { CloseDayModal } from './components/CloseDayModal';
import { AssociationTab } from './components/AssociationTab';
import { DailyStreetPickerModal } from './components/DailyStreetPickerModal';
import { DeliveryData } from './types';
import { CAJU_PRIMARY_AREAS, DAILY_STREET_CARDS, MANILHA_SUB_STREETS } from './data/cajuStreets';
import { MemoriaProvider, useMemoria } from './state/MemoriaContext';
import { PainelHub } from './components/PainelHub';
import {
  type AjudanteHub,
  type CatalogoRuas,
  type DocumentoCarga,
  type Guardados,
  type ItemSaida,
  acumularSaida,
  cargaDoPerfil,
  chaveRegiao,
  detectarEventos,
  encerrarSessao,
  iniciarSessao,
  marcarExportados,
  montarDocumentoEventos,
  podeCarregar,
  receberCarga,
  reencaixar,
  retiradosDaCarga,
  ruasEmRevisao,
  semEncaixe,
  validarCarga,
} from './domain/cargaHub';
import { memoriaVazia } from './domain/memoria';
import {
  gravarAjudanteDoAparelho,
  gravarApelidosRua,
  gravarCardsDeRegiao,
  gravarGuardados,
  gravarMemoriaSemPerfil,
  gravarSaida,
  lerAjudanteDoAparelho,
  lerApelidosRua,
  lerCardsDeRegiao,
  lerGuardados,
  lerMemoriaSemPerfil,
  lerSaida,
  lerSessaoConta,
  gravarSessaoConta,
} from './utils/hubStorage';
import { ErroTransporte, gravarUrlHub, lerUrlHub, transporteHttp } from './utils/transporteHub';
import { type DadosNovaConta, type SessaoConta, classificarErroConta } from './domain/conta';
import type { RetornoLogin } from './components/LoginHub';
import { cardsDeCaixa, contarPacotes, ehAreaManilha, pacotesDaRua, rotasDoDia, ruasDosPacotes, statusEntregue } from './domain/ruas';
import { dataLocal } from './domain/data';
import { chaveTexto } from './domain/texto';
import { gravarJSON, lerJSON, removerChave, useFalhasDeGravacao } from './utils/persistencia';
import { recuperarFotosDaFilaAntiga } from './utils/migracaoFotos';

// Função para normalizar e remover duplicatas na lista de ruas
const normalizeStreetList = (list: string[]): string[] => {
  const map = new Map<string, string>();
  list.forEach((st) => {
    const clean = st?.trim();
    // Filtra travessas de letras da Manilha para não aparecerem como botões soltos no topo
    if (clean && !/^rua\s+[a-k]$/i.test(clean) && !map.has(clean.toLowerCase())) {
      map.set(clean.toLowerCase(), clean);
    }
  });
  return Array.from(map.values());
};

const LOCAL_STORAGE_KEY = 'logiscan_deliveries_prod_v1';
const STREETS_STORAGE_KEY = 'logiscan_today_streets_v5';
const DAILY_CONFIRMED_DATE_KEY = 'safasanha_today_selection_date_v3';
/** Pacote fictício que a versão antiga gravava sozinha no primeiro uso. */
const ID_PACOTE_DEMO = 'del_init_1';

const DEFAULT_STREETS = CAJU_PRIMARY_AREAS;

function carregarPacotes(): DeliveryData[] {
  // Fotos que a versão antiga só guardava na fila do SafaSanhaso voltam para os pacotes (migração única).
  recuperarFotosDaFilaAntiga(LOCAL_STORAGE_KEY);
  const salvos = lerJSON<unknown>(LOCAL_STORAGE_KEY, []);
  if (!Array.isArray(salvos)) return [];
  return (salvos as DeliveryData[]).filter((d) => d && d.id_entrega !== ID_PACOTE_DEMO);
}

function AvisoArmazenamento() {
  const falhas = useFalhasDeGravacao();
  if (falhas.length === 0) return null;
  return (
    <div role="alert" className="sticky top-0 z-40 bg-rose-600 text-white text-xs font-bold px-3 py-2 flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <span>
        Não foi possível salvar no aparelho (armazenamento cheio ou bloqueado). As últimas alterações podem se perder ao fechar o app.
        Encerre o dia para arquivar as entregas ou libere espaço.
      </span>
    </div>
  );
}

function Conteudo() {
  const [activeTab, setActiveTab] = useState<'ruas' | 'resumo' | 'associacao'>(() => {
    try {
      const tabParam = new URLSearchParams(window.location.search).get('tab');
      if (tabParam === 'resumo' || tabParam === 'associacao' || tabParam === 'ruas') return tabParam;
    } catch (_e) {}
    return 'ruas';
  });

  const [activeStreet, setActiveStreet] = useState<string>('Rua Carlos Seidl');
  const [isRegionModalOpen, setIsRegionModalOpen] = useState<boolean>(false);
  const [isCloseDayModalOpen, setIsCloseDayModalOpen] = useState<boolean>(false);

  // Seletor diário de ruas ("Qual as ruas de hoje?") — abre sozinho na primeira vez de cada dia.
  const [isDailyStreetPickerOpen, setIsDailyStreetPickerOpen] = useState<boolean>(() => {
    try {
      if (new URLSearchParams(window.location.search).get('tab') === 'resumo') return false;
      return localStorage.getItem(DAILY_CONFIRMED_DATE_KEY) !== dataLocal();
    } catch (_e) {
      return false;
    }
  });

  // Lista de ruas selecionadas para a rota de hoje
  const [savedStreets, setSavedStreets] = useState<string[]>(() => {
    const parsed = lerJSON<unknown>(STREETS_STORAGE_KEY, null);
    if (Array.isArray(parsed) && parsed.length > 0) return normalizeStreetList(parsed as string[]);
    return normalizeStreetList(DEFAULT_STREETS);
  });

  // Entregas do dia (começam vazias; nenhum dado de demonstração é injetado)
  const [deliveries, setDeliveries] = useState<DeliveryData[]>(carregarPacotes);

  useEffect(() => {
    gravarJSON(LOCAL_STORAGE_KEY, deliveries);
  }, [deliveries]);

  useEffect(() => {
    gravarJSON(STREETS_STORAGE_KEY, savedStreets);
  }, [savedStreets]);

  // ---- Ponte com o LogiScan HUB (carga → Street → eventos) ----------------------
  /** Cards que o Street já tem: a carga do HUB só ENCAIXA aqui (nada nasce sozinho). */
  const montarCatalogo = (ruas = savedStreets, apelidos = apelidosRua, regioes = cardsRegiao): CatalogoRuas => {
    const cardsHub = DAILY_STREET_CARDS.filter((c) => c.type === 'hub').map((c) => c.streetName);
    const ehRegiao = (n: string) => ehAreaManilha(n) || [...cardsHub, ...regioes].some((r) => chaveTexto(r) === chaveTexto(n));
    return {
      ruas: [...DAILY_STREET_CARDS.filter((c) => c.type === 'street').map((c) => c.streetName), ...ruas.filter((n) => !ehRegiao(n))],
      manilha: MANILHA_SUB_STREETS.map((m) => m.name),
      regioes: [...cardsHub.filter((n) => !ehAreaManilha(n)), ...regioes],
      apelidos,
    };
  };

  // A identidade vem do PERFIL escolhido (sessão), não do aparelho. Trocar de perfil é sempre explícito.
  // Memórias separadas: a memória pessoal (endereços) é do perfil; regiões e histórico oficial são do HUB.
  const { memoria, atualizar } = useMemoria();
  const [ajudanteHub, setAjudanteHub] = useState<AjudanteHub | null>(lerAjudanteDoAparelho);
  const [saidaHub, setSaidaHub] = useState<ItemSaida[]>(lerSaida);
  const [guardadosHub, setGuardadosHub] = useState<Guardados>(lerGuardados);
  const [avisoHub, setAvisoHub] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [urlHub, setUrlHub] = useState<string>(lerUrlHub);
  const [perfisHub, setPerfisHub] = useState<AjudanteHub[] | null>(null);
  const [cargaOferecida, setCargaOferecida] = useState<{ doc: DocumentoCarga; novos: number; retirados: number } | null>(null);
  // Faixa "Repasse do Hugo para João" (rota repassada na hora pelo HUB): fica até o ajudante dizer "Entendi".
  const [repasseHub, setRepasseHub] = useState<{ chave: string; texto: string } | null>(null);
  // Sem endereço do HUB (produção sem configurar) = sem transporte: o Street não faz nenhuma requisição ao HUB.
  // Sessão de CONTA (login no HUB): o token só vale para o perfil dono dele; perfil sem conta não manda credencial.
  const [sessaoConta, setSessaoConta] = useState<SessaoConta | null>(lerSessaoConta);
  const tokenRef = useRef<string | null>(sessaoConta?.token ?? null);
  const renovarRef = useRef<string | null>(sessaoConta?.renovar ?? null);
  useEffect(() => {
    gravarSessaoConta(sessaoConta);
  }, [sessaoConta]);
  const transporte = useMemo(() => (urlHub ? transporteHttp(urlHub, {
        token: () => tokenRef.current,
        renovar: () => renovarRef.current,
        aoRenovar: (token, renovar) => {
          tokenRef.current = token;
          if (renovar) renovarRef.current = renovar;
          setSessaoConta((s) => (s ? { ...s, token, renovar: renovar ?? s.renovar } : s));
        },
      }) : null), [urlHub]);
  // Conhecimento de ruas do aparelho decidido na revisão (rua/região do HUB → card existente).
  const [apelidosRua, setApelidosRua] = useState<Record<string, string>>(lerApelidosRua);
  const [cardsRegiao, setCardsRegiao] = useState<string[]>(lerCardsDeRegiao);
  useEffect(() => {
    gravarApelidosRua(apelidosRua);
  }, [apelidosRua]);
  useEffect(() => {
    gravarCardsDeRegiao(cardsRegiao);
  }, [cardsRegiao]);
  useEffect(() => {
    gravarAjudanteDoAparelho(ajudanteHub);
  }, [ajudanteHub]);
  useEffect(() => {
    gravarSaida(saidaHub);
  }, [saidaHub]);
  useEffect(() => {
    gravarGuardados(guardadosHub);
  }, [guardadosHub]);

  // Qualquer entrega ou insucesso de um pacote da carga (por qualquer tela) vira evento na fila para o HUB.
  const deliveriesAnteriores = useRef(deliveries);
  useEffect(() => {
    const novos = detectarEventos(deliveriesAnteriores.current, deliveries, ajudanteHub?.id);
    deliveriesAnteriores.current = deliveries;
    if (novos.length > 0) setSaidaHub((s) => acumularSaida(s, novos));
  }, [deliveries, ajudanteHub]);

  const trocarLista = (lista: DeliveryData[]) => {
    deliveriesAnteriores.current = lista; // chegar/sair da tela não é acontecimento
    setDeliveries(lista);
  };

  const carregarPerfis = async () => {
    if (!transporte) {
      setPerfisHub(null);
      return;
    }
    try {
      setPerfisHub(await transporte.perfis());
    } catch (e) {
      setPerfisHub(null);
      // HUB com login obrigatório (Vercel): a lista de perfis só existe depois de entrar — não é erro, não assusta.
      if (e instanceof ErroTransporte && (e.status === 401 || e.status === 403)) return;
      setAvisoHub({ tipo: 'erro', texto: `${(e as Error).message}. Dá para usar o arquivo da carga.` });
    }
  };
  useEffect(() => {
    if (!ajudanteHub) carregarPerfis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transporte]);

  /** Abre a sessão do perfil: volta o que estava guardado com ele e troca para a MEMÓRIA PESSOAL dele. */
  const abrirSessao = (ajudante: AjudanteHub, lista: DeliveryData[]): { lista: DeliveryData[]; memoria: typeof memoria } | null => {
    let r: ReturnType<typeof iniciarSessao>;
    try {
      r = iniciarSessao(ajudante, lista, guardadosHub);
    } catch (e) {
      setAvisoHub({ tipo: 'erro', texto: (e as Error).message });
      return null;
    }
    gravarMemoriaSemPerfil(memoria); // a memória em uso até aqui é a do aparelho sem perfil
    let memoriaDoPerfil = r.memoria;
    if (!memoriaDoPerfil) {
      const temMemoria = Object.keys(memoria.destinos).length > 0;
      memoriaDoPerfil =
        temMemoria &&
        window.confirm(`Primeira vez de ${ajudante.nome} neste aparelho. Copiar a memória de endereços do aparelho para o perfil dele? (Se não, ele começa com memória vazia.)`)
          ? memoria
          : memoriaVazia();
    }
    const m = memoriaDoPerfil;
    atualizar(() => m);
    setGuardadosHub(r.guardados);
    setSaidaHub(r.saida);
    setAjudanteHub(ajudante);
    setCargaOferecida(null);
    return { lista: r.deliveries, memoria: m };
  };

  /** O HUB repassou uma rota (saindo deste perfil ou chegando nele): avisa, uma vez por repasse. */
  const avisarRepasse = (c: DocumentoCarga) => {
    const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const para = c.carga.repassada_para;
    const de = c.carga.repassada_de;
    const info = para
      ? {
          chave: `${c.carga.id}:para:${para.em}`,
          texto: `Repasse do ${c.ajudante.nome} para ${para.ajudante.nome} às ${hora(para.em)}: ${para.pacotes} pacote(s) saíram da sua rota${para.motivo ? ` (${para.motivo})` : ''}.`,
        }
      : de
        ? {
            chave: `${c.carga.id}:de:${de.em}`,
            texto: `Repasse do ${de.ajudante.nome} para ${c.ajudante.nome} às ${hora(de.em)}: você assumiu ${de.pacotes} pacote(s) da rota ${de.carga_codigo}${de.motivo ? ` (${de.motivo})` : ''}.`,
          }
        : null;
    if (!info) return;
    if (lerJSON<string[]>('logiscan_street_repasses_vistos_v0', []).includes(info.chave)) return;
    setRepasseHub((atual) => (atual?.chave === info.chave ? atual : info));
  };
  const dispensarRepasse = () => {
    if (!repasseHub) return;
    const vistos = lerJSON<string[]>('logiscan_street_repasses_vistos_v0', []);
    gravarJSON('logiscan_street_repasses_vistos_v0', [...vistos, repasseHub.chave].slice(-50));
    setRepasseHub(null);
  };

  /** Aplica uma carga (vinda do HUB ou de arquivo) ao perfil ativo. */
  const aplicarCarga = (carga: DocumentoCarga, lista: DeliveryData[], origem: 'hub' | 'arquivo', base = memoria) => {
    const agora = new Date().toISOString();
    avisarRepasse(carga);
    const r = receberCarga(base, carga, lista, agora, montarCatalogo());
    const ret = retiradosDaCarga(carga, lista);
    const trocados = new Map(r.atualizados.map((d) => [d.id_entrega, d]));
    if (r.cardsCriados.length) {
      setSavedStreets((prev) => [...prev, ...r.cardsCriados.filter((c) => !prev.some((s) => chaveTexto(s) === chaveTexto(c)))]);
    }
    atualizar(() => r.memoria);
    const listaFinal = [...r.novos, ...lista.filter((d) => !ret.remover.includes(d.id_entrega)).map((d) => trocados.get(d.id_entrega) ?? d)];
    trocarLista(listaFinal);
    // Carga NOVA: as Rotas passam a ser só o que o ajudante recebeu (não as 8 ruas de sempre).
    // Carga já conhecida (atualização): só acrescenta — o efeito das ruas dos pacotes cuida disso.
    if (!lista.some((d) => d.hub?.carga_id === carga.carga.id)) {
      const rotas = rotasDoDia(listaFinal);
      if (rotas.length > 0) {
        setSavedStreets(rotas);
        if (!rotas.some((s) => chaveTexto(s) === chaveTexto(activeStreet))) setActiveStreet(rotas[0]);
        try {
          localStorage.setItem(DAILY_CONFIRMED_DATE_KEY, dataLocal());
        } catch (_e) {}
      }
    }
    setCargaOferecida(null);
    const partes = [`${r.novos.length} pacote(s) novo(s)`];
    if (r.jaNoAparelho) partes.push(`${r.jaNoAparelho} já estavam no aparelho`);
    if (ret.remover.length) partes.push(`${ret.remover.length} retirado(s) da carga pelo HUB`);
    if (r.destinoPendente) partes.push(`${r.destinoPendente} com destino a confirmar`);
    if (r.atualizados.length) partes.push(`${r.atualizados.length} encaixado(s) nos cards existentes`);
    if (r.cardsCriados.length) partes.push(`card(s) criado(s) para caixa(s) do HUB: ${r.cardsCriados.join(', ')}`);
    const aguardando = carga.carga.situacao === 'MONTADA' ? ' Rota ainda não iniciada no HUB.' : '';
    const ruasNovas = [...new Set(r.novos.filter((d) => !d.hub?.revisar_rua).map((d) => d.rua_operacional || d.sub_rua_manilha || d.endereco_rua || ''))].filter(Boolean);
    const titulo =
      origem === 'hub'
        ? `${lista.some((d) => d.hub?.carga_id === carga.carga.id) ? 'Carga atualizada' : 'Nova carga'} do HUB para ${carga.ajudante.nome} — ${carga.carga.codigo}`
        : `Carga ${carga.carga.codigo} (arquivo)`;
    const revisar = r.revisar.length
      ? ` ${r.revisar.length} rua(s) NÃO RECONHECIDA(S) — nenhum card foi criado; revise abaixo: ${r.revisar.map((x) => x.nome).join(', ')}.`
      : '';
    setAvisoHub({
      tipo: r.revisar.length ? 'erro' : 'ok',
      texto: `${titulo}: ${partes.join(', ')}${ruasNovas.length ? ` · cards: ${ruasNovas.join(', ')}` : ''}.${aguardando}${revisar}`,
    });
    if (origem === 'hub') {
      transporte?.confirmarRecebimento(carga.carga.id, carga.ajudante.id, carga.pacotes.length).catch(() => undefined);
    }
  };

  const handleEscolherPerfil = (ajudante: AjudanteHub) => {
    if (ajudanteHub) return;
    const aberta = abrirSessao(ajudante, deliveries);
    if (!aberta) return;
    trocarLista(aberta.lista);
    setAvisoHub({ tipo: 'ok', texto: `Perfil de ${ajudante.nome} ativo neste aparelho.` });
    buscarCargaHub(ajudante, aberta.lista);
  };

  /**
   * Busca no HUB a carga do PERFIL ativo e, se houver novidade (ruas repassadas/retiradas), carrega na hora
   * com aviso claro. `automatico` = chamada do sincronismo periódico: sem mensagens quando nada mudou.
   */
  const buscarCargaHub = async (perfil = ajudanteHub, lista = deliveries, automatico = false) => {
    if (!perfil || !transporte) return;
    try {
      const [doc] = await transporte.cargasDoPerfil(perfil.id);
      if (!doc) {
        setCargaOferecida(null);
        if (!automatico) setAvisoHub({ tipo: 'ok', texto: `Nenhuma carga ativa para ${perfil.nome} no HUB.` });
        return;
      }
      const v = validarCarga(doc);
      if ('erros' in v) {
        setAvisoHub({ tipo: 'erro', texto: `Carga do HUB recusada: ${v.erros.slice(0, 3).join('; ')}` });
        return;
      }
      if (!cargaDoPerfil(perfil, v.carga)) {
        setAvisoHub({ tipo: 'erro', texto: `O HUB devolveu a carga de ${v.carga.ajudante.nome} para o perfil de ${perfil.nome}: recusada.` });
        return;
      }
      avisarRepasse(v.carga);
      const naTela = new Set(lista.map((d) => d.hub?.pacote_id).filter(Boolean));
      const novos = v.carga.pacotes.filter((p) => !naTela.has(p.hub_pacote_id)).length;
      const retirados = retiradosDaCarga(v.carga, lista).remover.length;
      const paraEncaixar = semEncaixe(v.carga, lista);
      if (novos === 0 && retirados === 0 && paraEncaixar === 0) {
        setCargaOferecida(null);
        if (!automatico) setAvisoHub({ tipo: 'ok', texto: `Carga ${v.carga.carga.codigo} já está atualizada neste aparelho.` });
        return;
      }
      // É a carga DESTE perfil: entra direto, com aviso claro (carga de outro perfil nunca chega aqui).
      aplicarCarga(v.carga, lista, 'hub');
    } catch (e) {
      if (e instanceof ErroTransporte && e.status === 401 && sessaoConta) {
        handleEncerrarSessao({ expirada: true });
        return;
      }
      if (!automatico) {
        setAvisoHub({ tipo: 'erro', texto: e instanceof ErroTransporte ? `${e.message}. Use o arquivo da carga.` : (e as Error).message });
      }
    }
  };

  /** Entrar com usuário + PIN. O PIN só passa por aqui: nada dele é guardado. */
  const handleEntrar = async (usuario: string, pin: string): Promise<RetornoLogin> => {
    if (!transporte) return { tipo: 'erro', texto: 'Informe o endereço do HUB primeiro.' };
    try {
      const r = await transporte.login(usuario, pin);
      if (!r.perfil.id) {
        return { tipo: 'erro', texto: 'Esta conta é só de administração e não tem perfil de ajudante para entregar. Peça para ligar um ajudante a ela no HUB.' };
      }
      const perfil: AjudanteHub = { id: r.perfil.id, nome: r.perfil.nome };
      tokenRef.current = r.token;
      renovarRef.current = r.renovar ?? null;
      const aberta = abrirSessao(perfil, deliveries);
      if (!aberta) {
        tokenRef.current = null;
        renovarRef.current = null;
        return { tipo: 'erro', texto: 'Há pacotes de outro ajudante na tela. Encerre a sessão dele antes de entrar.' };
      }
      setSessaoConta({ token: r.token, renovar: r.renovar, perfilId: perfil.id, papel: r.perfil.papel });
      trocarLista(aberta.lista);
      setAvisoHub({ tipo: 'ok', texto: `Bem-vindo, ${perfil.nome}.` });
      buscarCargaHub(perfil, aberta.lista);
      return { tipo: 'ok', texto: `Bem-vindo, ${perfil.nome}.` };
    } catch (e) {
      if (e instanceof ErroTransporte && e.status === 0) return { tipo: 'erro', texto: `${e.message}. Confira se o HUB está ligado.` };
      const c = e instanceof ErroTransporte ? classificarErroConta(e.status, e.corpo) : null;
      return { tipo: 'erro', texto: c?.mensagem ?? (e as Error).message };
    }
  };

  const handleCriarConta = async (dados: DadosNovaConta): Promise<RetornoLogin> => {
    if (!transporte) return { tipo: 'erro', texto: 'Informe o endereço do HUB primeiro.' };
    try {
      await transporte.criarConta(dados);
      return { tipo: 'ok', texto: 'Pedido enviado ao Hugo. Quando ele aprovar, entre com seu usuário e PIN.' };
    } catch (e) {
      if (e instanceof ErroTransporte && e.status === 0) return { tipo: 'erro', texto: `${e.message}. Confira se o HUB está ligado.` };
      const c = e instanceof ErroTransporte ? classificarErroConta(e.status, e.corpo) : null;
      return { tipo: 'erro', texto: c?.mensagem ?? (e as Error).message };
    }
  };

  // Sincronismo HUB → Street: com um perfil ativo, confere a carga dele a cada 15 s e ao voltar para o app.
  const buscarRef = useRef(buscarCargaHub);
  buscarRef.current = buscarCargaHub;

  /**
   * Envio AUTOMÁTICO da confirmação de entrega/insucesso ao HUB. Silencioso: se o HUB estiver fora,
   * a fila continua no aparelho e tenta de novo no próximo ciclo (idempotente pelo id do evento).
   * Só marca como enviado o que o HUB aceitou ou já tinha; recusado continua na fila e aparece no botão manual.
   */
  const enviandoAuto = useRef(false);
  const enviarAutomaticoRef = useRef<() => Promise<void>>(async () => undefined);
  enviarAutomaticoRef.current = async () => {
    if (!transporte || !ajudanteHub || enviandoAuto.current) return;
    const pendentes = saidaHub.filter((e) => !e.exportado_em);
    if (pendentes.length === 0) return;
    enviandoAuto.current = true;
    try {
      const agora = new Date().toISOString();
      const doc = montarDocumentoEventos(pendentes, ajudanteHub, agora);
      const r = await transporte.enviarEventos(doc);
      const recusados = new Set(r.recusados.map((x) => x.codigo));
      const ids = new Set(pendentes.filter((e) => !recusados.has(e.codigo)).map((e) => e.id_evento));
      setSaidaHub((s) => marcarExportados(s, agora, ids));
    } catch (e) {
      // HUB fora do ar: fica na fila. Token recusado: a sessão expirou → volta ao login (nada é apagado).
      if (e instanceof ErroTransporte && e.status === 401 && sessaoConta) handleEncerrarSessao({ expirada: true });
    } finally {
      enviandoAuto.current = false;
    }
  };
  const pendentesDeEnvio = saidaHub.filter((e) => !e.exportado_em).length;
  useEffect(() => {
    if (pendentesDeEnvio > 0) enviarAutomaticoRef.current();
  }, [pendentesDeEnvio, ajudanteHub, transporte]);

  useEffect(() => {
    if (!ajudanteHub || !transporte) return;
    const tick = () => {
      buscarRef.current(undefined, undefined, true);
      enviarAutomaticoRef.current();
    };
    const id = window.setInterval(tick, 15000);
    const aoVoltar = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener('focus', aoVoltar);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('focus', aoVoltar);
    };
  }, [ajudanteHub, transporte]);

  const handleCarregarArquivo = async (arquivo: File) => {
    let bruto: unknown;
    try {
      bruto = JSON.parse(await arquivo.text());
    } catch {
      setAvisoHub({ tipo: 'erro', texto: `${arquivo.name} não é um JSON válido.` });
      return;
    }
    const v = validarCarga(bruto);
    if ('erros' in v) {
      setAvisoHub({ tipo: 'erro', texto: `Carga recusada: ${v.erros.slice(0, 3).join('; ')}` });
      return;
    }
    const carga = v.carga;
    const permissao = podeCarregar(ajudanteHub, carga);
    if (permissao === 'outro_ajudante') {
      setAvisoHub({
        tipo: 'erro',
        texto: `Esta carga é de ${carga.ajudante.nome}, mas o perfil ativo é ${ajudanteHub!.nome}. Troque de perfil antes.`,
      });
      return;
    }
    if (permissao === 'sem_sessao') {
      if (!window.confirm(`Ativar o perfil de ${carga.ajudante.nome} neste aparelho para receber a carga ${carga.carga.codigo}?`)) return;
      const aberta = abrirSessao(carga.ajudante, deliveries);
      if (!aberta) return;
      aplicarCarga(carga, aberta.lista, 'arquivo', aberta.memoria);
      return;
    }
    aplicarCarga(carga, deliveries, 'arquivo');
  };

  /** `expirada` = o HUB recusou o token (401): sai sem perguntar, guardando tudo do perfil, e pede o login de novo. */
  const handleEncerrarSessao = (opcoes?: { expirada?: boolean; confirmado?: boolean }) => {
    if (!ajudanteHub) return;
    const expirada = opcoes?.expirada === true;
    const pendentes = saidaHub.filter((e) => !e.exportado_em).length;
    const aviso = pendentes
      ? `\n\n${pendentes} acontecimento(s) ainda não foram enviados ao HUB. Eles ficam guardados com ${ajudanteHub.nome} e voltam quando o perfil dele for ativado de novo.`
      : '';
    // A confirmação é feita no painel (botão "Sim, trocar"): window.confirm pode ser bloqueado pelo navegador.
    if (!expirada && opcoes?.confirmado !== true && !window.confirm(`Trocar de perfil? A carga, a fila e a memória de ${ajudanteHub.nome} ficam guardadas à parte.${aviso}`)) return;
    const r = encerrarSessao(ajudanteHub, deliveries, saidaHub, guardadosHub, memoria);
    trocarLista(r.deliveries);
    setSaidaHub(r.saida);
    setGuardadosHub(r.guardados);
    const semPerfil = lerMemoriaSemPerfil() ?? memoriaVazia();
    atualizar(() => semPerfil);
    setCargaOferecida(null);
    setAvisoHub(
      expirada
        ? { tipo: 'erro', texto: `A sessão de ${ajudanteHub.nome} expirou. Entre de novo — nada foi apagado.` }
        : { tipo: 'ok', texto: `Perfil de ${ajudanteHub.nome} encerrado neste aparelho. Nada foi apagado.` },
    );
    tokenRef.current = null;
    renovarRef.current = null;
    setSessaoConta(null);
    setAjudanteHub(null);
    carregarPerfis();
  };

  const baixarArquivoEventos = (doc: ReturnType<typeof montarDocumentoEventos>, agora: string) => {
    const nome = `retorno-street-${doc.ajudante.nome.replace(/[^\w-]+/g, '_')}-${agora.slice(0, 16).replace(/[:T]/g, '-')}.json`;
    const url = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: nome });
    a.click();
    URL.revokeObjectURL(url);
    return nome;
  };

  const handleEnviarAoHub = async (modo: 'hub' | 'arquivo' = 'hub') => {
    if (!ajudanteHub || saidaHub.length === 0) return;
    const agora = new Date().toISOString();
    const doc = montarDocumentoEventos(saidaHub, ajudanteHub, agora);
    if (modo === 'hub' && transporte) {
      try {
        const r = await transporte.enviarEventos(doc);
        setSaidaHub((s) => marcarExportados(s, agora, new Set(doc.eventos.map((e) => e.id_evento))));
        setAvisoHub({
          tipo: r.recusados.length ? 'erro' : 'ok',
          texto:
            `HUB: ${r.aceitos} registrado(s), ${r.repetidos} já recebido(s)` +
            (r.recusados.length ? `, ${r.recusados.length} recusado(s): ${r.recusados.map((x) => `${x.codigo} — ${x.motivo}`).join('; ')}` : '.'),
        });
        return;
      } catch (e) {
        setAvisoHub({ tipo: 'erro', texto: `${(e as Error).message}. Gerando arquivo para levar ao HUB.` });
      }
    }
    const nome = baixarArquivoEventos(doc, agora);
    setSaidaHub((s) => marcarExportados(s, agora, new Set(doc.eventos.map((e) => e.id_evento))));
    setAvisoHub({ tipo: 'ok', texto: `${nome} gerado com ${doc.eventos.length} acontecimento(s). Leve este arquivo ao HUB.` });
  };

  const handleUrlHub = (url: string) => {
    gravarUrlHub(url);
    setUrlHub(lerUrlHub());
  };

  // Ruas dos pacotes carregados entram na lista da região (sem duplicar e sem soltar sub-ruas da Manilha)
  useEffect(() => {
    setSavedStreets((prev) => {
      const map = new Map<string, string>();
      prev.forEach((st) => {
        const clean = st?.trim();
        if (clean && !/^rua\s+[a-k]$/i.test(clean)) map.set(chaveTexto(clean), clean);
      });
      let changed = false;
      ruasDosPacotes(deliveries).forEach((st) => {
        if (!/^rua\s+[a-k]$/i.test(st) && !map.has(chaveTexto(st))) {
          map.set(chaveTexto(st), st);
          changed = true;
        }
      });
      return changed ? Array.from(map.values()) : prev;
    });
  }, [deliveries]);

  // Revisão de ruas não reconhecidas (carga do HUB): encaixar num card existente ou criar o card — sempre por decisão.
  const decidirRevisao = (apelidos: Record<string, string>, ruas = savedStreets, regioes = cardsRegiao) => {
    setApelidosRua(apelidos);
    setDeliveries((prev) => reencaixar(prev, montarCatalogo(ruas, apelidos, regioes)));
  };
  const handleEncaixarRua = (chave: string, card: string) => decidirRevisao({ ...apelidosRua, [chave]: card });
  const handleCriarCardRua = (chave: string, nome: string) => {
    const ruas = savedStreets.some((s) => chaveTexto(s) === chaveTexto(nome)) ? savedStreets : [...savedStreets, nome];
    setSavedStreets(ruas);
    decidirRevisao({ ...apelidosRua, [chave]: nome }, ruas);
  };
  const handleCriarCardRegiao = (regiao: string) => {
    const regioes = cardsRegiao.some((r) => chaveTexto(r) === chaveTexto(regiao)) ? cardsRegiao : [...cardsRegiao, regiao];
    const ruas = savedStreets.some((s) => chaveTexto(s) === chaveTexto(regiao)) ? savedStreets : [...savedStreets, regiao];
    setCardsRegiao(regioes);
    setSavedStreets(ruas);
    decidirRevisao({ ...apelidosRua, [chaveRegiao(regiao)]: regiao }, ruas, regioes);
  };
  const revisaoRuas = useMemo(() => ruasEmRevisao(deliveries), [deliveries]);
  const cardsParaEncaixe = useMemo(() => {
    const c = montarCatalogo();
    return [...new Set([...c.ruas, ...c.regioes, 'Manilha'])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedStreets, cardsRegiao, apelidosRua]);

  // Handlers de Ruas
  const handleAddStreet = (newStreet: string) => {
    const clean = newStreet.trim();
    if (!clean) return;
    setSavedStreets((prev) => (prev.some((s) => chaveTexto(s) === chaveTexto(clean)) ? prev : [...prev, clean]));
    setActiveStreet(clean);
  };

  const handleDeleteStreet = (streetToDelete: string) => {
    const remaining = savedStreets.filter((s) => chaveTexto(s) !== chaveTexto(streetToDelete));
    setSavedStreets(remaining);
    if (chaveTexto(activeStreet) === chaveTexto(streetToDelete) && remaining.length > 0) {
      setActiveStreet(remaining[0]);
    }
  };

  const handleRenameStreet = (oldName: string, newName: string) => {
    const cleanNew = newName.trim();
    if (!cleanNew) return;
    setSavedStreets((prev) => normalizeStreetList(prev.map((s) => (chaveTexto(s) === chaveTexto(oldName) ? cleanNew : s))));
    if (chaveTexto(activeStreet) === chaveTexto(oldName)) setActiveStreet(cleanNew);
    // Atualiza pacotes que tinham a rua antiga (o vínculo de destino é refeito pela chave nova ao editar/cadastrar)
    setDeliveries((prev) =>
      prev.map((d) =>
        chaveTexto(d.endereco_rua) === chaveTexto(oldName)
          ? {
              ...d,
              endereco_rua: cleanNew,
              endereco_completo: `${cleanNew}, ${d.numero_casa || 'S/N'}${d.complemento ? ` (${d.complemento})` : ''}`,
              destino_id: undefined,
            }
          : d
      )
    );
  };

  // Handlers de Entregas
  const handleAddDelivery = (newDelivery: DeliveryData) => setDeliveries((prev) => [newDelivery, ...prev]);

  const handleAddBatchDeliveries = (newDeliveries: DeliveryData[]) => {
    if (newDeliveries.length === 0) return;
    setDeliveries((prev) => [...newDeliveries, ...prev]);
  };

  const handleUpdateDelivery = (updated: DeliveryData) =>
    setDeliveries((prev) => prev.map((d) => (d.id_entrega === updated.id_entrega ? updated : d)));

  const handleDeleteDelivery = (id: string) => setDeliveries((prev) => prev.filter((d) => d.id_entrega !== id));

  const handleClearAllDeliveries = () => {
    if (window.confirm('Deseja realmente limpar todos os pacotes e começar um novo dia de entregas?')) {
      setDeliveries([]);
      removerChave(LOCAL_STORAGE_KEY);
    }
  };

  // Contagem da rua ativa — a MESMA função usada por todas as telas
  const streetDeliveries = useMemo(() => pacotesDaRua(deliveries, activeStreet), [deliveries, activeStreet]);
  const { entregues: deliveredCount, insucessos: insucessoCount, pendentes: pendingCount } = useMemo(
    () => contarPacotes(streetDeliveries),
    [streetDeliveries]
  );

  // Moedas de Ouro do Dia: cada pacote entregue soma 2 moedas
  const coinsToday = useMemo(() => deliveries.filter(statusEntregue).length * 2, [deliveries]);

  const handleConfirmDailyStreets = (selected: string[]) => {
    if (selected.length > 0) {
      setSavedStreets(selected);
      if (!selected.some((s) => chaveTexto(s) === chaveTexto(activeStreet))) setActiveStreet(selected[0]);
    }
    try {
      localStorage.setItem(DAILY_CONFIRMED_DATE_KEY, dataLocal());
    } catch (_e) {}
  };

  return (
    <div className="dark min-h-screen font-sans flex flex-col antialiased bg-[#090d16] text-slate-100 selection:bg-emerald-500 selection:text-white">
      <AvisoArmazenamento />

      <Header
        activeStreet={activeStreet}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenStreetPicker={() => setIsRegionModalOpen(true)}
        onOpenDailyStreetPicker={() => setIsDailyStreetPickerOpen(true)}
        onOpenAddStreet={() => setIsRegionModalOpen(true)}
        pendingCount={pendingCount}
        totalCount={streetDeliveries.length}
        deliveredCount={deliveredCount}
        insucessoCount={insucessoCount}
        totalAllDeliveries={deliveries.length}
        coinsToday={coinsToday}
      />

      <main className="flex-1 max-w-xl mx-auto w-full px-3 sm:px-4 py-2">
        <PainelHub
          deliveries={deliveries}
          ajudante={ajudanteHub}
          saida={saidaHub}
          aviso={avisoHub}
          perfis={perfisHub}
          guardados={Object.values(guardadosHub).map((g) => g.ajudante)}
          urlHub={urlHub}
          cargaOferecida={cargaOferecida}
          onEscolherPerfil={handleEscolherPerfil}
          onEntrar={handleEntrar}
          onCriarConta={handleCriarConta}
          papel={sessaoConta && ajudanteHub?.id === sessaoConta.perfilId ? sessaoConta.papel : null}
          onBuscarCarga={() => buscarCargaHub()}
          onAceitarCarga={() => cargaOferecida && ajudanteHub && aplicarCarga(cargaOferecida.doc, deliveries, 'hub')}
          onCarregarArquivo={handleCarregarArquivo}
          onEnviarAoHub={handleEnviarAoHub}
          onEncerrarSessao={handleEncerrarSessao}
          onRecarregarPerfis={carregarPerfis}
          onMudarUrlHub={handleUrlHub}
          repasse={repasseHub}
          onDispensarRepasse={dispensarRepasse}
          revisaoRuas={revisaoRuas}
          cardsParaEncaixe={cardsParaEncaixe}
          onEncaixarRua={handleEncaixarRua}
          onCriarCardRua={handleCriarCardRua}
          onCriarCardRegiao={handleCriarCardRegiao}
        />
        {activeTab === 'ruas' && (
          <StreetPackageManager
            deliveries={deliveries}
            activeStreet={activeStreet}
            savedStreets={savedStreets}
            onSelectStreet={setActiveStreet}
            onAddStreet={handleAddStreet}
            onDeleteStreet={handleDeleteStreet}
            onRenameStreet={handleRenameStreet}
            onAddDelivery={handleAddDelivery}
            onAddBatchDeliveries={handleAddBatchDeliveries}
            onUpdateDelivery={handleUpdateDelivery}
            onDeleteDelivery={handleDeleteDelivery}
            onClearAllDeliveries={handleClearAllDeliveries}
            isRegionModalOpen={isRegionModalOpen}
            onOpenRegionModal={() => setIsRegionModalOpen(true)}
            onCloseRegionModal={() => setIsRegionModalOpen(false)}
            onOpenDailyStreetPicker={() => setIsDailyStreetPickerOpen(true)}
            onOpenCloseDayModal={() => setIsCloseDayModalOpen(true)}
          />
        )}

        {activeTab === 'resumo' && (
          <GeneralSummaryTab
            deliveries={deliveries}
            savedStreets={savedStreets}
            onSelectStreet={(street) => {
              setActiveStreet(street);
              setActiveTab('ruas');
            }}
            onClearAllDeliveries={handleClearAllDeliveries}
            onUpdateDelivery={handleUpdateDelivery}
            onSetDeliveries={setDeliveries}
          />
        )}

        {activeTab === 'associacao' && <AssociationTab />}
      </main>

      <FloatingMoneyReward />
      <CashCelebrationBurst />

      <CloseDayModal
        isOpen={isCloseDayModalOpen}
        deliveries={deliveries}
        onClose={() => setIsCloseDayModalOpen(false)}
        onConfirmCloseDay={(params) => {
          setDeliveries(params.nextDayDeliveries);
          setIsCloseDayModalOpen(false);
          setIsDailyStreetPickerOpen(false);
          setActiveTab('resumo');
        }}
      />

      <DailyStreetPickerModal
        isOpen={isDailyStreetPickerOpen}
        savedStreets={savedStreets}
        deliveries={deliveries}
        cardsDeCaixa={cardsDeCaixa(deliveries)}
        onClose={() => setIsDailyStreetPickerOpen(false)}
        onConfirmStreets={handleConfirmDailyStreets}
        onOpenAssociacaoTab={() => setActiveTab('associacao')}
      />
    </div>
  );
}

export default function App() {
  return (
    <MemoriaProvider>
      <Conteudo />
    </MemoriaProvider>
  );
}
