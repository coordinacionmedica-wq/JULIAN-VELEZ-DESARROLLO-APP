import { AnimatePresence, motion } from 'motion/react';
import { XCircle, Flame, AlertCircle, Timer, Syringe, HeartPulse } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function CodigoRojoModal({ isOpen, onClose }: Props) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[300] flex items-center justify-center p-4 overflow-y-auto">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white w-full max-w-4xl rounded-[40px] shadow-2xl p-8 border border-rose-100 relative"
          >
            <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-rose-50 rounded-full text-rose-400 hover:text-rose-600 transition-colors z-30">
              <XCircle className="w-6 h-6" />
            </button>

            <div className="mb-8 flex items-center gap-6">
              <div className="p-5 bg-rose-100 rounded-3xl text-rose-600 animate-pulse shadow-lg shadow-rose-200">
                <Flame className="w-10 h-10" />
              </div>
              <div>
                <h2 className="text-4xl font-black text-slate-800 tracking-tighter">CÓDIGO ROJO</h2>
                <p className="text-sm text-rose-600 font-black uppercase tracking-[0.2em] mt-1">Hemorragia Obstétrica • Protocolo HDSAR</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="col-span-1 md:col-span-3 bg-rose-600 p-6 rounded-3xl text-white shadow-lg">
                <h3 className="font-black text-xs mb-4 uppercase flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" /> PANEL DE ALERTA TEMPRANA (GRADOS DE CHOQUE)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white/10 p-3 rounded-2xl border border-white/20">
                    <div className="text-xs uppercase opacity-70 font-bold mb-1">Sensorio</div>
                    <div className="text-xs font-black">Normal / Agitado / Letárgico</div>
                  </div>
                  <div className="bg-white/10 p-3 rounded-2xl border border-white/20">
                    <div className="text-xs uppercase opacity-70 font-bold mb-1">Perfusión</div>
                    <div className="text-xs font-black">Normal / Pálida / Fría / Sudorosa</div>
                  </div>
                  <div className="bg-white/10 p-3 rounded-2xl border border-white/20">
                    <div className="text-xs uppercase opacity-70 font-bold mb-1">Pulso (LPM)</div>
                    <div className="text-xs font-black">60-90 / 91-100 / 101-120 / &gt;120</div>
                  </div>
                  <div className="bg-white/10 p-3 rounded-2xl border border-white/20">
                    <div className="text-xs uppercase opacity-70 font-bold mb-1">Presión Sistólica</div>
                    <div className="text-xs font-black">&gt;90 / 80-90 / 70-79 / &lt;70 mmHg</div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-rose-50 p-6 rounded-3xl border border-rose-100">
                  <h3 className="font-black text-rose-700 text-xs mb-4 uppercase flex items-center gap-2">
                    <Timer className="w-4 h-4" /> MINUTO 0: ACTIVACIÓN
                  </h3>
                  <ul className="space-y-2 text-xs font-bold text-slate-600">
                    <li className="flex gap-2"><span>1.</span> Identificar choque o hemorragia &gt;500ml</li>
                    <li className="flex gap-2"><span>2.</span> Alertar al equipo y activar alarma</li>
                    <li className="flex gap-2"><span>3.</span> Oxígeno por cánula (3L) o máscara</li>
                    <li className="flex gap-2"><span>4.</span> Posición Decúbito Lateral Izq.</li>
                  </ul>
                </div>
                <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100">
                  <h3 className="font-black text-amber-700 text-xs mb-4 uppercase">DISTRIBUCIÓN DEL EQUIPO</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 bg-amber-500 rounded-full" />
                      <span className="font-black">Coordinador:</span> Dirige y ordena
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      <span className="font-black">Asistente 1:</span> Vía Aérea (Cabeza)
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="font-black">Asistente 2:</span> Circulación (Brazos)
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
                  <h3 className="font-black text-emerald-700 text-xs mb-4 uppercase flex items-center gap-2">
                    <Syringe className="w-4 h-4" /> MINUTO 1-20: REANIMACIÓN
                  </h3>
                  <ul className="space-y-2 text-xs font-bold text-slate-600">
                    <li className="flex gap-2"><span>•</span> 2 Catéteres gruesos (#14 o #16)</li>
                    <li className="flex gap-2"><span>•</span> Muestras: Hemoclasif, Hemograma, Pruebas Coag.</li>
                    <li className="flex gap-2"><span>•</span> Cristaloides calientes (2 Litros)</li>
                    <li className="flex gap-2"><span>•</span> Sonda Foley para control de diuresis</li>
                  </ul>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-200">
                  <h3 className="font-black text-slate-800 text-xs mb-4 uppercase flex items-center gap-2">
                    <HeartPulse className="w-4 h-4" /> MINUTO 20-60: HEMOSTASIA
                  </h3>
                  <div className="space-y-2 text-xs font-bold text-slate-500">
                    <div className="p-2 bg-slate-100 rounded-lg">Masaje Uterino Bimanual Permanente</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 bg-rose-50 text-rose-700 rounded-lg">Oxitocina: 40 UI IV</div>
                      <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">Misoprostol: 800mcg</div>
                    </div>
                    <div className="p-2 bg-amber-50 text-amber-700 rounded-lg">Tranexámico: 1g IV lento</div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl">
                  <h3 className="font-black text-rose-500 text-xs mb-4 uppercase flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> MANEJO AVANZADO
                  </h3>
                  <p className="text-xs opacity-70 mb-4 italic leading-relaxed">Si la hemorragia persiste tras 60 minutos o el choque es grave:</p>
                  <ul className="space-y-3 text-xs font-black">
                    <li className="flex gap-3 items-center text-rose-400">
                      <div className="w-4 h-4 rounded-full border border-rose-500 flex items-center justify-center text-[8px]">1</div>
                      INICIAR TRANSFUSIÓN (PAQUETE 1)
                    </li>
                    <li className="flex gap-3 items-center">
                      <div className="w-4 h-4 rounded-full border border-slate-500 flex items-center justify-center text-[8px]">2</div>
                      DECISIÓN QUIRÚRGICA
                    </li>
                    <li className="flex gap-3 items-center">
                      <div className="w-4 h-4 rounded-full border border-slate-500 flex items-center justify-center text-[8px]">3</div>
                      DETERMINAR REMISIÓN NIVEL III
                    </li>
                  </ul>
                </div>
                <div className="p-4 rounded-2xl border-2 border-dashed border-rose-200 text-center">
                  <p className="text-xs font-black text-rose-400 uppercase">🚨 LLAMADO PRIORITARIO: GINECO-OBSTETRICIA</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
