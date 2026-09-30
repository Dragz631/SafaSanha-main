/**
 * Entrar / Criar conta do ajudante (Street). A conta vive no HUB: o pedido de conta chega lá como
 * PENDENTE e só funciona depois que o Hugo aprova. O PIN é digitado aqui e nunca fica guardado.
 */
import React, { useState } from 'react';
import { KeyRound, LogIn, UserPlus } from 'lucide-react';
import { SUFIXO_USUARIO, TAMANHO_PIN, normalizarUsuario, validarNovaConta, validarPin, validarUsuario } from '../domain/conta';
import type { DadosNovaConta } from '../domain/conta';

export interface RetornoLogin {
  tipo: 'ok' | 'erro';
  texto: string;
}

interface Props {
  onEntrar: (usuario: string, pin: string) => Promise<RetornoLogin>;
  onCriarConta: (dados: DadosNovaConta) => Promise<RetornoLogin>;
}

const campo = 'w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5 text-white placeholder:text-slate-500';
const botao = 'flex items-center justify-center gap-1 rounded-lg px-3 py-2 font-black disabled:opacity-40';

export const LoginHub: React.FC<Props> = ({ onEntrar, onCriarConta }) => {
  const [aba, setAba] = useState<'entrar' | 'criar'>('entrar');
  const [ocupado, setOcupado] = useState(false);
  const [retorno, setRetorno] = useState<RetornoLogin | null>(null);
  const [form, setForm] = useState<DadosNovaConta>({ nome: '', usuario: '', pin: '', confirmarPin: '', telefone: '', veiculo: '' });
  const set = (k: keyof DadosNovaConta) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  const soNumeros = (k: 'pin' | 'confirmarPin') => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value.replace(/\D/g, '').slice(0, TAMANHO_PIN) });

  const usuario = normalizarUsuario(form.usuario);
  const podeEntrar = !validarUsuario(usuario) && !validarPin(form.pin);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setOcupado(true);
    try {
      if (aba === 'entrar') {
        const r = await onEntrar(usuario, form.pin);
        setRetorno(r);
        if (r.tipo === 'ok') setForm({ ...form, pin: '', confirmarPin: '' });
        else setForm({ ...form, pin: '' });
      } else {
        const erros = validarNovaConta(form);
        if (erros.length) {
          setRetorno({ tipo: 'erro', texto: erros.join(' ') });
          return;
        }
        const r = await onCriarConta(form);
        setRetorno(r);
        if (r.tipo === 'ok') {
          setForm({ nome: '', usuario, pin: '', confirmarPin: '', telefone: '', veiculo: '' });
          setAba('entrar');
        }
      }
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="mt-2" data-testid="login-hub">
      <div className="flex gap-1.5 mb-2" role="tablist">
        {(['entrar', 'criar'] as const).map((a) => (
          <button
            key={a}
            type="button"
            role="tab"
            aria-selected={aba === a}
            onClick={() => { setAba(a); setRetorno(null); }}
            className={`${botao} flex-1 ${aba === a ? 'bg-sky-500 text-slate-950' : 'border border-slate-700 text-slate-300'}`}
          >
            {a === 'entrar' ? <><LogIn className="w-3.5 h-3.5" /> Entrar</> : <><UserPlus className="w-3.5 h-3.5" /> Criar conta</>}
          </button>
        ))}
      </div>

      <form onSubmit={enviar} className="flex flex-col gap-1.5">
        {aba === 'criar' && <input value={form.nome} onChange={set('nome')} placeholder="Seu nome" aria-label="Nome" autoComplete="name" className={campo} />}
        <div className="flex items-center gap-1.5">
          <input value={form.usuario} onChange={set('usuario')} placeholder="usuário" aria-label="Usuário" autoCapitalize="none" autoComplete="username" className={campo} />
          <span className="text-slate-500 shrink-0">{SUFIXO_USUARIO}</span>
        </div>
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <KeyRound className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-2.5" />
            <input value={form.pin} onChange={soNumeros('pin')} placeholder={`PIN (${TAMANHO_PIN} números)`} aria-label="PIN" type="password" inputMode="numeric" autoComplete={aba === 'entrar' ? 'current-password' : 'new-password'} className={`${campo} pl-7`} />
          </div>
          {aba === 'criar' && (
            <input value={form.confirmarPin} onChange={soNumeros('confirmarPin')} placeholder="Repita o PIN" aria-label="Repita o PIN" type="password" inputMode="numeric" autoComplete="new-password" className={`${campo} flex-1`} />
          )}
        </div>
        {aba === 'criar' && (
          <div className="flex gap-1.5">
            <input value={form.telefone} onChange={set('telefone')} placeholder="Telefone (opcional)" aria-label="Telefone" inputMode="tel" className={campo} />
            <input value={form.veiculo} onChange={set('veiculo')} placeholder="Veículo (opcional)" aria-label="Veículo" className={campo} />
          </div>
        )}
        <button type="submit" disabled={ocupado || (aba === 'entrar' && !podeEntrar)} className={`${botao} bg-emerald-500 text-slate-950`}>
          {ocupado ? 'Aguarde…' : aba === 'entrar' ? 'Entrar' : 'Enviar pedido de conta'}
        </button>
      </form>

      {aba === 'criar' && (
        <p className="mt-1 text-slate-500">O pedido vai para o Hugo. Você só consegue entrar depois que ele aprovar.</p>
      )}
      {retorno && (
        <div role="status" className={`mt-2 rounded-lg px-2 py-1.5 font-bold ${retorno.tipo === 'ok' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
          {retorno.texto}
        </div>
      )}
    </div>
  );
};
