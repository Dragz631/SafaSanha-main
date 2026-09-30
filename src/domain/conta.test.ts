import { describe, expect, it } from 'vitest';
import { classificarErroConta, corpoNovaConta, normalizarUsuario, validarNovaConta, validarPin, validarUsuario } from './conta';

describe('usuário', () => {
  it('normaliza: minúsculo, sem acento, sem espaço e sem o domínio', () => {
    expect(normalizarUsuario('  João Silva ')).toBe('joaosilva');
    expect(normalizarUsuario('Maria@logiscan.log')).toBe('maria');
  });
  it('valida tamanho e caracteres', () => {
    expect(validarUsuario('')).toMatch(/Informe/);
    expect(validarUsuario('ab')).toMatch(/3 letras/);
    expect(validarUsuario('joao!')).toMatch(/letras, números/);
    expect(validarUsuario('joao.silva')).toBeNull();
  });
});

describe('PIN', () => {
  it('6 números exatos', () => {
    expect(validarPin('123456')).toBeNull();
    expect(validarPin('1234')).not.toBeNull();
    expect(validarPin('1234567')).not.toBeNull();
    expect(validarPin('12a456')).not.toBeNull();
  });
});

describe('nova conta', () => {
  const ok = { nome: 'João', usuario: 'Joao', pin: '123456', confirmarPin: '123456' };
  it('dados certos = sem erros', () => expect(validarNovaConta(ok)).toEqual([]));
  it('PINs diferentes, nome vazio e usuário inválido são apontados', () => {
    expect(validarNovaConta({ ...ok, confirmarPin: '654321' })).toEqual(['Os dois PINs não são iguais.']);
    expect(validarNovaConta({ ...ok, nome: ' ', usuario: 'a' }).length).toBe(2);
  });
  it('o corpo leva usuário normalizado e omite o que está vazio', () => {
    expect(corpoNovaConta({ ...ok, usuario: 'João Silva', telefone: ' ', veiculo: 'Moto' })).toEqual({
      nome: 'João', usuario: 'joaosilva', pin: '123456', veiculo: 'Moto',
    });
  });
});

describe('resposta do HUB', () => {
  it('classifica cada recusa', () => {
    expect(classificarErroConta(403, { codigo: 'CONTA_PENDENTE' }).tipo).toBe('pendente');
    expect(classificarErroConta(403, { codigo: 'CONTA_RECUSADA' }).tipo).toBe('recusada');
    expect(classificarErroConta(401, { codigo: 'PIN_INVALIDO' }).tipo).toBe('pin');
    expect(classificarErroConta(409, { codigo: 'USUARIO_EXISTENTE' }).tipo).toBe('existente');
    expect(classificarErroConta(429, { codigo: 'BLOQUEADO', ate: '2026-10-01T10:00:00Z' })).toMatchObject({ tipo: 'bloqueado', ate: '2026-10-01T10:00:00Z' });
    expect(classificarErroConta(401, null).tipo).toBe('sessao');
    expect(classificarErroConta(500, { mensagem: 'falhou' })).toMatchObject({ tipo: 'outro', mensagem: 'falhou' });
  });
});
