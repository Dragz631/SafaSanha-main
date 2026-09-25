/**
 * Painel da ponte com o LogiScan HUB.
 * - Sem perfil ativo: "Quem está usando este aparelho?" (perfis vêm do HUB).
 * - Com perfil: buscar/aceitar a carga DESTE perfil, enviar entregas/insucessos ao HUB, trocar de perfil.
 * O arquivo continua disponível como fallback. Só exibe e chama handlers — regras em src/domain/cargaHub.ts.
 */
import React, { useRef, useState } from 'react';
import { Download, FileJson, LogOut, RefreshCw, Send, Upload, UserRound, Warehouse } from 'lucide-react';
import type { DeliveryData } from '../types';
import type { AjudanteHub, DocumentoCarga, ItemSaida } from '../domain/cargaHub';
import { ruaRealDoPacote, statusEntregue } from '../domain/ruas';
import { chaveTexto } from '../domain/texto';

interface Props {
  deliveries: DeliveryData[];
  ajudante: AjudanteHub | null;
  saida: ItemSaida[];
  aviso: { tipo: 'ok' | 'erro'; texto: string } | null;
  /** Perfis vindos do HUB (null = HUB fora do ar / ainda não consultado). */
  perfis: AjudanteHub[] | null;
  /** Perfis com coisas guardadas neste aparelho. */
  guardados: AjudanteHub[];
  urlHub: string;
  cargaOferecida: { doc: DocumentoCarga; novos: number; retirados: number } | null;
  onEscolherPerfil: (a: AjudanteHub) => void;
  onBuscarCarga: () => void;
  onAceitarCarga: () => void;
  onCarregarArquivo: (arquivo: File) => void;
  onEnviarAoHub: (modo?: 'hub' | 'arquivo') => void;
  onEncerrarSessao: () => void;
  onRecarregarPerfis: () => void;
  onMudarUrlHub: (url: string) => void;
}

const botao = 'flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-black disabled:opacity-40';

