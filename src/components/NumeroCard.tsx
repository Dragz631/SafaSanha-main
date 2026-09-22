import React, { useState } from 'react';
import {
  AlertTriangle,
  Building,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Edit3,
  FileText,
  Home,
  MapPin,
  Star,
  Store,
  Trash2,
} from 'lucide-react';
import { DeliveryData } from '../types';
import type { GrupoDestino, GrupoNumero, PacotePendente } from '../domain/agrupamento';
import type { TipoDestino } from '../domain/destino';
import { statusEntregue } from '../domain/ruas';
import { buildGroupedWhatsAppMessage, copyTextToClipboard } from '../utils/whatsappHelper';

/**
 * Um NÚMERO da rua. Dentro dele ficam os DESTINOS (endereço simples, Loja ABC, Condomínio X…),
 * e dentro de cada destino as UNIDADES (Apto 101, Casa 2…) e os pacotes.
 * O condomínio continua DENTRO da rua/número — nunca vira uma seção separada.
 */
interface NumeroCardProps {
  grupo: GrupoNumero;
  onOpenSingleDeliveryModal: (delivery: DeliveryData, mode?: 'entrega' | 'insucesso') => void;
  onOpenGroupDeliveryModal: (deliveries: DeliveryData[]) => void;
  onEditDelivery: (delivery: DeliveryData) => void;
  onDeleteDelivery: (id: string) => void;
  onConfirmarDestino: (pacote: DeliveryData, destinoId: string) => void;
}

const ICONE: Record<TipoDestino, React.ElementType> = { simples: MapPin, predio: Building, vila: Home, comercio: Store };

function tituloDoDestino(d: GrupoDestino, mostrarSemNome: boolean): string | undefined {
  if (d.contextoNome) return d.contextoNome;
  if (d.tipo === 'predio') return 'Unidades (Apto/Bloco) · local sem nome';
  if (d.tipo === 'vila') return 'Casas no mesmo número';
  return mostrarSemNome ? 'Endereço sem local informado' : undefined;
}

