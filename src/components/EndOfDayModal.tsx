import React, { useState } from 'react';
import {
  X,
  Check,
  RotateCcw,
  AlertTriangle,
  Send,
  Copy,
  Package,
  Sparkles,
  ArrowRight,
  Truck,
  Building,
  CheckCircle2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { UserProfile, UserStreet, StreetPackage, DayHistoryRecord } from '../types';
import {
  formatDaySummaryWhatsAppMessage,
  openWhatsApp,
  copyToClipboard,
  archiveDayHistory,
} from '../lib/userStorage';

interface EndOfDayModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  streets: UserStreet[];
  whatsappPhone?: string;
  onDayFinalized: (updatedStreets: UserStreet[], newRecord: DayHistoryRecord) => void;
  onReattemptPackages: (packagesToReset: { streetId: string; pkgId: string }[]) => void;
}

export const EndOfDayModal: React.FC<EndOfDayModalProps> = ({
  isOpen,
  onClose,
  user,
  streets,
  whatsappPhone,
  onDayFinalized,
  onReattemptPackages,
}) => {
  if (!isOpen) return null;

  // Gather all failures
  const allFailures: { streetId: string; streetName: string; pkg: StreetPackage }[] = [];
  let totalPkgs = 0;
  let deliveredPkgs = 0;

  streets.forEach((s) => {
    totalPkgs += s.packages.length;
    deliveredPkgs += s.packages.filter((p) => p.status === 'delivered').length;
    s.packages.filter((p) => p.status === 'failed').forEach((pkg) => {
      allFailures.push({ streetId: s.id, streetName: s.name, pkg });
    });
  });

  const hasFailures = allFailures.length > 0;

  // Step state:
  // 'ask_reattempt' (if failures exist) -> 'select_reattempts' (if chose to re-attempt) OR 'configure_resolutions' (if finalizing with failures)
  // 'final_summary' (if 0 failures or ready to send)
  const [step, setStep] = useState<'ask_reattempt' | 'select_reattempts' | 'configure_resolutions' | 'final_summary'>(
    hasFailures ? 'ask_reattempt' : 'final_summary'
  );

  // Selected packages to re-attempt
  const [selectedToReattempt, setSelectedToReattempt] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    allFailures.forEach((f) => {
      map[f.pkg.id] = true;
    });
    return map;
  });

  // Failed packages destination: 'reroute' | 'return_to_hub'
  const [failedResolutions, setFailedResolutions] = useState<Record<string, 'reroute' | 'return_to_hub'>>(() => {
    const map: Record<string, 'reroute' | 'return_to_hub'> = {};
    allFailures.forEach((f) => {
      map[f.pkg.id] = 'return_to_hub';
    });
    return map;
  });

  const [copied, setCopied] = useState(false);
  const summaryMessage = formatDaySummaryWhatsAppMessage(user.name, streets);

  // Re-attempt selected packages
  const handleExecuteReattempts = () => {
    const toReset: { streetId: string; pkgId: string }[] = [];
    allFailures.forEach((f) => {
      if (selectedToReattempt[f.pkg.id]) {
        toReset.push({ streetId: f.streetId, pkgId: f.pkg.id });
      }
    });

    if (toReset.length > 0) {
      onReattemptPackages(toReset);
      alert(`✅ ${toReset.length} pacote(s) foram colocados novamente em rota como pendentes!`);
    }
    onClose();
  };

  // Finalize Day & Archive
  const handleFinalizeDay = async (openZap: boolean = false) => {
    const { updatedStreets, newRecord } = archiveDayHistory(
      user.id,
      user.name,
      streets,
      failedResolutions
    );

    await copyToClipboard(summaryMessage);

    if (openZap) {
      openWhatsApp(summaryMessage, whatsappPhone);
    }

    confetti({
      particleCount: 120,
      spread: 90,
      origin: { y: 0.5 },
    });

    onDayFinalized(updatedStreets, newRecord);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-400/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-lg">Fechamento do Dia de Entrega</h3>
              <p className="text-xs text-slate-300">
                {deliveredPkgs} entregas concluídas • {allFailures.length} insucessos
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* STEP 1: Ask if day has finished or want to retry failures */}
          {step === 'ask_reattempt' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-black text-sm text-amber-900">
                    Você possui {allFailures.length} encomenda(s) com insucesso hoje
                  </h4>
                  <p className="text-xs text-amber-800">
                    O seu dia de entregas acabou mesmo ou você irá tentar refazer alguma dessas entregas agora?
                  </p>
                </div>
              </div>

              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setStep('select_reattempts')}
                  className="w-full p-4 rounded-2xl border-2 border-emerald-500 bg-emerald-50/60 hover:bg-emerald-50 text-left flex items-center justify-between group transition-all cursor-pointer shadow-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
                      <RotateCcw className="w-5 h-5" />
                    </div>
                    <div>
                      <strong className="text-slate-900 text-sm block font-black">
                        Quero tentar reentregar agora
                      </strong>
                      <span className="text-slate-600 text-xs">
                        Selecione os pacotes para voltarem como pendentes no app
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-emerald-600 group-hover:translate-x-1 transition-transform" />
                </button>

                <button
                  type="button"
                  onClick={() => setStep('configure_resolutions')}
                  className="w-full p-4 rounded-2xl border-2 border-slate-300 hover:border-slate-400 bg-white text-left flex items-center justify-between group transition-all cursor-pointer shadow-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <strong className="text-slate-900 text-sm block font-black">
                        Não vou mais tentar hoje (Finalizar Dia)
                      </strong>
                      <span className="text-slate-600 text-xs">
                        Defina o destino das encomendas (Devolver ao Galpão ou Manter em Rota)
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-500 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2A: Select which packages to re-attempt now */}
          {step === 'select_reattempts' && (
            <div className="space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-sm text-slate-900">
                  Selecione as entregas para tentar novamente:
                </h4>
                <button
                  type="button"
                  onClick={() => setStep('ask_reattempt')}
                  className="text-xs text-slate-500 hover:underline font-bold cursor-pointer"
                >
                  Voltar
                </button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {allFailures.map(({ streetName, pkg }) => (
                  <label
                    key={pkg.id}
                    className={`p-3 rounded-2xl border-2 flex items-center justify-between gap-3 cursor-pointer transition-all ${
                      selectedToReattempt[pkg.id]
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={!!selectedToReattempt[pkg.id]}
                        onChange={(e) =>
                          setSelectedToReattempt((prev) => ({
                            ...prev,
                            [pkg.id]: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <div className="min-w-0">
                        <strong className="text-xs font-black truncate block">
                          Nº {pkg.houseNumber} {pkg.complement ? `(${pkg.complement})` : ''} • {streetName}
                        </strong>
                        <span className="text-[11px] text-slate-600">
                          {pkg.recipientName || 'Morador'} — <span className="text-red-700 font-bold">{pkg.failureReason || 'Ausente'}</span>
                        </span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleExecuteReattempts}
                  className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm shadow-md cursor-pointer flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Colocar Selecionados em Nova Tentativa</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2B: Configure what to do with failed packages (Galpão vs Rota amanhã) */}
          {step === 'configure_resolutions' && (
            <div className="space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div>
                  <h4 className="font-black text-sm text-slate-900">
                    Destino dos Pacotes não entregues:
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Escolha o que acontecerá com cada insucesso
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep('ask_reattempt')}
                  className="text-xs text-slate-500 hover:underline font-bold cursor-pointer"
                >
                  Voltar
                </button>
              </div>

              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {allFailures.map(({ streetName, pkg }) => {
                  const currentRes = failedResolutions[pkg.id] || 'return_to_hub';
                  return (
                    <div
                      key={pkg.id}
                      className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <strong className="text-xs font-black text-slate-900">
                            Nº {pkg.houseNumber} {pkg.complement ? `(${pkg.complement})` : ''} • {streetName}
                          </strong>
                          <div className="text-[11px] text-slate-600">
                            {pkg.recipientName || 'Morador'} — <span className="text-red-700 font-bold">{pkg.failureReason || 'Ausente'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Destination Buttons */}
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            setFailedResolutions((prev) => ({
                              ...prev,
                              [pkg.id]: 'return_to_hub',
                            }))
                          }
                          className={`py-2 px-2.5 rounded-xl border-2 font-black text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            currentRes === 'return_to_hub'
                              ? 'border-red-600 bg-red-50 text-red-900 shadow-xs'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <Building className="w-3.5 h-3.5 text-red-600 shrink-0" />
                          <span>Devolver Galpão</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setFailedResolutions((prev) => ({
                              ...prev,
                              [pkg.id]: 'reroute',
                            }))
                          }
                          className={`py-2 px-2.5 rounded-xl border-2 font-black text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            currentRes === 'reroute'
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-xs'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <Truck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Manter em Rota</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setStep('final_summary')}
                  className="w-full py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs sm:text-sm shadow-md cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Avançar para Enviar Resumo do Dia</span>
                  <ArrowRight className="w-4 h-4 text-emerald-400" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Final Summary & Archive confirmation */}
          {step === 'final_summary' && (
            <div className="space-y-3.5 animate-fadeIn">
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 space-y-1">
                <h4 className="font-black text-sm text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Pronto para finalizar o dia!
                </h4>
                <p className="text-xs text-emerald-800">
                  O resumo do dia foi formatado e ficará salvo permanentemente no seu histórico de entregas.
                </p>
              </div>

              {/* Text Preview */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
                  <span>Resumo do Dia (WhatsApp):</span>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await copyToClipboard(summaryMessage);
                      if (ok) {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }
                    }}
                    className="text-emerald-700 hover:text-emerald-800 flex items-center gap-1 font-bold cursor-pointer"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                  </button>
                </div>

                <pre className="p-3.5 rounded-2xl bg-slate-900 text-emerald-300 font-mono text-[11px] leading-relaxed whitespace-pre-wrap select-all border border-slate-800 shadow-inner max-h-52 overflow-y-auto">
                  {summaryMessage}
                </pre>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleFinalizeDay(false)}
                  className="py-3 px-3 rounded-2xl border-2 border-slate-300 hover:bg-slate-100 font-black text-xs text-slate-800 shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Copiar & Finalizar Dia</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleFinalizeDay(true)}
                  className="py-3 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Send className="w-4 h-4" />
                  <span>Enviar no Zap & Finalizar</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
