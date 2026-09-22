import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { MemoriaOperacional } from '../domain/memoria';
import { carregarMemoria, salvarMemoria } from '../utils/memoriaStorage';

interface MemoriaContexto {
  memoria: MemoriaOperacional;
  /** Aplica uma transformação pura à memória (composição segura entre chamadas seguidas). */
  atualizar: (fn: (m: MemoriaOperacional) => MemoriaOperacional) => void;
}

const Contexto = createContext<MemoriaContexto | null>(null);

export const MemoriaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [memoria, setMemoria] = useState<MemoriaOperacional>(() => carregarMemoria());

  useEffect(() => {
    salvarMemoria(memoria);
  }, [memoria]);

  const atualizar = useCallback((fn: (m: MemoriaOperacional) => MemoriaOperacional) => setMemoria((m) => fn(m)), []);
  const valor = useMemo(() => ({ memoria, atualizar }), [memoria, atualizar]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
};

export function useMemoria(): MemoriaContexto {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useMemoria deve ser usado dentro de <MemoriaProvider>');
  return ctx;
}