const LinhaPacote: React.FC<{
  pacote: DeliveryData;
  grande?: boolean;
  mostrarComplemento?: boolean;
  onOpenSingle: NumeroCardProps['onOpenSingleDeliveryModal'];
  onEdit: NumeroCardProps['onEditDelivery'];
  onDelete: NumeroCardProps['onDeleteDelivery'];
}> = ({ pacote, grande, mostrarComplemento = true, onOpenSingle, onEdit, onDelete }) => {
  const entregue = statusEntregue(pacote);
  const insucesso = pacote.status === 'insucesso';
  const codigo = pacote.codigo_pacote.startsWith('#') ? pacote.codigo_pacote : `#${pacote.codigo_pacote}`;
  const nome = pacote.nome_destinatario || 'Morador';
  const comp = pacote.complemento || pacote.endereco_complemento || '';

  return (
    <div
      className={`rounded-xl border p-2.5 space-y-2 ${
        entregue ? 'border-emerald-500/40 bg-slate-900/90' : insucesso ? 'border-rose-500/40 bg-slate-900/90' : 'border-slate-800 bg-slate-900'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-black text-sm text-slate-100 truncate">{nome}</span>
            {mostrarComplemento && comp && (
              <span className="text-[10px] font-bold text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded-md border border-slate-700">{comp}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <span className="text-[10px] font-mono font-bold text-sky-300 bg-sky-950/60 px-1.5 py-0.5 rounded-md border border-sky-800/50">{codigo}</span>
            {entregue ? (
              <span className="text-[10px] font-bold text-emerald-300 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Entregue ({pacote.recebedor_detalhes || 'Morador'})
              </span>
            ) : insucesso ? (
              <span className="text-[10px] font-bold text-rose-300 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Insucesso: {pacote.motivo_insucesso || 'Ausente'}
              </span>
            ) : (
              <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Pendente
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => onEdit(pacote)}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800"
            title="Corrigir endereço / nome / código"
            aria-label="Corrigir"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(pacote.id_entrega)}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-950/40"
            title="Excluir pacote"
            aria-label="Excluir"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onOpenSingle(pacote, insucesso ? 'insucesso' : 'entrega')}
          className={`flex-1 ${grande ? 'h-12 text-sm' : 'h-9 text-xs'} px-3 rounded-xl font-black flex items-center justify-center gap-1.5 active:scale-[0.98] touch-manipulation ${
            entregue
              ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30'
              : insucesso
              ? 'bg-rose-600 hover:bg-rose-500 text-white'
              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
          }`}
        >
          {entregue ? <FileText className="w-4 h-4" /> : insucesso ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{entregue ? 'Ver Registro / Copiar' : insucesso ? 'Insucesso' : grande ? 'Entregar Pacote (+2 🪙)' : 'Entregar'}</span>
        </button>
        {!entregue && !insucesso && (
          <button
            type="button"
            onClick={() => onOpenSingle(pacote, 'insucesso')}
            className={`${grande ? 'h-12 w-12' : 'h-9 w-9'} bg-slate-800 hover:bg-rose-950/40 text-rose-400 border border-slate-700 rounded-xl flex items-center justify-center shrink-0`}
            title="Registrar insucesso"
            aria-label="Registrar insucesso"
          >
            <AlertTriangle className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

const BlocoPendente: React.FC<{
  pendente: PacotePendente;
  onOpenSingle: NumeroCardProps['onOpenSingleDeliveryModal'];
  onEdit: NumeroCardProps['onEditDelivery'];
  onDelete: NumeroCardProps['onDeleteDelivery'];
  onConfirmarDestino: NumeroCardProps['onConfirmarDestino'];
}> = ({ pendente, onOpenSingle, onEdit, onDelete, onConfirmarDestino }) => {
  const ids = new Set(pendente.candidatos.map((c) => c.id));
  return (
    <div className="rounded-xl border border-amber-500/50 bg-amber-950/20 p-2.5 space-y-2" data-testid="pendente-confirmacao">
      <div className="flex items-center gap-1.5 text-[11px] font-black text-amber-300">
        <AlertTriangle className="w-3.5 h-3.5" />
        <span>{pendente.motivo === 'sugestao' ? 'Confirmar destino (já conheço este número)' : 'Confirmar destino (mais de um local neste número)'}</span>
      </div>
      <LinhaPacote pacote={pendente.pacote} onOpenSingle={onOpenSingle} onEdit={onEdit} onDelete={onDelete} />
      <p className="text-[11px] text-slate-300 leading-snug">
        {pendente.motivo === 'sugestao'
          ? 'Este pacote é para o local abaixo? Nada é vinculado até você confirmar.'
          : 'Não sei a qual destes locais pertence. Escolha (nada é vinculado sozinho) ou corrija o endereço.'}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {pendente.candidatos.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onConfirmarDestino(pendente.pacote, c.id)}
            className="h-9 px-3 rounded-xl bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-100 border border-slate-700 text-xs font-black"
          >
            É {c.contextoNome ?? 'o endereço sem local informado'}
          </button>
        ))}
        {!ids.has(pendente.novoDestinoId) && (
          <button
            type="button"
            onClick={() => onConfirmarDestino(pendente.pacote, pendente.novoDestinoId)}
            className="h-9 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold"
          >
            É outro endereço (sem local)
          </button>
        )}
        <button
          type="button"
          onClick={() => onEdit(pendente.pacote)}
          className="h-9 px-3 rounded-xl bg-amber-500/20 text-amber-200 border border-amber-500/40 text-xs font-bold"
        >
          Corrigir endereço
        </button>
      </div>
    </div>
  );
};

export const NumeroCard: React.FC<NumeroCardProps> = ({
  grupo,
  onOpenSingleDeliveryModal,
  onOpenGroupDeliveryModal,
  onEditDelivery,
  onDeleteDelivery,
  onConfirmarDestino,
}) => {
  const [copiado, setCopiado] = useState<string | null>(null);
  const todos = [...grupo.destinos.flatMap((d) => d.pacotes), ...grupo.pendentes.map((p) => p.pacote)];
  const pendentesEntrega = todos.filter((p) => !statusEntregue(p) && p.status !== 'insucesso').length;
  const mostrarSemNome = grupo.destinos.length > 1 || grupo.pendentes.length > 0;
  const solo = grupo.destinos.length === 1 && grupo.pendentes.length === 0 && grupo.destinos[0].pacotes.length === 1;

  const copiar = async (destino: GrupoDestino) => {
    const ok = await copyTextToClipboard(buildGroupedWhatsAppMessage(destino.pacotes));
    if (ok) {
      setCopiado(destino.id);
      setTimeout(() => setCopiado(null), 2000);
    }
  };

  const linha = (p: DeliveryData, opts: { grande?: boolean; mostrarComplemento?: boolean } = {}) => (
    <LinhaPacote
      key={p.id_entrega}
      pacote={p}
      grande={opts.grande}
      mostrarComplemento={opts.mostrarComplemento}
      onOpenSingle={onOpenSingleDeliveryModal}
      onEdit={onEditDelivery}
      onDelete={onDeleteDelivery}
    />
  );

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 shadow-sm overflow-hidden" data-testid={`numero-${grupo.numeroChave}`}>
      <div className="p-3 bg-slate-950 flex items-center gap-3 border-b border-slate-800">
        <div className="min-w-[3rem] h-12 px-2 rounded-xl bg-slate-900 text-amber-300 border border-slate-700/80 flex flex-col items-center justify-center font-black font-mono">
          <span className="text-[8px] uppercase tracking-tighter opacity-70 leading-none">Nº</span>
          <span className="text-lg leading-none mt-0.5">{grupo.numeroNome}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-black text-slate-100">
            {grupo.totalPacotes} {grupo.totalPacotes === 1 ? 'pacote' : 'pacotes'}
            <span className="text-slate-400 font-bold"> • {pendentesEntrega} pendente{pendentesEntrega === 1 ? '' : 's'}</span>
          </div>
          {grupo.destinos.length > 1 && (
            <div className="text-[11px] font-bold text-amber-300">{grupo.destinos.length} locais diferentes neste número</div>
          )}
          {grupo.destinos.length === 1 && grupo.destinos[0].conhecidoDeAntes && (
            <div className="text-[10px] font-black text-emerald-300 flex items-center gap-0.5" data-testid="destino-conhecido">
              <Star className="w-2.5 h-2.5" /> DESTINO CONHECIDO
            </div>
          )}
        </div>
      </div>

      <div className="p-2.5 space-y-2.5">
        {grupo.destinos.map((d) => {
          const Icone = ICONE[d.tipo];
          const titulo = tituloDoDestino(d, mostrarSemNome);
          const pendDestino = d.pacotes.filter((p) => !statusEntregue(p) && p.status !== 'insucesso').length;
          const podeEntregarJuntos = d.pacotes.length > 1 && d.tipo !== 'vila';

          if (solo) return <div key={d.id}>{linha(d.pacotes[0], { grande: true })}</div>;

          return (
            <section key={d.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5 space-y-2" data-testid="destino">
              {(titulo || podeEntregarJuntos) && (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                    <Icone className="w-4 h-4 text-sky-300 shrink-0" />
                    {titulo && <span className="text-xs font-black text-slate-100 truncate">{titulo}</span>}
                    {d.conhecidoDeAntes && grupo.destinos.length > 1 && (
                      <span className="text-[9px] font-black text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                        <Star className="w-2.5 h-2.5" /> DESTINO CONHECIDO
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => copiar(d)}
                      className="h-8 w-8 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center"
                      title="Copiar texto consolidado"
                      aria-label="Copiar texto consolidado"
                    >
                      {copiado === d.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    {podeEntregarJuntos && (
                      <button
                        type="button"
                        onClick={() => onOpenGroupDeliveryModal(d.pacotes)}
                        className="h-8 px-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-black"
                      >
                        {pendDestino > 0 ? `Entregar todos juntos (${pendDestino})` : 'Ver registro do grupo'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {d.unidades.map((u) => (
                <div key={u.chave} className="space-y-1.5" data-testid="unidade">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-sky-500/15 text-sky-200 font-black text-xs border border-sky-500/30">{u.rotulo}</span>
                    {u.pacotes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onOpenGroupDeliveryModal(u.pacotes)}
                        className="h-7 px-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-[11px] font-bold"
                      >
                        Entregar {u.pacotes.length} desta unidade
                      </button>
                    )}
                  </div>
                  {u.pacotes.map((p) => linha(p, { mostrarComplemento: false }))}
                </div>
              ))}

              {d.semUnidade.length > 0 && d.unidades.length > 0 && (
                <div className="space-y-1.5" data-testid="sem-unidade">
                  <div className="text-[11px] font-black text-amber-300 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Sem unidade informada — confirme com o morador
                  </div>
                  {d.semUnidade.map((p) => linha(p))}
                </div>
              )}

              {d.unidades.length === 0 && d.pacotes.map((p) => linha(p))}
            </section>
          );
        })}

        {grupo.pendentes.map((pend) => (
          <BlocoPendente
            key={pend.pacote.id_entrega}
            pendente={pend}
            onOpenSingle={onOpenSingleDeliveryModal}
            onEdit={onEditDelivery}
            onDelete={onDeleteDelivery}
            onConfirmarDestino={onConfirmarDestino}
          />
        ))}
      </div>
    </div>
  );
};
