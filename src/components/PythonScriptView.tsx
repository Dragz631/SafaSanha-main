import React, { useState } from 'react';
import { Copy, Check, Download, Terminal, Code2, Cpu, Crosshair, Bot } from 'lucide-react';
import {
  PYTHON_STREAMLIT_CODE,
  PYTHON_MAPEADOR_CODE,
  PYTHON_ROBO_CODE,
} from '../lib/pythonCode';

type ScriptType = 'streamlit' | 'mapeador' | 'robo';

export const PythonScriptView: React.FC = () => {
  const [selectedScript, setSelectedScript] = useState<ScriptType>('robo');
  const [copied, setCopied] = useState(false);

  const getScriptContent = () => {
    switch (selectedScript) {
      case 'streamlit':
        return PYTHON_STREAMLIT_CODE;
      case 'mapeador':
        return PYTHON_MAPEADOR_CODE;
      case 'robo':
        return PYTHON_ROBO_CODE;
      default:
        return PYTHON_ROBO_CODE;
    }
  };

  const getScriptFileName = () => {
    switch (selectedScript) {
      case 'streamlit':
        return 'app.py';
      case 'mapeador':
        return 'mapeador_coordenadas.py';
      case 'robo':
        return 'robo_baixa_jt.py';
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(getScriptContent());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPyFile = () => {
    const blob = new Blob([getScriptContent()], { type: 'text/x-python;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getScriptFileName();
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-6 space-y-6">
      
      {/* Title Header */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-black uppercase tracking-wider mb-2">
            <Bot className="w-3.5 h-3.5" />
            <span>PASSO 4 — Scripts em Python / RPA Local</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>Suíte de Automação & Robô de Baixa em Emulador</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Scripts locais prontos para execução no computador do supervisor ou entregador.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyCode}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copiado!' : 'Copiar Código'}</span>
          </button>

          <button
            onClick={handleDownloadPyFile}
            className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
          >
            <Download className="w-4 h-4 text-blue-300" />
            <span>Baixar {getScriptFileName()}</span>
          </button>
        </div>
      </div>

      {/* Script Selector Tabs */}
      <div className="flex flex-wrap items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200 gap-1 text-xs sm:text-sm font-bold">
        <button
          onClick={() => setSelectedScript('robo')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            selectedScript === 'robo'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-700 hover:bg-slate-200/80'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>SCRIPT 2: robo_baixa_jt.py (Robô Executor RPA)</span>
        </button>

        <button
          onClick={() => setSelectedScript('mapeador')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            selectedScript === 'mapeador'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-700 hover:bg-slate-200/80'
          }`}
        >
          <Crosshair className="w-4 h-4" />
          <span>SCRIPT 1: mapeador_coordenadas.py (Mapeador X,Y)</span>
        </button>

        <button
          onClick={() => setSelectedScript('streamlit')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            selectedScript === 'streamlit'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-700 hover:bg-slate-200/80'
          }`}
        >
          <Code2 className="w-4 h-4" />
          <span>Streamlit Web (app.py)</span>
        </button>
      </div>

      {/* Terminal Setup Instructions */}
      <div className="bg-slate-900 text-slate-200 rounded-3xl p-5 shadow-lg border border-slate-800 space-y-3 font-sans">
        <h3 className="font-bold text-sm text-emerald-400 flex items-center gap-2">
          <Terminal className="w-4 h-4" />
          <span>Como Executar este Script no Seu Computador (Terminal Python):</span>
        </h3>

        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 font-mono text-xs text-emerald-300 space-y-2 overflow-x-auto">
          <p className="text-slate-500"># 1. Instalar dependências para o Robô e Câmera Virtual</p>
          <p className="font-bold text-white">pip install pyautogui pyobsadmin opencv-python pyvirtualcam</p>
          <p className="text-slate-500"># 2. Executar o script selecionado ({getScriptFileName()})</p>
          <p className="font-bold text-white">python {getScriptFileName()}</p>
        </div>
        <p className="text-[11px] text-amber-300 font-medium">
          🚨 <strong>Trava de Emergência:</strong> O PyAutoGUI está configurado com <code className="bg-slate-800 px-1 py-0.5 rounded text-amber-200">FAILSAFE = True</code>. Se o robô precisar ser interrompido imediatamente, basta mover o cursor do mouse para o <strong>Canto Superior Esquerdo</strong> da tela.
        </p>
      </div>

      {/* Code Block Container */}
      <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="bg-slate-950 px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <span className="font-mono text-xs text-slate-400 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
            <span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" />
            <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
            <span className="ml-2 font-black text-white">{getScriptFileName()}</span>
          </span>
          <span className="text-[11px] text-emerald-400 font-mono font-bold">
            Python 3.10+ | PyAutoGUI | OpenCV | OBS VirtualCam
          </span>
        </div>

        <pre className="p-5 text-xs font-mono text-slate-200 overflow-x-auto max-h-[650px] leading-relaxed">
          <code>{getScriptContent()}</code>
        </pre>
      </div>

    </div>
  );
};

