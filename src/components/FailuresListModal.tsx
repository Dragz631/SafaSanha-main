import React from 'react';
import { X, AlertTriangle, RotateCcw, MapPin, Home, User, Send, CheckCircle2 } from 'lucide-react';
import { UserProfile, UserStreet, StreetPackage } from '../types';
import { openWhatsApp } from '../lib/userStorage';

interface FailureItem {
  streetId: string;
  streetName: string;
  pkg: StreetPackage;
}

interface FailuresListModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  streets: UserStreet[];
  onResetPackage: (streetId: string, pkgId: string) => void;
}

export const FailuresListModal: React.FC<FailuresListModalProps> = ({
  isOpen,
  onClose,
  user,
  streets,
  onResetPackage,
}) => {
  if (!isOpen) return null;

  const failures: FailureItem[] = [];
  streets.forEach((s) => {
    s.packages
      .filter((p) => p.status === 'failed')
      .forEach((p) => {
        failures.push({
          streetId: s.id,
          streetName: s.name,
          pkg: p,
        });
      });
  });

  const handleSendFailureZap = (item: FailureItem) => {
    const text = [
      `⚠️ *LOGISTAN [EXPEDITO] - INSUCESSO DE ENTREGA*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `👤 *Entregador:* ${user.name}`,
      `📍 *Rua:* ${item.streetName}`,
      `🏠 *Nº:* ${item.pkg.houseNumber}${item.pkg.complement ? ` (${item.pkg.complement})` : ''}`,
      item.pkg.recipientName ? `👤 *Morador:* ${item.pkg.recipientName}` : '',
      `❌ *Motivo:* ${item.pkg.failureReason || 'Morador Ausente'}`,
      item.pkg.code ? `🔢 *Código:* ${item.pkg.code}` : '',
      `⏰ *Horário:* ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ]
      .filter(Boolean)
      .join('\n');

    openWhatsApp(text);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-rose-700 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-black text-lg">Insucessos / Falhas ({failures.length})</h3>
              <p className="text-xs text-red-100 font-medium">
                Ruas e motivos das entregas não realizadas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
          {failures.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="font-black text-slate-900 text-base">Nenhum insucesso registrado!</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Todas as tentativas foram entregues com sucesso ou estão aguardando entrega.
              </p>
            </div>
          ) : (
            failures.map((item, index) => {
              const compl = item.pkg.complement ? ` (${item.pkg.complement})` : '';
              return (
                <div
                  key={`${item.streetId}_${item.pkg.id}_${index}`}
                  className="p-4 rounded-2xl bg-red-50/70 border border-red-200 space-y-2.5 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-red-900">
                        <MapPin className="w-3.5 h-3.5 text-red-600 shrink-0" />
                        <span className="truncate">{item.streetName}</span>
                      </div>
                      <h4 className="font-black text-slate-900 text-sm">
                        Nº {item.pkg.houseNumber}{compl} - {item.pkg.recipientName || 'Morador'}
                      </h4>
                    </div>

                    <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-red-200 text-red-900 shrink-0">
                      {item.pkg.failureReason || 'Ausente'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-red-200/60 text-xs">
                    <button
                      onClick={() => onResetPackage(item.streetId, item.pkg.id)}
                      className="flex items-center gap-1 text-slate-600 hover:text-slate-900 font-bold hover:underline cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Tentar Novamente (Reabrir)</span>
                    </button>

                    <button
                      onClick={() => handleSendFailureZap(item)}
                      className="flex items-center gap-1 px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] shadow-2xs cursor-pointer"
                    >
                      <Send className="w-3 h-3" />
                      <span>Mandar no Zap</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
