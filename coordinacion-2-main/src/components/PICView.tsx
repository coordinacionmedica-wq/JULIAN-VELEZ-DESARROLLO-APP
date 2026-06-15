import React from 'react';
import { motion } from 'motion/react';
import {
  Calendar,
  Database,
  BrainCircuit,
  ClipboardList,
  FileText,
  Plus,
  Trash2,
  Clock,
} from 'lucide-react';
import { TrainingActivity } from '../types';
import { MONTH_NAMES } from '../constants';
import { useAppContext } from '../context/AppContext';

interface PICViewProps {
  onDeleteActivity: (id: string) => void;
  newActivity: Partial<TrainingActivity>;
  setNewActivity: React.Dispatch<React.SetStateAction<Partial<TrainingActivity>>>;
  onAddActivity: () => void;
  onExportExcel: () => void;
  onExportPDF: () => void;
}

export function PICView({ onDeleteActivity, newActivity, setNewActivity, onAddActivity, onExportExcel, onExportPDF }: PICViewProps) {
  const { activities, selectedMonth, selectedYear } = useAppContext();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-sm p-5 border border-amber-100"
    >
      <div className="mb-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600 w-fit">
          <Calendar className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-black text-slate-800">PIC — Programa Institucional de Capacitaciones</h2>
          <p className="text-xs text-amber-600 font-bold uppercase tracking-widest tracking-tighter">Plan de Capacitación HDSAR - {MONTH_NAMES[selectedMonth]} {selectedYear}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onExportExcel}
            className="px-4 py-2 text-xs font-black bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 transition-colors uppercase border border-emerald-100 h-fit"
          >
            Excel
          </button>
          <button
            onClick={onExportPDF}
            className="px-4 py-2 text-xs font-black bg-rose-50 text-rose-700 rounded-xl hover:bg-rose-100 transition-colors uppercase border border-rose-100 h-fit"
          >
            PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="space-y-3">
          <div className="bg-amber-50/30 p-4 rounded-xl border border-amber-100">
            <h4 className="text-xs font-black text-amber-700 uppercase mb-3">Información de la Actividad</h4>
            <div className="space-y-3">
              <div>
                <label className="text-xs uppercase font-black text-slate-400 mb-1 ml-2 block">Nombre de la Actividad</label>
                <input
                  placeholder="Nombre de la capacitación"
                  className="w-full bg-white border border-slate-100 px-3 py-2 rounded-lg font-bold text-sm"
                  value={newActivity.activityName || ''}
                  onChange={e => setNewActivity({ ...newActivity, activityName: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs uppercase font-black text-slate-400 mb-1 ml-2 block">Día</label>
                  <input type="number" min={1} max={31} value={newActivity.day || ''} onChange={e => setNewActivity({ ...newActivity, day: Number(e.target.value) })} className="w-full bg-white border border-slate-100 px-3 py-2 rounded-lg font-bold text-sm" />
                </div>
                <div>
                  <label className="text-xs uppercase font-black text-slate-400 mb-1 ml-2 block">Horas</label>
                  <input type="number" value={newActivity.hours || ''} onChange={e => setNewActivity({ ...newActivity, hours: Number(e.target.value) })} className="w-full bg-white border border-slate-100 px-3 py-2 rounded-lg font-bold text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs uppercase font-black text-slate-400 mb-1 ml-2 block">Lugar / Ubicación</label>
                <input placeholder="Ej: Auditorio HSE" className="w-full bg-white border border-slate-100 px-3 py-2 rounded-lg font-bold text-sm" value={newActivity.place || ''} onChange={e => setNewActivity({ ...newActivity, place: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs uppercase font-black text-slate-400 mb-1 ml-2 block">Modalidad</label>
                  <select value={newActivity.modality} onChange={e => setNewActivity({ ...newActivity, modality: e.target.value as any })} className="w-full bg-white border border-slate-100 px-3 py-2 rounded-lg font-bold text-sm">
                    <option value="presencial">Presencial</option>
                    <option value="virtual">Virtual</option>
                    <option value="mixta">Mixta</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase font-black text-slate-400 mb-1 ml-2 block">Dirigida a</label>
                  <input placeholder="Personal" className="w-full bg-white border border-slate-100 px-3 py-2 rounded-lg font-bold text-sm" value={newActivity.targetGroup || ''} onChange={e => setNewActivity({ ...newActivity, targetGroup: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs uppercase font-black text-slate-400 mb-1 ml-2 block">Responsable</label>
                  <input placeholder="Nombre" className="w-full bg-white border border-slate-100 px-3 py-2 rounded-lg font-bold text-sm" value={newActivity.responsible || ''} onChange={e => setNewActivity({ ...newActivity, responsible: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs uppercase font-black text-slate-400 mb-1 ml-2 block">Población Objetivo</label>
                  <input placeholder="Ej: Médicos" className="w-full bg-white border border-slate-100 px-3 py-2 rounded-lg font-bold text-sm" value={newActivity.targetPopulation || ''} onChange={e => setNewActivity({ ...newActivity, targetPopulation: e.target.value })} />
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={onAddActivity}
            className="w-full bg-amber-600 text-white font-black py-2.5 rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-md text-xs uppercase"
          >
            CONFIRMAR Y GUARDAR ACTIVIDAD
          </button>
        </div>

        <div className="space-y-3">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 h-full flex flex-col">
            <h4 className="text-xs font-black text-slate-400 uppercase mb-4 tracking-widest">Documentación y Soportes</h4>
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
              {[
                { key: 'preTest', label: 'Base de datos / Pre-test', icon: Database },
                { key: 'training', label: 'Capacitación (Lectura)', icon: BrainCircuit },
                { key: 'attendance', label: 'Asistencia Digital Firmada', icon: ClipboardList },
                { key: 'postTest', label: 'Post-test / Evaluación', icon: FileText }
              ].map((item) => (
                <div key={item.key} className="bg-white p-3 rounded-lg border border-slate-100 group shadow-sm">
                  <p className="text-xs uppercase font-black text-slate-400 mb-2">{item.label}</p>
                  <div className="flex items-center gap-3">
                    <label className="flex-1 flex items-center justify-between px-4 py-3 bg-stone-50 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-amber-50 hover:border-amber-500 transition-all">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                        <item.icon className="w-4 h-4 text-slate-400" />
                        <span className="truncate max-w-[150px]">
                          {newActivity.files?.[item.key as keyof typeof newActivity.files] || 'Subir Archivo'}
                        </span>
                      </div>
                      <Plus className="w-4 h-4 text-slate-300 group-hover:text-amber-600 transition-colors" />
                      <input type="file" className="hidden" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setNewActivity(prev => ({
                            ...prev,
                            files: { ...prev.files, [item.key]: file.name }
                          }));
                        }
                      }} />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Cronograma del Mes</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {activities.filter(a => a.month === selectedMonth && a.year === selectedYear).length === 0 ? (
            <div className="col-span-full py-8 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
              <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">No hay actividades programadas para este mes</p>
            </div>
          ) : (
            activities.filter(a => a.month === selectedMonth && a.year === selectedYear).map(a => (
              <div key={a.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm relative group overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onDeleteActivity(a.id)}
                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-full transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 font-black text-xs">
                    {a.day}
                  </div>
                  <div className="flex-1">
                    <h5 className="font-black text-slate-800 uppercase text-xs truncate">{a.activityName}</h5>
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-bold uppercase">
                      <Clock className="w-3 h-3" /> {a.hours}h • {a.modality}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl">
                    <span className="text-xs uppercase font-black text-slate-400">Progreso</span>
                    <span className="text-xs uppercase font-black text-emerald-600">
                      {Object.values(a.files || {}).filter(Boolean).length}/4 Soportes
                    </span>
                  </div>
                  <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: `${(Object.values(a.files || {}).filter(Boolean).length / 4) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
}
