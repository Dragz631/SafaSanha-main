import React, { useState } from 'react';
import { isStrictStreetMatch } from '../lib/associationEngine';
import {
  Cpu,
  MapPin,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Play,
  Search,
  Plus,
  Trash2,
  Eye,
  Edit3,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  FileCheck,
  Home,
  Package,
  User,
  Users,
  Building,
  Check,
} from 'lucide-react';
import { DeliveryData, AssociationArea, AssociationMemoryRecord, DeliveryStatus } from '../types';
import { AssociationManagerModal } from './AssociationManagerModal';

interface DashboardViewProps {
  deliveries: DeliveryData[];
  associations: AssociationArea[];
  memoryRecords?: AssociationMemoryRecord[];
  onUpdateDelivery: (updatedDelivery: DeliveryData) => void;
  onUpdateDeliveriesBatch: (updatedDeliveries: DeliveryData[]) => void;
  onAddAssociation: (newAssoc: AssociationArea) => void;
  onUpdateAssociation: (updatedAssoc: AssociationArea) => void;
  onDeleteAssociation: (id: string) => void;
  onAddMemoryRecord?: (record: AssociationMemoryRecord) => void;
  onDeleteMemoryRecord?: (id: string) => void;
  onSelectDeliveryForReceipt: (delivery: DeliveryData) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  deliveries,
  associations,
  memoryRecords = [],
  onUpdateDelivery,
  onUpdateDeliveriesBatch,
  onAddAssociation,
  onUpdateAssociation,
  onDeleteAssociation,
  onAddMemoryRecord = () => {},
  onDeleteMemoryRecord = () => {},
  onSelectDeliveryForReceipt,
}) => {
  const [subTab, setSubTab] = useState<'overview' | 'streets' | 'associations' | 'manual_fix'>('overview');
  const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);

  // Search & Filters
  const [streetSearch, setStreetSearch] = useState('');
  const [manualCodeEdits, setManualCodeEdits] = useState<{ [id: string]: string }>({});

  // Robot Automation Simulation State
  const [isRobotRunning, setIsRobotRunning] = useState(false);
  const [robotProgress, setRobotProgress] = useState(0);
  const [robotLogs, setRobotLogs] = useState<string[]>([]);

  // Association Modal / Form State
  const [isCreatingAssoc, setIsCreatingAssoc] = useState(false);
  const [newAssocName, setNewAssocName] = useState('');
  const [newAssocReceiver, setNewAssocReceiver] = useState('');
  const [newAssocStreetInput, setNewAssocStreetInput] = useState('');
  const [newAssocDesc, setNewAssocDesc] = useState('');

  // Editing existing association street
  const [addingStreetToId, setAddingStreetToId] = useState<string | null>(null);
  const [streetAddValue, setStreetAddValue] = useState('');

  // Helper stats
  const totalDeliveries = deliveries.length;
  const pendingBaixaCount = deliveries.filter((d) => d.status === 'pendente_baixa').length;
  const inRevisionCount = deliveries.filter(
    (d) =>
      d.status === 'em_revisao' &&
      !d.nome_destinatario &&
      !(d.endereco_completo || d.endereco_rua) &&
      d.origem_leitura !== 'ocr_ai'
  ).length;
  const robotProcessingCount = deliveries.filter((d) => d.status === 'processando_robo').length;
  const completedCount = deliveries.filter((d) => d.status === 'concluido').length;

  // Trigger Robot Automations (Simulated RPA execution on Android Emulator)
  const handleTriggerRobot = () => {
    const readyItems = deliveries.filter((d) => d.status === 'pendente_baixa');
    if (readyItems.length === 0) {
      alert('Não há entregas com status "Pendente Baixa" para processar no robô.');
      return;
    }

    setIsRobotRunning(true);
    setRobotProgress(0);
    setRobotLogs([
      `[${new Date().toLocaleTimeString()}] 🚀 Inicializando serviço de RPA no Emulador Android...`,
      `[${new Date().toLocaleTimeString()}] 📦 Carregando lote de ${readyItems.length} pacotes prontos...`,
    ]);

    // Mark items as processando_robo
    const updatedBatch = deliveries.map((d) =>
      d.status === 'pendente_baixa' ? { ...d, status: 'processando_robo' as DeliveryStatus } : d
    );
    onUpdateDeliveriesBatch(updatedBatch);

    // Simulate progress
    let step = 0;
    const interval = setInterval(() => {
      step += 20;
      setRobotProgress(step);

      if (step === 20) {
        setRobotLogs((prev) => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] 📱 Conectado ao app de logística. Abrindo scanner...`,
        ]);
      } else if (step === 40) {
        setRobotLogs((prev) => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] ⚡ Digitando códigos e anexando comprovantes de foto...`,
        ]);
      } else if (step === 80) {
        setRobotLogs((prev) => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] ✅ Baixas confirmadas na API do operador!`,
        ]);
      } else if (step >= 100) {
        clearInterval(interval);
        setIsRobotRunning(false);

        // Mark processando_robo as concluido
        const finalizedBatch = deliveries.map((d) =>
          d.status === 'processando_robo' || d.status === 'pendente_baixa'
            ? { ...d, status: 'concluido' as DeliveryStatus }
            : d
        );
        onUpdateDeliveriesBatch(finalizedBatch);

        setRobotLogs((prev) => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] 🎉 LOTE FINALIZADO COM SUCESSO! Todos os pacotes baixados.`,
        ]);
      }
    }, 1200);
  };

  // Handle Manual Barcode Correction
  const handleSaveManualFix = (delivery: DeliveryData) => {
    const newCode = manualCodeEdits[delivery.id_entrega] || delivery.codigo_pacote;
    if (!newCode.trim()) {
      alert('Por favor, informe um código válido.');
      return;
    }

    const updated: DeliveryData = {
      ...delivery,
      codigo_pacote: newCode.trim().toUpperCase(),
      status: 'pendente_baixa',
      origem_leitura: 'manual',
    };

    onUpdateDelivery(updated);
    alert(`Código atualizado para ${updated.codigo_pacote}! Status alterado para "Pendente Baixa".`);
  };

  // Add new Association Area
  const handleCreateAssociationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssocName.trim() || !newAssocReceiver.trim()) {
      alert('Por favor, preencha o nome da Associação e o Recebedor Padrão.');
      return;
    }

    const streetsArray = newAssocStreetInput
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const colors = ['purple', 'amber', 'emerald', 'blue', 'indigo'];
    const randomColor = colors[associations.length % colors.length];

    const newAssoc: AssociationArea = {
      id: `assoc_${Date.now()}`,
      nome: newAssocName.trim(),
      recebedor_padrao: newAssocReceiver.trim(),
      ruas: streetsArray,
      cor: randomColor,
      descricao: newAssocDesc.trim() || 'Área de Associação Cadastrada.',
    };

    onAddAssociation(newAssoc);

    // Auto update existing deliveries matching these streets strictly to use this association!
    const updatedDeliveries = deliveries.map((d) => {
      const streetName = d.endereco_completo || d.endereco_rua || '';
      const matches = streetsArray.some((st) => isStrictStreetMatch(streetName, st));
      if (matches) {
        return {
          ...d,
          associacao_id: newAssoc.id,
          associacao_nome: newAssoc.nome,
          recebedor_tipo: 'associacao' as const,
          recebedor_detalhes: newAssoc.recebedor_padrao,
        };
      }
      return d;
    });

    onUpdateDeliveriesBatch(updatedDeliveries);

    // Reset Form
    setNewAssocName('');
    setNewAssocReceiver('');
    setNewAssocStreetInput('');
    setNewAssocDesc('');
    setIsCreatingAssoc(false);
  };

  // Add Street to Existing Association
  const handleAddStreetToAssoc = (assoc: AssociationArea) => {
    if (!streetAddValue.trim()) return;
    const newStreetClean = streetAddValue.trim();

    if (assoc.ruas.some((s) => s.toLowerCase() === newStreetClean.toLowerCase())) {
      alert('Esta rua já está vinculada a esta associação.');
      return;
    }

    const updatedAssoc: AssociationArea = {
      ...assoc,
      ruas: [...assoc.ruas, newStreetClean],
    };

    onUpdateAssociation(updatedAssoc);

    // Auto match existing deliveries with this new street strictly
    const updatedDeliveries = deliveries.map((d) => {
      const streetName = d.endereco_completo || d.endereco_rua || '';
      if (isStrictStreetMatch(streetName, newStreetClean)) {
        return {
          ...d,
          associacao_id: assoc.id,
          associacao_nome: assoc.nome,
          recebedor_tipo: 'associacao' as const,
          recebedor_detalhes: assoc.recebedor_padrao,
        };
      }
      return d;
    });

    onUpdateDeliveriesBatch(updatedDeliveries);
    setStreetAddValue('');
    setAddingStreetToId(null);
  };

  // Remove Street from Association
  const handleRemoveStreetFromAssoc = (assoc: AssociationArea, streetToRemove: string) => {
    const updatedAssoc: AssociationArea = {
      ...assoc,
      ruas: assoc.ruas.filter((s) => s !== streetToRemove),
    };

    onUpdateAssociation(updatedAssoc);
  };

  // Helper grouping by Street and Number
  const getDeliveriesGroupedByStreet = () => {
    const groups: { [street: string]: { [number: string]: DeliveryData[] } } = {};

    deliveries.forEach((d) => {
      const street = d.endereco_completo || d.endereco_rua || 'Sem Rua Definida';
      const number = (d.numero_casa || d.endereco_numero) ? `Nº ${d.numero_casa || d.endereco_numero}` : 'Número Não Especificado';

      if (
        streetSearch &&
        !street.toLowerCase().includes(streetSearch.toLowerCase()) &&
        !d.codigo_pacote.toLowerCase().includes(streetSearch.toLowerCase()) &&
        !d.recebedor_detalhes.toLowerCase().includes(streetSearch.toLowerCase()) &&
        !(d.nome_destinatario || '').toLowerCase().includes(streetSearch.toLowerCase())
      ) {
        return;
      }

      if (!groups[street]) {
        groups[street] = {};
      }
      if (!groups[street][number]) {
        groups[street][number] = [];
      }
      groups[street][number].push(d);
    });

    return groups;
  };

  const groupedByStreet = getDeliveriesGroupedByStreet();

  return (
    <div className="max-w-6xl mx-auto px-3 py-5 sm:p-6 space-y-6">
      
      {/* Top Banner Dashboard Title */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-blue-600 text-white p-2 rounded-xl">
              <Cpu className="w-5 h-5" />
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              PASSO 2: Painel de Controle & Geofencing
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Organização por Ruas/Condomínios, Cerca Virtual por Associação e Automação de Baixas.
          </p>
        </div>

        {/* Sub-tabs Nav Pill */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 text-xs font-bold">
          <button
            onClick={() => setSubTab('overview')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
              subTab === 'overview'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Robô & Visão Geral</span>
          </button>

          <button
            onClick={() => setSubTab('streets')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
              subTab === 'streets'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Por Ruas & Prédios</span>
          </button>

          <button
            onClick={() => setSubTab('associations')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
              subTab === 'associations'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Associações ({associations.length})</span>
          </button>

          <button
            onClick={() => setSubTab('manual_fix')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all relative cursor-pointer ${
              subTab === 'manual_fix'
                ? 'bg-white text-amber-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>Ajuste Manual</span>
            {inRevisionCount > 0 && (
              <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-1.5 py-0.2 rounded-full">
                {inRevisionCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: ROBÔ & VISÃO GERAL (PAINEL DO ROBÔ & METRICAS)               */}
      {/* ========================================================================= */}
      {subTab === 'overview' && (
        <div className="space-y-6">
          
          {/* Metrics Overview Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-bold">Total Entregas</span>
                <Package className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-2xl sm:text-3xl font-mono font-black text-slate-900">
                {totalDeliveries}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Registradas na plataforma</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs">
              <div className="flex items-center justify-between text-emerald-700 mb-1">
                <span className="text-xs font-bold">Prontas p/ Baixa</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl sm:text-3xl font-mono font-black text-emerald-700">
                {pendingBaixaCount}
              </p>
              <p className="text-[11px] text-emerald-600 font-medium mt-1">Fotos + Código validados</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs">
              <div className="flex items-center justify-between text-amber-700 mb-1">
                <span className="text-xs font-bold">Em Revisão</span>
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-2xl sm:text-3xl font-mono font-black text-amber-600">
                {inRevisionCount}
              </p>
              <p className="text-[11px] text-amber-700 font-medium mt-1">Código necessita ajuste</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-blue-200 shadow-xs">
              <div className="flex items-center justify-between text-blue-700 mb-1">
                <span className="text-xs font-bold">Concluídas / Robô</span>
                <ShieldCheck className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-2xl sm:text-3xl font-mono font-black text-blue-700">
                {completedCount + robotProcessingCount}
              </p>
              <p className="text-[11px] text-blue-600 font-medium mt-1">Baixadas no sistema</p>
            </div>
          </div>

          {/* Robot Automation Trigger Hero Card */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950 text-white rounded-3xl p-6 shadow-xl border border-slate-800 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 bg-blue-500/20 text-blue-300 border border-blue-400/30 px-3 py-1 rounded-full text-xs font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  <span>Automação de Baixas RPA (Emulador Android)</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white">
                  Gatilho do Robô de Baixas Automáticas
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
                  Dispare a rotina automatizada para simular o envio do lote de entregas válidas para o script local de emulador, liberando o pacote no sistema de logística oficial.
                </p>
              </div>

              {/* Trigger Button */}
              <div>
                <button
                  onClick={handleTriggerRobot}
                  disabled={isRobotRunning || pendingBaixaCount === 0}
                  className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-extrabold text-sm sm:text-base px-6 py-4 rounded-2xl shadow-lg flex items-center gap-3 transition-all active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed border border-blue-400/40"
                >
                  {isRobotRunning ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin text-blue-200" />
                      <span>Processando no Emulador... ({robotProgress}%)</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 fill-current text-white" />
                      <span>🚀 Disparar Baixas Automáticas ({pendingBaixaCount})</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Simulated Live Robot Execution Logs */}
            {robotLogs.length > 0 && (
              <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800/80 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800">
                  <span className="font-bold flex items-center gap-2 text-blue-400">
                    <Cpu className="w-4 h-4" /> Console de Execução do Robô
                  </span>
                  <span>Progresso: {robotProgress}%</span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div
                    className="bg-blue-500 h-full transition-all duration-300"
                    style={{ width: `${robotProgress}%` }}
                  />
                </div>

                <div className="space-y-1 max-h-40 overflow-y-auto text-slate-300">
                  {robotLogs.map((log, idx) => (
                    <p key={idx} className="leading-relaxed">
                      {log}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick List of Deliveries Ready for Robot */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-extrabold text-base text-slate-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Pacotes Prontos para Envio ao Robô ({pendingBaixaCount})</span>
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Sincronizados e Validados
              </span>
            </h3>

            {pendingBaixaCount === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200/80 text-slate-500 text-xs">
                Nenhum pacote pendente de baixa no momento. Adicione fotos na Aba 1 ou aprove itens em Ajuste Manual.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {deliveries
                  .filter((d) => d.status === 'pendente_baixa')
                  .map((delivery) => (
                    <div
                      key={delivery.id_entrega}
                      className="bg-slate-50 hover:bg-white border border-slate-200 rounded-2xl p-3.5 transition-all flex items-center gap-3 shadow-2xs"
                    >
                      <img
                        src={delivery.foto_pacote_path || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80'}
                        alt="Pacote"
                        className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-mono font-bold text-slate-900 text-xs truncate">
                          {delivery.codigo_pacote}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {delivery.endereco_rua || 'Rua Principal'} {delivery.endereco_numero ? `, ${delivery.endereco_numero}` : ''}
                        </p>
                        <span className="inline-block mt-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                          🟢 Pronto
                        </span>
                      </div>
                      <button
                        onClick={() => onSelectDeliveryForReceipt(delivery)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                        title="Ver Comprovante"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: ORGANIZAÇÃO POR RUAS E CONDOMÍNIOS / PRÉDIOS                   */}
      {/* ========================================================================= */}
      {subTab === 'streets' && (
        <div className="space-y-5">
          
          {/* Search bar */}
          <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={streetSearch}
                onChange={(e) => setStreetSearch(e.target.value)}
                placeholder="Filtrar por nome de rua, morador ou código de pacote..."
                className="w-full pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="text-xs font-bold text-slate-500">
              Total de Ruas Mapeadas: <strong className="text-blue-600">{Object.keys(groupedByStreet).length}</strong>
            </div>
          </div>

          {/* List of Street Cards */}
          {Object.keys(groupedByStreet).length === 0 ? (
            <div className="bg-white rounded-3xl p-10 border border-slate-200 text-center text-slate-500 text-sm space-y-2">
              <Building2 className="w-10 h-10 mx-auto text-slate-300" />
              <p className="font-bold text-slate-700">Nenhuma rua cadastrada ou encontrada no filtro.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedByStreet).map(([streetName, numbersGroup]) => {
                const totalPackagesInStreet = Object.values(numbersGroup).reduce(
                  (acc, list) => acc + list.length,
                  0
                );

                return (
                  <div
                    key={streetName}
                    className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden"
                  >
                    {/* Street Header Banner */}
                    <div className="bg-slate-50 p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-blue-100 text-blue-700 rounded-xl font-bold">
                          <MapPin className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-black text-slate-900 text-base sm:text-lg">
                            {streetName}
                          </h3>
                          <p className="text-xs text-slate-500">
                            {Object.keys(numbersGroup).length} números / condomínios registrados
                          </p>
                        </div>
                      </div>

                      <span className="bg-blue-600 text-white text-xs font-black px-3 py-1 rounded-full shadow-2xs">
                        {totalPackagesInStreet} {totalPackagesInStreet === 1 ? 'pacote' : 'pacotes'}
                      </span>
                    </div>

                    {/* Grouping Inside Street: Numbers / Buildings / Condomínios */}
                    <div className="p-4 sm:p-5 space-y-4">
                      {Object.entries(numbersGroup).map(([numberLabel, itemsList]) => (
                        <div
                          key={numberLabel}
                          className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-3"
                        >
                          {/* Number / Condominium Title */}
                          <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                            <span className="font-extrabold text-xs sm:text-sm text-slate-800 flex items-center gap-2">
                              <Building className="w-4 h-4 text-blue-600" />
                              <span>{numberLabel}</span>
                              {itemsList.length > 1 && (
                                <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                  Prédio / Múltiplos
                                </span>
                              )}
                            </span>
                            <span className="text-xs text-slate-500 font-bold">
                              {itemsList.length} entrega(s)
                            </span>
                          </div>

                          {/* Package List Clean Grid */}
                          <div className="divide-y divide-slate-200/60">
                            {itemsList.map((item) => (
                              <div
                                key={item.id_entrega}
                                className="py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                              >
                                {/* Package Info */}
                                <div className="flex items-center gap-3">
                                  <img
                                    src={item.foto_pacote_path || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80'}
                                    alt="Pacote"
                                    className="w-10 h-10 rounded-xl object-cover border border-slate-300 shrink-0"
                                  />
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-extrabold text-slate-900 text-sm">
                                        {item.codigo_pacote}
                                      </span>
                                      {item.endereco_complemento && (
                                        <span className="bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded text-[10px]">
                                          {item.endereco_complemento}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-slate-600 font-medium">
                                      Destinatário / Recebedor: <strong>{item.recebedor_detalhes}</strong>
                                    </p>
                                  </div>
                                </div>

                                {/* Status & Actions */}
                                <div className="flex items-center gap-2">
                                  {item.status === 'aguardando_rua' && (
                                    <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2.5 py-1 rounded-full">
                                      🟡 Aguardando Rua
                                    </span>
                                  )}
                                  {item.status === 'entregue' && (
                                    <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2.5 py-1 rounded-full">
                                      🔵 Entregue na Rua
                                    </span>
                                  )}
                                  {item.status === 'processado_jt' && (
                                    <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2.5 py-1 rounded-full">
                                      🟣 Bipado J&T
                                    </span>
                                  )}
                                  {item.status === 'concluido' && (
                                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-1 rounded-full">
                                      ✅ Concluído
                                    </span>
                                  )}
                                  {item.status === 'aguardando_pin' && (
                                    <span className="bg-indigo-100 text-indigo-900 text-[10px] font-bold px-2.5 py-1 rounded-full">
                                      🔑 Requer PIN
                                    </span>
                                  )}
                                  {item.status === 'insucesso' && (
                                    <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2.5 py-1 rounded-full">
                                      ❌ Insucesso
                                    </span>
                                  )}

                                  <button
                                    onClick={() => onSelectDeliveryForReceipt(item)}
                                    className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 text-xs transition-colors cursor-pointer shadow-2xs"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-blue-600" />
                                    <span>Ver Comprovante</span>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: GERENCIADOR DE ASSOCIAÇÕES & CERCA VIRTUAL                     */}
      {/* ========================================================================= */}
      {subTab === 'associations' && (
        <div className="space-y-6">
          
          {/* Associations Header Card */}
          <div className="bg-gradient-to-r from-purple-900 via-slate-900 to-purple-950 text-white rounded-3xl p-6 border border-purple-800 shadow-md flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1 max-w-xl">
              <span className="text-[10px] font-black uppercase text-purple-300 bg-purple-950 px-2.5 py-0.5 rounded-full border border-purple-700">
                Módulo de Geofencing & Memória Comunitária
              </span>
              <h3 className="text-xl font-black text-white flex items-center gap-2 pt-1">
                <MapPin className="w-6 h-6 text-purple-400" />
                <span>Gestão de Associações, Cerca Virtual & Regras</span>
              </h3>
              <p className="text-xs text-purple-200/80">
                Cadastre perímetros no mapa, regras de ruas/moradores e gerencie a memória histórica de destinatários aprendida pela IA.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setIsManagerModalOpen(true)}
                className="bg-purple-500 hover:bg-purple-400 text-white font-black text-xs px-5 py-3 rounded-2xl shadow-lg flex items-center gap-2 transition-all cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Gerenciar Associações (Mapa + Regras)</span>
              </button>
            </div>
          </div>

          {/* Modal Instance */}
          <AssociationManagerModal
            associations={associations}
            memoryRecords={memoryRecords}
            isOpen={isManagerModalOpen}
            onClose={() => setIsManagerModalOpen(false)}
            onAddAssociation={onAddAssociation}
            onUpdateAssociation={onUpdateAssociation}
            onDeleteAssociation={onDeleteAssociation}
            onAddMemoryRecord={onAddMemoryRecord}
            onDeleteMemoryRecord={onDeleteMemoryRecord}
          />

          {/* Association Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {associations.map((assoc) => {
              // Find matching packages for this association
              const matchingDeliveries = deliveries.filter(
                (d) =>
                  d.associacao_id === assoc.id ||
                  assoc.ruas.some((st) => (d.endereco_rua || d.endereco_completo || '').toLowerCase().includes(st.toLowerCase()))
              );

              return (
                <div
                  key={assoc.id}
                  className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Association Title & Badge */}
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                          Pasta da Associação
                        </span>
                        <h4 className="font-extrabold text-slate-900 text-base mt-1">
                          {assoc.nome}
                        </h4>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setIsManagerModalOpen(true)}
                          className="text-purple-600 hover:text-purple-800 p-1.5 bg-purple-50 hover:bg-purple-100 rounded-xl transition-colors cursor-pointer text-xs font-bold flex items-center gap-1"
                          title="Editar no Mapa/Regras"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>
                        <button
                          onClick={() => onDeleteAssociation(assoc.id)}
                          className="text-slate-400 hover:text-rose-600 p-1.5 rounded-xl transition-colors cursor-pointer"
                          title="Remover Associação"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Default Receiver Info */}
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs space-y-1">
                      <span className="text-slate-500 font-bold block text-[11px]">
                        Recebedor Padrão Definido:
                      </span>
                      <p className="font-extrabold text-slate-900 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-purple-600" />
                        <span>{assoc.recebedor_padrao}</span>
                      </p>
                    </div>

                    {/* Moradores Rules & Streets */}
                    <div className="space-y-2">
                      {assoc.moradores && assoc.moradores.length > 0 && (
                        <div>
                          <span className="text-xs font-bold text-purple-900 block mb-1">
                            👤 Moradores Mapeados ({assoc.moradores.length}):
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {assoc.moradores.map((m, i) => (
                              <span
                                key={i}
                                className="text-[11px] font-extrabold bg-purple-100 text-purple-900 px-2.5 py-0.5 rounded-lg border border-purple-300"
                              >
                                {m}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <span className="text-xs font-bold text-slate-700 block mb-1">
                          🛣️ Ruas & Comunidades ({assoc.ruas.length}):
                        </span>

                        <div className="flex flex-wrap gap-1.5">
                          {assoc.ruas.map((street) => (
                            <span
                              key={street}
                              className="inline-flex items-center gap-1 text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300 px-2.5 py-1 rounded-xl"
                            >
                              <span>{street}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveStreetFromAssoc(assoc, street)}
                                className="text-slate-400 hover:text-slate-800 ml-0.5 cursor-pointer"
                                title="Remover rua"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>

                      {assoc.cerca_virtual && (
                        <div className="pt-1">
                          <span className="text-[10px] font-black text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-300 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Cerca Virtual Ativa ({assoc.cerca_virtual.descricao_area || 'Geofence Configurado'})</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Matching Packages Summary */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-600">
                      Pacotes Agrupados nesta Associação:
                    </span>
                    <span className="font-black text-purple-800 bg-purple-100 px-3 py-1 rounded-full">
                      {matchingDeliveries.length} pacotes
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 4: AJUSTE MANUAL & TRIAGEM DE FALHAS                              */}
      {/* ========================================================================= */}
      {subTab === 'manual_fix' && (
        <div className="space-y-5">
          
          {/* Section Header */}
          <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-amber-950 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <span>Fila de Triagem de Falhas (Ajuste Manual)</span>
              </h3>
              <p className="text-xs text-amber-900 mt-0.5">
                Pacotes onde a foto da etiqueta estava desfocada, escura ou com código ilegível.
              </p>
            </div>

            <span className="bg-amber-500 text-slate-950 font-black text-xs px-3.5 py-1.5 rounded-full shadow-2xs">
              {inRevisionCount} {inRevisionCount === 1 ? 'item pendente' : 'itens pendentes'}
            </span>
          </div>

          {/* List of Failure Items */}
          {inRevisionCount === 0 ? (
            <div className="bg-white rounded-3xl p-10 border border-slate-200 text-center text-slate-500 text-sm space-y-2">
              <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500" />
              <p className="font-black text-slate-800 text-base">Fila limpa! Nenhuma falha de leitura pendente.</p>
              <p className="text-xs text-slate-400">Todos os códigos foram escaneados ou corrigidos com sucesso.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {deliveries
                .filter(
                  (d) =>
                    d.status === 'em_revisao' &&
                    !d.nome_destinatario &&
                    !(d.endereco_completo || d.endereco_rua) &&
                    d.origem_leitura !== 'ocr_ai'
                )
                .map((item) => {
                  const currentEditVal =
                    manualCodeEdits[item.id_entrega] !== undefined
                      ? manualCodeEdits[item.id_entrega]
                      : item.codigo_pacote;

                  return (
                    <div
                      key={item.id_entrega}
                      className="bg-white rounded-3xl border-2 border-amber-300 p-5 shadow-xs space-y-4 flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        {/* Header Badge */}
                        <div className="flex items-center justify-between border-b border-amber-100 pb-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 bg-blue-100 px-2.5 py-0.5 rounded-full">
                            ✏️ Preenchimento de Dados Pendente
                          </span>
                          <span className="text-[11px] font-mono text-slate-500">
                            {item.data_hora}
                          </span>
                        </div>

                        {/* High resolution Photo Preview Card */}
                        <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-950 aspect-[16/9] flex items-center justify-center">
                          <img
                            src={item.foto_pacote_path || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80'}
                            alt="Foto do Pacote para Ajuste"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded border border-white/20">
                            🔍 Foto da Etiqueta
                          </div>
                        </div>

                        {/* Input Box to Edit Code */}
                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1">
                            Código de Barras / Rastreio Correto:
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={currentEditVal}
                              onChange={(e) =>
                                setManualCodeEdits((prev) => ({
                                  ...prev,
                                  [item.id_entrega]: e.target.value.toUpperCase(),
                                }))
                              }
                              className="flex-1 bg-amber-50/50 border-2 border-amber-400 rounded-xl px-3 py-2 text-sm font-mono font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                              placeholder="Digite o código real ex: JT123456789BR"
                            />
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Destinatário: <strong>{item.recebedor_detalhes}</strong> ({item.endereco_rua || 'Rua sem nome'})
                          </p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        <button
                          onClick={() => onSelectDeliveryForReceipt(item)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-600" />
                          <span>Ver Fotos</span>
                        </button>

                        <button
                          onClick={() => handleSaveManualFix(item)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-[0.98]"
                        >
                          <Check className="w-4 h-4" />
                          <span>Aprovar para Baixa</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

        </div>
      )}

    </div>
  );
};
