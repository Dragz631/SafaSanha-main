/**
 * CONTA do ajudante no Street (login + criar conta) — regras puras, sem DOM nem rede.
 *
 * A conta vive no HUB (quem aprova é o Hugo). O Street só coleta os dados, valida o formato e
 * interpreta a resposta. O usuário é escrito sem o domínio: "joao" vale "joao@logiscan.log".
 * O PIN nunca é guardado no aparelho; só o token de sessão que o HUB devolve.
 */
export const SUFIXO_USUARIO = '@logiscan.log';

/** ADMIN_AJUDANTE = administra no HUB e também sai para entregar (o caso do Hugo). */
export type PapelConta = 'ADMIN' | 'AJUDANTE' | 'ADMIN_AJUDANTE';
export const PAPEIS_CONTA: PapelConta[] = ['ADMIN', 'AJUDANTE', 'ADMIN_AJUDANTE'];
export const ehAdmin = (p: PapelConta | null | undefined) => p === 'ADMIN' || p === 'ADMIN_AJUDANTE';

/** O PIN tem 6 números (o Supabase Auth do HUB exige 6 ou mais). */
export const TAMANHO_PIN = 6;

/** Sessão de conta guardada no aparelho (nunca o PIN). */
export interface SessaoConta {
  token: string;
  /** Refresh token para renovar o token (expira em ~1h). Nunca o PIN. */
  renovar?: string;
  perfilId: string;
  papel: PapelConta;
}

/** Minúsculo, sem acento, sem espaços e sem o sufixo de domínio. */
export function normalizarUsuario(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(SUFIXO_USUARIO, '')
    .replace(/\s+/g, '');
}

export function validarUsuario(usuario: string): string | null {
  if (!usuario) return 'Informe o usuário.';
  if (usuario.length < 3) return 'O usuário precisa ter pelo menos 3 letras.';
  if (usuario.length > 24) return 'O usuário pode ter no máximo 24 caracteres.';
  if (!/^[a-z0-9._-]+$/.test(usuario)) return 'Use só letras, números, ponto, traço ou sublinhado no usuário.';
  return null;
}

export function validarPin(pin: string): string | null {
  return pin.length === TAMANHO_PIN && /^[0-9]+$/.test(pin) ? null : `O PIN tem ${TAMANHO_PIN} números.`;
}

export interface DadosNovaConta {
  nome: string;
  usuario: string;
  pin: string;
  confirmarPin: string;
  telefone?: string;
  veiculo?: string;
}

/** Lista os problemas do cadastro (vazia = pode enviar). */
export function validarNovaConta(d: DadosNovaConta): string[] {
  const erros: string[] = [];
  if (d.nome.trim().length < 2) erros.push('Informe o seu nome.');
  const e = validarUsuario(normalizarUsuario(d.usuario));
  if (e) erros.push(e);
  const p = validarPin(d.pin);
  if (p) erros.push(p);
  else if (d.pin !== d.confirmarPin) erros.push('Os dois PINs não são iguais.');
  return erros;
}

/** Corpo enviado ao HUB (POST /contas): usuário já normalizado, campos vazios omitidos. */
export function corpoNovaConta(d: DadosNovaConta) {
  return {
    nome: d.nome.trim(),
    usuario: normalizarUsuario(d.usuario),
    pin: d.pin,
    ...(d.telefone?.trim() ? { telefone: d.telefone.trim() } : {}),
    ...(d.veiculo?.trim() ? { veiculo: d.veiculo.trim() } : {}),
  };
}

export type ResultadoErroConta =
  | { tipo: 'pendente' | 'recusada' | 'pin' | 'existente' | 'sessao' | 'outro'; mensagem: string }
  | { tipo: 'bloqueado'; mensagem: string; ate: string | null };

/** Traduz a recusa do HUB (status + corpo {codigo, mensagem, ate?}) em algo que o ajudante entende. */
export function classificarErroConta(status: number, corpo: { codigo?: string; mensagem?: string; ate?: string } | null): ResultadoErroConta {
  const codigo = corpo?.codigo;
  if (codigo === 'CONTA_PENDENTE') return { tipo: 'pendente', mensagem: 'Sua conta ainda está aguardando a aprovação do Hugo.' };
  if (codigo === 'CONTA_RECUSADA') return { tipo: 'recusada', mensagem: 'Sua conta não foi liberada. Fale com o Hugo.' };
  if (codigo === 'USUARIO_EXISTENTE') return { tipo: 'existente', mensagem: 'Esse usuário já existe. Escolha outro.' };
  if (codigo === 'BLOQUEADO' || status === 429) {
    const ate = corpo?.ate ?? null;
    return { tipo: 'bloqueado', ate, mensagem: 'Muitas tentativas erradas. Espere um pouco e tente de novo.' };
  }
  if (codigo === 'PIN_INVALIDO') return { tipo: 'pin', mensagem: 'Usuário ou PIN incorretos.' };
  if (status === 401) return { tipo: 'sessao', mensagem: 'Sua sessão expirou. Entre de novo.' };
  return { tipo: 'outro', mensagem: corpo?.mensagem ?? `O HUB respondeu ${status}.` };
}
