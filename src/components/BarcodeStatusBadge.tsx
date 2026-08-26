import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, Sparkles, Edit3, RefreshCw } from 'lucide-react';

interface BarcodeStatusBadgeProps {
  code: string;
  success: boolean | null;
  scanning: boolean;
  onCodeChange: (newCode: string) => void;
  onRetryScan: () => void;
}

export const BarcodeStatusBadge: React.FC<BarcodeStatusBadgeProps> = ({
  code,
  success,
  scanning,
  onCodeChange,
  onRetryScan,
}) => {
  const [isEditing, setIsEditing] = useState(false);

  if (scanning) {
    return (
      <div className="bg-slate-100 border border-slate-200 rounded-xl p-3.5 flex items-center justify-center gap-2.5 text-slate-700 animate-pulse">
        <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
        <span className="font-semibold text-sm">Analisando foto com visão computacional...</span>
      </div>
    );
  }

  if (success === true && code) {
    return (
      <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-4 shadow-xs text-emerald-950">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Código Lido com Sucesso
              </p>
              <p className="text-2xl font-mono font-extrabold text-emerald-800 tracking-wider my-0.5">
                🟢 {code}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="text-xs bg-emerald-200/80 hover:bg-emerald-200 text-emerald-900 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-colors"
            title="Corrigir ou editar código"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Editar</span>
          </button>
        </div>

        {isEditing && (
          <div className="mt-3 pt-3 border-t border-emerald-200">
            <label className="block text-xs font-bold text-emerald-900 mb-1">
              Ajustar código do pacote:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={code}
                onChange={(e) => onCodeChange(e.target.value.toUpperCase())}
                className="flex-1 bg-white border border-emerald-300 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Ex: JT123456789"
              />
              <button
                onClick={() => setIsEditing(false)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all"
              >
                Salvar
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (success === false) {
    return (
      <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 shadow-xs text-amber-950">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-sm text-amber-900">
              ⚠️ Leitura Automática Não Concluída
            </h4>
            <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
              A foto pode estar desfocada, escura ou com reflexo. Digite o código manualmente abaixo ou tente re-escanear.
            </p>

            <div className="mt-3 space-y-2.5">
              <div>
                <label className="block text-xs font-bold text-amber-900 mb-1">
                  Código de Barras / Rastreio (Manual):
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => onCodeChange(e.target.value.toUpperCase())}
                  placeholder="Ex: JT123456789"
                  className="w-full bg-white border border-amber-300 rounded-xl px-3.5 py-2.5 text-base font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:font-normal placeholder:text-slate-400"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  onClick={onRetryScan}
                  type="button"
                  className="bg-amber-200/80 hover:bg-amber-200 text-amber-950 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Re-analisar Imagem</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