export const PainelHub: React.FC<Props> = (p) => {
  const input = useRef<HTMLInputElement>(null);
  const [editandoUrl, setEditandoUrl] = useState(false);
  const [url, setUrl] = useState(p.urlHub);
  const { ajudante } = p;
  const daCarga = ajudante ? p.deliveries.filter((d) => d.hub?.ajudante_id === ajudante.id) : [];
  const cargas = Array.from(new Set(daCarga.map((d) => d.hub!.carga_codigo)));
  const entregues = daCarga.filter(statusEntregue).length;
  const insucessos = daCarga.filter((d) => d.status === 'insucesso').length;
  // agrupa por rua sem diferenciar maiúscula/acento ("Rua Carlos seidl" = "Rua Carlos Seidl")
  const porRua = new Map<string, { nome: string; n: number }>();
  daCarga
    .filter((d) => !statusEntregue(d) && d.status !== 'insucesso')
    .forEach((d) => {
      const nome = ruaRealDoPacote(d);
      const k = chaveTexto(nome);
      porRua.set(k, { nome: porRua.get(k)?.nome ?? nome, n: (porRua.get(k)?.n ?? 0) + 1 });
    });
  const aEnviar = p.saida.filter((e) => !e.exportado_em).length;
  // perfis para escolher: os do HUB + os que têm coisas guardadas aqui (mesmo com o HUB fora do ar)
  const opcoes = [...(p.perfis ?? [])];
  p.guardados.forEach((g) => !opcoes.some((o) => o.id === g.id) && opcoes.push(g));

  return (
    <section className="mt-2 mb-1 rounded-2xl border border-sky-500/30 bg-sky-500/5 p-3 text-xs" aria-label="Carga do LogiScan HUB">
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        className="hidden"
        data-testid="arquivo-carga"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) p.onCarregarArquivo(f);
          e.target.value = '';
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Warehouse className="w-4 h-4 text-sky-300 shrink-0" />
        <span className="font-black text-sky-200 uppercase tracking-tight">LogiScan HUB</span>
        {ajudante ? (
          <span className="flex items-center gap-1 text-slate-300">
            <UserRound className="w-3.5 h-3.5" /> perfil <b className="text-white">{ajudante.nome}</b>
          </span>
        ) : (
          <span className="text-slate-500">nenhum perfil ativo</span>
        )}
        <button
          type="button"
          onClick={() => setEditandoUrl(!editandoUrl)}
          className="ml-auto text-[10px] text-slate-500 underline decoration-dotted"
          title="Endereço do HUB na rede local"
        >
          {p.urlHub.replace(/^https?:\/\//, '')}
        </button>
      </div>

      {editandoUrl && (
        <form
          className="mt-2 flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            p.onMudarUrlHub(url);
            setEditandoUrl(false);
          }}
        >
          <input value={url} onChange={(e) => setUrl(e.target.value)} className="flex-1 rounded-lg bg-slate-900 border border-slate-700 px-2 py-1" />
          <button type="submit" className={`${botao} bg-slate-700 text-white`}>Salvar</button>
        </form>
      )}

      {!ajudante && (
        <div className="mt-2">
          <div className="text-slate-300 font-bold mb-1.5">Quem está usando este aparelho?</div>
          <div className="flex flex-wrap gap-1.5">
            {opcoes.map((o) => (
              <button key={o.id} type="button" onClick={() => p.onEscolherPerfil(o)} className={`${botao} border border-sky-500/50 text-sky-100`}>
                <UserRound className="w-3.5 h-3.5" /> {o.nome}
                {p.guardados.some((g) => g.id === o.id) && <span className="text-[9px] text-amber-300">(tem carga guardada)</span>}
              </button>
            ))}
            <button type="button" onClick={p.onRecarregarPerfis} className={`${botao} text-slate-400`} title="Buscar perfis no HUB">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="mt-1 text-slate-500">
            {p.perfis === null ? 'HUB fora do ar: ' : 'Sem perfil, o Street funciona no modo livre. '}
            <button type="button" className="underline" onClick={() => input.current?.click()}>carregar arquivo de carga</button>
          </div>
        </div>
      )}

      {ajudante && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button type="button" onClick={p.onBuscarCarga} className={`${botao} bg-sky-500 text-slate-950`}>
            <RefreshCw className="w-3.5 h-3.5" /> Buscar carga do HUB
          </button>
          <button
            type="button"
            onClick={() => p.onEnviarAoHub('hub')}
            disabled={p.saida.length === 0}
            className={`${botao} border border-emerald-400/50 text-emerald-300`}
          >
            <Send className="w-3.5 h-3.5" /> Enviar ao HUB{aEnviar > 0 ? ` (${aEnviar})` : ''}
          </button>
          <button type="button" onClick={() => input.current?.click()} className={`${botao} border border-slate-600 text-slate-300`} title="Fallback: carregar arquivo">
            <Upload className="w-3.5 h-3.5" /> <FileJson className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => p.onEnviarAoHub('arquivo')}
            disabled={p.saida.length === 0}
            className={`${botao} border border-slate-600 text-slate-300`}
            title="Fallback: gerar arquivo de retorno"
          >
            <Download className="w-3.5 h-3.5" /> <FileJson className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={p.onEncerrarSessao} title="Trocar de perfil (nada é apagado)" className={`${botao} ml-auto border border-slate-600 text-slate-300`}>
            <LogOut className="w-3.5 h-3.5" /> Trocar perfil
          </button>
        </div>
      )}

      {ajudante && p.cargaOferecida && (
        <div className="mt-2 rounded-xl border border-amber-400/50 bg-amber-400/10 p-2.5">
          <div className="font-black text-amber-200">
            {cargas.includes(p.cargaOferecida.doc.carga.codigo) ? 'Carga atualizada no HUB' : 'Nova carga do HUB'} para{' '}
            {p.cargaOferecida.doc.ajudante.nome}: {p.cargaOferecida.doc.carga.codigo}
          </div>
          <div className="text-amber-100/80">
            {p.cargaOferecida.doc.pacotes.length} pacote(s) · {p.cargaOferecida.novos} novo(s) neste aparelho
            {p.cargaOferecida.retirados > 0 && ` · ${p.cargaOferecida.retirados} saíram da carga`}
            {p.cargaOferecida.doc.carga.situacao === 'MONTADA' && ' · rota ainda não iniciada'}
          </div>
          <button type="button" onClick={p.onAceitarCarga} className={`${botao} mt-1.5 bg-amber-400 text-slate-950`}>
            Carregar no perfil de {p.cargaOferecida.doc.ajudante.nome}
          </button>
        </div>
      )}

      {daCarga.length > 0 && (
        <div className="mt-2 text-slate-300">
          <b>{cargas.join(', ')}</b> · {daCarga.length} pacote(s) · <span className="text-emerald-300">{entregues} entregue(s)</span>
          {insucessos > 0 && <span className="text-rose-300"> · {insucessos} insucesso(s)</span>}
          {porRua.size > 0 && (
            <span className="text-slate-400">
              {' '}· faltam: {Array.from(porRua.values(), (r) => `${r.nome} (${r.n})`).join(', ')}
            </span>
          )}
        </div>
      )}
      {p.saida.length > 0 && (
        <div className="mt-1 text-slate-400">
          {aEnviar > 0 ? `${aEnviar} acontecimento(s) ainda não enviado(s) ao HUB.` : 'Tudo já foi enviado ao HUB (reenviar é seguro).'}
        </div>
      )}
      {p.aviso && (
        <div role="status" className={`mt-2 rounded-lg px-2 py-1.5 font-bold ${p.aviso.tipo === 'ok' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
          {p.aviso.texto}
        </div>
      )}
    </section>
  );
};
