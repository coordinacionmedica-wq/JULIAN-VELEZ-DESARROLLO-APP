import { AnimatePresence, motion } from 'motion/react';
import { XCircle, Activity, Search } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function CodigoAzulModal({ isOpen, onClose }: Props) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[300] flex items-center justify-center p-4 overflow-y-auto">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white w-full max-w-4xl rounded-[40px] shadow-2xl p-8 border border-blue-100 relative"
          >
            <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-blue-50 rounded-full text-blue-400 hover:text-blue-600 transition-colors z-30">
              <XCircle className="w-6 h-6" />
            </button>

            <div className="mb-8 flex items-center gap-6">
              <div className="p-5 bg-blue-100 rounded-3xl text-blue-600 shadow-lg shadow-blue-200">
                <Activity className="w-10 h-10" />
              </div>
              <div>
                <h2 className="text-4xl font-black text-slate-800 tracking-tighter">CÓDIGO AZUL</h2>
                <p className="text-sm text-blue-600 font-black uppercase tracking-[0.2em] mt-1">RCP Avanzado • Soporte Vital HDSAR</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-4">
                <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
                  <h3 className="font-black text-blue-700 text-xs mb-4 uppercase">1. RECONOCIMIENTO</h3>
                  <div className="space-y-2 text-xs font-bold text-slate-600">
                    <div className="p-2 bg-white rounded-lg">• Verificar escena segura</div>
                    <div className="p-2 bg-white rounded-lg font-black text-blue-600">• ¿No responde? Pedir apoyo</div>
                    <div className="p-2 bg-white rounded-lg">• Pulso y Resp (&lt; 10s)</div>
                  </div>
                </div>
                <div className="bg-slate-900 text-white p-6 rounded-3xl">
                  <h3 className="font-black text-blue-400 text-xs mb-4 uppercase">2. COMPRESIONES (CAB)</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="text-xl font-black text-blue-500">30:2</div>
                      <div className="text-xs leading-tight">Ciclo de compresiones y ventilaciones</div>
                    </div>
                    <p className="text-xs opacity-60">Frecuencia: 100-120 lpm. Profundidad: 5-6 cm. Permitir descompresión total.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100">
                  <h3 className="font-black text-amber-700 text-xs mb-4 uppercase">3. RITMOS DESFIBRILABLES</h3>
                  <p className="text-xs font-black text-slate-400 mb-3 uppercase">TVSP / FV</p>
                  <div className="space-y-3 text-xs font-bold">
                    <div className="p-3 bg-white rounded-xl border border-amber-200 text-amber-600 text-center">DESCARGA (200J Bifásico)</div>
                    <div className="p-3 bg-white rounded-xl border border-slate-100">Adrenalina 1mg (3-5 min)</div>
                    <div className="p-3 bg-white rounded-xl border border-slate-100">Amiodarona 300mg / 150mg</div>
                  </div>
                </div>
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                  <h3 className="font-black text-slate-400 text-xs mb-4 uppercase">4. RITMOS NO DESFIBRILABLES</h3>
                  <p className="text-xs font-black text-slate-400 mb-3 uppercase">Asistolia / AESP</p>
                  <div className="space-y-3 text-xs font-bold">
                    <div className="p-3 bg-blue-600 text-white rounded-xl text-center shadow-lg">ADRENALINA LO ANTES POSIBLE</div>
                    <div className="p-3 bg-white rounded-xl border border-slate-200">RCP Continuo (2 min)</div>
                    <div className="p-3 bg-white rounded-xl border border-slate-200">Tratar causas (5H / 5T)</div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-white p-6 rounded-3xl border-2 border-blue-100 h-full">
                  <h3 className="font-black text-slate-800 text-xs mb-4 uppercase flex items-center gap-2">
                    <Search className="w-4 h-4 text-blue-500" /> CAUSAS REVERSIBLES
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-xs font-bold">
                    <div className="space-y-1">
                      <p className="text-blue-600">5 H's</p>
                      <p>• Hipovolemia</p>
                      <p>• Hipoxia</p>
                      <p>• Hidrogeniones</p>
                      <p>• Hipo/Hiper K</p>
                      <p>• Hipotermia</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-rose-600">5 T's</p>
                      <p>• Tensión Neum.</p>
                      <p>• Taponamiento</p>
                      <p>• Tóxicos</p>
                      <p>• Tromb Pulm.</p>
                      <p>• Tromb Coro.</p>
                    </div>
                  </div>
                  <div className="mt-8 p-4 bg-blue-50 rounded-2xl">
                    <p className="text-xs font-black text-blue-600 uppercase text-center">🚨 VÍA AÉREA AVANZADA Y CAPNOGRAFÍA</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
