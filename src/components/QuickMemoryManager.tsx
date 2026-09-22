import React, { useState, useMemo } from 'react';
import { Compass, Plus, Check, UserPlus, Trash2, Search, Building, Home, MapPin, Store } from 'lucide-react';
import { DeliveryData } from '../types';
import { MANILHA_SUB_STREETS } from '../data/cajuStreets';
import { useMemoria } from '../state/MemoriaContext';
import {
  compararNumeros,
  destinosDasRuas,
  esquecerDestino,
  esquecerPessoa,
  tipoDeDestinoConhecido,
  type DestinoConhecido,
} from '../domain/memoria';
import { textoComplemento } from '../domain/endereco';
import { chaveTexto } from '../domain/texto';
import { enderecoDoPacote } from '../domain/agrupamento';
import { confirmarDestino, montarPacote } from '../domain/cadastro';
import type { TipoDestino } from '../domain/destino';

/**
 * "CASAS SALVAS" — memória operacional POR DESTINO (rua + número + local), não só por número.
 * Mostra o que já se sabe (moradores por unidade, locais nomeados) e adiciona o pacote com 1 toque.
 * Nada aqui sobrescreve o histórico: só o operador remove, e com confirmação.
 */
interface QuickMemoryManagerProps {
  streetName: string;
  isManilhaActive: boolean;
  manilhaSubStreet?: string;
  currentDeliveries: DeliveryData[];
  onAddDelivery: (delivery: DeliveryData) => void;
  onSelectForManualAdd: (houseNumber: string, complement?: string, subStreet?: string) => void;
  onToast: (msg: string) => void;
}

const ICONE: Record<TipoDestino, React.ElementType> = { simples: MapPin, predio: Building, vila: Home, comercio: Store };
const ROTULO: Record<TipoDestino, string> = { simples: 'Casa', predio: 'Prédio', vila: 'Vila', comercio: 'Local' };

interface Entrada {
  chave: string;
  nome?: string;
  pessoaChave?: string;
  unidadeChave?: string;
  unidadeRotulo?: string;
}

function entradasDoDestino(d: DestinoConhecido): Entrada[] {
  const lista: Entrada[] = [];
  for (const u of d.unidades) {
    if (u.pessoas.length === 0) lista.push({ chave: `${u.chave}|`, unidadeChave: u.chave, unidadeRotulo: u.rotulo });
    for (const p of u.pessoas) {
      lista.push({ chave: `${u.chave}|${p.chave}`, nome: p.nome, pessoaChave: p.chave, unidadeChave: u.chave, unidadeRotulo: u.rotulo });
    }
  }
  for (const p of d.pessoas) lista.push({ chave: `|${p.chave}`, nome: p.nome, pessoaChave: p.chave });
  if (lista.length === 0) lista.push({ chave: 'vazio' });
  return lista;
}

