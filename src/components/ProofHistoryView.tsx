import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Search,
  Printer,
  FileCheck,
  Package,
  Home,
  User,
  Users,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  Sparkles,
  ShieldCheck,
  List,
  LayoutGrid,
  ChevronRight,
  Filter,
  Key,
} from 'lucide-react';
import { DeliveryData } from '../types';

interface ProofHistoryViewProps {
  deliveries: DeliveryData[];
  onSelectDeliveryForReceipt: (delivery: DeliveryData) => void;
}

export const ProofHistoryView: React.FC<ProofHistoryViewProps> = ({
  deliveries,
  onSelectDeliveryForReceipt,
}) => {
  // Get Today's Date String YYYY-MM-DD
  const todayStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // Selected date filter (Default to today '2026-07-24' or current day string)
  const [selectedDate, setSelectedDate] = useState<string>('2026-07-24');
  const [showAllDates, setShowAllDates] = useState<boolean>(false);

  // Search filter for Emergency Anti-Contestation (Anti-Acareação)
  const [searchQuery, setSearchQuery] = useState<string>('');

  // View Mode: 'list' vs 'grid'. Automatically set based on whether selectedDate === todayStr or default date
  const [manualViewMode, setManualViewMode] = useState<'list' | 'grid' | null>(null);

  // Determine if selected date is TODAY
  const isToday = selectedDate === '2026-07-24' || selectedDate === todayStr;

  // Active View Mode (defaults to 'list' for TODAY, and 'grid' for PAST DAYS)
  const activeViewMode = manualViewMode ? manualViewMode : isToday ? 'list' : 'grid';

  // Filter deliveries by Search Query OR Date
  const filteredDeliveries = useMemo(() => {
    let list = [...deliveries];

    // Search query override: if searching, search across ALL history regardless of date filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return list.filter((d) => {
        const codeMatch = d.codigo_pacote.toLowerCase().includes(q);
        const receiverMatch = (d.recebedor_detalhes || '').toLowerCase().includes(q);
        const recipientMatch = (d.nome_destinatario || '').toLowerCase().includes(q);
        const streetMatch = (d.endereco_completo || d.endereco_rua || '').toLowerCase().includes(q);
        const bairroMatch = (d.bairro || '').toLowerCase().includes(q);
        const assocMatch = (d.associacao_nome || '').toLowerCase().includes(q);
        return codeMatch || receiverMatch || recipientMatch || streetMatch || bairroMatch || assocMatch;
      });
    }

    // Otherwise filter by selected date if not "showAllDates"
    if (!showAllDates && selectedDate) {
      list = list.filter((d) => {
        // data_hora format is "YYYY-MM-DD HH:MM:SS"
        const datePart = d.data_hora.split(' ')[0];
        return datePart === selectedDate;
      });
    }

    return list;
  }, [deliveries, searchQuery, selectedDate, showAllDates]);

  // Handle Quick Print PDF
  const handlePrintProof = (delivery: DeliveryData) => {
    onSelectDeliveryForReceipt(delivery);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  // Helper for Receiver Badge
  const getReceiverBadge = (type: string) => {
    switch (type) {
      case 'proprio_morador':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
            <User className="w-3 h-3 text-blue-600" />
            Morador
          </span>
        );
      case 'vizinho':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
            <Users className="w-3 h-3 text-purple-600" />
            Vizinho
          </span>
        );
      case 'estabelecimento':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <Building2 className="w-3 h-3 text-amber-600" />
            Comércio / Bar
          </span>
        );
      case 'associacao':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
            <ShieldCheck className="w-3 h-3 text-indigo-600" />
            Associação
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            {type}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      
      {/* Banner Title */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white rounded-3xl p-5 sm:p-7 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <ShieldCheck className="w-64 h-64 text-white" />
        </div>

        <div className="relative z-10 max-w-3xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>PASSO 3 — Histórico & Prova Anti-Acareação</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Arquivo de Entregas e Comprovantes em HD
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
            Pesquisa emergencial de pacotes contestados por clientes ou transportadora, suporte a impressões de acareação e alternância inteligente de layout.
          </p>
        </div>
      </div>

      {/* Emergency Search Bar (Anti-Acareação) */}
      <div className="bg-amber-500/10 border-2 border-amber-400/80 rounded-3xl p-4 sm:p-5 bg-white shadow-md space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500 text-slate-950 rounded-xl font-bold shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base text-slate-900 uppercase tracking-wide">
                Módulo de Busca de Emergência (Anti-Acareação)
              </h3>
              <p className="text-xs text-slate-600 font-medium">
                Digite o código ou cliente para isolar a prova e contestar alegações de não entrega.
              </p>
            </div>
          </div>

          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer"
            >
              Limpar busca
            </button>
          )}
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-5 h-5 text-amber-600" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por Código do Pacote (JT...), Nome do Cliente ou Rua..."
            className="w-full bg-slate-50 border-2 border-amber-300 focus:border-amber-500 focus:bg-white text-slate-900 text-xs sm:text-sm font-bold pl-11 pr-4 py-3 rounded-2xl outline-hidden transition-all shadow-inner placeholder:font-normal placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Date & Layout Control Bar */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        
        {/* Date Selector & Presets */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-blue-600 shrink-0" />
            <span className="text-xs font-black uppercase text-slate-700 tracking-wide">Data Operacional:</span>
          </div>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setShowAllDates(false);
              setManualViewMode(null); // Reset manual view mode on date change
            }}
            disabled={showAllDates}
            className="bg-slate-100 border border-slate-300 font-bold text-xs text-slate-900 px-3 py-2 rounded-xl focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setSelectedDate('2026-07-24');
                setShowAllDates(false);
                setManualViewMode(null);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                !showAllDates && selectedDate === '2026-07-24'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Hoje (24/07)
            </button>

            <button
              onClick={() => {
                setSelectedDate('2026-07-23');
                setShowAllDates(false);
                setManualViewMode(null);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                !showAllDates && selectedDate === '2026-07-23'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Ontem (23/07)
            </button>

            <button
              onClick={() => setShowAllDates(!showAllDates)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                showAllDates
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {showAllDates ? 'Exibindo Todos os Dias' : 'Ver Todos os Dias'}
            </button>
          </div>
        </div>

        {/* View Mode Toggle Button */}
        <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold">
          <span className="px-2 text-[11px] text-slate-500 font-extrabold uppercase tracking-wider hidden sm:inline">
            Modo:
          </span>
          <button
            onClick={() => setManualViewMode('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
              activeViewMode === 'list'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Visualização em Lista (Ideal para Acompanhamento do Dia)"
          >
            <List className="w-4 h-4" />
            <span>Lista {isToday && !manualViewMode && '(Padrão Hoje)'}</span>
          </button>

          <button
            onClick={() => setManualViewMode('grid')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
              activeViewMode === 'grid'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Visualização em Cards / Grid (Arquivo Visual de Fotos)"
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Cards / Grid {!isToday && !manualViewMode && '(Padrão Arquivo)'}</span>
          </button>
        </div>

      </div>

      {/* Results Header Info Bar */}
      <div className="flex items-center justify-between px-2 text-xs font-bold text-slate-600">
        <p className="flex items-center gap-2">
          <span>
            Exibindo <strong className="text-slate-900 font-black">{filteredDeliveries.length}</strong> registro(s)
          </span>
          {searchQuery && (
            <span className="bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full text-[11px]">
              Filtro ativo: "{searchQuery}"
            </span>
          )}
          {!searchQuery && (
            <span className="bg-blue-50 text-blue-800 px-2.5 py-0.5 rounded-full text-[11px]">
              {showAllDates ? 'Todo o histórico' : `Data: ${selectedDate}`}
            </span>
          )}
        </p>

        <span className="text-slate-400 font-normal hidden sm:inline">
          {activeViewMode === 'list' ? '📋 Layout Lista Compacta' : '🖼️ Layout Galeria de Cards HD'}
        </span>
      </div>

      {/* No Deliveries Found Empty State */}
      {filteredDeliveries.length === 0 && (
        <div className="bg-white border-2 border-dashed border-slate-300 rounded-3xl p-10 text-center space-y-3">
          <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
            <Filter className="w-6 h-6" />
          </div>
          <h3 className="font-extrabold text-base text-slate-800">Nenhum pacote encontrado</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Não encontramos nenhuma prova de entrega para os critérios selecionados ({searchQuery ? `termo "${searchQuery}"` : `data ${selectedDate}`}).
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setShowAllDates(true);
            }}
            className="mt-2 bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs hover:bg-blue-700 transition-colors cursor-pointer"
          >
            Exibir Todo o Histórico
          </button>
        </div>
      )}

      {/* VIEW MODE 1: LIST LAYOUT (Optimized for Today's Active Tracking) */}
      {activeViewMode === 'list' && filteredDeliveries.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white font-extrabold border-b border-slate-800">
                  <th className="py-3.5 px-4 uppercase tracking-wider text-[11px]">Código Pacote</th>
                  <th className="py-3.5 px-4 uppercase tracking-wider text-[11px]">Fotos (Par Evidência)</th>
                  <th className="py-3.5 px-4 uppercase tracking-wider text-[11px]">Recebedor & Endereço</th>
                  <th className="py-3.5 px-4 uppercase tracking-wider text-[11px]">Data / Hora</th>
                  <th className="py-3.5 px-4 uppercase tracking-wider text-[11px]">Status</th>
                  <th className="py-3.5 px-4 uppercase tracking-wider text-[11px] text-right">Ação / Prova</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                {filteredDeliveries.map((delivery) => (
                  <tr key={delivery.id_entrega} className="hover:bg-slate-50/80 transition-colors">
                    
                    {/* Package Code */}
                    <td className="py-3 px-4 font-mono font-black text-slate-900 text-sm">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>{delivery.codigo_pacote}</span>
                      </div>
                      {delivery.associacao_nome && (
                        <span className="block mt-0.5 text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200 w-max">
                          {delivery.associacao_nome}
                        </span>
                      )}
                    </td>

                    {/* Pair Photos Micro Thumbnails */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 h-12 rounded-lg bg-slate-900 overflow-hidden border border-slate-200 shrink-0">
                          <img
                            src={delivery.foto_pacote_path || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80'}
                            alt="Pacote"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="w-12 h-12 rounded-lg bg-slate-900 overflow-hidden border border-slate-200 shrink-0">
                          <img
                            src={delivery.foto_local_path || 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=600&q=80'}
                            alt="Local"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                    </td>

                    {/* Receiver & Address */}
                    <td className="py-3 px-4 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {getReceiverBadge(delivery.recebedor_tipo)}
                        {delivery.palavra_chave && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-950 border border-emerald-400">
                            <Key className="w-3 h-3 text-emerald-700" />
                            🔑 PIN: {delivery.palavra_chave}
                          </span>
                        )}
                      </div>
                      <p className="font-extrabold text-slate-900 text-xs">
                        {delivery.recebedor_detalhes || 'Sem nome'}
                      </p>
                      {delivery.endereco_rua && (
                        <p className="text-[11px] text-slate-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>
                            {delivery.endereco_rua}
                            {delivery.endereco_numero ? `, ${delivery.endereco_numero}` : ''}
                          </span>
                        </p>
                      )}
                    </td>

                    {/* Timestamp */}
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      <span className="font-bold flex items-center gap-1.5 text-xs text-slate-800">
                        <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        {delivery.data_hora}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {delivery.status === 'aguardando_rua' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                          🟡 Aguardando Rua
                        </span>
                      )}
                      {(delivery.status === 'entregue' || delivery.status === 'concluido' || delivery.status === 'processado_jt' || delivery.status === 'pendente_baixa') && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          {delivery.status === 'entregue' ? 'Entregue na Rua' : delivery.status === 'processado_jt' ? 'Bipado J&T' : 'Concluído'}
                        </span>
                      )}
                      {delivery.status === 'aguardando_pin' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-300">
                          🔑 Requer PIN
                        </span>
                      )}
                      {delivery.status === 'insucesso' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-300">
                          ❌ Insucesso
                        </span>
                      )}
                      {delivery.status === 'em_revisao' && (
                        delivery.origem_leitura === 'ocr_ai' || Boolean(delivery.nome_destinatario || delivery.endereco_rua || delivery.endereco_completo) ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            100% Validado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            Revisão
                          </span>
                        )
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                      <button
                        onClick={() => onSelectDeliveryForReceipt(delivery)}
                        className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-extrabold px-3 py-1.5 rounded-xl border border-slate-300 transition-colors cursor-pointer"
                        title="Ver Comprovante Digital Completo"
                      >
                        <FileCheck className="w-3.5 h-3.5 text-blue-600" />
                        <span>Ver PDF</span>
                      </button>

                      <button
                        onClick={() => handlePrintProof(delivery)}
                        className="inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold px-3 py-1.5 rounded-xl shadow-xs transition-colors cursor-pointer"
                        title="Imprimir Comprovante de Entrega para Acareação"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Imprimir</span>
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW MODE 2: CARDS / GRID LAYOUT (Visual Archive for Past Days) */}
      {activeViewMode === 'grid' && filteredDeliveries.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredDeliveries.map((delivery) => (
            <div
              key={delivery.id_entrega}
              className="bg-white border-2 border-slate-200 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              {/* Card Header */}
              <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">
                    Código do Pacote
                  </span>
                  <span className="text-lg font-mono font-black text-white tracking-wider flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-400 shrink-0" />
                    {delivery.codigo_pacote}
                  </span>
                </div>

                <div>
                  {delivery.status === 'pendente_baixa' || delivery.status === 'concluido' || delivery.status === 'entregue' || delivery.status === 'processado_jt' || delivery.origem_leitura === 'ocr_ai' || Boolean(delivery.nome_destinatario || delivery.endereco_rua || delivery.endereco_completo) ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ✅ Dados Confirmados via Visão Computacional
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      Em Revisão
                    </span>
                  )}
                </div>
              </div>

              {/* Side-by-Side HD Photos Pair */}
              <div className="p-3 bg-slate-950 grid grid-cols-2 gap-2 border-b border-slate-800">
                <div className="space-y-1">
                  <div className="aspect-[4/3] rounded-xl overflow-hidden bg-slate-900 border border-slate-700 relative">
                    <img
                      src={delivery.foto_pacote_path || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80'}
                      alt="Pacote"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-1.5 left-1.5 bg-slate-950/80 backdrop-blur-md text-white text-[9px] font-bold px-2 py-0.5 rounded-md">
                      Etiqueta
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="aspect-[4/3] rounded-xl overflow-hidden bg-slate-900 border border-slate-700 relative">
                    <img
                      src={delivery.foto_local_path || 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=600&q=80'}
                      alt="Local"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-1.5 left-1.5 bg-slate-950/80 backdrop-blur-md text-white text-[9px] font-bold px-2 py-0.5 rounded-md">
                      Local / Fachada
                    </span>
                  </div>
                </div>
              </div>

              {/* Delivery Details Body */}
              <div className="p-4 space-y-3 flex-1 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Recebedor:</span>
                    <div className="mt-0.5">{getReceiverBadge(delivery.recebedor_tipo)}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Horário:</span>
                    <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-blue-600" />
                      {delivery.data_hora}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Identificação do Recebedor:</span>
                    {delivery.palavra_chave && (
                      <span className="text-[10px] font-black bg-emerald-100 text-emerald-950 px-2 py-0.5 rounded-md border border-emerald-400 inline-flex items-center gap-1">
                        <Key className="w-3 h-3 text-emerald-700" />
                        🔑 PIN Registrado: {delivery.palavra_chave}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-black text-slate-900 bg-slate-50 p-2 rounded-xl border border-slate-200">
                    {delivery.recebedor_detalhes || 'Morador local'}
                  </p>
                </div>

                {delivery.endereco_rua && (
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Endereço de Entrega:</span>
                    <p className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>
                        {delivery.endereco_rua}
                        {delivery.endereco_numero ? `, ${delivery.endereco_numero}` : ''}
                        {delivery.endereco_complemento ? ` (${delivery.endereco_complemento})` : ''}
                      </span>
                    </p>
                  </div>
                )}

                {delivery.associacao_nome && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-2.5 text-xs text-indigo-900">
                    <span className="font-extrabold block text-[11px] text-indigo-700 uppercase">
                      📍 Associação Cerca Virtual:
                    </span>
                    <span className="font-bold">{delivery.associacao_nome}</span>
                  </div>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="bg-slate-50 p-3 border-t border-slate-200 flex items-center justify-between gap-2">
                <button
                  onClick={() => onSelectDeliveryForReceipt(delivery)}
                  className="w-full bg-white hover:bg-slate-100 text-slate-900 text-xs font-black py-2.5 px-3 rounded-xl border border-slate-300 shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <FileCheck className="w-4 h-4 text-blue-600" />
                  <span>Gerar PDF Comprovante</span>
                </button>

                <button
                  onClick={() => handlePrintProof(delivery)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-black py-2.5 px-4 rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir</span>
                </button>
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
};
