import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  CheckCircle,
  XCircle,
  Clock,
  HeartPulse,
  ShieldCheck,
  Sparkles,
  Send,
  MapPin,
  FileSpreadsheet,
  MessageCircle,
  ClipboardList,
  Calendar,
  Users,
  FileText,
  BrainCircuit,
  BarChart3,
  Printer,
  Flame,
  Activity,
  Bell,
  Star,
  Info,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Markdown from 'react-markdown';
import { MONTH_NAMES } from '../constants';
import { SlotType } from '../types';
import { useAppContext } from '../context/AppContext';

interface HomeViewProps {
  globalTotalHours: number;
  onShowCodigoRojo: () => void;
  onShowCodigoAzul: () => void;
  onGenerateAIStats: () => void;
}

export function HomeView({ globalTotalHours, onShowCodigoRojo, onShowCodigoAzul, onGenerateAIStats }: HomeViewProps) {
  const {
    session, doctors, shiftRequests, activities,
    selectedMonth, selectedYear, isMonthPublished, isOnline,
    isGeneratingAI, aiReport, setAiReport,
    setActiveTab, serviceMappings, variables, currentMonthData,
    changePassword, evaluations
  } = useAppContext();

  // Local form state
  const myRating = useMemo(() => {
    if (!session?.doctorId) return null;
    return evaluations[`${selectedYear}_${selectedMonth}_${session.doctorId}`];
  }, [evaluations, session, selectedMonth, selectedYear]);

  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [showProductivityStats, setShowProductivityStats] = useState(false);
  const [productivityResults, setProductivityResults] = useState<any[]>([]);

  const currentUserProfile = useMemo(() => {
    if (!session?.doctorId) return null;
    return doctors.find(d => d.id === session.doctorId);
  }, [session?.doctorId, doctors]);

  const canSeeCodigoRojo = useMemo(() => {
    if (session?.r === 'admin') return true;
    if (!currentUserProfile) return false;
    const perms = currentUserProfile.permissions;
    return perms === undefined ? false : perms.includes('ver_protocolo_rojo');
  }, [session?.r, currentUserProfile]);

  const canSeeCodigoAzul = useMemo(() => {
    if (session?.r === 'admin') return true;
    if (!currentUserProfile) return false;
    const perms = currentUserProfile.permissions;
    return perms === undefined ? false : perms.includes('ver_protocolo_azul');
  }, [session?.r, currentUserProfile]);

  const handleChangePassword = async () => {
    if (!session?.doctorId) return;
    await changePassword(session.doctorId, oldPass, newPass);
    setOldPass('');
    setNewPass('');
  };

  const calculateProductivity = () => {
    const activeDoctorsList = doctors.filter(d => d.st === 'activo');
    const daysInCurrentMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

    const results = activeDoctorsList.map(doc => {
      const stats: Record<string, { shifts: number, hours: number }> = {};
      serviceMappings.forEach(m => {
        stats[m.name] = { shifts: 0, hours: 0 };
      });
      stats['Otros'] = { shifts: 0, hours: 0 };

      let totalDocHours = 0;

      (['m', 't', 'n'] as SlotType[]).forEach(slot => {
        for (let d = 1; d <= daysInCurrentMonth; d++) {
          const sigla = currentMonthData[doc.id]?.[slot]?.[d];
          if (sigla && sigla !== 'X' && sigla !== 'DESC' && sigla !== 'PT') {
            const h = variables[slot]?.[sigla] || 0;
            totalDocHours += h;

            const mapping = serviceMappings.find(m => m.siglas.some(s => s.trim().toUpperCase() === sigla.trim().toUpperCase()));
            if (mapping) {
              stats[mapping.name].shifts++;
              stats[mapping.name].hours += h;
            } else {
              stats['Otros'].shifts++;
              stats['Otros'].hours += h;
            }
          }
        }
      });

      return {
        doctor: doc.nombre,
        role: doc.rol,
        stats,
        totalDocHours
      };
    });

    setProductivityResults(results);
    setShowProductivityStats(true);
  };

  if (!session) return null;

  return (
    <motion.div
      key="home"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="space-y-6 max-w-5xl mx-auto pb-6"
    >
      {/* ── Banner de Bienvenida ── */}
      <div className="relative bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 rounded-2xl p-5 md:p-6 overflow-hidden shadow-lg shadow-emerald-500/20">
        <div className="absolute inset-0 opacity-10">
          <HeartPulse className="absolute right-4 top-4 w-32 h-32 text-white" />
        </div>
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-emerald-100/80 text-xs uppercase tracking-widest font-bold mb-1">
              {MONTH_NAMES[selectedMonth]} {selectedYear}
            </p>
            <h2 className="text-2xl md:text-3xl font-black text-white drop-shadow-sm">
              Bienvenido, {session.n}
            </h2>
            <p className="text-emerald-100/70 text-sm mt-1">
              Hospital Departamental San Antonio de Roldanillo
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isMonthPublished
              ? <span className="flex items-center gap-1.5 bg-white/20 text-white text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full border border-white/30 backdrop-blur-sm"><CheckCircle className="w-3.5 h-3.5" /> Publicado</span>
              : <span className="flex items-center gap-1.5 bg-amber-400/30 text-amber-100 text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full border border-amber-300/40"><Clock className="w-3.5 h-3.5" /> Borrador</span>
            }
            <span className={`flex items-center gap-1.5 text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full border backdrop-blur-sm ${isOnline ? 'bg-white/20 text-white border-white/30' : 'bg-rose-400/30 text-rose-100 border-rose-300/40'}`}>
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-white animate-pulse' : 'bg-rose-300'}`}></span>
              {isOnline ? 'En línea' : 'Sin conexión'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Visualización de Calificación (Médicos) ── */}
      {session.r === 'doctor' && myRating && (
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white border-2 border-amber-100 rounded-3xl p-6 shadow-xl shadow-amber-500/5 relative overflow-hidden">
           <div className="absolute -right-4 -top-4 opacity-5"><Star className="w-32 h-32 text-amber-500 fill-amber-500" /></div>
           <div className="flex items-start gap-5 relative z-10">
              <div className="bg-amber-50 p-4 rounded-2xl flex flex-col items-center justify-center border border-amber-100 shrink-0">
                 <span className="text-3xl font-black text-amber-600">{myRating.score}</span>
                 <div className="flex gap-0.5 mt-1">
                   {[...Array(5)].map((_, i) => (
                     <Star key={i} className={`w-2.5 h-2.5 ${i < myRating.score ? 'text-amber-500 fill-amber-500' : 'text-slate-200'}`} />
                   ))}
                 </div>
              </div>
              <div className="flex-1">
                 <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-1 flex items-center gap-2">
                   <Star className="w-4 h-4 text-amber-500" /> Mi Valoración de {MONTH_NAMES[selectedMonth]}
                 </h3>
                 <p className="text-sm text-slate-600 leading-relaxed font-medium">"{myRating.comments || 'Sin comentarios adicionales.'}"</p>
                 <p className="text-[10px] text-slate-400 mt-3 font-bold uppercase">Calificado por: {myRating.adminName} · {new Date(myRating.timestamp).toLocaleDateString()}</p>
              </div>
           </div>
        </motion.div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Horas globales */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden sm:col-span-2 group hover:shadow-md transition-shadow">
          <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-teal-400" />
          <div className="p-5 flex items-center gap-4">
            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 shrink-0 group-hover:scale-110 transition-transform">
              <HeartPulse className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-0.5">Horas Globales</p>
              <div className="text-4xl font-black text-emerald-600">{globalTotalHours}<span className="text-xl text-emerald-400 ml-1">h</span></div>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">{MONTH_NAMES[selectedMonth]} {selectedYear}</p>
            </div>
          </div>
        </div>

        {/* Médicos activos */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
          <div className="h-1.5 bg-gradient-to-r from-sky-500 to-blue-400" />
          <div className="p-5 text-center">
            <div className="bg-sky-50 w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 border border-sky-100 group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5 text-sky-600" />
            </div>
            <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-1">Activos</p>
            <div className="text-3xl font-black text-sky-600">{doctors.filter(d => d.st === 'activo').length}</div>
            <p className="text-xs text-slate-400 mt-0.5">de {doctors.length}</p>
          </div>
        </div>

        {/* Solicitudes pendientes */}
        {(() => {
          const pending = shiftRequests.filter(r => r.status === 'pending' && r.targetMonth === selectedMonth && r.targetYear === selectedYear).length;
          return (
            <div className={`bg-white rounded-2xl shadow-sm overflow-hidden group hover:shadow-md transition-shadow ${pending > 0 ? 'ring-1 ring-amber-300' : ''}`}>
              <div className={`h-1.5 ${pending > 0 ? 'bg-gradient-to-r from-amber-400 to-orange-400' : 'bg-gradient-to-r from-slate-200 to-slate-300'}`} />
              <div className="p-5 text-center">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 border group-hover:scale-110 transition-transform ${pending > 0 ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
                  <Bell className={`w-5 h-5 ${pending > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
                </div>
                <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-1">Solicitudes</p>
                <div className={`text-3xl font-black ${pending > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{pending}</div>
                <button onClick={() => setActiveTab('solicitudes')} className="text-xs text-emerald-600 font-bold underline mt-0.5 hover:text-emerald-700">ver</button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── Emergencias (if visible) ── */}
      {(canSeeCodigoRojo || canSeeCodigoAzul) && (
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-2 ml-1">Protocolos de Emergencia</p>
          <div className="grid grid-cols-2 gap-3">
            {canSeeCodigoRojo && (
              <button
                onClick={onShowCodigoRojo}
                className="bg-gradient-to-br from-rose-600 to-rose-700 text-white p-3.5 rounded-xl flex items-center gap-3 font-black hover:scale-[1.02] active:scale-95 transition-all shadow-md shadow-rose-500/25 border border-rose-400/30 group"
              >
                <div className="bg-white/20 p-3 rounded-xl group-hover:rotate-12 transition-transform shrink-0">
                  <Flame className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <div className="text-xs uppercase opacity-70 leading-none mb-1">Obstetricia</div>
                  <div className="text-lg">CÓDIGO ROJO</div>
                </div>
              </button>
            )}
            {canSeeCodigoAzul && (
              <button
                onClick={onShowCodigoAzul}
                className="bg-gradient-to-br from-blue-600 to-blue-700 text-white p-3.5 rounded-xl flex items-center gap-3 font-black hover:scale-[1.02] active:scale-95 transition-all shadow-md shadow-blue-500/25 border border-blue-400/30 group"
              >
                <div className="bg-white/20 p-3 rounded-xl group-hover:animate-pulse shrink-0">
                  <Activity className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <div className="text-xs uppercase opacity-70 leading-none mb-1">RCP / Paro</div>
                  <div className="text-lg">CÓDIGO AZUL</div>
                </div>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Accesos Rápidos ── */}
      <div>
        <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-3 ml-1">Accesos Rápidos</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { id: 'turnos',      label: 'Turnero',        icon: Calendar,      bar: 'from-emerald-500 to-teal-400',   iconBg: 'bg-emerald-50 border-emerald-100',  iconColor: 'text-emerald-600', adminOnly: false, perm: null },
            { id: 'solicitudes', label: 'Solicitudes',    icon: Send,          bar: 'from-amber-400 to-orange-400',   iconBg: 'bg-amber-50 border-amber-100',      iconColor: 'text-amber-600',   adminOnly: false, perm: 'solicitar_turno' },
            { id: 'rural',       label: 'Rural',          icon: MapPin,        bar: 'from-sky-500 to-blue-400',       iconBg: 'bg-sky-50 border-sky-100',          iconColor: 'text-sky-600',     adminOnly: false, perm: 'call_availability' },
            { id: 'novedades',   label: 'Novedades',      icon: ClipboardList, bar: 'from-violet-500 to-purple-400',  iconBg: 'bg-violet-50 border-violet-100',    iconColor: 'text-violet-600',  adminOnly: true,  perm: null },
            { id: 'pic',         label: 'Capacitaciones', icon: BrainCircuit,  bar: 'from-orange-500 to-amber-400',   iconBg: 'bg-orange-50 border-orange-100',    iconColor: 'text-orange-600',  adminOnly: false, perm: 'ver_pic' },
            { id: 'docs',        label: 'Guías',          icon: FileText,      bar: 'from-teal-500 to-emerald-400',   iconBg: 'bg-teal-50 border-teal-100',        iconColor: 'text-teal-600',    adminOnly: false, perm: 'ver_guias' },
            { id: 'stats',       label: 'Estadísticas',   icon: BarChart3,     bar: 'from-rose-500 to-pink-400',      iconBg: 'bg-rose-50 border-rose-100',        iconColor: 'text-rose-600',    adminOnly: true,  perm: null },
          ].filter(item => {
            const isPrivileged = session.r === 'admin' || session.r === 'read';
            if (item.adminOnly && !isPrivileged) return false;
            if (item.perm && !isPrivileged) {
              const perms = currentUserProfile?.permissions;
              return perms === undefined ? true : perms.includes(item.perm);
            }
            return true;
          })
          .map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 active:scale-95 transition-all group text-left"
              >
                <div className={`h-1 bg-gradient-to-r ${item.bar}`} />
                <div className="p-4 flex flex-col gap-2">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${item.iconBg} group-hover:scale-110 transition-transform`}>
                    <Icon className={`w-4.5 h-4.5 ${item.iconColor}`} />
                  </div>
                  <span className="text-sm font-black text-slate-700">{item.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Herramientas (admin/read) ── */}
      {(session.r === 'admin' || session.r === 'read') && (
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-2 ml-1">Herramientas</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={onGenerateAIStats}
              disabled={isGeneratingAI}
              className="bg-violet-600 text-white p-4 rounded-2xl flex items-center gap-3 font-bold hover:bg-violet-700 transition-all shadow-lg shadow-violet-500/20 disabled:opacity-60"
            >
              <Sparkles className={`w-5 h-5 ${isGeneratingAI ? 'animate-spin' : ''}`} />
              <div className="text-left">
                <div className="text-xs uppercase opacity-70">Inteligencia Artificial</div>
                <div className="text-sm">{isGeneratingAI ? 'Analizando...' : 'Análisis IA'}</div>
              </div>
            </button>
            <button
              onClick={calculateProductivity}
              className="bg-emerald-700 text-white p-4 rounded-2xl flex items-center gap-3 font-bold hover:bg-emerald-800 transition-all shadow-lg shadow-emerald-500/20"
            >
              <ClipboardList className="w-5 h-5" />
              <div className="text-left">
                <div className="text-xs uppercase opacity-70">Resumen mensual</div>
                <div className="text-sm">Productividad</div>
              </div>
            </button>
            <button
              onClick={() => window.print()}
              className="bg-white border border-slate-200 text-slate-700 p-4 rounded-2xl flex items-center gap-3 font-bold hover:bg-slate-50 transition-all shadow-sm"
            >
              <Printer className="w-5 h-5" />
              <div className="text-left">
                <div className="text-xs uppercase opacity-70">Vista actual</div>
                <div className="text-sm">Imprimir</div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ── Comunidad ── */}
      <a
        href="https://wa.me/573173683886?mode=gi_t"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-4 bg-[#25D366] text-white p-5 rounded-2xl font-black hover:bg-[#20ba59] transition-all shadow-lg shadow-emerald-500/20 group"
      >
        <MessageCircle className="w-8 h-8 shrink-0 group-hover:animate-bounce" />
        <div>
          <div className="text-xs uppercase opacity-80 leading-none mb-1">Comunidad Médica</div>
          <div className="text-base">UNIRSE AL GRUPO WHATSAPP</div>
        </div>
      </a>

      {/* ── Gestión de contraseña (doctor) ── */}
      {session.r === 'doctor' && (
        <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm">
          <h3 className="text-sm font-bold text-emerald-700 mb-4 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> Cambio de Contraseña
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input type="password" placeholder="Contraseña Actual" className="bg-stone-50 border border-emerald-100 p-3 rounded-xl outline-none focus:border-emerald-500 text-slate-800 text-sm" value={oldPass} onChange={(e) => setOldPass(e.target.value)} />
            <input type="password" placeholder="Nueva Contraseña" className="bg-stone-50 border border-emerald-100 p-3 rounded-xl outline-none focus:border-emerald-500 text-slate-800 text-sm" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
            <button onClick={handleChangePassword} className="bg-emerald-600 text-white font-black rounded-xl hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-emerald-500/20 text-sm">ACTUALIZAR</button>
          </div>
          <p className="text-xs text-slate-400 mt-3 italic">Frecuencia de cambio obligatoria: Cada 90 días.</p>
        </div>
      )}

      {/* ── Tabla de Productividad (expandible) ── */}
      {showProductivityStats && productivityResults.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm overflow-hidden"
        >
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-emerald-600" />
              Productividad — {MONTH_NAMES[selectedMonth]} {selectedYear}
            </h3>
            <button onClick={() => setShowProductivityStats(false)} className="text-slate-400 hover:text-rose-500 transition-colors">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-emerald-50 text-xs text-emerald-800 font-bold uppercase tracking-wider">
                  <th className="p-3 rounded-tl-xl">MÉDICO / ROL</th>
                  {serviceMappings.map(m => <th key={m.id} className="p-3 text-center">{m.name}</th>)}
                  <th className="p-3 text-center">OTROS</th>
                  <th className="p-3 text-center rounded-tr-xl">TOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {productivityResults.map((res, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-slate-800 text-sm">{res.doctor}</div>
                      <div className="text-xs text-slate-400 uppercase font-mono">{res.role}</div>
                    </td>
                    {serviceMappings.map(m => (
                      <td key={m.id} className="p-3 text-center">
                        <div className="font-black text-emerald-600 text-sm">{res.stats[m.name].shifts}<span className="text-xs font-normal text-slate-400 ml-0.5">T</span></div>
                        <div className="text-xs text-slate-400">{res.stats[m.name].hours}h</div>
                      </td>
                    ))}
                    <td className="p-3 text-center">
                      <div className="font-black text-amber-600 text-sm">{res.stats['Otros'].shifts}<span className="text-xs font-normal text-slate-400 ml-0.5">T</span></div>
                      <div className="text-xs text-slate-400">{res.stats['Otros'].hours}h</div>
                    </td>
                    <td className="p-3 text-center font-black text-slate-800 bg-emerald-50/30">
                      <div className="text-sm">{res.totalDocHours}h</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-end no-print">
            <button
              onClick={() => {
                const ws = XLSX.utils.json_to_sheet(productivityResults.map(r => ({
                  'Médico': r.doctor, 'Rol': r.role,
                  ...Object.fromEntries(serviceMappings.map(m => [`${m.name} (H)`, r.stats[m.name].hours])),
                  'Otros (H)': r.stats['Otros'].hours, 'Total (H)': r.totalDocHours
                })));
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Productividad");
                XLSX.writeFile(wb, `Productividad_${MONTH_NAMES[selectedMonth]}_${selectedYear}.xlsx`);
              }}
              className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl border border-emerald-200 font-bold text-xs uppercase flex items-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" /> Exportar Excel
            </button>
          </div>
        </motion.div>
      )}

      {/* ── AI Report ── */}
      {isGeneratingAI && (
        <div className="bg-white p-6 rounded-xl border border-violet-100 text-center space-y-3">
          <Sparkles className="w-10 h-10 text-violet-500 animate-spin mx-auto" />
          <p className="text-violet-600 font-black animate-pulse uppercase tracking-widest text-xs">Analizando indicadores con IA...</p>
        </div>
      )}
      {aiReport && !isGeneratingAI && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900 border-l-4 border-violet-500 p-6 rounded-2xl text-white shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-6 opacity-5"><Sparkles className="w-24 h-24" /></div>
          <div className="flex justify-between items-start mb-5 border-b border-white/10 pb-4">
            <h3 className="text-base font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-400" /> Dashboard Estadístico IA
            </h3>
            <button onClick={() => setAiReport(null)} className="text-white/40 hover:text-white transition-colors"><XCircle className="w-5 h-5" /></button>
          </div>
          <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-li:my-1">
            <Markdown>{aiReport}</Markdown>
          </div>
          <div className="mt-6 pt-4 border-t border-white/10 flex justify-between items-center">
            <p className="text-xs text-white/40 uppercase font-mono italic">Generado el {new Date().toLocaleString()}</p>
            <button
              onClick={() => {
                const win = window.open('', '_blank');
                win?.document.write(`<html><head><title>Informe IA</title><style>body{font-family:sans-serif;padding:40px;line-height:1.6;color:#333}h2{color:#7c3aed}</style></head><body><h2>Informe Estadístico Gerencial - IA</h2><div style="font-size:14px">${aiReport.replace(/\n/g, '<br>')}</div></body></html>`);
              }}
              className="text-xs font-black underline underline-offset-4 hover:text-violet-400"
            >ABRIR PARA IMPRIMIR</button>
          </div>
        </motion.div>
      )}

      {/* ── Estado del Sistema ── */}
      <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl">
        <p className="text-xs text-slate-400 font-mono leading-relaxed">
          <span className="font-bold text-slate-500">Motor V27.0</span> — El cálculo "Triple Sum" consolida las 24h por profesional antes de computar los semáforos semanales.
        </p>
      </div>
    </motion.div>
  );
}
