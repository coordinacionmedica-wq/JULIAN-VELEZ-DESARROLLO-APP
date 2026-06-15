import { AnimatePresence, motion } from 'motion/react';
import { XCircle, Calendar, Database, BrainCircuit, ClipboardList, FileText, Plus, Trash2 } from 'lucide-react';
import { TrainingActivity } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedMonth: number;
  selectedYear: number;
  monthName: string;
  newActivity: Partial<TrainingActivity>;
  setNewActivity: (a: Partial<TrainingActivity> | ((prev: Partial<TrainingActivity>) => Partial<TrainingActivity>)) => void;
  onAdd: () => void;
  activities: TrainingActivity[];
  onDelete: (id: string) => void;
  onExportExcel: () => void;
  onExportPDF: () => void;
}

export function ActivitiesModal({
  isOpen, onClose, selectedMonth, selectedYear, monthName,
  newActivity, setNewActivity, onAdd, activities, onDelete,
  onExportExcel, onExportPDF
}: Props) {
  const monthActivities = activities.filter(a => a.month === selectedMonth && a.year === selectedYear);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white w-full max-w-4xl rounded-[40px] shadow-2xl p-8 border border-amber-100 relative max-h-[90vh] overflow-y-auto custom-scrollbar"
          >
            <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-stone-50 rounded-full text-slate-400 hover:text-rose-500 transition-colors z-30">
              <XCircle className="w-6 h-6" />
            </button>

            <div className="mb-8 flex items-center gap-4">
              <div className="p-4 bg-amber-50 rounded-3xl text-amber-600">
                <Calendar className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">PIC - Programa Institucional de Capacitaciones</h2>
                <p className="text-xs text-amber-600 font-bold uppercase tracking-widest tracking-tighter">Plan de Capacitación HDSAR - {monthName} {selectedYear}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={onExportExcel} className="px-3 py-2 text-xs font-black bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 transition-colors uppercase border border-emerald-100">Excel</button>
                <button onClick={onExportPDF} className="px-3 py-2 text-xs font-black bg-rose-50 text-rose-700 rounded-xl hover:bg-rose-100 transition-colors uppercase border border-rose-100">PDF</button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="bg-amber-50/30 p-6 rounded-[32px] border border-amber-100">
                  <h4 className="text-xs font-black text-amber-700 uppercase mb-4 tracking-widest">Información de la Actividad</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs uppercase font-black text-slate-400 mb-1 ml-2 block">Nombre de la Actividad</label>
                      <input placeholder="Nombre de la capacitación" className="w-full bg-white border border-slate-100 p-4 rounded-xl font-bold" value={newActivity.activityName || ''} onChange={e => setNewActivity({ ...newActivity, activityName: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs uppercase font-black text-slate-400 mb-1 ml-2 block">Día</label>
                        <input type="number" min={1} max={31} value={newActivity.day || ''} onChange={e => setNewActivity({ ...newActivity, day: Number(e.target.value) })} className="w-full bg-white border border-slate-100 p-4 rounded-xl font-bold" />
                      </div>
                      <div>
                        <label className="text-xs uppercase font-black text-slate-400 mb-1 ml-2 block">Horas</label>
                        <input type="number" value={newActivity.hours || ''} onChange={e => setNewActivity({ ...newActivity, hours: Number(e.target.value) })} className="w-full bg-white border border-slate-100 p-4 rounded-xl font-bold" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs uppercase font-black text-slate-400 mb-1 ml-2 block">Lugar / Ubicación</label>
                      <input placeholder="Ej: Auditorio HSE" className="w-full bg-white border border-slate-100 p-4 rounded-xl font-bold" value={newActivity.place || ''} onChange={e => setNewActivity({ ...newActivity, place: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs uppercase font-black text-slate-400 mb-1 ml-2 block">Modalidad</label>
                        <select value={newActivity.modality} onChange={e => setNewActivity({ ...newActivity, modality: e.target.value as any })} className="w-full bg-white border border-slate-100 p-4 rounded-xl font-bold">
                          <option value="presencial">Presencial</option>
                          <option value="virtual">Virtual</option>
                          <option value="mixta">Mixta</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs uppercase font-black text-slate-400 mb-1 ml-2 block">Dirigida a</label>
                        <input placeholder="Personal" className="w-full bg-white border border-slate-100 p-4 rounded-xl font-bold" value={newActivity.targetGroup || ''} onChange={e => setNewActivity({ ...newActivity, targetGroup: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs uppercase font-black text-slate-400 mb-1 ml-2 block">Responsable</label>
                        <input placeholder="Nombre" className="w-full bg-white border border-slate-100 p-4 rounded-xl font-bold" value={newActivity.responsible || ''} onChange={e => setNewActivity({ ...newActivity, responsible: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-xs uppercase font-black text-slate-400 mb-1 ml-2 block">Población Objetivo</label>
                        <input placeholder="Ej: Médicos" className="w-full bg-white border border-slate-100 p-4 rounded-xl font-bold" value={newActivity.targetPopulation || ''} onChange={e => setNewActivity({ ...newActivity, targetPopulation: e.target.value })} />
                      </div>
                    </div>
                  </div>
                </div>

                <button onClick={onAdd} className="w-full bg-amber-600 text-white font-black py-5 rounded-[24px] hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-amber-600/20 uppercase tracking-widest text-sm">CONFIRMAR Y GUARDAR ACTIVIDAD</button>
              </div>

              <div className="space-y-6">
                <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-200 h-full flex flex-col">
                  <h4 className="text-xs font-black text-slate-400 uppercase mb-4 tracking-widest">Documentación y Soportes</h4>
                  <div className="space-y-3 flex-1 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                    {[
                      { key: 'preTest', label: 'Base de datos / Pre-test', icon: Database },
                      { key: 'training', label: 'Capacitación (Lectura)', icon: BrainCircuit },
                      { key: 'attendance', label: 'Asistencia Digital Firmada', icon: ClipboardList },
                      { key: 'postTest', label: 'Post-test / Evaluación', icon: FileText }
                    ].map((item) => (
                      <div key={item.key} className="bg-white p-4 rounded-[20px] border border-slate-100 group">
                        <p className="text-xs uppercase font-black text-slate-400 mb-2">{item.label}</p>
                        <div className="flex items-center gap-3">
                          <label className="flex-1 flex items-center justify-between px-4 py-3 bg-stone-50 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-amber-50 hover:border-amber-500 transition-all">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                              <item.icon className="w-4 h-4 text-slate-400" />
                              <span className="truncate max-w-[150px]">{newActivity.files?.[item.key as keyof typeof newActivity.files] || 'Subir Archivo'}</span>
                            </div>
                            <Plus className="w-4 h-4 text-slate-300 group-hover:text-amber-600 transition-colors" />
                            <input type="file" className="hidden" onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setNewActivity(prev => ({ ...prev, files: { ...prev.files, [item.key]: file.name } }));
                              }
                            }} />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 pt-6 border-t border-slate-200">
                    <h5 className="text-xs font-black text-slate-400 uppercase mb-4 tracking-widest text-center italic">Actividades del Mes Actual</h5>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                      {monthActivities.map(a => (
                        <div key={a.id} className="bg-white p-3 rounded-xl border border-slate-100 flex justify-between items-center group shadow-sm transition-all hover:border-amber-200">
                          <div>
                            <p className="text-xs font-bold text-slate-800 leading-tight">{a.activityName}</p>
                            <p className="text-xs text-amber-600 font-bold uppercase">Día {a.day} • {a.modality} • {a.hours}h</p>
                          </div>
                          <button onClick={() => onDelete(a.id)} className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      {monthActivities.length === 0 && (
                        <p className="text-xs text-slate-300 text-center italic py-4">No hay actividades para {monthName}.</p>
                      )}
                    </div>
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
