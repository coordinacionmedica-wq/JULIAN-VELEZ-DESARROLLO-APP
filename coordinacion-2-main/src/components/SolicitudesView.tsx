import { motion } from 'motion/react';
import { Plus, Send, Clock, Save, CheckCircle, XCircle } from 'lucide-react';
import { UserSession, SlotType, ShiftRequest } from '../types';

interface Props {
  session: UserSession;
  daysInMonth: number;
  reqDay: number;
  setReqDay: (d: number) => void;
  reqSlot: SlotType;
  setReqSlot: (s: SlotType) => void;
  reqReason: string;
  setReqReason: (r: string) => void;
  onSubmit: () => void;
  shiftRequests: ShiftRequest[];
  selectedMonth: number;
  selectedYear: number;
  onExport: () => void;
  onUpdateStatus: (id: string, status: 'approved' | 'rejected') => void;
}

export function SolicitudesView({
  session, daysInMonth, reqDay, setReqDay, reqSlot, setReqSlot,
  reqReason, setReqReason, onSubmit, shiftRequests, selectedMonth,
  selectedYear, onExport, onUpdateStatus
}: Props) {
  const isAdmin = session.r === 'admin';
  const filtered = shiftRequests.filter(r =>
    (session.r === 'doctor' ? r.doctorId === session.doctorId : true) &&
    r.targetMonth === selectedMonth && r.targetYear === selectedYear
  );

  return (
    <motion.div
      key="solicitudes"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-6"
    >
      {session.r === 'doctor' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-black text-sky-600 mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nueva Solicitud de Cambio
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-slate-400 uppercase ml-2 mb-1 block font-bold">Día del Cambio</label>
              <select className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg outline-none text-sm text-slate-800" value={reqDay} onChange={e => setReqDay(parseInt(e.target.value))}>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => <option key={d} value={d}>Día {d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 uppercase ml-2 mb-1 block font-bold">Jornada</label>
              <select className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg outline-none text-sm text-slate-800" value={reqSlot} onChange={e => setReqSlot(e.target.value as SlotType)}>
                <option value="m">Mañana</option>
                <option value="t">Tarde</option>
                <option value="n">Noche</option>
              </select>
            </div>
            <div className="sm:col-span-3">
              <label className="text-xs text-slate-400 uppercase ml-2 mb-1 block font-bold">Motivo / Detalle del cambio</label>
              <textarea className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg outline-none focus:border-sky-500 min-h-[72px] text-sm text-slate-800" placeholder="Describa el cambio solicitado..." value={reqReason} onChange={e => setReqReason(e.target.value)} />
            </div>
          </div>
          <button onClick={onSubmit} className="w-full mt-3 bg-sky-500 text-white font-black py-2.5 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-xs shadow-md shadow-sky-500/20">
            <Send className="w-4 h-4" /> Enviar Solicitud
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-black text-emerald-700 flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-600" /> Historial de Solicitudes
          </h3>
          {isAdmin && (
            <button onClick={onExport} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-600 px-4 py-2 rounded-xl text-xs font-bold border border-emerald-200 flex items-center gap-2 shadow-sm transition-all">
              <Save className="w-4 h-4" /> EXPORTAR TXT
            </button>
          )}
        </div>

        <div className="space-y-4">
          {filtered.length === 0 ? (
            <p className="text-center py-10 text-slate-300 uppercase font-black text-xs italic">No hay solicitudes registradas</p>
          ) : (
            filtered.map(req => (
              <div key={req.id} className="bg-stone-50 p-3 rounded-xl border border-emerald-100 flex flex-wrap items-center justify-between gap-3 hover:border-emerald-300 transition-colors">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 mb-1">
                    {isAdmin && <span className="text-emerald-600 font-bold">Dr. {req.doctorName} - </span>}
                    <span className="text-slate-800 font-bold uppercase">Día {req.day} ({req.slot.toUpperCase()})</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-black uppercase ${
                      req.status === 'pending' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                      req.status === 'approved' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                      'bg-rose-100 text-rose-700 border border-rose-200'
                    }`}>
                      {req.status === 'pending' ? 'Pendiente' : req.status === 'approved' ? 'Aprobado' : 'Rechazado'}
                    </span>
                  </div>
                  <p className="text-slate-500 text-sm italic">"{req.reason}"</p>
                  <div className="text-xs text-slate-400 mt-2">{new Date(req.timestamp).toLocaleString()}</div>
                </div>

                {isAdmin && req.status === 'pending' && (
                  <div className="flex gap-2">
                    <button onClick={() => onUpdateStatus(String(req.id), 'approved')} className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white p-3 rounded-xl border border-emerald-500/30 transition-all">
                      <CheckCircle className="w-5 h-5" />
                    </button>
                    <button onClick={() => onUpdateStatus(String(req.id), 'rejected')} className="bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white p-3 rounded-xl border border-rose-500/30 transition-all">
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
}
