import React, { useState, useRef } from 'react';
import { User, Plus, Trash2, Check, Sparkles, Phone, ArrowRight, X, ShieldAlert, Download, Upload } from 'lucide-react';
import { UserProfile } from '../types';
import {
  AVATAR_COLORS,
  createNewUser,
  deleteUserProfile,
  getUserData,
} from '../lib/userStorage';
import { exportFullDatabase, importFullDatabase } from '../lib/memoryEngine';


interface UserSelectionModalProps {
  isOpen: boolean;
  users: UserProfile[];
  activeUserId: string | null;
  onSelectUser: (user: UserProfile) => void;
  onRefreshUsers: () => void;
  canClose?: boolean;
  onClose?: () => void;
}

export const UserSelectionModal: React.FC<UserSelectionModalProps> = ({
  isOpen,
  users,
  activeUserId,
  onSelectUser,
  onRefreshUsers,
  canClose = true,
  onClose,
}) => {
  const [isCreating, setIsCreating] = useState(users.length === 0);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0].id);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newUser = createNewUser(name.trim(), selectedColor, phone.trim());

    setName('');
    setPhone('');
    setIsCreating(false);
    onRefreshUsers();
    onSelectUser(newUser);
  };

  const handleDelete = (user: UserProfile) => {
    deleteUserProfile(user.id);
    setUserToDelete(null);
    onRefreshUsers();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white p-5 sm:p-6 relative">
          {canClose && onClose && users.length > 0 && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <User className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight">
                {users.length === 0
                  ? 'Bem-vindo ao LogiScan!'
                  : isCreating
                  ? 'Novo Entregador'
                  : 'Quem está entregando?'}
              </h2>
              <p className="text-xs text-blue-100 font-medium">
                {users.length === 0
                  ? 'Cadastre seu perfil para salvar suas ruas no app'
                  : 'Cada entregador tem suas ruas salvas separadamente'}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* List of existing users */}
          {!isCreating && users.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Perfis Cadastrados ({users.length})
                </span>
                <button
                  onClick={() => setIsCreating(true)}
                  className="text-xs font-extrabold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Cadastrar Outro
                </button>
              </div>

              <div className="space-y-2.5">
                {users.map((u) => {
                  const userData = getUserData(u.id);
                  const streetCount = userData.streets?.length || 0;
                  const totalPkgs =
                    userData.streets?.reduce((acc, s) => acc + s.packages.length, 0) || 0;
                  const deliveredPkgs =
                    userData.streets?.reduce(
                      (acc, s) => acc + s.packages.filter((p) => p.status === 'delivered').length,
                      0
                    ) || 0;

                  const colorInfo =
                    AVATAR_COLORS.find((c) => c.id === u.color) || AVATAR_COLORS[0];
                  const isActive = activeUserId === u.id;

                  return (
                    <div
                      key={u.id}
                      className={`group relative flex items-center justify-between p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                        isActive
                          ? 'border-blue-600 bg-blue-50/70 shadow-sm'
                          : 'border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-slate-100'
                      }`}
                      onClick={() => {
                        onSelectUser(u);
                        if (onClose) onClose();
                      }}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-white text-base shadow-sm ${colorInfo.bg}`}
                        >
                          {u.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-slate-900 truncate">{u.name}</h4>
                            {isActive && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-600 text-white">
                                Ativo
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 font-medium">
                            {streetCount} {streetCount === 1 ? 'rua' : 'ruas'} • {deliveredPkgs}/
                            {totalPkgs} entregues
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setUserToDelete(u);
                          }}
                          className="text-slate-400 hover:text-red-600 p-2 rounded-xl hover:bg-red-50 transition-all opacity-80 group-hover:opacity-100 cursor-pointer"
                          title="Excluir perfil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="text-blue-600">
                          <ArrowRight className="w-5 h-5" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Create User Form */}
          {isCreating && (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Nome do Entregador *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Raul, Hugo, Carlos..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-base font-bold text-slate-900 bg-white"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center justify-between">
                  <span>WhatsApp Padrão da Base / Grupo (Opcional)</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="tel"
                    placeholder="Ex: 21999998888 (para envio com 1 toque)"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm text-slate-900 bg-white"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Se deixar em branco, o WhatsApp abre para você escolher o contato/grupo na hora.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  Cor do Perfil
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {AVATAR_COLORS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedColor(c.id)}
                      className={`w-9 h-9 rounded-2xl flex items-center justify-center text-white transition-all cursor-pointer ${
                        c.bg
                      } ${
                        selectedColor === c.id
                          ? 'ring-4 ring-offset-2 ring-emerald-600 scale-110'
                          : 'opacity-80 hover:opacity-100'
                      }`}
                    >
                      {selectedColor === c.id && <Check className="w-5 h-5 stroke-[3]" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                {users.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="flex-1 py-3 px-4 rounded-2xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    Voltar
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Check className="w-5 h-5" />
                  Salvar e Entrar
                </button>
              </div>
            </form>
          )}

          {/* Backup & Restauração Completa */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="min-w-0">
                <span className="text-[11px] font-black text-slate-800 uppercase block">
                  Backup Completo de Dados
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Exportar ou importar todas as ruas e memórias
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const json = exportFullDatabase();
                    const blob = new Blob([json], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `safasanha_backup_${new Date().toISOString().slice(0, 10)}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-[11px] flex items-center gap-1 cursor-pointer transition-all"
                  title="Baixar backup em JSON"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Exportar</span>
                </button>

                <label className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-black text-[11px] flex items-center gap-1 cursor-pointer transition-all">
                  <Upload className="w-3.5 h-3.5 text-blue-600" />
                  <span>Restaurar</span>
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const content = event.target?.result as string;
                        if (content) {
                          const ok = importFullDatabase(content);
                          if (ok) {
                            alert('Backup restaurado com sucesso!');
                            onRefreshUsers();
                          } else {
                            alert('Erro ao restaurar backup. Verifique o arquivo JSON.');
                          }
                        }
                      };
                      reader.readAsText(file);
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>


        {/* Delete Confirmation Modal Overlay */}
        {userToDelete && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-20">
            <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="text-center">
                <h3 className="font-black text-slate-900 text-base">
                  Excluir perfil de {userToDelete.name}?
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Todas as ruas e dados salvos no celular deste entregador serão removidos.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setUserToDelete(null)}
                  className="flex-1 py-2.5 px-3 rounded-2xl border border-slate-300 font-bold text-slate-700 text-sm hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(userToDelete)}
                  className="flex-1 py-2.5 px-3 rounded-2xl bg-red-600 hover:bg-red-700 font-bold text-white text-sm shadow-sm cursor-pointer"
                >
                  Confirmar Exclusão
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
