import React from 'react';
import { BrainCircuit, Sparkles, Wand2, Info } from 'lucide-react';
import { MonthlyData } from '../../types';

interface TurneroAIPanelProps {
  isGenerating: boolean;
  suggestions: MonthlyData | null;
  onGenerate: () => void;
  onApply: () => void;
  onDiscard: () => void;
}

export function TurneroAIPanel({ isGenerating, suggestions, onGenerate, onApply, onDiscard }: TurneroAIPanelProps) {
  return (
    <div className="bg-emerald-900 text-emerald-100 p-3 md:p-4 rounded-xl border border-emerald-800 shadow-lg no-print">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 md:gap-3">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="p-1.5 md:p-2 bg-emerald-800 rounded-lg text-emerald-400">
            <BrainCircuit className="w-4 h-4 md:w-5 md:h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-black uppercase tracking-tight text-white text-xs md:text-sm">IA Shift Engine</h3>
            <p className="text-[8px] md:text-xs uppercase font-bold opacity-60">Generador de mallas automáticas</p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {suggestions ? (
            <>
              <button
                onClick={onDiscard}
                className="flex-1 sm:flex-none bg-slate-800 text-white px-2.5 md:px-3 py-1.5 rounded-lg font-bold text-xs md:text-xs hover:bg-slate-700 transition-all border border-slate-700"
              >
                DESCARTAR
              </button>
              <button
                onClick={onApply}
                className="flex-1 sm:flex-none bg-emerald-500 text-white px-3 md:px-4 py-1.5 rounded-lg font-black text-xs md:text-xs hover:bg-emerald-400 transition-all shadow-md shadow-emerald-500/20"
              >
                APLICAR MALLA
              </button>
            </>
          ) : (
            <button
              onClick={onGenerate}
              disabled={isGenerating}
              className="flex-1 sm:flex-none bg-white text-emerald-900 px-3 md:px-4 py-1.5 rounded-lg font-black text-xs md:text-xs hover:bg-emerald-50 transition-all shadow-md shadow-white/10 disabled:opacity-50"
            >
              {isGenerating ? (
                <span className="flex items-center justify-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5 animate-spin" /> PROCESANDO...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> GENERAR PROPUESTA
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {suggestions && (
        <div className="mt-2 md:mt-3 p-2 md:p-2.5 bg-emerald-950/50 rounded-lg border border-emerald-800/50">
          <p className="text-[8px] md:text-xs font-bold text-emerald-400 uppercase italic flex items-center gap-1.5">
            <Info className="w-3 h-3 flex-shrink-0" /> Propuesta generada. Revise antes de aplicar.
          </p>
        </div>
      )}
    </div>
  );
}
