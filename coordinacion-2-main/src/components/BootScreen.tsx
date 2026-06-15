import { motion } from 'motion/react';

export function BootScreen() {
  return (
    <div className="fixed inset-0 bg-stone-50 flex flex-col items-center justify-center z-50">
      <motion.div 
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="text-6xl mb-4"
      >
        🏥
      </motion.div>
      <h1 className="font-bold text-3xl text-emerald-700 tracking-widest uppercase">COORDINACION MEDICA HDSAR</h1>
      <p className="text-xs text-emerald-600/60 mt-2 font-mono">CONSOLIDACIÓN TOTAL V27.0 - REACT</p>
    </div>
  );
}
