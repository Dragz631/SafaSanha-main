/**
 * Persistência local com FALHA VISÍVEL.
 * A versão anterior engolia erros de gravação (`catch {}`): com o armazenamento cheio (fotos em base64),
 * o app seguia "funcionando" mas nada era salvo. Aqui toda gravação devolve sucesso/falha e avisa a interface.
 */
import { useEffect, useState } from 'react';

const falhas = new Map<string, string>();
const ouvintes = new Set<() => void>();

function avisar() {
  ouvintes.forEach((fn) => fn());
}

export function gravarJSON(chave: string, valor: unknown): boolean {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
    if (falhas.delete(chave)) avisar();
    return true;
  } catch (erro) {
    falhas.set(chave, erro instanceof Error ? erro.message : String(erro));
    console.error(`Falha ao gravar "${chave}":`, erro);
    avisar();
    return false;
  }
}

export function lerJSON<T>(chave: string, padrao: T): T {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto === null ? padrao : (JSON.parse(bruto) as T);
  } catch (erro) {
    console.warn(`Não foi possível ler "${chave}":`, erro);
    return padrao;
  }
}

export function removerChave(chave: string): void {
  try {
    localStorage.removeItem(chave);
  } catch {
    /* sem storage: nada a remover */
  }
}

/** Chaves cuja última gravação falhou (vazio = tudo salvo). */
export function useFalhasDeGravacao(): string[] {
  const [, forcar] = useState(0);
  useEffect(() => {
    const fn = () => forcar((n) => n + 1);
    ouvintes.add(fn);
    return () => {
      ouvintes.delete(fn);
    };
  }, []);
  return Array.from(falhas.keys());
}
