/**
 * Painel da ponte com o LogiScan HUB.
 * - Sem perfil ativo: "Quem está usando este aparelho?" (perfis vêm do HUB).
 * - Com perfil: buscar/aceitar a carga DESTE perfil, enviar entregas/insucessos ao HUB, trocar de perfil.
 * O arquivo continua disponível como fallback. Só exibe e chama handlers — regras em src/domain/cargaHub.ts.
 */
import React, { useRef, useState } from 'react';
import { Download, FileJson, LogOut, RefreshCw, Send, Upload, UserRound, Warehouse } from 'lucide-react';
import type { DeliveryData } from '../types';
import { ehAdmin, type DadosNovaConta, type PapelConta } from '../domain/conta';
import { LoginHub, type RetornoLogin } from './LoginHub';
import type { AjudanteHub, DocumentoCarga, ItemSaida, RuaEmRevisao } from '../domain/cargaHub';
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
  /** Login/criação de conta (a conta vive no HUB; o Hugo aprova). */
  onEntrar: (usuario: string, pin: string) => Promise<RetornoLogin>;
  onCriarConta: (dados: DadosNovaConta) => Promise<RetornoLogin>;
  /** Papel da conta logada (null = perfil sem conta). */
  papel: PapelConta | null;
  onBuscarCarga: () => void;
  onAceitarCarga: () => void;
  onCarregarArquivo: (arquivo: File) => void;
  onEnviarAoHub: (modo?: 'hub' | 'arquivo') => void;
  onEncerrarSessao: () => void;
  onRecarregarPerfis: () => void;
  onMudarUrlHub: (url: string) => void;
  /** Ruas/regiões da carga que o Street não reconheceu (NOVA RUA / CONHECIMENTO NÃO RECONHECIDO). */
  revisaoRuas: RuaEmRevisao[];
  /** Cards existentes onde dá para encaixar. */
  cardsParaEncaixe: string[];
  onEncaixarRua: (chave: string, card: string) => void;
  onCriarCardRua: (chave: string, nome: string) => void;
  onCriarCardRegiao: (regiao: string) => void;
  /** Faixa "Repasse do X para Y" (rota repassada na hora pelo HUB). */
  repasse: { chave: string; texto: string } | null;
  onDispensarRepasse: () => void;
}

