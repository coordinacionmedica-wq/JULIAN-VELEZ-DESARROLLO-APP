import { AnimatePresence, motion } from 'motion/react';
import { XCircle, PhoneIncoming, Send } from 'lucide-react';
import { SlotType, MonthlyData, Doctor } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  callDay: number;
  setCallDay: (d: number) => void;
  callSlot: SlotType;
  setCallSlot: (s: SlotType) => void;
  callTargetId: number | null;
  setCallTargetId: (id: number | null) => void;
  callService: string;
  setCallService: (s: string) => void;
  callCaller: string;
  setCallCaller: (s: string) => void;
  daysInMonth: number;
  currentMonthData: MonthlyData;
  doctors: Doctor[];
  sessionName?: string;
  onConfirm: () => void;
}

export function CallModal({
  isOpen, onClose, callDay, setCallDay, callSlot, setCallSlot,
  callTargetId, setCallTargetId, callService, setCallService,
  callCaller, setCallCaller, daysInMonth, currentMonthData, doctors,
  sessionName, onConfirm
}: Props) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl p-8 border border-rose-100 relative"
          >
            <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-stone-50 rounded-full text-slate-400 hover:text-rose-500 transition-colors z-30">
              <XCircle className="w-6 h-6" />
            </button>

            <div className="mb-8 flex items-center gap-4">
              <div className="p-4 bg-rose-50 rounded-3xl text-rose-600">
                <PhoneIncoming className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-800">Llamado a Disponibilidad</h2>
                <p className="text-xs text-rose-500 font-bold uppercase tracking-widest">Protocolo de Asistencia Institucional</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs uppercase font-black text-slate-400 mb-1 ml-2 block">Día</label>
                  <input type="number" min={1} max={daysInMonth} value={callDay} onChange={e => { setCallDay(Number(e.target.value)); setCallTargetId(null); }} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl font-bold" />
                </div>
                <div>
                  <label className="text-xs uppercase font-black text-slate-400 mb-1 ml-2 block">Jornada</label>
                  <select value={callSlot} onChange={e => { setCallSlot(e.target.value as SlotType); setCallTargetId(null); }} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl font-bold">
                    <option value="m">Mañana</option>
                    <option value="t">Tarde</option>
                    <option value="n">Noche</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs uppercase font-black text-slate-400 mb-1 ml-2 block">Asistencial a Llamar</label>
                <select
                  value={callTargetId || ''}
                  onChange={e => setCallTargetId(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl font-bold"
                >
                  <option value="">Selección Automática (Primer Disponible)</option>
                  {Object.keys(currentMonthData).reduce((acc: any[], idStr) => {
                    const id = Number(idStr);
                    const sigla = currentMonthData[id]?.[callSlot]?.[callDay] || 'X';
                    if (sigla.startsWith('D')) {
                      const doc = doctors.find(d => d.id === id);
                      if (doc) acc.push({ id: doc.id, name: doc.nombre, sigla });
                    }
                    return acc;
                  }, []).map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.name} ({opt.sigla})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-xs uppercase font-black text-slate-400 mb-1 ml-2 block">Servicio o Labor Administrativa</label>
                  <select
                    value={callService}
                    onChange={e => setCallService(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl font-bold"
                  >
                    <option value="Traslado Médico">TRASLADO MÉDICO</option>
                    <option value="Apoyo Urgencias">APOYO URGENCIAS</option>
                    <option value="Apoyo Hospitalización">APOYO HOSPITALIZACIÓN</option>
                    <option value="Apoyo Observación">APOYO OBSERVACIÓN</option>
                    <option value="Apoyo al Triage">APOYO AL TRIAGE</option>
                    <option value="Cubrir Incapacidad">CUBRIR INCAPACIDAD</option>
                    <option value="Ayudantía Quirúrgica">AYUDANTÍA QUIRÚRGICA</option>
                    <option value="Brigadas">BRIGADAS</option>
                    <option value="Consulta Externa">CONSULTA EXTERNA</option>
                    <option value="Administrativo">ADMINISTRATIVO</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase font-black text-slate-400 mb-1 ml-2 block">Administrador / Enfermero que llama</label>
                  <input
                    type="text"
                    placeholder={sessionName || "Nombre del responsable"}
                    value={callCaller}
                    onChange={e => setCallCaller(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl font-bold font-mono"
                  />
                </div>
              </div>

              <button
                onClick={onConfirm}
                className="w-full bg-rose-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-rose-500/20 hover:bg-rose-700 transition-all flex items-center justify-center gap-3"
              >
                <Send className="w-5 h-5" /> GENERAR ALERTA DE LLAMADO
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
