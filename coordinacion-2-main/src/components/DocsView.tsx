import React from 'react';
import { motion } from 'motion/react';
import { FileText, Users } from 'lucide-react';

interface DocsViewProps {
  onShowAntibioticManual: () => void;
  onShowInductionManual: () => void;
}

export function DocsView({ onShowAntibioticManual, onShowInductionManual }: DocsViewProps) {
  return (
    <motion.div
      key="docs"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-full space-y-4"
    >
      <div className="flex gap-4">
        <button
          className="flex-1 p-6 bg-emerald-50 rounded-2xl border border-emerald-100 hover:border-emerald-500 transition-all flex items-center justify-center gap-3 font-bold text-emerald-800 shadow-sm"
          onClick={onShowAntibioticManual}
        >
          <FileText className="text-emerald-600" /> Manual Antibióticos
        </button>
        <button
          className="flex-1 p-6 bg-rose-50 rounded-2xl border border-rose-100 hover:border-rose-500 transition-all flex items-center justify-center gap-3 font-bold text-rose-800 shadow-sm"
          onClick={onShowInductionManual}
        >
          <Users className="text-rose-500" /> Inducción General
        </button>
      </div>
      <div className="bg-white rounded-3xl h-[60vh] flex items-center justify-center text-slate-300 overflow-hidden">
        <p className="text-slate-400 italic">Pre-visualización de PDF bloqueada por políticas de iframe.</p>
      </div>
    </motion.div>
  );
}
