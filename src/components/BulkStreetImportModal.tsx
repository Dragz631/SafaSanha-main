import React, { useState } from 'react';
import { X, FileText, Check, ListPlus, AlertCircle } from 'lucide-react';
import { UserStreet } from '../types';

interface BulkStreetImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (newStreets: UserStreet[]) => void;
  existingStreetsCount: number;
}

export const BulkStreetImportModal: React.FC<BulkStreetImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  existingStreetsCount,
}) => {
  const [text, setText] = useState('');
  const [defaultNeighborhood, setDefaultNeighborhood] = useState('');

  if (!isOpen) return null;

  const parsedStreets = text
    .split('\n')
    .map((line) => line.trim())
    // Remove bullets, numbers at start (e.g. "1. Rua X", "- Rua Y", "* Rua Z")
    .map((line) => line.replace(/^[\d\.\-\*\•\)\s]+/, '').trim())
    .filter((line) => line.length > 2);

  const handleConfirm = () => {
    if (parsedStreets.length === 0) return;

    const newStreets: UserStreet[] = parsedStreets.map((name, index) => ({
      id: `street_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`,
      name,
      neighborhood: defaultNeighborhood.trim() || undefined,
      order: existingStreetsCount + index + 1,
      isCompleted: false,
      packages: [],
      createdAt: new Date().toISOString(),
    }));

    onImport(newStreets);
    setText('');
    setDefaultNeighborhood('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-5 sm:p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20">
              <ListPlus className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-black text-lg">Colar Lista de Ruas</h3>
              <p className="text-xs text-emerald-100 font-medium">
                Importação rápida em lote (do Zap ou planilha)
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

        {/* Form Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Bairro / Região Padrão (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ex: Centro, Zona Norte, Parque das Nações..."
              value={defaultNeighborhood}
              onChange={(e) => setDefaultNeighborhood(e.target.value)}
              className="w-full px-4 py-2.5 rounded-2xl border border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none text-sm text-slate-900 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center justify-between">
              <span>Cole a Lista de Ruas (uma por linha) *</span>
              {parsedStreets.length > 0 && (
                <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  {parsedStreets.length} {parsedStreets.length === 1 ? 'rua detectada' : 'ruas detectadas'}
                </span>
              )}
            </label>
            <textarea
              rows={6}
              placeholder={`Exemplo:\nRua das Flores\nAv. Brasil\nTravessa Santa Cruz\nRua Dom Pedro II, 400`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none text-sm text-slate-900 bg-white font-mono"
              autoFocus
            />
          </div>

          {parsedStreets.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-xs font-bold uppercase text-slate-500 block">
                Pré-visualização ({parsedStreets.length}):
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {parsedStreets.map((street, i) => (
                  <span
                    key={i}
                    className="text-xs font-bold px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-slate-800 shadow-xs"
                  >
                    📍 {street}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-2xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-200/70 transition-all cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={parsedStreets.length === 0}
            onClick={handleConfirm}
            className="flex-1 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Check className="w-5 h-5" />
            Adicionar {parsedStreets.length > 0 ? `${parsedStreets.length} Ruas` : 'Ruas'}
          </button>
        </div>
      </div>
    </div>
  );
};
