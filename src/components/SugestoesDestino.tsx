import React, { useMemo } from 'react';
import { Star } from 'lucide-react';
import { candidatosNoNumero } from '../domain/memoria';
import { interpretarComplemento, interpretarNumero, textoComplemento } from '../domain/endereco';
import { chaveTexto } from '../domain/texto';
import { useMemoria } from '../state/MemoriaContext';

interface SugestoesDestinoProps {
  /** Rua real (na Manilha, a sub-rua selecionada). */
  rua: string;
  numero: string;
  complemento: string;
  onEscolher: (dados: { complemento: string; nome?: string }) => void;
}

/**
 * Ao digitar o número, mostra os destinos JÁ CONHECIDOS naquele número. É só sugestão:
 * tocar preenche os campos; nada é vinculado até o operador adicionar o pacote.
 * Se houver mais de um destino, todos aparecem — o sistema não escolhe por ele.
 */
export const SugestoesDestino: React.FC<SugestoesDestinoProps> = ({ rua, numero, complemento, onEscolher }) => {
  const { memoria } = useMemoria();
  const candidatos = useMemo(() => {
    if (!numero.trim()) return [];
    return candidatosNoNumero(memoria, chaveTexto(rua), interpretarNumero(numero).chave);
  }, [memoria, rua, numero]);

  if (candidatos.length === 0) return null;

  const contextoAtual = interpretarComplemento(complemento).contexto?.chave ?? '';
  const selecionado = candidatos.find((c) => c.contextoChave === contextoAtual);
  const expandido = selecionado ?? (candidatos.length === 1 ? candidatos[0] : undefined);

  return (
    <div className="rounded-xl bg-slate-950/70 border border-emerald-500/30 p-2 space-y-1.5" data-testid="sugestoes-destino">
      <div className="text-[10px] font-black text-emerald-300 uppercase tracking-wider flex items-center gap-1">
        <Star className="w-3 h-3" />
        {candidatos.length === 1 ? 'Destino conhecido neste número' : `${candidatos.length} destinos conhecidos neste número`}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {candidatos.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onEscolher({ complemento: c.contextoNome ?? '' })}
            className={`h-8 px-2.5 rounded-lg text-[11px] font-black border ${
              selecionado?.id === c.id ? 'bg-emerald-500 text-slate-950 border-emerald-500' : 'bg-slate-800 text-slate-200 border-slate-700'
            }`}
          >
            {c.contextoNome ?? 'Endereço simples (sem local)'}
          </button>
        ))}
      </div>
      {expandido && (expandido.unidades.length > 0 || expandido.pessoas.length > 0) && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {expandido.unidades.flatMap((u) =>
            (u.pessoas.length > 0 ? u.pessoas : [undefined]).map((p) => (
              <button
                key={`${u.chave}-${p?.chave ?? 'x'}`}
                type="button"
                onClick={() => onEscolher({ complemento: textoComplemento(expandido.contextoNome, u.rotulo), nome: p?.nome })}
                className="h-8 px-2.5 rounded-lg text-[11px] font-bold bg-slate-800 text-slate-100 border border-slate-700"
              >
                {u.rotulo}
                {p ? ` · ${p.nome}` : ''}
              </button>
            ))
          )}
          {expandido.pessoas.map((p) => (
            <button
              key={p.chave}
              type="button"
              onClick={() => onEscolher({ complemento: expandido.contextoNome ?? '', nome: p.nome })}
              className="h-8 px-2.5 rounded-lg text-[11px] font-bold bg-slate-800 text-slate-100 border border-slate-700"
            >
              {p.nome}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
