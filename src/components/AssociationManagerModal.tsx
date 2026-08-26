import React, { useState } from 'react';
import {
  ShieldAlert,
  MapPin,
  Layers,
  Plus,
  Trash2,
  Edit3,
  X,
  Check,
  Brain,
  Search,
  User,
  Home,
  Compass,
  Building,
  Sparkles,
} from 'lucide-react';
import { AssociationArea, AssociationMemoryRecord, GeofenceConfig } from '../types';
import { AssociationMapDrawer } from './AssociationMapDrawer';
import { createMemoryRecord } from '../lib/associationEngine';

interface AssociationManagerModalProps {
  associations: AssociationArea[];
  memoryRecords: AssociationMemoryRecord[];
  isOpen: boolean;
  onClose: () => void;
  onAddAssociation: (newAssoc: AssociationArea) => void;
  onUpdateAssociation: (updatedAssoc: AssociationArea) => void;
  onDeleteAssociation: (id: string) => void;
  onAddMemoryRecord: (record: AssociationMemoryRecord) => void;
  onDeleteMemoryRecord: (id: string) => void;
}

export const AssociationManagerModal: React.FC<AssociationManagerModalProps> = ({
  associations,
  memoryRecords,
  isOpen,
  onClose,
  onAddAssociation,
  onUpdateAssociation,
  onDeleteAssociation,
  onAddMemoryRecord,
  onDeleteMemoryRecord,
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'memory'>('list');
  const [editingAssoc, setEditingAssoc] = useState<AssociationArea | null>(null);

  // Form State
  const [assocName, setAssocName] = useState('');
  const [assocReceiver, setAssocReceiver] = useState('');
  const [assocColor, setAssocColor] = useState('purple');
  const [assocDescription, setAssocDescription] = useState('');
  const [assocStreetsInput, setAssocStreetsInput] = useState('');
  const [assocBairrosInput, setAssocBairrosInput] = useState('');
  const [assocMoradoresInput, setAssocMoradoresInput] = useState('');
  const [assocGeofence, setAssocGeofence] = useState<GeofenceConfig | undefined>(undefined);

  // Memory Form State
  const [memorySearch, setMemorySearch] = useState('');
  const [newMemoryName, setNewMemoryName] = useState('');
  const [newMemoryAddr, setNewMemoryAddr] = useState('');
  const [newMemoryBairro, setNewMemoryBairro] = useState('');
  const [newMemoryAssocId, setNewMemoryAssocId] = useState('');

  if (!isOpen) return null;

  const handleStartCreate = () => {
    setEditingAssoc(null);
    setAssocName('');
    setAssocReceiver('');
    setAssocColor('purple');
    setAssocDescription('');
    setAssocStreetsInput('');
    setAssocBairrosInput('');
    setAssocMoradoresInput('');
    setAssocGeofence({
      tipo: 'circulo',
      centro_lat: -22.9035,
      centro_lng: -43.2096,
      raio_metros: 350,
      descricao_area: 'Cerca Virtual — Raio de Cobertura',
    });
    setActiveTab('create');
  };

  const handleStartEdit = (assoc: AssociationArea) => {
    setEditingAssoc(assoc);
    setAssocName(assoc.nome);
    setAssocReceiver(assoc.recebedor_padrao);
    setAssocColor(assoc.cor || 'purple');
    setAssocDescription(assoc.descricao || '');
    setAssocStreetsInput(assoc.ruas ? assoc.ruas.join(', ') : '');
    setAssocBairrosInput(assoc.bairros ? assoc.bairros.join(', ') : '');
    setAssocMoradoresInput(assoc.moradores ? assoc.moradores.join(', ') : '');
    setAssocGeofence(assoc.cerca_virtual);
    setActiveTab('create');
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assocName.trim()) {
      alert('Por favor, informe o nome da Associação.');
      return;
    }

    const streetsArray = assocStreetsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const bairrosArray = assocBairrosInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const moradoresArray = assocMoradoresInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (editingAssoc) {
      const updated: AssociationArea = {
        ...editingAssoc,
        nome: assocName.trim(),
        recebedor_padrao: assocReceiver.trim() || 'Sede da Associação',
        cor: assocColor,
        descricao: assocDescription.trim(),
        ruas: streetsArray,
        bairros: bairrosArray,
        moradores: moradoresArray,
        cerca_virtual: assocGeofence,
      };
      onUpdateAssociation(updated);
    } else {
      const newAssoc: AssociationArea = {
        id: `assoc_${Date.now()}`,
        nome: assocName.trim(),
        recebedor_padrao: assocReceiver.trim() || 'Sede da Associação',
        cor: assocColor,
        descricao: assocDescription.trim(),
        ruas: streetsArray,
        bairros: bairrosArray,
        moradores: moradoresArray,
        cerca_virtual: assocGeofence,
      };
      onAddAssociation(newAssoc);
    }

    setActiveTab('list');
  };

  const handleAddMemoryDirect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemoryName.trim() || !newMemoryAssocId) {
      alert('Preencha o Nome do Morador e selecione a Associação.');
      return;
    }

    const targetAssoc = associations.find((a) => a.id === newMemoryAssocId);
    if (!targetAssoc) return;

    const record = createMemoryRecord(
      newMemoryName,
      newMemoryAddr || 'Endereço Registrado na Memória',
      targetAssoc.id,
      targetAssoc.nome,
      newMemoryBairro,
      'manual'
    );

    onAddMemoryRecord(record);
    setNewMemoryName('');
    setNewMemoryAddr('');
    setNewMemoryBairro('');
  };

  const filteredMemory = memoryRecords.filter(
    (m) =>
      m.nome_destinatario.toLowerCase().includes(memorySearch.toLowerCase()) ||
      m.endereco.toLowerCase().includes(memorySearch.toLowerCase()) ||
      m.associacao_nome.toLowerCase().includes(memorySearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 text-white rounded-3xl max-w-4xl w-full p-5 sm:p-7 shadow-2xl border border-slate-800 space-y-5 my-auto max-h-[92vh] flex flex-col">
        {/* Header Modal */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-500/20 text-purple-300 rounded-2xl border border-purple-500/30">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
                🏛️ Módulo de Gestão de Associações & Cerca Virtual
              </h3>
              <p className="text-xs text-slate-400">
                Cadastre perímetros no mapa, regras de moradores e consulte o aprendizado histórico da IA.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 cursor-pointer transition-colors self-end sm:self-center"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shrink-0">
          <button
            onClick={() => setActiveTab('list')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'list'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Associações Cadastradas ({associations.length})</span>
          </button>

          <button
            onClick={handleStartCreate}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'create'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>{editingAssoc ? 'Editar Associação' : 'Nova Associação (Mapa + Regras)'}</span>
          </button>

          <button
            onClick={() => setActiveTab('memory')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'memory'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Brain className="w-4 h-4 text-purple-300" />
            <span>🧠 Memória Histórica de Moradores ({memoryRecords.length})</span>
          </button>
        </div>

        {/* TAB 1: LIST OF ASSOCIATIONS */}
        {activeTab === 'list' && (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">
                Visualização das Associações ativas no ecossistema logístico:
              </span>
              <button
                onClick={handleStartCreate}
                className="bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" /> Cadastrar Associação
              </button>
            </div>

            {associations.length === 0 ? (
              <div className="bg-slate-950 p-8 rounded-2xl border border-slate-800 text-center space-y-3">
                <ShieldAlert className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-sm font-bold text-slate-400">
                  Nenhuma Associação cadastrada no momento.
                </p>
                <button
                  onClick={handleStartCreate}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs px-4 py-2 rounded-xl"
                >
                  Criar Primeira Associação
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {associations.map((assoc) => (
                  <div
                    key={assoc.id}
                    className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 hover:border-purple-600/60 transition-all space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full bg-${assoc.cor || 'purple'}-500 border border-white/40 shrink-0`} />
                          <h4 className="font-extrabold text-sm text-white">{assoc.nome}</h4>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleStartEdit(assoc)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs cursor-pointer"
                            title="Editar Associação"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Deseja remover a associação "${assoc.nome}"?`)) {
                                onDeleteAssociation(assoc.id);
                              }
                            }}
                            className="p-1.5 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 rounded-lg text-xs cursor-pointer"
                            title="Excluir Associação"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-purple-300 font-bold flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        <span>Sede / Recebedor: <strong>{assoc.recebedor_padrao}</strong></span>
                      </p>

                      {assoc.descricao && (
                        <p className="text-xs text-slate-400 italic bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                          "{assoc.descricao}"
                        </p>
                      )}

                      {/* Rule details */}
                      <div className="space-y-1.5 text-xs">
                        <div>
                          <span className="font-extrabold text-slate-400 block text-[11px]">
                            🛣️ Ruas Abrangidas ({assoc.ruas?.length || 0}):
                          </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {assoc.ruas && assoc.ruas.length > 0 ? (
                              assoc.ruas.map((r, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] font-bold bg-slate-900 text-slate-300 px-2 py-0.5 rounded border border-slate-800"
                                >
                                  {r}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-slate-500 italic">Nenhuma rua informada</span>
                            )}
                          </div>
                        </div>

                        {assoc.moradores && assoc.moradores.length > 0 && (
                          <div>
                            <span className="font-extrabold text-purple-300 block text-[11px] mt-1">
                              👥 Moradores Cadastrados ({assoc.moradores.length}):
                            </span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {assoc.moradores.map((m, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] font-bold bg-purple-950 text-purple-200 px-2 py-0.5 rounded border border-purple-800"
                                >
                                  👤 {m}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {assoc.cerca_virtual && (
                          <div className="pt-1">
                            <span className="text-[10px] font-black text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-800 inline-flex items-center gap-1">
                              <Compass className="w-3 h-3 text-emerald-400" />
                              <span>Cerca Virtual Ativa ({assoc.cerca_virtual.tipo === 'circulo' ? `Raio ${assoc.cerca_virtual.raio_metros}m` : 'Polígono'})</span>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CREATE / EDIT ASSOCIATION */}
        {activeTab === 'create' && (
          <form onSubmit={handleSaveForm} className="flex-1 overflow-y-auto space-y-5 pr-1 text-xs">
            <div className="bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-800 space-y-4">
              <h4 className="font-extrabold text-sm text-purple-300 flex items-center gap-2 border-b border-slate-800 pb-2">
                <Edit3 className="w-4 h-4" />
                <span>1. Dados Básicos da Associação & Sede Comunitária</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">
                    Nome da Associação *
                  </label>
                  <input
                    type="text"
                    required
                    value={assocName}
                    onChange={(e) => setAssocName(e.target.value)}
                    placeholder="Ex: Associação Rua Paraíso & Parque Alegria"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">
                    Recebedor Padrão na Sede / Responsável *
                  </label>
                  <input
                    type="text"
                    required
                    value={assocReceiver}
                    onChange={(e) => setAssocReceiver(e.target.value)}
                    placeholder="Ex: Sede da Associação (Dona Maria / Sr. Antenor)"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Cor do Destaque Visual:</label>
                  <select
                    value={assocColor}
                    onChange={(e) => setAssocColor(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 font-bold text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="purple">🟣 Roxo Corporativo</option>
                    <option value="amber">🟠 Âmbar / Laranja</option>
                    <option value="emerald">🟢 Verde Esmeralda</option>
                    <option value="blue">🔵 Azul Comunitário</option>
                    <option value="rose">🔴 Rosa Destaque</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="font-bold text-slate-300 block mb-1">Observações / Instruções da Sede:</label>
                  <input
                    type="text"
                    value={assocDescription}
                    onChange={(e) => setAssocDescription(e.target.value)}
                    placeholder="Ex: Ponto de apoio na rua principal, entregas concentradas das 08h às 18h."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>

            {/* Manual Rules Input */}
            <div className="bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-800 space-y-4">
              <h4 className="font-extrabold text-sm text-purple-300 flex items-center gap-2 border-b border-slate-800 pb-2">
                <Home className="w-4 h-4" />
                <span>2. Regras de Associação Manual (Ruas, Bairros e Moradores Especificos)</span>
              </h4>

              <div className="space-y-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">
                    🛣️ Nomes das Ruas (separados por vírgula):
                  </label>
                  <input
                    type="text"
                    value={assocStreetsInput}
                    onChange={(e) => setAssocStreetsInput(e.target.value)}
                    placeholder="Ex: Rua Paraíso, Avenida das Flores, Beco do Sol"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-purple-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Qualquer pacote contendo estas ruas no endereço será vinculado automaticamente.
                  </p>
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">
                    🏡 Nomes dos Bairros / Trechos (separados por vírgula):
                  </label>
                  <input
                    type="text"
                    value={assocBairrosInput}
                    onChange={(e) => setAssocBairrosInput(e.target.value)}
                    placeholder="Ex: Parque Alegria, Chatuba Baixa, Morro da Cruz"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-purple-300 block mb-1 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-purple-400" />
                    <span>👥 Nomes de MORADORES Específicos pertencentes à Associação (separados por vírgula):</span>
                  </label>
                  <textarea
                    rows={2}
                    value={assocMoradoresInput}
                    onChange={(e) => setAssocMoradoresInput(e.target.value)}
                    placeholder="Ex: Dona Maria da Silva, Sr. Antenor, Carlos Eduardo, Marcos Vinicius"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-purple-500"
                  />
                  <p className="text-[10px] text-purple-300/70 mt-1">
                    💡 Cadastre o nome completo ou apelido do morador. Ao bipar a etiqueta, se a IA ler este nome, categorizará diretamente para a Saca desta Associação!
                  </p>
                </div>
              </div>
            </div>

            {/* Virtual Fence Map Drawer */}
            <AssociationMapDrawer
              geofence={assocGeofence}
              onChangeGeofence={(newG) => setAssocGeofence(newG)}
            />

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-2.5 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-purple-600 hover:bg-purple-500 text-white font-black px-6 py-2.5 rounded-xl shadow-lg flex items-center gap-2 cursor-pointer transition-all active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>{editingAssoc ? 'Salvar Alterações' : 'Cadastrar Associação'}</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 3: HISTORICAL MEMORY & RESIDENT LEARNING */}
        {activeTab === 'memory' && (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
            {/* Direct Learn Memory Form */}
            <form onSubmit={handleAddMemoryDirect} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
              <h4 className="font-extrabold text-sm text-purple-300 flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-400" />
                <span>Vinculação Manual na Memória da IA ([Nome + Endereço] -&gt; Associação)</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Nome do Morador *</label>
                  <input
                    type="text"
                    required
                    value={newMemoryName}
                    onChange={(e) => setNewMemoryName(e.target.value)}
                    placeholder="Ex: Dona Francisca Santos"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">Endereço / Rua</label>
                  <input
                    type="text"
                    value={newMemoryAddr}
                    onChange={(e) => setNewMemoryAddr(e.target.value)}
                    placeholder="Ex: Rua Paraíso, 102"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">Associação *</label>
                  <select
                    required
                    value={newMemoryAssocId}
                    onChange={(e) => setNewMemoryAssocId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-white font-bold focus:outline-none focus:border-purple-500"
                  >
                    <option value="">Selecione a Associação...</option>
                    {associations.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-500 text-white font-black px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Salvar Vínculo na Memória
                </button>
              </div>
            </form>

            {/* Search Bar */}
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={memorySearch}
                onChange={(e) => setMemorySearch(e.target.value)}
                placeholder="Buscar morador ou endereço no histórico de memória..."
                className="w-full bg-transparent text-xs text-white focus:outline-none placeholder:text-slate-500"
              />
            </div>

            {/* Memory List */}
            {filteredMemory.length === 0 ? (
              <p className="text-center text-slate-500 py-6 italic">
                Nenhum registro de memória encontrado com estes critérios.
              </p>
            ) : (
              <div className="space-y-2">
                {filteredMemory.map((mem) => (
                  <div
                    key={mem.id}
                    className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 flex flex-wrap items-center justify-between gap-2 hover:border-purple-800/60 transition-all"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-white flex items-center gap-1">
                          👤 {mem.nome_destinatario}
                        </span>
                        <span className="text-[10px] font-black bg-purple-950 text-purple-300 px-2 py-0.5 rounded border border-purple-800">
                          🏛️ {mem.associacao_nome}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        📍 {mem.endereco} {mem.bairro ? `(${mem.bairro})` : ''} • Vinculado em {mem.data_vinculo} ({mem.origem === 'ia' ? '✨ Aprendido via Visão IA' : mem.origem === 'manual' ? '✋ Inclusão Manual' : '📜 Histórico Operacional'})
                      </p>
                    </div>

                    <button
                      onClick={() => onDeleteMemoryRecord(mem.id)}
                      className="text-slate-500 hover:text-rose-400 p-1.5 hover:bg-slate-900 rounded-lg cursor-pointer transition-colors"
                      title="Excluir Vínculo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
