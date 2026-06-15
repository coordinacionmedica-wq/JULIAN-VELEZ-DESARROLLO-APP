import { motion } from 'motion/react';
import { BookOpen, Calendar, PhoneIncoming, ClipboardList, BrainCircuit, Users, ShieldCheck, FileText } from 'lucide-react';

export function AyudaView() {
  return (
    <motion.div
      key="ayuda"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6 max-w-5xl mx-auto pb-20"
    >
      <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-5">
          <BookOpen className="w-64 h-64" />
        </div>

        <h2 className="text-3xl font-black text-slate-800 mb-2">Resumen de Funciones y Órdenes</h2>
        <p className="text-slate-500 font-medium mb-8">Guía operativa para la administración del sistema V27.0 - ESE Roldanillo</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="p-6 bg-sky-50 rounded-3xl border border-sky-100 group hover:shadow-md transition-all">
            <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-sky-600 mb-4">
              <Calendar className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-sky-900 mb-2">Gestión de Turnos</h4>
            <p className="text-xs text-sky-700 leading-relaxed">
              Ciclo de siglas: Clic en celdas para cambiar turnos. El sistema valida automáticamente conflictos de agenda y genera descansos (PT) tras noches.
            </p>
          </div>

          <div className="p-6 bg-rose-50 rounded-3xl border border-rose-100 group hover:shadow-md transition-all">
            <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-rose-600 mb-4">
              <PhoneIncoming className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-rose-900 mb-2">Llamado Disponibilidad</h4>
            <p className="text-xs text-rose-700 leading-relaxed">
              Procedimiento de crisis: Busca al médico asignado a Disponibilidad (Siglas D) y envía una notificación push de alta prioridad al dispositivo del médico.
            </p>
          </div>

          <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100 group hover:shadow-md transition-all">
            <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-emerald-600 mb-4">
              <ClipboardList className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-emerald-900 mb-2">Control de Auditoría</h4>
            <p className="text-xs text-emerald-700 leading-relaxed">
              Registro irreversible de novedades: Cada cambio de turno queda grabado con sello de tiempo, admin responsable y valor anterior.
            </p>
          </div>

          <div className="p-6 bg-violet-50 rounded-3xl border border-violet-100 group hover:shadow-md transition-all">
            <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-violet-600 mb-4">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-violet-900 mb-2">PIC (Programa Institucional de Capacitaciones)</h4>
            <p className="text-xs text-violet-700 leading-relaxed">
              Módulo PIC: Permite programar capacitaciones mensuales cargando soportes de Pre-test, asistencia firmada y evaluación post-test obligatoria.
            </p>
          </div>

          <div className="p-6 bg-amber-50 rounded-3xl border border-amber-100 group hover:shadow-md transition-all">
            <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-amber-600 mb-4">
              <Users className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-amber-900 mb-2">Roles y Permisos</h4>
            <p className="text-xs text-amber-700 leading-relaxed">
              Diferenciación jerárquica: Solo Admins pueden programar. Enfermeros Jefes pueden gestionar llamados a disponibilidad y alertas.
            </p>
          </div>

          <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-100 group hover:shadow-md transition-all">
            <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-indigo-600 mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-indigo-900 mb-2">Auto-Registro</h4>
            <p className="text-xs text-indigo-700 leading-relaxed">
              Flujo de ingreso: Médicos nuevos se registran &rarr; Admin valida y activa &rarr; Se generan credenciales para el logueo del profesional.
            </p>
          </div>

          <div className="p-6 bg-slate-900 rounded-3xl border border-slate-800 text-white group hover:shadow-md transition-all">
            <div className="w-10 h-10 bg-slate-800 rounded-xl shadow-sm flex items-center justify-center text-sky-400 mb-4">
              <FileText className="w-5 h-5" />
            </div>
            <h4 className="font-bold mb-2">Informes de Función</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Resumen para Administrador: Este panel consolida todas las reglas de negocio aplicadas al motor de turnos del hospital.
            </p>
          </div>
        </div>

        <div className="mt-12 space-y-4">
          <h3 className="text-xl font-black text-slate-800">Órdenes de Sistema (Comandos)</h3>
          <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 overflow-x-auto">
            <table className="w-full text-left text-sm font-medium text-slate-600">
              <thead>
                <tr className="border-b border-slate-200 uppercase text-xs font-black tracking-widest text-slate-400">
                  <th className="pb-4 py-2">Comando / Función</th>
                  <th className="pb-4 py-2">Propósito Operativo</th>
                  <th className="pb-4 py-2">Acceso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-4 font-bold text-slate-800">cycleShift()</td>
                  <td className="py-4">Ciclar turnos en la cuadrícula mensual</td>
                  <td className="py-4"><span className="px-2 py-1 bg-sky-100 text-sky-700 rounded-lg text-xs font-black">ADMIN</span></td>
                </tr>
                <tr>
                  <td className="py-4 font-bold text-slate-800">pushNotification()</td>
                  <td className="py-4">Enviar alertas push a dispositivos registrados</td>
                  <td className="py-4"><span className="px-2 py-1 bg-sky-100 text-sky-700 rounded-lg text-xs font-black">ADMIN / ENF JEF</span></td>
                </tr>
                <tr>
                  <td className="py-4 font-bold text-slate-800">handleCallAvailability()</td>
                  <td className="py-4">Activar protocolo de médico de guardia</td>
                  <td className="py-4"><span className="px-2 py-1 bg-rose-100 text-rose-700 rounded-lg text-xs font-black">ADMIN / ENF JEF</span></td>
                </tr>
                <tr>
                  <td className="py-4 font-bold text-slate-800">updateDoctorMonth()</td>
                  <td className="py-4">Persistencia granular por profesional</td>
                  <td className="py-4"><span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-black">SISTEMA</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