export const QuickMemoryManager: React.FC<QuickMemoryManagerProps> = ({
  streetName,
  isManilhaActive,
  manilhaSubStreet,
  currentDeliveries,
  onAddDelivery,
  onSelectForManualAdd,
  onToast,
}) => {
  const { memoria, atualizar } = useMemoria();
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'todas' | 'na_rota' | 'pendentes'>('todas');
  const [manilhaCategory, setManilhaCategory] = useState<'todas' | 'principais' | 'letras'>('todas');
  const [selectedSubStreet, setSelectedSubStreet] = useState<string>('todas');

  const ruaChaves = useMemo(
    () => (isManilhaActive ? MANILHA_SUB_STREETS.map((s) => chaveTexto(s.name)) : [chaveTexto(streetName)]),
    [isManilhaActive, streetName]
  );
  const allSaved = useMemo(() => destinosDasRuas(memoria, ruaChaves), [memoria, ruaChaves]);

  const filtered = useMemo(() => {
    let list = allSaved;
    if (isManilhaActive) {
      const nomesDe = (tipo: 'principal' | 'letra') => MANILHA_SUB_STREETS.filter((s) => s.type === tipo).map((s) => chaveTexto(s.name));
      if (manilhaCategory === 'principais') list = list.filter((d) => nomesDe('principal').includes(d.ruaChave));
      if (manilhaCategory === 'letras') list = list.filter((d) => nomesDe('letra').includes(d.ruaChave));
      if (selectedSubStreet !== 'todas') list = list.filter((d) => d.ruaChave === chaveTexto(selectedSubStreet));
    }
    const q = chaveTexto(searchFilter);
    if (q) {
      list = list.filter((d) =>
        [d.numeroNome, d.ruaNome, d.contextoNome ?? '', ...d.pessoas.map((p) => p.nome), ...d.unidades.flatMap((u) => [u.rotulo, ...u.pessoas.map((p) => p.nome)])]
          .map(chaveTexto)
          .some((t) => t.includes(q))
      );
    }
    return list;
  }, [allSaved, isManilhaActive, manilhaCategory, selectedSubStreet, searchFilter]);

  const subStreetCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allSaved.forEach((d) => (counts[d.ruaNome] = (counts[d.ruaNome] || 0) + 1));
    return counts;
  }, [allSaved]);

  // Um morador/unidade já está na rota de hoje? (mesmo destino, mesma unidade e mesmo nome)
  const naRota = (d: DestinoConhecido, e: Entrada): boolean =>
    currentDeliveries.some((p) => {
      const end = enderecoDoPacote(p);
      if ((p.destino_id ?? end.destinoId) !== d.id) return false;
      if ((end.unidade?.chave ?? '') !== (e.unidadeChave ?? '')) return false;
      return !e.pessoaChave || chaveTexto(p.nome_destinatario) === e.pessoaChave;
    });

  const { totalInRoute, totalPending } = useMemo(() => {
    let inRoute = 0;
    let pending = 0;
    allSaved.forEach((d) => entradasDoDestino(d).forEach((e) => (naRota(d, e) ? inRoute++ : pending++)));
    return { totalInRoute: inRoute, totalPending: pending };
  }, [allSaved, currentDeliveries]);

  // O que ainda falta adicionar aparece primeiro — é o que o operador veio procurar aqui.
  // Destinos já 100% na rota ficam por último (nada a fazer neles agora).
  const displayed = useMemo(() => {
    const base =
      statusFilter === 'todas'
        ? filtered
        : filtered.filter((d) => {
            const es = entradasDoDestino(d);
            return statusFilter === 'na_rota' ? es.some((e) => naRota(d, e)) : es.some((e) => !naRota(d, e));
          });
    return [...base].sort((a, b) => {
      const aPendente = entradasDoDestino(a).some((e) => !naRota(a, e)) ? 0 : 1;
      const bPendente = entradasDoDestino(b).some((e) => !naRota(b, e)) ? 0 : 1;
      return aPendente - bPendente || compararNumeros(a.numeroChave, b.numeroChave);
    });
  }, [filtered, statusFilter, currentDeliveries]);

  // 1 toque: o operador ESCOLHEU este destino na memória → vínculo explícito (não há ambiguidade a resolver).
  const handleAdd = (d: DestinoConhecido, e: Entrada) => {
    const agora = new Date().toISOString();
    const novo = montarPacote(
      {
        rua: isManilhaActive ? 'Manilha' : streetName,
        subRuaManilha: isManilhaActive ? d.ruaNome : undefined,
        numero: d.numeroNome,
        complemento: textoComplemento(d.contextoNome, e.unidadeRotulo),
        nome: e.nome,
      },
      agora,
      currentDeliveries.map((p) => p.codigo_pacote)
    );
    const r = confirmarDestino(memoria, novo, d.id, agora);
    atualizar(() => r.memoria);
    onAddDelivery(r.pacote);
    try {
      if ('vibrate' in navigator) navigator.vibrate(40);
    } catch (_e) {}
    const local = d.contextoNome ? ` ${d.contextoNome}` : '';
    onToast(`✅ Nº ${d.numeroNome}${local}${e.unidadeRotulo ? ` (${e.unidadeRotulo})` : ''}${e.nome ? ` de ${e.nome}` : ''} adicionado!`);
  };

  const handleForgetPerson = (d: DestinoConhecido, e: Entrada, ev: React.MouseEvent) => {
    ev.stopPropagation();
    if (!e.pessoaChave) return;
    if (window.confirm(`Esquecer "${e.nome}" neste destino? (O histórico de entregas já feitas não é alterado.)`)) {
      atualizar((m) => esquecerPessoa(m, d.id, e.unidadeChave, e.pessoaChave!));
    }
  };

  const handleForgetDestino = (d: DestinoConhecido) => {
    if (window.confirm(`Esquecer o destino Nº ${d.numeroNome}${d.contextoNome ? ` – ${d.contextoNome}` : ''} e tudo o que se sabe sobre ele?`)) {
      atualizar((m) => esquecerDestino(m, d.id));
    }
  };

  const chipBase = 'text-xs font-black px-3 py-1.5 rounded-xl border transition-all cursor-pointer touch-manipulation active:scale-95 shrink-0';

  return (
    <div className="space-y-3">
      {isManilhaActive && (
        <div className="space-y-2 bg-slate-100/90 dark:bg-slate-900/90 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="grid grid-cols-3 gap-1 p-1 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800/80">
            {([['todas', `Todas (${allSaved.length})`], ['principais', 'Meio & Lados'], ['letras', 'Letras (A a K)']] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setManilhaCategory(id);
                  setSelectedSubStreet('todas');
                }}
                className={`h-8 px-2 rounded-lg text-xs font-black flex items-center justify-center gap-1 ${
                  manilhaCategory === id ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {id === 'todas' && <Compass className="w-3.5 h-3.5" />}
                <span>{label}</span>
              </button>
            ))}
          </div>
          {manilhaCategory !== 'todas' && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
              <button
                type="button"
                onClick={() => setSelectedSubStreet('todas')}
                className={`h-7 px-2.5 rounded-lg text-xs font-bold shrink-0 ${
                  selectedSubStreet === 'todas' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {manilhaCategory === 'principais' ? 'Todas Principais' : 'Todas Letras'}
              </button>
              {MANILHA_SUB_STREETS.filter((s) => s.type === (manilhaCategory === 'principais' ? 'principal' : 'letra')).map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setSelectedSubStreet(st.name)}
                  className={`h-7 px-2.5 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1.5 ${
                    selectedSubStreet === st.name ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                  }`}
                  title={`${st.name} (${subStreetCounts[st.name] || 0} destinos salvos)`}
                >
                  <span>{st.type === 'letra' ? st.name.replace(/rua\s*/i, '').toUpperCase() : st.shortLabel}</span>
                  <span className="text-[10px] px-1 rounded-sm bg-slate-100 dark:bg-slate-900/60 font-mono">{subStreetCounts[st.name] || 0}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Fixo no topo do painel rolável: os filtros continuam à mão mesmo com muitas casas salvas. */}
      <div className="space-y-2 sticky -top-1 z-10 bg-slate-900/95 backdrop-blur-md pb-1 pt-0.5">
        {allSaved.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button type="button" onClick={() => setStatusFilter('todas')} className={`${chipBase} ${statusFilter === 'todas' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'}`}>
              Todas ({allSaved.length})
            </button>
            <button type="button" onClick={() => setStatusFilter('na_rota')} className={`${chipBase} flex items-center gap-1 ${statusFilter === 'na_rota' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/60'}`}>
              <Check className="w-3 h-3 stroke-[3]" />
              <span>Na Rota ({totalInRoute})</span>
            </button>
            <button type="button" onClick={() => setStatusFilter('pendentes')} className={`${chipBase} ${statusFilter === 'pendentes' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'}`}>
              + Pendentes ({totalPending})
            </button>
          </div>
        )}

        {allSaved.length > 2 && (
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder={isManilhaActive ? 'Buscar por número, morador, local ou via...' : 'Buscar número, morador ou local salvo...'}
              className="w-full h-10 pl-10 pr-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-500 border border-slate-200 dark:border-slate-800"
            />
          </div>
        )}
      </div>

      {displayed.length === 0 && (
        <div className="bg-white dark:bg-slate-900/80 rounded-2xl p-6 text-center space-y-3 border border-slate-200 dark:border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center mx-auto text-xl border border-amber-200/80 dark:border-amber-800/60">⚡</div>
          <div>
            <h4 className="text-sm font-black text-slate-900 dark:text-white">
              {statusFilter === 'na_rota'
                ? 'Nenhum destino desta rua foi adicionado na rota de hoje ainda.'
                : statusFilter === 'pendentes'
                ? 'Tudo o que está salvo já está na rota de hoje!'
                : isManilhaActive && selectedSubStreet !== 'todas'
                ? `Nada salvo na ${selectedSubStreet} ainda.`
                : 'Nenhum destino memorizado nesta rua ainda.'}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto mt-1 leading-relaxed">
              Ao cadastrar pacotes pela aba <b>"✍️ Digitar Novo"</b>, o destino e os moradores ficam salvos para adicionar com 1 toque.
            </p>
          </div>
          {statusFilter === 'todas' && (
            <button
              type="button"
              onClick={() => onSelectForManualAdd('', '', selectedSubStreet !== 'todas' ? selectedSubStreet : undefined)}
              className="h-10 px-5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Cadastrar Primeiro Número</span>
            </button>
          )}
        </div>
      )}

      {displayed.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {displayed.map((d) => {
            const tipo = tipoDeDestinoConhecido(d);
            const Icone = ICONE[tipo];
            const entradas = entradasDoDestino(d);
            const dentro = entradas.filter((e) => naRota(d, e)).length;
            return (
              <div
                key={d.id}
                data-testid="casa-salva"
                className={`rounded-2xl border p-3 space-y-2.5 bg-white dark:bg-slate-900 ${
                  dentro > 0 && dentro === entradas.length ? 'border-emerald-500/60' : 'border-slate-200/90 dark:border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-8 px-2.5 rounded-xl font-mono font-black text-sm flex items-center gap-1 shrink-0 border bg-emerald-500/15 text-emerald-900 dark:text-emerald-200 border-emerald-400/40">
                      <span className="text-[10px] font-bold opacity-60">Nº</span>
                      <span>{d.numeroNome}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isManilhaActive && <span className="text-[9px] font-black bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded-md truncate max-w-[110px]">{d.ruaNome}</span>}
                        <Icone className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                        <span className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">{d.contextoNome ?? ROTULO[tipo]}</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                        {d.pacotesRegistrados} pacote{d.pacotesRegistrados === 1 ? '' : 's'} já registrado{d.pacotesRegistrados === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {dentro > 0 && <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-md">{dentro}/{entradas.length} rota</span>}
                    <button
                      type="button"
                      onClick={() => onSelectForManualAdd(d.numeroNome, textoComplemento(d.contextoNome), isManilhaActive ? d.ruaNome : undefined)}
                      className="h-7 w-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center border border-slate-200 dark:border-slate-700"
                      title={`Cadastrar novo morador no Nº ${d.numeroNome}`}
                      aria-label="Adicionar morador"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleForgetDestino(d)}
                      className="h-7 w-7 rounded-lg text-slate-400 hover:text-rose-600 flex items-center justify-center"
                      title="Esquecer este destino"
                      aria-label="Esquecer destino"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {entradas.map((e) => {
                    const inRoute = naRota(d, e);
                    return (
                      <div key={e.chave} className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleAdd(d, e)}
                          className={`flex-1 min-h-[50px] p-2.5 rounded-xl border text-left flex items-center justify-between gap-2.5 active:scale-[0.98] touch-manipulation ${
                            inRoute
                              ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-950/40 ring-2 ring-emerald-500/30'
                              : 'border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40'
                          }`}
                          title={inRoute ? 'Já está na rota de hoje. Toque para adicionar outro pacote.' : 'Toque para adicionar à rota de hoje'}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${inRoute ? 'bg-emerald-500 text-white' : 'border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-400'}`}>
                              {inRoute ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Plus className="w-3.5 h-3.5 stroke-[2.5]" />}
                            </div>
                            <div className="min-w-0">
                              <span className="font-black text-xs sm:text-sm block truncate text-slate-900 dark:text-white">{e.nome ?? 'Morador'}</span>
                              {e.unidadeRotulo && <span className="text-[11px] block truncate font-semibold text-slate-500 dark:text-slate-400">{e.unidadeRotulo}</span>}
                            </div>
                          </div>
                          <span className={`text-[10px] font-black shrink-0 px-2 py-1 rounded-lg ${inRoute ? 'bg-emerald-600 text-white' : 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/60'}`}>
                            {inRoute ? 'Na Rota' : '+ Rota'}
                          </span>
                        </button>
                        {e.pessoaChave && (
                          <button
                            type="button"
                            onClick={(ev) => handleForgetPerson(d, e, ev)}
                            className="w-8 h-[50px] flex items-center justify-center text-slate-400 hover:text-rose-600 rounded-xl shrink-0"
                            title="Esquecer este morador"
                            aria-label="Esquecer morador"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
