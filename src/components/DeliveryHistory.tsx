import React, { useState } from 'react';
import { ClipboardList, Code, Trash2, Download, CheckCircle2, AlertTriangle, Eye, Search } from 'lucide-react';
import { DeliveryData } from '../types';

interface DeliveryHistoryProps {
  deliveries: DeliveryData[];
  onDeleteDelivery: (id: string) => void;
  onSelectDeliveryForJson: (delivery: DeliveryData) => void;
}

export const DeliveryHistory: React.FC<DeliveryHistoryProps> = ({
  deliveries,
  onDeleteDelivery,
  onSelectDeliveryForJson,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredDeliveries = deliveries.filter((d) => {
    const matchesSearch =
      d.codigo_pacote.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.recebedor_detalhes.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleDownloadAllJson = () => {
    const dataStr = JSON.stringify(deliveries, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `entregas_logiscan_${new Date().toISOString().substring(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Top Banner & Stats */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-blue-600" />
            <span>Fila de Entregas & Triagem</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Histórico local das coletas registradas no Módulo do Entregador
          </p>
        </div>

        {deliveries.length > 0 && (
          <button
            onClick={handleDownloadAllJson}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-2 transition-all active:scale-[0.98]"
          >
            <Download className="w-4 h-4 text-blue-100" />
            <span>Exportar Lote JSON</span>
          </button>
        )}
      </div>

      {/* Filter and Search controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100 p-3 rounded-2xl border border-slate-200">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por código (JT123...) ou recebedor..."
            className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Status Filter buttons */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs overflow-x-auto max-w-full">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 rounded-lg font-bold transition-colors whitespace-nowrap ${
              statusFilter === 'all' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todos ({deliveries.length})
          </button>
          <button
            onClick={() => setStatusFilter('aguardando_rua')}
            className={`px-3 py-1 rounded-lg font-bold transition-colors whitespace-nowrap ${
              statusFilter === 'aguardando_rua' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Aguardando Rua
          </button>
          <button
            onClick={() => setStatusFilter('entregue')}
            className={`px-3 py-1 rounded-lg font-bold transition-colors whitespace-nowrap ${
              statusFilter === 'entregue' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Entregue (Rua)
          </button>
          <button
            onClick={() => setStatusFilter('processado_jt')}
            className={`px-3 py-1 rounded-lg font-bold transition-colors whitespace-nowrap ${
              statusFilter === 'processado_jt' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Bipado J&T
          </button>
          <button
            onClick={() => setStatusFilter('concluido')}
            className={`px-3 py-1 rounded-lg font-bold transition-colors whitespace-nowrap ${
              statusFilter === 'concluido' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Concluído
          </button>
        </div>
      </div>

      {/* Deliveries List */}
      {filteredDeliveries.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center text-slate-400 space-y-3 shadow-xs">
          <ClipboardList className="w-12 h-12 mx-auto text-slate-300" />
          <p className="font-bold text-slate-600 text-base">Nenhuma entrega encontrada</p>
          <p className="text-xs max-w-sm mx-auto text-slate-500">
            Utilize a aba <strong className="text-blue-600">Coleta (Mobile)</strong> para registrar pares de fotos de pacotes e locais.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDeliveries.map((delivery) => (
            <div
              key={delivery.id_entrega}
              className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              {/* Thumbnails */}
              <div className="flex items-center gap-3">
                <div className="flex -space-x-4">
                  <img
                    src={delivery.foto_pacote_path || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80'}
                    alt="Pacote"
                    className="w-14 h-14 rounded-xl object-cover border-2 border-white shadow-xs ring-1 ring-slate-200"
                    title="Foto do Pacote"
                  />
                  <img
                    src={delivery.foto_local_path || 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=600&q=80'}
                    alt="Local"
                    className="w-14 h-14 rounded-xl object-cover border-2 border-white shadow-xs ring-1 ring-slate-200"
                    title="Foto do Local"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-base text-slate-900 tracking-wider">
                      {delivery.codigo_pacote}
                    </span>
                    {delivery.status === 'aguardando_rua' && (
                      <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        🟡 Aguardando Rua
                      </span>
                    )}
                    {delivery.status === 'entregue' && (
                      <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        🔵 Entregue na Rua
                      </span>
                    )}
                    {delivery.status === 'processado_jt' && (
                      <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        🟣 Bipado J&T
                      </span>
                    )}
                    {delivery.status === 'concluido' && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Concluído
                      </span>
                    )}
                    {delivery.status === 'aguardando_pin' && (
                      <span className="text-[10px] bg-indigo-100 text-indigo-900 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        🔑 Requer PIN
                      </span>
                    )}
                    {delivery.status === 'insucesso' && (
                      <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        ❌ Insucesso
                      </span>
                    )}
                    {delivery.status === 'pendente_baixa' && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Pendente Baixa
                      </span>
                    )}
                  </div>

                  <p className="text-xs font-semibold text-slate-700">
                    Recebedor: <span className="font-normal text-slate-600">{delivery.recebedor_detalhes}</span>
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Data/Hora: {delivery.data_hora}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                <button
                  onClick={() => onSelectDeliveryForJson(delivery)}
                  className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold px-3.5 py-2 rounded-xl border border-blue-200 flex items-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
                >
                  <Eye className="w-4 h-4 text-blue-600" />
                  <span>Ver Comprovante</span>
                </button>

                <button
                  onClick={() => onDeleteDelivery(delivery.id_entrega)}
                  className="bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 p-2 rounded-xl border border-slate-200 transition-colors"
                  title="Excluir item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
