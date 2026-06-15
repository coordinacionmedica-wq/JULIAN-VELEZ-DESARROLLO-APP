import { motion } from 'motion/react';
import { Doctor } from '../types';

interface Props {
  doctor: Doctor;
  onChange: (doc: Doctor) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function EditDoctorModal({ doctor, onChange, onSave, onCancel }: Props) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-6">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-full max-w-lg p-8 rounded-[32px] border border-emerald-100 shadow-2xl">
        <h2 className="text-2xl font-black text-slate-800 mb-6 uppercase tracking-tight">Editar Médico</h2>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto px-2 custom-scrollbar">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 uppercase font-black ml-2 mb-1 block">Nombres</label>
              <input
                className="w-full bg-stone-50 border border-emerald-100 p-4 rounded-xl text-slate-800 outline-none focus:border-emerald-500 font-bold"
                value={doctor.nombre}
                onChange={e => onChange({ ...doctor, nombre: e.target.value })}
                placeholder="Nombres"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 uppercase font-black ml-2 mb-1 block">Apellidos</label>
              <input
                className="w-full bg-stone-50 border border-emerald-100 p-4 rounded-xl text-slate-800 outline-none focus:border-emerald-500 font-bold"
                value={doctor.apellidos || ''}
                onChange={e => onChange({ ...doctor, apellidos: e.target.value })}
                placeholder="Apellidos"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 uppercase font-black ml-2 mb-1 block">Cédula</label>
              <input
                className="w-full bg-stone-50 border border-emerald-100 p-4 rounded-xl text-slate-800 outline-none focus:border-emerald-500 font-bold"
                value={doctor.cedula || ''}
                onChange={e => onChange({ ...doctor, cedula: e.target.value })}
                placeholder="Documento de Identidad"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 uppercase font-black ml-2 mb-1 block">Registro Médico</label>
              <input
                className="w-full bg-stone-50 border border-emerald-100 p-4 rounded-xl text-slate-800 outline-none focus:border-emerald-500 font-bold"
                value={doctor.registroMedico || ''}
                onChange={e => onChange({ ...doctor, registroMedico: e.target.value })}
                placeholder="Registro Médico"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 uppercase font-black ml-2 mb-1 block">Email</label>
              <input
                className="w-full bg-stone-50 border border-emerald-100 p-4 rounded-xl text-slate-800 outline-none focus:border-emerald-500 font-bold"
                value={doctor.email || ''}
                onChange={e => onChange({ ...doctor, email: e.target.value })}
                placeholder="Email"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 uppercase font-black ml-2 mb-1 block">Teléfono</label>
              <input
                className="w-full bg-stone-50 border border-emerald-100 p-4 rounded-xl text-slate-800 outline-none focus:border-emerald-500 font-bold"
                value={doctor.telefono || ''}
                onChange={e => onChange({ ...doctor, telefono: e.target.value })}
                placeholder="WhatsApp"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase font-black ml-2 mb-1 block">Contraseña</label>
            <input
              className="w-full bg-stone-50 border border-emerald-100 p-4 rounded-xl text-slate-800 outline-none focus:border-emerald-500 font-bold"
              value={doctor.password}
              onChange={e => onChange({ ...doctor, password: e.target.value })}
              placeholder="Contraseña"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 uppercase font-black ml-2 mb-1 block">Categoría</label>
              <select
                className="w-full bg-stone-50 border border-emerald-100 p-4 rounded-xl text-slate-800 outline-none focus:border-emerald-500 font-bold"
                value={doctor.cat}
                onChange={e => onChange({ ...doctor, cat: e.target.value as any })}
              >
                <option value="Planta">PLANTA</option>
                <option value="CTA">CTA</option>
                <option value="APS">APS</option>
                <option value="Rural">RURAL</option>
                <option value="Disponibilidad">DISPONIBILIDAD</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 uppercase font-black ml-2 mb-1 block">Rol</label>
              <select
                className="w-full bg-stone-50 border border-emerald-100 p-4 rounded-xl text-slate-800 outline-none focus:border-emerald-500 font-bold"
                value={doctor.rol}
                onChange={e => onChange({ ...doctor, rol: e.target.value as any })}
              >
                <option value="Médico General">Médico General</option>
                <option value="Médico Especialista">Médico Especialista</option>
                <option value="Médico Rural">Médico Rural</option>
                <option value="Enfermero Jefe">Enfermero Jefe</option>
                <option value="Auxiliar Enfermería">Auxiliar Enfermería</option>
                <option value="Interno">Interno</option>
                <option value="Triage">Triage</option>
                <option value="Laboratorio">Laboratorio</option>
                <option value="Odontólogo">Odontólogo</option>
              </select>
            </div>
          </div>
          <div className="flex gap-4 pt-4">
            <button
              onClick={onCancel}
              className="flex-1 py-4 border border-slate-200 text-slate-400 font-bold rounded-xl hover:bg-slate-50 uppercase text-xs"
            >
              CANCELAR
            </button>
            <button
              onClick={onSave}
              className="flex-1 py-4 bg-emerald-600 text-white font-black rounded-xl hover:scale-105 transition-transform shadow-lg shadow-emerald-500/20 uppercase text-xs"
            >
              GUARDAR CAMBIOS
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