/** Uma rua não reconhecida: encaixar num card que já existe ou criar o card — só por decisão da pessoa. */
const LinhaRevisao: React.FC<{
  r: RuaEmRevisao;
  cards: string[];
  onEncaixar: (card: string) => void;
  onCriarRua: () => void;
  onCriarRegiao: () => void;
}> = ({ r, cards, onEncaixar, onCriarRua, onCriarRegiao }) => {
  const [card, setCard] = useState('');
  return (
    <li className="rounded-lg border border-amber-400/40 bg-slate-950/40 p-2">
      <div>
        <b className="text-white">{r.nome}</b> <span className="text-amber-200/80">· {r.pacotes} pacote(s)</span>
        {r.regiao && <span className="text-slate-400"> · região no HUB: {r.regiao}</span>}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <select value={card} onChange={(e) => setCard(e.target.value)} aria-label={`Card para ${r.nome}`} className="rounded-lg bg-slate-900 border border-slate-700 px-1.5 py-1">
          <option value="">Encaixar em…</option>
          {cards.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <button type="button" disabled={!card} onClick={() => onEncaixar(card)} className={`${botao} bg-amber-400 text-slate-950`}>Encaixar</button>
        <button type="button" onClick={onCriarRua} className={`${botao} border border-slate-600 text-slate-200`}>Criar card “{r.nome}”</button>
        {r.regiao && (
          <button type="button" onClick={onCriarRegiao} className={`${botao} border border-slate-600 text-slate-200`}>Criar card da região “{r.regiao}”</button>
        )}
      </div>
    </li>
  );
};

const botao = 'flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-black disabled:opacity-40';

export const PainelHub: React.FC<Props> = (p) => {
  const input = useRef<HTMLInputElement>(null);
  const [editandoUrl, setEditandoUrl] = useState(false);
  const [url, setUrl] = useState(p.urlHub);
  const [semConta, setSemConta] = useState(false);
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
            {ehAdmin(p.papel) && <span className="rounded bg-amber-400/20 px-1 text-[9px] font-black text-amber-300">ADMIN</span>}
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
          {p.urlHub ? p.urlHub.replace(/^https?:\/\//, '') : 'conectar ao HUB'}
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
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Endereço do HUB (ex.: http://localhost:4100)" aria-label="Endereço do HUB" className="flex-1 rounded-lg bg-slate-900 border border-slate-700 px-2 py-1" />
          <button type="submit" className={`${botao} bg-slate-700 text-white`}>Salvar</button>
        </form>
      )}

      {!ajudante && !p.urlHub && opcoes.length === 0 && (
        <div className="mt-2 text-slate-500">
          HUB não conectado. Informe o endereço acima ao ligar o HUB, ou{' '}
          <button type="button" className="underline" onClick={() => input.current?.click()}>carregar arquivo de carga</button>.
        </div>
      )}

      {!ajudante && p.urlHub && !semConta && (
        <div>
          <LoginHub onEntrar={p.onEntrar} onCriarConta={p.onCriarConta} />
          <div className="mt-1.5 text-slate-500">
            <button type="button" className="underline" onClick={() => setSemConta(true)}>perfil sem conta</button>
            {' · '}
            <button type="button" className="underline" onClick={() => input.current?.click()}>carregar arquivo de carga</button>
          </div>
        </div>
      )}

      {!ajudante && ((p.urlHub && semConta) || (!p.urlHub && opcoes.length > 0)) && (
        <div className="mt-2">
          <div className="text-slate-300 font-bold mb-1.5">Quem está usando este aparelho? <span className="text-slate-500 font-normal">(perfil sem conta)</span></div>
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
            {p.urlHub && <><button type="button" className="underline" onClick={() => setSemConta(false)}>voltar ao login</button>{' · '}</>}
            {p.perfis === null ? 'HUB fora do ar: ' : 'Sem perfil, o Street funciona no modo livre. '}
            <button type="button" className="underline" onClick={() => input.current?.click()}>carregar arquivo de carga</button>
          </div>
        </div>
      )}

      {ajudante && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button type="button" onClick={p.onBuscarCarga} disabled={!p.urlHub} className={`${botao} bg-sky-500 text-slate-950`}>
            <RefreshCw className="w-3.5 h-3.5" /> Buscar carga do HUB
          </button>
          <button
            type="button"
            onClick={() => p.onEnviarAoHub('hub')}
            disabled={p.saida.length === 0 || !p.urlHub}
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

      {p.repasse && (
        <div role="status" className="mt-2 rounded-xl border border-amber-400/60 bg-amber-400/15 p-2.5 flex items-start gap-2">
          <span className="flex-1 font-black text-amber-100">↔ {p.repasse.texto}</span>
          <button type="button" onClick={p.onDispensarRepasse} className={`${botao} bg-amber-400 text-slate-950`}>Entendi</button>
        </div>
      )}

      {p.revisaoRuas.length > 0 && (
        <div className="mt-2 rounded-xl border border-amber-400/50 bg-amber-400/10 p-2.5" role="region" aria-label="Ruas não reconhecidas">
          <div className="font-black text-amber-200 uppercase tracking-tight">Nova rua / conhecimento não reconhecido</div>
          <div className="text-amber-100/80 mb-1.5">
            Estes pacotes chegaram do HUB numa rua que o Street não conhece. Nenhum card foi criado sozinho: diga onde eles ficam.
          </div>
          <ul className="flex flex-col gap-1.5">
            {p.revisaoRuas.map((r) => (
              <LinhaRevisao
                key={r.chave}
                r={r}
                cards={p.cardsParaEncaixe}
                onEncaixar={(card) => p.onEncaixarRua(r.chave, card)}
                onCriarRua={() => p.onCriarCardRua(r.chave, r.nome)}
                onCriarRegiao={() => r.regiao && p.onCriarCardRegiao(r.regiao)}
              />
            ))}
          </ul>
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
          {aEnviar > 0 ? `${aEnviar} acontecimento(s) na fila: o Street reenvia sozinho quando o HUB responder.` : 'Tudo já foi enviado ao HUB ✓'}
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
