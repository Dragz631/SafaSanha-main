import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  User,
  Users,
  Building2,
  Calendar,
  Code,
  Package,
  Home,
  FileCheck,
  ChevronDown,
  ChevronUp,
  Printer,
  ShieldCheck,
  MapPin,
  Key,
} from 'lucide-react';
import { DeliveryData } from '../types';

interface JsonExportModalProps {
  delivery: DeliveryData | null;
  onClose: () => void;
}

export const JsonExportModal: React.FC<JsonExportModalProps> = ({ delivery, onClose }) => {
  const [copiedJson, setCopiedJson] = useState(false);
  const [showTechnicalJson, setShowTechnicalJson] = useState(false);

  if (!delivery) return null;

  // Format clean JSON object for debug/export
  const jsonObject = {
    id_entrega: delivery.id_entrega,
    codigo_pacote: delivery.codigo_pacote,
    recebedor_tipo: delivery.recebedor_tipo,
    recebedor_detalhes: delivery.recebedor_detalhes,
    foto_pacote_path: delivery.foto_pacote_path,
    foto_local_path: delivery.foto_local_path,
    data_hora: delivery.data_hora,
    status: delivery.status,
    origem_leitura: delivery.origem_leitura || 'auto',
  };

  const jsonString = JSON.stringify(jsonObject, null, 2);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(jsonString);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2200);
  };

  // Format Receiver Type label and icon
  const renderReceiverTypeBadge = () => {
    switch (delivery.recebedor_tipo) {
      case 'proprio_morador':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
            <User className="w-3.5 h-3.5 text-blue-600" />
            Próprio Morador
          </span>
        );
      case 'vizinho':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200">
            <Users className="w-3.5 h-3.5 text-purple-600" />
            Vizinho / Parente
          </span>
        );
      case 'estabelecimento':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <Building2 className="w-3.5 h-3.5 text-amber-600" />
            Estabelecimento / Bar
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <User className="w-3.5 h-3.5 text-slate-500" />
            {delivery.recebedor_tipo || 'Desconhecido'}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg leading-tight text-white flex items-center gap-2">
                Comprovante Digital de Entrega
              </h3>
              <p className="text-xs text-slate-400">Registro oficial de triagem & logística</p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Scrollable */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          
          {/* Top Info Banner: Package Code + Status Badge */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Código de Rastreamento / Pacote
              </span>
              <span className="text-2xl sm:text-3xl font-mono font-black text-slate-900 tracking-wider">
                {delivery.codigo_pacote}
              </span>
            </div>

            <div className="flex flex-col items-end gap-2">
              {delivery.status === 'pendente_baixa' || delivery.status === 'concluido' || delivery.status === 'entregue' || delivery.status === 'processado_jt' || delivery.origem_leitura === 'ocr_ai' || Boolean(delivery.nome_destinatario && (delivery.endereco_completo || delivery.endereco_rua)) ? (
                <div className="bg-emerald-50 border-2 border-emerald-400 text-emerald-900 px-3.5 py-1.5 rounded-2xl flex items-center gap-2 font-bold text-xs sm:text-sm shadow-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>✅ Dados Confirmados via Visão Computacional</span>
                </div>
              ) : (
                <div className="bg-amber-50 border-2 border-amber-300 text-amber-950 px-3.5 py-1.5 rounded-2xl flex items-center gap-2 font-bold text-xs sm:text-sm shadow-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>🟡 Revisão Manual</span>
                </div>
              )}

              {delivery.palavra_chave && (
                <div className="bg-emerald-100 border-2 border-emerald-500 text-emerald-950 px-3.5 py-1.5 rounded-2xl flex items-center gap-2 font-black text-xs sm:text-sm shadow-xs">
                  <Key className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>🔑 PIN Registrado: <strong className="font-mono text-emerald-950">{delivery.palavra_chave}</strong></span>
                </div>
              )}
            </div>
          </div>

          {/* 📍 DADOS DA ETIQUETA (DESTINATÁRIO) - Visão Computacional OCR */}
          <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-md border border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg">
                  <MapPin className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-black uppercase tracking-wider text-blue-400">
                  📍 DADOS DA ETIQUETA (DESTINATÁRIO)
                </h4>
              </div>
              <span className="text-[10px] font-extrabold uppercase bg-blue-600/30 text-blue-300 px-2.5 py-0.5 rounded-full border border-blue-500/30">
                OCR Visão Computacional
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  Destinatário (Impresso na Etiqueta):
                </span>
                <p className="font-extrabold text-white bg-slate-800/90 px-3 py-2.5 rounded-xl border border-slate-700/80">
                  {delivery.nome_destinatario || delivery.recebedor_detalhes || 'Não identificado na etiqueta'}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  Bairro da Entrega:
                </span>
                <p className="font-extrabold text-white bg-slate-800/90 px-3 py-2.5 rounded-xl border border-slate-700/80">
                  {delivery.bairro || 'Não informado'}
                </p>
              </div>

              <div className="sm:col-span-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  Endereço Completo de Entrega (Foto):
                </span>
                <div className="font-extrabold text-emerald-300 bg-slate-800/90 px-3.5 py-2.5 rounded-xl border border-slate-700/80 flex items-center justify-between gap-2">
                  <span>
                    {delivery.endereco_completo || delivery.endereco_rua || (delivery.foto_pacote_path ? 'Endereço registrado na foto da etiqueta' : 'Logradouro a confirmar')}
                    {(delivery.numero_casa || delivery.endereco_numero) ? `, Nº ${delivery.numero_casa || delivery.endereco_numero}` : ''}
                    {(delivery.complemento || delivery.endereco_complemento) ? ` — ${delivery.complemento || delivery.endereco_complemento}` : ''}
                  </span>
                  {delivery.associacao_nome && (
                    <span className="text-[10px] font-extrabold bg-purple-900/80 text-purple-200 px-2 py-0.5 rounded-md border border-purple-700/50 shrink-0">
                      Cerca Virtual: {delivery.associacao_nome}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Side-by-side Photo Gallery */}
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-2.5 flex items-center gap-1.5">
              <span>Evidências Fotográficas do Par (1º Pacote/Etiqueta, 2º Local/Fachada)</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Photo 1: Package / Label Photo */}
              <div className="bg-slate-900 rounded-2xl border border-slate-200 overflow-hidden shadow-xs flex flex-col">
                <div className="bg-slate-800/90 text-white px-3 py-2 text-xs font-bold flex items-center justify-between border-b border-slate-700">
                  <span className="flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-purple-400" />
                    <span>1. Foto do Pacote / Etiqueta</span>
                  </span>
                  <span className="text-[10px] text-purple-300 bg-purple-950 px-2 py-0.5 rounded-md font-mono border border-purple-700/50">
                    Etiqueta / Barcode
                  </span>
                </div>
                <div className="relative aspect-[4/3] bg-slate-950 flex items-center justify-center">
                  <img
                    src={delivery.foto_pacote_path || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80'}
                    alt="Foto do Pacote / Etiqueta"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* Photo 2: Location Photo */}
              <div className="bg-slate-900 rounded-2xl border border-slate-200 overflow-hidden shadow-xs flex flex-col">
                <div className="bg-slate-800/90 text-white px-3 py-2 text-xs font-bold flex items-center justify-between border-b border-slate-700">
                  <span className="flex items-center gap-1.5">
                    <Home className="w-3.5 h-3.5 text-emerald-400" />
                    <span>2. Foto do Local / Fachada / Portaria</span>
                  </span>
                  <span className="text-[10px] text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded-md font-mono border border-emerald-700/50">
                    Fachada / Ponto
                  </span>
                </div>
                <div className="relative aspect-[4/3] bg-slate-950 flex items-center justify-center">
                  <img
                    src={delivery.foto_local_path || 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=600&q=80'}
                    alt="Foto do Local / Fachada / Portaria"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Receiver & Registration Details Block */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3.5 shadow-xs">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2">
              Detalhes do Recebedor & Horário
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Receiver Type & Name */}
              <div className="space-y-2">
                <div>
                  <span className="text-[11px] font-bold text-slate-500 block mb-1">
                    Tipo de Recebedor:
                  </span>
                  {renderReceiverTypeBadge()}
                </div>

                <div>
                  <span className="text-[11px] font-bold text-slate-500 block mb-0.5">
                    Nome / Identificação:
                  </span>
                  <p className="text-sm font-extrabold text-slate-900 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                    {delivery.recebedor_detalhes || 'Não informado'}
                  </p>
                </div>
              </div>

              {/* Timestamp & Reading Origin */}
              <div className="space-y-2">
                <div>
                  <span className="text-[11px] font-bold text-slate-500 block mb-0.5">
                    Data e Hora do Registro:
                  </span>
                  <p className="text-xs font-bold text-slate-800 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>{delivery.data_hora}</span>
                  </p>
                </div>

                <div>
                  <span className="text-[11px] font-bold text-slate-500 block mb-0.5">
                    Origem da Leitura do Código:
                  </span>
                  <p className="text-xs font-medium text-slate-700 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                    {delivery.origem_leitura === 'manual' ? (
                      <span className="font-bold text-amber-800">✍️ Digitação Manual / Ajuste</span>
                    ) : (
                      <span className="font-bold text-emerald-800">📷 Leitura Automática (Visão Computacional)</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Technical JSON Toggle Drawer (Collapsible) */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50">
            <button
              onClick={() => setShowTechnicalJson(!showTechnicalJson)}
              className="w-full px-4 py-2.5 text-xs font-bold text-slate-700 flex items-center justify-between hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Code className="w-4 h-4 text-slate-500" />
                <span>Visualizar Estrutura Técnica (Payload JSON)</span>
              </span>
              {showTechnicalJson ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showTechnicalJson && (
              <div className="p-3 border-t border-slate-200 bg-slate-900 text-emerald-300 font-mono text-[11px] overflow-x-auto">
                <pre className="leading-relaxed">{jsonString}</pre>
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer Actions */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              type="button"
              className="bg-blue-600 hover:bg-blue-700 text-white border border-blue-700 text-xs font-black px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>📄 Gerar PDF de Prova / Imprimir</span>
            </button>

            <button
              onClick={handleCopyJson}
              type="button"
              className="bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-xs flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
            >
              {copiedJson ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700 font-extrabold">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-600" />
                  <span>Copiar JSON</span>
                </>
              )}
            </button>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="bg-slate-800 hover:bg-slate-900 text-white text-xs sm:text-sm font-extrabold px-6 py-2.5 rounded-xl shadow-xs transition-all active:scale-[0.98] cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>

      {/* PRINT-ONLY OFFICIAL PROOF DOCUMENT (Hidden on Screen, Visible on Print / PDF Export) */}
      <div className="hidden print:block print:fixed print:inset-0 print:bg-white print:p-8 print:text-black font-sans">
        <div className="border-4 border-slate-900 p-6 space-y-6">
          
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
            <div>
              <h1 className="text-2xl font-black uppercase tracking-wider">LogiScan — Comprovante Oficial de Entrega</h1>
              <p className="text-xs font-bold text-slate-600">Documento de Prova Anti-Acareação & Auditoria Logística</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono font-bold block">DATA DO COMPROVANTE:</span>
              <span className="text-sm font-black">{delivery.data_hora}</span>
            </div>
          </div>

          {/* Package & Receiver Metadata Box */}
          <div className="grid grid-cols-2 gap-4 border border-slate-400 p-4 bg-slate-50">
            <div>
              <span className="text-[10px] font-bold uppercase block text-slate-600">Código do Pacote / Rastreamento:</span>
              <span className="text-2xl font-mono font-black">{delivery.codigo_pacote}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase block text-slate-600">Status da Entrega:</span>
              <span className="text-base font-extrabold text-emerald-800">
                {delivery.status === 'pendente_baixa' || delivery.status === 'concluido' || delivery.status === 'entregue' || delivery.status === 'processado_jt' || delivery.origem_leitura === 'ocr_ai' || Boolean(delivery.nome_destinatario && (delivery.endereco_completo || delivery.endereco_rua)) ? '100% VALIDADO' : 'EM REVISÃO'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase block text-slate-600">Recebedor Declarado:</span>
              <span className="text-sm font-bold">{delivery.recebedor_detalhes || 'Morador'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase block text-slate-600">Endereço de Entrega:</span>
              <span className="text-sm font-bold">
                {delivery.endereco_rua || delivery.endereco_completo || (delivery.foto_pacote_path ? 'Endereço registrado na foto da etiqueta' : 'Logradouro a confirmar')}{(delivery.endereco_numero || delivery.numero_casa) ? `, ${delivery.endereco_numero || delivery.numero_casa}` : ''}
              </span>
            </div>
          </div>

          {/* Side-by-side HD Evidences */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-2">EVIDÊNCIAS FOTOGRÁFICAS DO PAR DE ENTREGA:</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-slate-400 p-2 text-center">
                <img src={delivery.foto_pacote_path || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80'} alt="Foto Pacote" className="w-full h-64 object-cover mb-2" />
                <span className="text-xs font-bold uppercase block">FOTO 1: Pacote & Etiqueta de Leitura</span>
              </div>
              <div className="border border-slate-400 p-2 text-center">
                <img src={delivery.foto_local_path || 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=600&q=80'} alt="Foto Local" className="w-full h-64 object-cover mb-2" />
                <span className="text-xs font-bold uppercase block">FOTO 2: Fachada / Ponto de Recebimento</span>
              </div>
            </div>
          </div>

          {/* Disclaimer & Official Signature line */}
          <div className="pt-6 border-t-2 border-slate-900 flex justify-between items-end text-xs">
            <div className="max-w-md space-y-1">
              <p className="font-bold">Termos da Contestação:</p>
              <p className="text-[10px] text-slate-600">
                Este documento atesta a conclusão da entrega do volume identificado pelo código {delivery.codigo_pacote}, respaldado por evidência geotagged e registro de imagem do local e pacote.
              </p>
            </div>
            <div className="text-center w-64 border-t border-slate-900 pt-1">
              <span className="text-[10px] font-bold block uppercase">Assinatura / Carimbo do Supervisor</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
