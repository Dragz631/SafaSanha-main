import React, { useState } from 'react';
import { X, Layers, Plus, Sparkles, Check, AlertCircle, Trash2, Edit2, Tag } from 'lucide-react';
import { DeliveryData } from '../types';

interface QuickBatchAddModalProps {
  isOpen: boolean;
  activeStreet: string;
  onClose: () => void;
  onAddBatch: (deliveries: DeliveryData[]) => void;
}

export const QuickBatchAddModal: React.FC<QuickBatchAddModalProps> = ({
  isOpen,
  activeStreet,
  onClose,
  onAddBatch,
}) => {
  const [textInput, setTextInput] = useState('');
  const [defaultBatchComplement, setDefaultBatchComplement] = useState('');
  const [previewItems, setPreviewItems] = useState<Array<{ number: string; name?: string; complement?: string }>>([]);

  // Parser inteligente de linhas de lote
  const parseBatchText = (text: string, defaultComp: string) => {
    const lines = text.split(/[\n,;]+/).map(l => l.trim()).filter(Boolean);
    const parsed: Array<{ number: string; name?: string; complement?: string }> = [];

    lines.forEach(line => {
      let working = line;
      let complement = defaultComp.trim();

      // 1. Verifica se há parênteses: Ex: "563 (Apto 302) Diego" ou "785 (Bloco B)"
      const compMatchParens = working.match(/\((.*?)\)/);
      if (compMatchParens) {
        complement = compMatchParens[1].trim();
        working = working.replace(/\(.*?\)/, '').trim();
      }

      // 2. Extrai termos chave de complemento sem parênteses: Ex: "563 Apto 302 Diego", "48 Casa 2 Rafael", "785 Bloco B"
      if (!compMatchParens) {
        const compKeywordMatch = working.match(/\b(?:apto|apartamento|bloco|casa|fundos|sobrado|loja|sala|sl|quadra|qd|lote|lt)\s*[\d\w\-\/]+/i);
        if (compKeywordMatch) {
          complement = compKeywordMatch[0].trim();
          working = working.replace(compKeywordMatch[0], '').trim();
        }
      }

      // 3. Extrai o número da casa e o nome do morador restante
      const match = working.match(/^(?:casa\s*)?(\d+[A-Za-z]?)\s*[-:\/]?\s*(.*)$/i);
      if (match) {
        const num = match[1];
        const rest = match[2]?.trim() || '';

        parsed.push({
          number: num,
          name: rest || undefined,
          complement: complement || undefined,
        });
      } else if (working.length > 0) {
        // Se for só número ou texto
        const onlyNum = working.replace(/[^\d]/g, '');
        parsed.push({
          number: onlyNum || working,
          name: isNaN(Number(working)) ? working : undefined,
          complement: complement || undefined,
        });
      }
    });

    return parsed;
  };

  const handleTextChange = (text: string) => {
    setTextInput(text);
    setPreviewItems(parseBatchText(text, defaultBatchComplement));
  };

  const handleDefaultComplementChange = (comp: string) => {
    setDefaultBatchComplement(comp);
    setPreviewItems(parseBatchText(textInput, comp));
  };

  const handleUpdateItemComplement = (index: number, newComp: string) => {
    setPreviewItems(prev => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], complement: newComp.trim() || undefined };
      }
      return next;
    });
  };

  const handleRemoveItem = (index: number) => {
    setPreviewItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleConfirm = () => {
    if (previewItems.length === 0) return;

    const baseTime = Date.now();
    const created: DeliveryData[] = previewItems.map((item, idx) => {
      const code = `#${String(1000 + ((baseTime + idx) % 9000))}`;
      const houseNum = item.number || 'S/N';
      const client = item.name || 'Morador';

      return {
        id_entrega: `del_${baseTime}_${idx}`,
        codigo_pacote: code,
        nome_destinatario: client,
        recebedor_detalhes: client,
        recebedor_tipo: 'proprio_morador',
        endereco_rua: activeStreet,
        numero_casa: houseNum,
        endereco_numero: houseNum,
        complemento: item.complement,
        endereco_completo: `${activeStreet}, ${houseNum}${item.complement ? ` (${item.complement})` : ''}`,
        foto_pacote_path: '',
        foto_local_path: '',
        data_hora: new Date(baseTime + idx * 1000).toISOString(),
        status: 'aguardando_rua',
        origem_leitura: 'manual',
      };
    });

    onAddBatch(created);
    setTextInput('');
    setDefaultBatchComplement('');
    setPreviewItems([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 flex flex-col max-h-[92vh] pb-safe">
        
        {/* Cabeçalho */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-black text-sm text-white">
                Cadastro em Lote (Com Complemento)
              </h2>
              <p className="text-[11px] text-amber-400 font-bold">{activeStreet}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="p-4 space-y-3.5 overflow-y-auto flex-1">
          {/* Caixa de Ajuda / Instruções Rápidas */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-900 space-y-1.5">
            <p className="font-extrabold flex items-center gap-1.5">
              <span>⚡ Como colocar o complemento em lote:</span>
            </p>
            <p className="text-amber-800 leading-relaxed text-[11px]">
              Digite direto na linha junto com o número (com ou sem parênteses). O aplicativo separa tudo sozinho:
            </p>
            <div className="bg-white/90 p-2 rounded-xl border border-amber-200 font-mono text-[11px] text-slate-700 select-all leading-relaxed">
              563 Apto 302 Diego, 785 Bloco B Rafael, 48 Casa 2 Kely, 311 Fundos, 41 Sobrado
            </div>
          </div>

          {/* Complemento Padrão Opcional para Todo o Lote (ex: Prédio / Bloco) */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-amber-600" />
                <span>Complemento Fixo para Todo o Lote (Opcional):</span>
              </label>
              {defaultBatchComplement && (
                <button
                  type="button"
                  onClick={() => handleDefaultComplementChange('')}
                  className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                >
                  Limpar
                </button>
              )}
            </div>
            
            <input
              type="text"
              value={defaultBatchComplement}
              onChange={(e) => handleDefaultComplementChange(e.target.value)}
              placeholder="Ex: Bloco B, Portaria, Apto..."
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500"
            />

            {/* Chips de Atalho para o Complemento do Lote */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-0.5">
              {['Apto ', 'Bloco A', 'Bloco B', 'Bloco C', 'Casa 2', 'Fundos', 'Sobrado', 'Loja '].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleDefaultComplementChange(chip)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer shrink-0 ${
                    defaultBatchComplement.toLowerCase().includes(chip.trim().toLowerCase())
                      ? 'bg-amber-400 text-slate-950 shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {chip.trim()}
                </button>
              ))}
            </div>
          </div>

          {/* Área de Texto Principal para Digitar / Colar */}
          <div>
            <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block mb-1.5">
              Digite ou cole os pacotes (números, complementos e moradores):
            </label>
            <textarea
              rows={4}
              value={textInput}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="Exemplo:&#10;563 Apto 302 Diego&#10;785 Bloco B Rafael&#10;48 Casa 2 Kely&#10;32, 41, 311 Fundos"
              className="w-full p-3 bg-slate-50 border-2 border-slate-300 focus:border-amber-500 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none placeholder-slate-400 leading-relaxed font-mono"
              autoFocus
            />
          </div>

          {/* Preview dos Pacotes Identificados */}
          {previewItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                  📦 Pacotes reconhecidos ({previewItems.length}):
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  Clique no complemento para editar
                </span>
              </div>
              <div className="max-h-48 overflow-y-auto bg-slate-50 rounded-2xl p-2 border border-slate-200 space-y-1.5">
                {previewItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-lg bg-emerald-100 text-emerald-800 font-black flex items-center justify-center text-[10px] shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-black text-slate-900 shrink-0">
                        Nº {item.number}
                      </span>
                      {item.name && (
                        <span className="text-slate-600 text-[11px] truncate">
                          • {item.name}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Campo editável de complemento por item */}
                      <input
                        type="text"
                        value={item.complement || ''}
                        onChange={(e) => handleUpdateItemComplement(idx, e.target.value)}
                        placeholder="+Compl"
                        className="w-20 sm:w-24 px-2 py-0.5 text-[10px] font-extrabold bg-slate-100 hover:bg-slate-200 focus:bg-white text-slate-800 border border-slate-200 rounded-lg text-center focus:outline-none focus:ring-1 focus:ring-amber-500"
                        title="Editar complemento deste pacote"
                      />

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                        title="Remover pacote"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold text-xs rounded-xl cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={previewItems.length === 0}
            className={`flex-2 py-3 font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              previewItems.length > 0
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/30'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar {previewItems.length} Pacotes</span>
          </button>
        </div>

      </div>
    </div>
  );
};
