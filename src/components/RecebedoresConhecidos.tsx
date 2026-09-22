import React from 'react';

/**
 * Recebedores que já receberam neste DESTINO. Só sugere: tocar preenche o campo,
 * mas o registro da entrega guarda quem o operador confirmar que recebeu agora.
 */
export const RecebedoresConhecidos: React.FC<{
  nomes: string[];
  atual: string;
  onEscolher: (nome: string) => void;
}> = ({ nomes, atual, onEscolher }) => {
  if (nomes.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 pb-1" data-testid="recebedores-conhecidos">
      <span className="text-[10px] font-black text-amber-700 dark:text-amber-300">Conhecidos neste destino:</span>
      {nomes.map((nome) => (
        <button
          key={nome}
          type="button"
          onClick={() => onEscolher(nome)}
          className={`h-8 px-2.5 rounded-lg text-xs font-black border ${
            atual.trim().toLowerCase() === nome.toLowerCase()
              ? 'bg-amber-500 text-slate-950 border-amber-500'
              : 'bg-white dark:bg-slate-800 text-amber-950 dark:text-amber-200 border-amber-300 dark:border-amber-700/60'
          }`}
        >
          {nome}
        </button>
      ))}
    </div>
  );
};
