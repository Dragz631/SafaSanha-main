/**
 * Painel da ponte com o LogiScan HUB: carregar a carga do ajudante e devolver as entregas.
 * Só exibe e chama os handlers — as regras vivem em src/domain/cargaHub.ts.
 */
import React, { useRef } from 'react';
import { Download, Upload, Warehouse } from 'lucide-react';
import type { DeliveryData } from '../types';
import type { AjudanteHub, ItemSaida } from '../domain/cargaHub';
import { ruaRealDoPacote, statusEntregue } from '../domain/ruas';

interface Props {
  deliveries: DeliveryData[];
  ajudante: AjudanteHub | null;
  saida: ItemSaida[];
  aviso: { tipo: 'ok' | 'erro'; texto: string } | null;
  onCarregarCarga: (arquivo: File) => void;
  onEnviarAoHub: () => void;
}

export const PainelHub: React.FC<Props> = ({ deliveries, ajudante, saida, aviso, onCarregarCarga, onEnviarAoHub }) => {
  const input = useRef<HTMLInputElement>(null);
  const daCarga = deliveries.filter((d) => d.hub && (!ajudante || d.hub.ajudante_id === ajudante.id));
  const cargas = Array.from(new Set(daCarga.map((d) => d.hub!.carga_codigo)));
  const entregues = daCarga.filter(statusEntregue).length;
  const porRua = new Map<string, number>();
  daCarga.filter((d) => !statusEntregue(d)).forEach((d) => porRua.set(ruaRealDoPacote(d), (porRua.get(ruaRealDoPacote(d)) ?? 0) + 1));
  const aEnviar = saida.filter((e) => !e.exportado_em).length;

  return (
    <section className="mt-2 mb-1 rounded-2xl border border-sky-500/30 bg-sky-500/5 p-3 text-xs" aria-label="Carga do LogiScan HUB">
      <div className="flex flex-wrap items-center gap-2">
        <Warehouse className="w-4 h-4 text-sky-300 shrink-0" />
        <span className="font-black text-sky-200 uppercase tracking-tight">Carga do HUB</span>
        {ajudante && <span className="text-slate-400">aparelho de <b className="text-slate-200">{ajudante.nome}</b></span>}
        <div className="ml-auto flex gap-1.5">
          <input
            ref={input}
            type="file"
            accept=".json,application/json"
            className="hidden"
            data-testid="arquivo-carga"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onCarregarCarga(f);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex items-center gap-1 rounded-lg bg-sky-500 px-2.5 py-1.5 font-black text-slate-950"
          >
            <Upload className="w-3.5 h-3.5" /> Carregar carga
          </button>
          <button
            type="button"
            onClick={onEnviarAoHub}
            disabled={saida.length === 0}
            className="flex items-center gap-1 rounded-lg border border-emerald-400/50 px-2.5 py-1.5 font-black text-emerald-300 disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" /> Enviar ao HUB{aEnviar > 0 ? ` (${aEnviar})` : ''}
          </button>
        </div>
      </div>

      {daCarga.length > 0 && (
        <div className="mt-2 text-slate-300">
          <b>{cargas.join(', ')}</b> · {daCarga.length} pacote(s) · <span className="text-emerald-300">{entregues} entregue(s)</span>
          {porRua.size > 0 && (
            <span className="text-slate-400">
              {' '}· faltam: {Array.from(porRua, ([rua, n]) => `${rua} (${n})`).join(', ')}
            </span>
          )}
        </div>
      )}
      {saida.length > 0 && (
        <div className="mt-1 text-slate-400">
          {aEnviar > 0 ? `${aEnviar} entrega(s) ainda não enviada(s) ao HUB.` : 'Tudo já foi enviado ao HUB (reenviar é seguro).'}
        </div>
      )}
      {aviso && (
        <div role="status" className={`mt-2 rounded-lg px-2 py-1.5 font-bold ${aviso.tipo === 'ok' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
          {aviso.texto}
        </div>
      )}
    </section>
  );
};
