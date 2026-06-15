import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Settings,
  Trash2,
  UserPlus,
  FileDown,
  FileSpreadsheet,
  Clock,
  Save,
  Power,
  Wand2,
  Palette,
  CheckCircle,
  Database,
  Plus,
  BrainCircuit,
  Sparkles,
  ShieldCheck,
  Activity,
  XCircle,
  Bell,
  ChevronRight,
} from 'lucide-react';
import { SlotType, Doctor, DoctorRole } from '../types';
import { MONTH_NAMES } from '../constants';
import { useAppContext } from '../context/AppContext';

interface AdminViewProps {
  onDownloadTemplate: () => void;
  onImportExcel: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddDoctor: () => void;
  onEditDoctor: (doc: Doctor) => void;
  onGenerateCapacityReport: (period: string) => void;
  onGenerateServiceReport: () => void;
  assignFreeDaysToPlanta: () => void;
  newDocName: string;
  setNewDocName: (v: string) => void;
  newDocEmail: string;
  setNewDocEmail: (v: string) => void;
  newDocContact: string;
  setNewDocContact: (v: string) => void;
  newDocCat: string;
  setNewDocCat: (v: any) => void;
  newDocRol: string;
  setNewDocRol: (v: any) => void;
}

export function AdminView({
  onDownloadTemplate,
  onImportExcel,
  onAddDoctor,
  onEditDoctor,
  onGenerateCapacityReport,
  onGenerateServiceReport,
  assignFreeDaysToPlanta,
  newDocName, setNewDocName,
  newDocEmail, setNewDocEmail,
  newDocContact, setNewDocContact,
  newDocCat, setNewDocCat,
  newDocRol, setNewDocRol,
}: AdminViewProps) {
  const {
    session,
    doctors, variables, serviceMappings, setServiceMappings,
    auditLogs, selectedMonth, selectedYear,
    isGeneratingAI, aiReport, setAiReport,
    idleTimeout, setIdleTimeout,
    setActiveTab, setNotification,
    addVariable, removeVariable,
    toggleDoctorStatus, deleteDoctor, resetDoctorPass,
    saveServiceMappings,
    theme, updateTheme,
  } = useAppContext();

  // Variable form state
  const [newVarCode, setNewVarCode] = useState('');
  const [newVarHour, setNewVarHour] = useState('');
  const [newVarSlot, setNewVarSlot] = useState<SlotType>('m');
  const [editingVar, setEditingVar] = useState<{ slot: SlotType; code: string } | null>(null);

  const handleAddVariable = async () => {
    await addVariable(newVarSlot, newVarCode, parseFloat(newVarHour));
    setNewVarCode('');
    setNewVarHour('');
    setEditingVar(null);
  };

  const addServiceMapping = () => {
    const newService = {
      id: Date.now().toString(),
      name: '',
      siglas: [] as string[],
    };
    setServiceMappings([...serviceMappings, newService]);
  };

  const deleteServiceMapping = (id: string) => {
    if (confirm('¿Eliminar este mapeo de servicio?')) {
      setServiceMappings(serviceMappings.filter(m => m.id !== id));
    }
  };

  if (!session) return null;

  return (
    <motion.div
      key="admin"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-4 max-w-5xl mx-auto"
    >
      <div className="flex gap-2 no-print">
        <button
          onClick={() => setActiveTab('toolbox')}
          className="flex items-center gap-2 bg-gradient-to-br from-emerald-600 to-teal-700 text-white px-4 py-2.5 rounded-xl font-black text-xs shadow-md shadow-emerald-600/20 hover:scale-[1.02] active:scale-95 transition-all"
        >
          <Settings className="w-4 h-4" /> Configurar Reglas Shift Engine V3
        </button>
      </div>

      {/* Variable Management */}
      <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-sm">
        <h3 className="text-sm font-black text-emerald-700 mb-3 flex items-center gap-2">
          <Settings className="w-4 h-4" /> Gestión de Siglas Horarias
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-emerald-50 rounded-xl mb-4 border border-emerald-100">
          <input
            className="bg-white border border-emerald-200 px-3 py-2 rounded-lg outline-none focus:border-emerald-500 font-bold text-sm"
            placeholder="Sigla (N, M, T…)"
            value={newVarCode}
            onChange={(e) => setNewVarCode(e.target.value)}
          />
          <input
            type="number"
            step="0.1"
            min="0"
            className="bg-white border border-emerald-200 px-3 py-2 rounded-lg outline-none focus:border-emerald-500 font-bold text-sm"
            placeholder="Horas"
            value={newVarHour}
            onChange={(e) => setNewVarHour(e.target.value)}
          />
          <select
            className="bg-white border border-emerald-200 px-3 py-2 rounded-lg outline-none font-bold text-sm"
            value={newVarSlot}
            onChange={(e) => setNewVarSlot(e.target.value as SlotType)}
          >
            <option value="m">Mañana</option>
            <option value="t">Tarde</option>
            <option value="n">Noche</option>
          </select>
          <button
            onClick={handleAddVariable}
            className="bg-emerald-600 text-white font-black rounded-lg text-xs hover:bg-emerald-700 active:scale-95 transition-all shadow-sm px-3 py-2"
          >
            {editingVar ? 'Actualizar' : 'Guardar Sigla'}
          </button>
          {editingVar && (
            <button onClick={() => { setEditingVar(null); setNewVarCode(''); setNewVarHour(''); }} className="col-span-2 sm:col-span-4 text-xs text-rose-500 font-bold underline text-center">Cancelar edición</button>
          )}
        </div>

        <div className="space-y-3">
          {(['m', 't', 'n'] as SlotType[]).map(slot => (
            <div key={slot} className="border-t border-emerald-50 pt-3">
              <p className="text-xs text-emerald-600 uppercase font-bold mb-2">{slot === 'm' ? 'Jornada Mañana' : slot === 't' ? 'Jornada Tarde' : 'Jornada Noche'}</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(variables[slot]).map(([k, v]) => (
                  <div key={k} className="group relative bg-stone-50 pl-3 pr-8 py-2 rounded-lg border border-emerald-100 text-xs flex gap-2 hover:border-emerald-500 transition-all cursor-pointer shadow-sm" onClick={() => {
                    setEditingVar({ slot, code: k });
                    setNewVarCode(k);
                    setNewVarHour(v.toString());
                    setNewVarSlot(slot);
                  }}>
                    <span className="font-black text-emerald-600">{k}</span>
                    <span className="text-slate-400">{v}h</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeVariable(slot, k); }}
                      className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 text-rose-400 hover:text-rose-600 transition-all rounded"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Staff Management */}
      <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-sm">
        <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
          <h3 className="text-sm font-black text-emerald-700 flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Nómina Médica
          </h3>
          <div className="flex gap-2">
            <button
              onClick={onDownloadTemplate}
              className="bg-slate-50 text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg font-bold text-xs uppercase flex items-center gap-1.5 hover:bg-slate-100 transition-all"
            >
              <FileDown className="w-3.5 h-3.5" /> Plantilla
            </button>
            <label className="cursor-pointer bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg font-bold text-xs uppercase flex items-center gap-1.5 hover:bg-blue-600 hover:text-white transition-all">
              <FileSpreadsheet className="w-3.5 h-3.5" /> Importar
              <input type="file" accept=".xlsx, .xls" className="hidden" onChange={onImportExcel} />
            </label>
            <button
              onClick={assignFreeDaysToPlanta}
              className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg font-bold text-xs uppercase flex items-center gap-1.5 hover:bg-emerald-600 hover:text-white transition-all"
            >
              <Clock className="w-3.5 h-3.5" /> Día Libre
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4 bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
          <input
            className="bg-white border border-emerald-200 px-3 py-2 rounded-lg outline-none focus:border-emerald-500 font-bold text-sm col-span-2 sm:col-span-1"
            placeholder="Nombre Completo"
            value={newDocName}
            onChange={(e) => setNewDocName(e.target.value)}
          />
          <input
            className="bg-white border border-emerald-200 px-3 py-2 rounded-lg outline-none focus:border-emerald-500 font-bold text-sm"
            placeholder="Email"
            type="email"
            value={newDocEmail}
            onChange={(e) => setNewDocEmail(e.target.value)}
          />
          <input
            className="bg-white border border-emerald-200 px-3 py-2 rounded-lg outline-none focus:border-emerald-500 font-bold text-sm"
            placeholder="WhatsApp"
            value={newDocContact}
            onChange={(e) => setNewDocContact(e.target.value)}
          />
          <select
            className="bg-white border border-emerald-200 px-3 py-2 rounded-lg outline-none font-bold text-sm"
            value={newDocCat}
            onChange={(e) => setNewDocCat(e.target.value as any)}
          >
            <option value="Planta">Planta</option>
            <option value="CTA">CTA</option>
            <option value="APS">APS</option>
            <option value="Rural">Rural</option>
            <option value="Disponibilidad">Disponibilidad</option>
          </select>
          <select
            className="bg-white border border-emerald-200 px-3 py-2 rounded-lg outline-none font-bold text-sm"
            value={newDocRol}
            onChange={(e) => setNewDocRol(e.target.value as any)}
          >
            <option value="Médico General">Médico General</option>
            <option value="Médico Especialista">Especialista</option>
            <option value="Médico Rural">Rural</option>
            <option value="Enfermero Jefe">Enfermera(o) Jefe</option>
            <option value="Auxiliar Enfermería">Aux. Enf.</option>
            <option value="Interno">Interno</option>
            <option value="Triage">Triage</option>
            <option value="Laboratorio">Laboratorio</option>
            <option value="Odontólogo">Odontólogo</option>
            <option value="Fisioterapeuta">Fisioterapeuta</option>
            <option value="Rayos X">Rayos X</option>
          </select>
          <button
            onClick={onAddDoctor}
            className="bg-emerald-700 text-white font-black rounded-lg text-xs hover:bg-emerald-800 active:scale-95 transition-all shadow-sm col-span-2 sm:col-span-1 py-2"
          >
            + Añadir
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {doctors.map(d => (
            <div key={d.id} className={`p-3 rounded-xl border transition-all ${d.st === 'activo' ? 'bg-stone-50 border-emerald-100 shadow-sm' : 'bg-rose-50 border-rose-100 opacity-50'}`}>
              <div className="flex justify-between items-start mb-2 gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-800 leading-tight">{d.nombre}</div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-emerald-600 uppercase font-black">{d.cat}</div>
                    <div className="text-xs bg-emerald-100 text-emerald-800 px-1.5 rounded uppercase font-bold">{d.rol || 'Médico'}</div>
                    {d.email && <div className="text-xs text-slate-400 italic">({d.email})</div>}
                  </div>
                  <div className="text-xs text-slate-400 font-mono mt-1">
                    Cédula: <span className="font-bold">{d.cedula || 'N/A'}</span> | RM: <span className="font-bold">{d.registroMedico || 'N/A'}</span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">
                    User: <span className="text-emerald-700 font-bold">{d.username}</span> | Pass: <span className="text-emerald-700 font-bold">{d.password}</span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => onEditDoctor(d)}
                    className="p-2 rounded-lg border bg-white border-emerald-100 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                    title="Editar Médico"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => resetDoctorPass(d.id)}
                    className="p-2 rounded-lg border bg-white border-amber-100 text-amber-600 hover:bg-amber-500 hover:text-white transition-all shadow-sm"
                    title="Restablecer Contraseña"
                  >
                    <Save className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => toggleDoctorStatus(d.id, d.st === 'activo' ? 'inactivo' : 'activo')}
                    title={d.st === 'activo' ? 'Desactivar médico' : 'Reactivar médico'}
                    className={`p-2 rounded-lg border transition-all shadow-sm ${d.st === 'activo' ? 'bg-white border-emerald-500 text-emerald-600 hover:bg-emerald-500 hover:text-white' : 'bg-white border-amber-500 text-amber-600 hover:bg-amber-500 hover:text-white'}`}
                  >
                    <Power className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteDoctor(d.id)}
                    title="Eliminar médico del sistema"
                    className="p-2 rounded-lg border bg-white border-rose-100 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="text-xs font-mono text-slate-300">UID: {d.id}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Theme Settings */}
      <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-sm">
        <h3 className="text-sm font-black text-emerald-700 mb-3 flex items-center gap-2">
          <Palette className="w-4 h-4 text-emerald-600" /> Personalización Visual
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="text-xs text-emerald-600 uppercase font-black block mb-2">Color Principal</label>
            <div className="grid grid-cols-5 gap-2">
              {['#00c8f0', '#00e5a0', '#ff7d33', '#f43f5e', '#a855f7', '#eab308', '#22c55e', '#3b82f6', '#ec4899', '#f97316'].map(c => (
                <button
                  key={c}
                  onClick={() => updateTheme({ ...theme, primary: c })}
                  className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${theme.primary === c ? 'border-slate-400 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-emerald-600 uppercase font-black block mb-2">Fuente del Sistema</label>
            <div className="flex flex-col gap-1.5">
              {(['sans', 'serif', 'mono'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => updateTheme({ ...theme, font: f })}
                  className={`px-3 py-2 rounded-lg border text-left flex justify-between items-center transition-all text-sm ${theme.font === f ? 'bg-emerald-600 text-white border-white' : 'bg-stone-50 border-emerald-100 text-slate-600'}`}
                  style={f === 'serif' ? { fontFamily: 'serif' } : f === 'mono' ? { fontFamily: 'monospace' } : { fontFamily: 'sans-serif' }}
                >
                  <span>
                    {f === 'sans' ? 'Inter (Moderna)' : f === 'serif' ? 'Playfair (Elegante)' : 'JetBrains (Técnica)'}
                  </span>
                  {theme.font === f && <CheckCircle className="w-5 h-5" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Productividad - Gestión de Mapeos */}
      <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-700" />
            <h3 className="text-sm font-black text-emerald-700">Mapeo de Servicios</h3>
          </div>
          <button
            onClick={addServiceMapping}
            className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-200 font-bold text-xs uppercase flex items-center gap-1.5 hover:bg-emerald-100 transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Añadir
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-3 uppercase font-bold">Asigne las siglas a cada servicio para el cálculo de productividad.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {serviceMappings.map((m, idx) => (
            <div key={m.id} className="bg-stone-50 p-4 rounded-xl border border-emerald-100 flex flex-col gap-2 relative group">
              <button
                onClick={() => deleteServiceMapping(m.id)}
                className="absolute top-4 right-4 text-slate-300 hover:text-rose-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <div className="space-y-1">
                <span className="text-xs text-emerald-600 font-black uppercase">Nombre del Servicio</span>
                <input
                  className="w-full bg-white border border-emerald-100 p-2 rounded-lg text-xs font-bold outline-none focus:border-emerald-500"
                  value={m.name}
                  onChange={(e) => {
                    const newMappings = [...serviceMappings];
                    newMappings[idx].name = e.target.value;
                    setServiceMappings(newMappings);
                  }}
                />
              </div>
              <div className="space-y-1 mt-2">
                <span className="text-xs text-slate-400 uppercase font-bold">Siglas Asociadas (separadas por coma)</span>
                <input
                  className="w-full bg-white border border-emerald-100 p-2 rounded-lg text-xs font-bold outline-none focus:border-emerald-500"
                  placeholder="Ej: 13, 13A, 13B"
                  value={m.siglas.join(', ')}
                  onChange={(e) => {
                    const newMappings = [...serviceMappings];
                    newMappings[idx].siglas = e.target.value.split(',').map(s => s.trim().toUpperCase());
                    setServiceMappings(newMappings);
                  }}
                />
              </div>
            </div>
          ))}
          {serviceMappings.length === 0 && (
            <div className="col-span-1 md:col-span-2 text-center py-10 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
              <p className="text-sm text-slate-400 italic">No hay servicios configurados</p>
            </div>
          )}
          <button
            onClick={() => saveServiceMappings(serviceMappings)}
            className="col-span-1 md:col-span-2 bg-emerald-700 text-white font-black py-2.5 rounded-xl hover:bg-emerald-800 transition-all shadow-sm flex items-center justify-center gap-2 text-xs mt-2"
          >
            <Save className="w-4 h-4" /> Guardar Mapeos
          </button>
        </div>
      </div>

      {/* AI Capacity Report */}
      <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-sm">
        <h3 className="text-sm font-black text-emerald-700 mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-500" /> Reporte de Capacidad IA
        </h3>

        <div className="flex flex-wrap gap-2 mb-4">
          {(['semanal', 'quincenal', 'mensual'] as const).map((p) => (
            <button
              key={p}
              onClick={() => onGenerateCapacityReport(p)}
              disabled={isGeneratingAI}
              className="flex-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-4 py-2.5 rounded-lg flex flex-col items-center gap-0.5 transition-all disabled:opacity-50"
            >
              <span className="text-emerald-700 font-black text-xs uppercase">{p}</span>
              <span className="text-xs text-slate-400">{p === 'semanal' ? 'Días 1–7' : p === 'quincenal' ? 'Días 1–15' : 'Mes completo'}</span>
            </button>
          ))}
        </div>

        {isGeneratingAI && (
          <div className="flex items-center gap-3 py-3 px-4 bg-emerald-50 rounded-xl border border-emerald-100 animate-pulse">
            <BrainCircuit className="w-5 h-5 text-emerald-500 animate-spin shrink-0" />
            <p className="text-xs font-bold text-emerald-700">Gemini analizando cobertura...</p>
          </div>
        )}

        {aiReport && (
          <div className="bg-slate-900 text-emerald-400 p-4 rounded-xl border border-emerald-500/20 overflow-x-auto text-xs font-mono">
            <pre className="whitespace-pre-wrap">{aiReport}</pre>
          </div>
        )}
      </div>

      {/* Session Security Settings */}
      <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-sm">
        <h3 className="text-sm font-black text-emerald-700 mb-3 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" /> Seguridad de Sesión
        </h3>
        <div className="bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-100 flex flex-wrap justify-between items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-black text-emerald-900 text-xs mb-0.5">Auto-Cierre por Inactividad</p>
            <p className="text-xs text-slate-500">Cierra sesión automáticamente tras inactividad del mouse o teclado.</p>
          </div>
          <select
            value={idleTimeout}
            onChange={(e) => {
              const val = Number(e.target.value);
              setIdleTimeout(val);
              localStorage.setItem('idleTimeout', val.toString());
              setNotification({ message: `Cierre automático: ${val} min`, type: 'success' });
            }}
            className="bg-white border border-emerald-200 text-emerald-800 font-bold px-3 py-2 rounded-lg outline-none text-sm shrink-0"
          >
            {[5, 10, 15, 20, 30].map(t => (
              <option key={t} value={t}>{t} min</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <button
          onClick={onGenerateServiceReport}
          disabled={isGeneratingAI}
          className="w-full bg-gradient-to-r from-emerald-600 to-teal-700 text-white px-4 py-3 rounded-xl flex items-center gap-3 transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 shadow-md"
        >
          <Activity className="w-4 h-4 text-white shrink-0" />
          <div className="text-left">
            <span className="block font-black text-xs">Análisis Profundo de Servicios (IA Gerencia)</span>
            <span className="block text-xs text-white/70">Ocupación, patrones de uso y capacidad instalada</span>
          </div>
          <Sparkles className="w-4 h-4 ml-auto text-emerald-200 animate-pulse shrink-0" />
        </button>
      </div>

      {isGeneratingAI ? (
        <div className="py-8 flex items-center justify-center gap-3">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
            <Wand2 className="w-6 h-6 text-emerald-600" />
          </motion.div>
          <p className="text-emerald-700/60 text-xs font-black animate-pulse uppercase">Generando análisis estratégico...</p>
        </div>
      ) : aiReport ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-stone-50 p-4 rounded-2xl border border-emerald-100"
        >
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-black uppercase">Resultados IA</span>
            <button
              onClick={() => setAiReport(null)}
              className="text-slate-400 hover:text-rose-500 transition-colors"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
          <div className="text-slate-700 text-xs leading-relaxed whitespace-pre-wrap font-sans">
            {aiReport}
          </div>
          <div className="mt-4 pt-3 border-t border-emerald-100 flex justify-between items-center">
            <p className="text-xs text-slate-400 italic">Generado por Gemini IA.</p>
            <button
              onClick={() => {
                const blob = new Blob([aiReport], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `Reporte_IA_Capacidad_${MONTH_NAMES[selectedMonth]}.txt`;
                link.click();
              }}
              className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-black hover:scale-105 active:scale-95 transition-all"
            >
              Descargar
            </button>
          </div>
        </motion.div>
      ) : (
        <div className="py-12 text-center">
          <p className="text-slate-300 text-sm uppercase font-black opacity-60">Selecciona un periodo para generar el reporte estratégico</p>
        </div>
      )}

      {/* Audit Logs */}
      <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-sm">
        <h3 className="text-sm font-black text-emerald-700 mb-3 flex items-center gap-2">
          <Bell className="w-4 h-4 text-emerald-500" /> Auditoría — {MONTH_NAMES[selectedMonth]} {selectedYear}
        </h3>
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
          {auditLogs.filter(log => log.targetMonth === selectedMonth && log.targetYear === selectedYear).length === 0 && (
            <div className="text-center py-6 text-slate-300 font-mono text-xs italic">
              Sin registros en este período.
            </div>
          )}
          {auditLogs
            .filter(log => log.targetMonth === selectedMonth && log.targetYear === selectedYear)
            .map(log => (
              <div key={log.id} className="bg-stone-50 px-3 py-2 rounded-lg border border-emerald-100 flex justify-between items-center text-xs group hover:border-emerald-300 transition-colors">
                <div>
                  <div className="text-slate-800 font-bold mb-1">
                    Dr. {log.doctorName} <span className="text-emerald-600 ml-2 font-black">Día {log.day} ({log.slot.toUpperCase()})</span>
                    {log.doctorContact && <span className="ml-2 text-[8px] px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-md border border-emerald-100 font-bold">{log.doctorContact}</span>}
                  </div>
                  <div className="text-slate-400 flex items-center gap-2">
                    Cambio: <span className="text-rose-400 line-through opacity-50">{log.oldSigla}</span>
                    <ChevronRight className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-600 font-black px-1.5 py-0.5 bg-emerald-50 rounded">{log.newSigla}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400 mb-1">{new Date(log.timestamp).toLocaleTimeString()}</div>
                  <div className="text-xs uppercase font-black text-emerald-700/50">Sincronizado</div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </motion.div>
  );
}
