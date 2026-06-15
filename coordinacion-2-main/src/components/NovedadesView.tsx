import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileSpreadsheet, Printer, Sparkles, XCircle, Info, Calendar, ChevronRight, Send, UserPlus, CheckCircle, XOctagon, ChevronDown, ChevronUp, ClipboardList, Bell, Link2, Copy, Check, Mail, MessageCircle, Plus } from 'lucide-react';
import Markdown from 'react-markdown';
import { collection, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { AuditEntry, UserSession, RegistrationRequest, RegistrationInvitation, DoctorRole } from '../types';

const ROLES: DoctorRole[] = [
  'Médico General', 'Médico Rural', 'Médico Especialista', 'Médico Obstetra/Ginecólogo',
  'Enfermero Jefe', 'Jefe de Partos', 'Auxiliar Enfermería', 'Interno',
  'Triage', 'Odontólogo', 'Laboratorio', 'Fisioterapeuta', 'Rayos X'
];

const CATS = ['Planta', 'CTA', 'APS', 'Rural', 'Disponibilidad'] as const;

interface Props {
  session: UserSession;
  monthName: string;
  selectedYear: number;
  auditLogs: AuditEntry[];
  selectedMonth: number;
  onExportExcel: () => void;
  onExportPDF: () => void;
  onGenerateAI: () => void;
  isGeneratingAI: boolean;
  aiReport: string | null;
  setAiReport: (r: string | null) => void;
  onPushNotification: (doctorId: number, message: string) => void;
  registrationRequests: RegistrationRequest[];
  onApproveRegistration: (requestId: string, assignedRol: string, assignedCat: string) => Promise<{ username: string; password: string } | undefined>;
  onRejectRegistration: (requestId: string, reason: string) => Promise<void>;
}

export function NovedadesView({
  session, monthName, selectedYear, auditLogs, selectedMonth,
  onExportExcel, onExportPDF, onGenerateAI, isGeneratingAI,
  aiReport, setAiReport, onPushNotification,
  registrationRequests, onApproveRegistration, onRejectRegistration
}: Props) {
  const isAdmin = session.r === 'admin';
  const monthLogs = auditLogs.filter(l => l.targetMonth === selectedMonth && l.targetYear === selectedYear);
  const pendingReqs = registrationRequests.filter(r => r.status === 'pending');

  const [activeTab, setActiveTab] = useState<'registros' | 'novedades'>('registros');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [approvalState, setApprovalState] = useState<Record<string, { rol: string; cat: string; rejectReason: string; showReject: boolean; loading: boolean }>>({})
  const [lastCredentials, setLastCredentials] = useState<{ username: string; password: string; nombre: string; email: string } | null>(null);

  // Invitation modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<DoctorRole>('Médico General');
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const getApprovalState = (id: string) => approvalState[id] || { rol: 'Médico General', cat: 'Planta', rejectReason: '', showReject: false, loading: false };
  const setField = (id: string, field: string, value: string | boolean) =>
    setApprovalState(prev => ({ ...prev, [id]: { ...getApprovalState(id), [field]: value } }));

  const handleCreateInvitation = async () => {
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      alert('Por favor ingrese un correo válido');
      return;
    }
    setInviteLoading(true);
    try {
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const id = Date.now().toString();
      const invitation: RegistrationInvitation = {
        id,
        token,
        email: inviteEmail.trim(),
        suggestedRol: inviteRole,
        message: inviteMessage.trim(),
        status: 'pending',
        createdAt: Date.now(),
        createdBy: session.n || 'Admin'
      };
      await setDoc(doc(db, 'registrationInvitations', id), invitation);
      const link = `${window.location.origin}/register?invite=${token}`;
      setGeneratedLink(link);
      setInviteEmail('');
      setInviteMessage('');
    } catch (err) {
      alert('Error creando invitación: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setInviteLoading(false);
    }
  };

  const copyLink = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleApprove = async (req: RegistrationRequest) => {
    const st = getApprovalState(req.id);
    setField(req.id, 'loading', true);
    const result = await onApproveRegistration(req.id, st.rol, st.cat);
    setField(req.id, 'loading', false);
    setExpandedId(null);
    if (result?.username) {
      setLastCredentials({ username: result.username, password: result.password, nombre: `${req.nombre} ${req.apellidos}`, email: req.email });
    }
  };

  const handleReject = async (req: RegistrationRequest) => {
    const st = getApprovalState(req.id);
    if (!st.rejectReason.trim()) return;
    setField(req.id, 'loading', true);
    await onRejectRegistration(req.id, st.rejectReason);
    setField(req.id, 'loading', false);
    setExpandedId(null);
  };

  return (
    <motion.div
      key="novedades"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-4xl mx-auto space-y-6"
    >
      <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm gap-2">
        <div>
          <h2 className="text-base font-black text-slate-800">Novedades — {monthName} {selectedYear}</h2>
          <p className="text-xs text-slate-500 font-mono">Registro oficial de cambios en el turnero</p>
        </div>
        <div className="flex gap-3 no-print">
          <button onClick={onExportExcel} className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl border border-emerald-200 font-bold text-xs uppercase flex items-center gap-2 hover:bg-emerald-100 transition-all">
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
          <button onClick={onExportPDF} className="bg-rose-50 text-rose-700 px-4 py-2 rounded-xl border border-rose-200 font-bold text-xs uppercase flex items-center gap-2 hover:bg-rose-100 transition-all">
            <Printer className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      {/* Tabs — solo admin ve solicitudes de registro */}
      {isAdmin && (
        <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl">
          <button
            onClick={() => setActiveTab('registros')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-xs uppercase transition-all ${
              activeTab === 'registros' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            Solicitudes de Registro
            {pendingReqs.length > 0 && (
              <span className="bg-rose-500 text-white text-xs font-black px-2 py-0.5 rounded-full">{pendingReqs.length}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('novedades')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-xs uppercase transition-all ${
              activeTab === 'novedades' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Registro de Cambios
          </button>
        </div>
      )}

      {/* ── CREDENCIALES GENERADAS ── */}
      {lastCredentials && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-900 text-white p-5 rounded-2xl border border-emerald-600 shadow-xl"
        >
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <span className="font-black text-sm uppercase tracking-widest text-emerald-300">Cuenta Activada</span>
            </div>
            <button onClick={() => setLastCredentials(null)} className="text-white/40 hover:text-white"><XCircle className="w-5 h-5" /></button>
          </div>
          <p className="text-sm text-emerald-100 mb-3"><span className="font-bold">{lastCredentials.nombre}</span> — {lastCredentials.email}</p>
          <div className="grid grid-cols-2 gap-3 bg-black/30 p-4 rounded-xl">
            <div>
              <p className="text-xs uppercase tracking-widest text-emerald-400 mb-1">Usuario</p>
              <p className="font-black text-white text-lg font-mono">{lastCredentials.username}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-emerald-400 mb-1">Contraseña temporal</p>
              <p className="font-black text-white text-lg font-mono">{lastCredentials.password}</p>
            </div>
          </div>
          <p className="text-xs text-emerald-400 mt-3 italic">Estas credenciales fueron enviadas al correo registrado (si SMTP está configurado). Guárdalas como respaldo.</p>
        </motion.div>
      )}

      {/* ── SOLICITUDES DE REGISTRO ── */}
      {isAdmin && activeTab === 'registros' && (
        <div className="space-y-3">
          {/* Header with invite button */}
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div>
              <h3 className="text-sm font-black text-slate-800">Bandeja de Solicitudes</h3>
              <p className="text-xs text-slate-500">Gestiona las solicitudes de registro de personal</p>
            </div>
            <button
              onClick={() => setShowInviteModal(true)}
              className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20"
            >
              <Link2 className="w-4 h-4" />
              Invitar Personal
            </button>
          </div>

          {registrationRequests.length === 0 ? (
            <div className="bg-stone-100/50 border border-emerald-100 p-8 rounded-2xl text-center">
              <UserPlus className="w-8 h-8 text-emerald-200 mx-auto mb-2" />
              <p className="text-slate-400 uppercase font-black tracking-widest text-xs italic">No hay solicitudes de registro</p>
            </div>
          ) : (
            registrationRequests.map(req => {
              const st = getApprovalState(req.id);
              const isExpanded = expandedId === req.id;
              const prefix = req.genero === 'F' ? 'Dra.' : 'Dr.';
              const statusColor = req.status === 'pending' ? 'bg-amber-50 border-amber-200 text-amber-700'
                : req.status === 'approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-rose-50 border-rose-200 text-rose-700';
              const statusLabel = req.status === 'pending' ? 'Pendiente' : req.status === 'approved' ? 'Aprobado' : 'Rechazado';

              return (
                <motion.div
                  key={req.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`bg-white border rounded-2xl shadow-sm overflow-hidden transition-all ${
                    req.status === 'pending' ? 'border-amber-200' : 'border-slate-200'
                  }`}
                >
                  {/* Header row */}
                  <div
                    className="p-4 flex flex-wrap gap-4 items-center justify-between cursor-pointer hover:bg-slate-50/60 transition-colors"
                    onClick={() => req.status === 'pending' && setExpandedId(isExpanded ? null : req.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 font-black border border-emerald-100 text-lg">
                        {req.nombre.charAt(0)}
                      </div>
                      <div>
                        <div className="font-black text-slate-800">{prefix} {req.nombre} {req.apellidos}</div>
                        <div className="text-xs text-slate-400 font-mono">CC {req.cedula} · RM {req.registroMedico || '—'}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="text-right">
                        <div className="text-xs text-slate-400">{new Date(req.createdAt).toLocaleString()}</div>
                        <div className="text-xs text-slate-500">Solicitó: <span className="font-bold">{req.requestedRol}</span></div>
                      </div>
                      <span className={`text-xs font-black uppercase px-3 py-1.5 rounded-full border ${statusColor}`}>
                        {statusLabel}
                      </span>
                      {req.status === 'pending' && (
                        <button className="p-1.5 text-slate-400 hover:text-emerald-600 transition-colors">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded approval panel */}
                  <AnimatePresence>
                    {isExpanded && req.status === 'pending' && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-amber-100 bg-amber-50/30 overflow-hidden"
                      >
                        <div className="p-5 space-y-4">
                          {/* Datos del solicitante */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-slate-100">
                            <div><p className="text-xs uppercase font-black text-slate-400">Email</p><p className="text-sm font-bold text-slate-700 break-all">{req.email}</p></div>
                            <div><p className="text-xs uppercase font-black text-slate-400">Teléfono</p><p className="text-sm font-bold text-slate-700">{req.telefono || '—'}</p></div>
                            <div><p className="text-xs uppercase font-black text-slate-400">Género</p><p className="text-sm font-bold text-slate-700">{req.genero === 'M' ? 'Masculino' : 'Femenino'}</p></div>
                            <div><p className="text-xs uppercase font-black text-slate-400">Solicitó rol</p><p className="text-sm font-bold text-emerald-700">{req.requestedRol}</p></div>
                          </div>

                          {/* Asignación por admin */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs uppercase font-black text-emerald-600 ml-1 mb-1 block">Rol a Asignar *</label>
                              <select
                                className="w-full bg-white border border-emerald-200 p-3 rounded-xl outline-none focus:border-emerald-500 font-bold text-sm"
                                value={st.rol}
                                onChange={e => setField(req.id, 'rol', e.target.value)}
                              >
                                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs uppercase font-black text-emerald-600 ml-1 mb-1 block">Categoría *</label>
                              <select
                                className="w-full bg-white border border-emerald-200 p-3 rounded-xl outline-none focus:border-emerald-500 font-bold text-sm"
                                value={st.cat}
                                onChange={e => setField(req.id, 'cat', e.target.value)}
                              >
                                {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                          </div>

                          {/* Botones */}
                          {!st.showReject ? (
                            <div className="flex gap-3">
                              <button
                                onClick={() => handleApprove(req)}
                                disabled={st.loading}
                                className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50"
                              >
                                {st.loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                APROBAR Y ACTIVAR CUENTA
                              </button>
                              <button
                                onClick={() => setField(req.id, 'showReject', true)}
                                className="px-5 bg-rose-50 text-rose-600 border border-rose-200 py-3 rounded-xl font-black text-sm flex items-center gap-2 hover:bg-rose-100 transition-all"
                              >
                                <XOctagon className="w-4 h-4" /> Rechazar
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div>
                                <label className="text-xs uppercase font-black text-rose-600 ml-1 mb-1 block">Motivo del Rechazo *</label>
                                <input
                                  className="w-full bg-white border border-rose-200 p-3 rounded-xl outline-none focus:border-rose-400 font-bold text-sm"
                                  placeholder="Ej: Documento incompleto, verificar registro médico..."
                                  value={st.rejectReason}
                                  onChange={e => setField(req.id, 'rejectReason', e.target.value)}
                                />
                              </div>
                              <div className="flex gap-3">
                                <button
                                  onClick={() => handleReject(req)}
                                  disabled={st.loading || !st.rejectReason.trim()}
                                  className="flex-1 bg-rose-600 text-white py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 hover:bg-rose-700 disabled:opacity-50 transition-all"
                                >
                                  {st.loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <XOctagon className="w-4 h-4" />}
                                  CONFIRMAR RECHAZO
                                </button>
                                <button
                                  onClick={() => setField(req.id, 'showReject', false)}
                                  className="px-5 bg-slate-100 text-slate-600 py-3 rounded-xl font-black text-sm hover:bg-slate-200 transition-all"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Aprobado/Rechazado footer */}
                  {req.status !== 'pending' && (
                    <div className={`px-5 py-2.5 border-t text-xs font-bold uppercase tracking-widest ${
                      req.status === 'approved' ? 'border-emerald-100 bg-emerald-50/50 text-emerald-600' : 'border-rose-100 bg-rose-50/50 text-rose-600'
                    }`}>
                      {req.status === 'approved'
                        ? `✅ Aprobado por ${req.reviewedBy} · ${req.reviewedAt ? new Date(req.reviewedAt).toLocaleString() : ''}`
                        : `❌ Rechazado: "${req.rejectionReason}" — ${req.reviewedBy}`
                      }
                    </div>
                  )}
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* ── REGISTRO DE CAMBIOS (siempre visible para no-admin, tab para admin) ── */}
      {(!isAdmin || activeTab === 'novedades') && (
        <>
      {isGeneratingAI && (
        <div className="bg-white p-6 rounded-xl border border-violet-100 text-center space-y-3">
          <div className="flex justify-center">
            <Sparkles className="w-8 h-8 text-violet-500 animate-spin" />
          </div>
          <p className="text-violet-600 font-black animate-pulse uppercase tracking-widest text-xs">Analizando indicadores con IA...</p>
        </div>
      )}

      {aiReport && !isGeneratingAI && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900 border-l-4 border-violet-500 p-5 rounded-2xl text-white shadow-lg relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Sparkles className="w-32 h-32" />
          </div>
          <div className="flex justify-between items-start mb-3 border-b border-white/10 pb-3">
            <h3 className="text-sm font-black flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-400" /> Dashboard Estadístico IA
            </h3>
            <button onClick={() => setAiReport(null)} className="text-white/40 hover:text-white transition-colors">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
          <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-li:my-1">
            <Markdown>{aiReport}</Markdown>
          </div>
          <div className="mt-4 pt-3 border-t border-white/10 flex justify-between items-center">
            <p className="text-xs text-white/40 uppercase font-mono italic">Generado el {new Date().toLocaleString()}</p>
            <button
              onClick={() => {
                const win = window.open('', '_blank');
                win?.document.write(`<html><head><title>Informe Estadístico IA</title><style>body{font-family:sans-serif;padding:40px;line-height:1.6;color:#333}h2{color:#7c3aed}pre{white-space:pre-wrap;background:#f4f4f4;padding:20px;border-radius:10px}</style></head><body><h2>Informe Estadístico Gerencial - IA</h2><div style="font-size:14px">${aiReport.replace(/\n/g, '<br>')}</div></body></html>`);
              }}
              className="text-xs font-black underline underline-offset-4 hover:text-violet-400"
            >
              ABRIR PARA IMPRIMIR
            </button>
          </div>
        </motion.div>
      )}

      <div className="space-y-3">
        {monthLogs.length === 0 ? (
          <div className="bg-stone-100/50 border border-emerald-100 p-8 rounded-2xl text-center">
            <Info className="w-8 h-8 text-emerald-200 mx-auto mb-2" />
            <p className="text-slate-400 uppercase font-black tracking-widest text-xs italic">No hay movimientos registrados para este mes</p>
          </div>
        ) : (
          monthLogs.map(log => (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              key={log.id}
              className="bg-white border border-slate-200 p-5 rounded-2xl flex flex-wrap gap-4 items-center justify-between group hover:border-emerald-500/40 transition-colors shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 font-black border border-emerald-100">
                  {log.doctorName.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800">Dr. {log.doctorName}</div>
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <Calendar className="w-3 h-3" /> Día {log.day} | Jornada: {log.slot.toUpperCase()}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-stone-50 px-3 py-2 rounded-xl border border-slate-100">
                <span className="text-xs text-rose-400 line-through opacity-50 px-2">{log.oldSigla}</span>
                <ChevronRight className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-md">{log.newSigla}</span>
              </div>

              <div className="flex items-center gap-3">
                {isAdmin && (
                  <button
                    onClick={() => onPushNotification(log.doctorId, `🔔 NOVEDAD INDIVIDUAL: Día ${log.day} (${log.slot.toUpperCase()}) cambio a ${log.newSigla}. Por favor verifique.`)}
                    className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all group/note"
                    title="Notificar inmediatamente a este médico"
                  >
                    <Send className="w-4 h-4 group-hover/note:translate-x-1 transition-transform" />
                  </button>
                )}
                <div className="text-right">
                  <div className="text-xs text-slate-400">{new Date(log.timestamp).toLocaleString()}</div>
                  <div className="text-xs uppercase font-bold text-emerald-700/60 transition-colors">Por: {log.adminName}</div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
        </>
      )}

      {/* ── INVITATION MODAL ── */}
      <AnimatePresence>
        {showInviteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowInviteModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="bg-emerald-600 p-4 flex items-center justify-between">
                <h3 className="text-white font-black text-sm uppercase flex items-center gap-2">
                  <Link2 className="w-5 h-5" />
                  Invitar Personal
                </h3>
                <button onClick={() => { setShowInviteModal(false); setGeneratedLink(null); }} className="text-white/80 hover:text-white">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {generatedLink ? (
                  <div className="space-y-4">
                    <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
                      <p className="text-sm font-bold text-emerald-800 mb-2">¡Enlace generado exitosamente!</p>
                      <p className="text-xs text-emerald-600 mb-3">Comparte este enlace con el personal para que complete su registro:</p>
                      <div className="bg-white p-3 rounded-lg border border-emerald-200 break-all text-xs font-mono text-slate-600">
                        {generatedLink}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        onClick={copyLink}
                        className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all"
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copied ? '¡Enlace Copiado!' : 'Copiar Enlace'}
                      </button>
                      <div className="grid grid-cols-2 gap-2">
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(`Hola! Te invito a registrarte en el sistema de Coordinación Médica HDSAR. Ingresa al siguiente enlace y completa tus datos:\n\n${generatedLink}`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-bold text-xs uppercase transition-all"
                        >
                          <MessageCircle className="w-4 h-4" />
                          WhatsApp
                        </a>
                        <a
                          href={`mailto:${inviteEmail || ''}?subject=${encodeURIComponent('Invitación de Registro — Coordinación Médica HDSAR')}&body=${encodeURIComponent(`Estimado/a,\n\nHa sido invitado/a a registrarse en el sistema de Coordinación Médica del Hospital Departamental San Antonio de Roldanillo.\n\nPor favor, haga clic en el siguiente enlace para completar su registro:\n\n${generatedLink}\n\nEste enlace es de uso único. Una vez complete el formulario, el administrador revisará su solicitud y le enviará sus credenciales de acceso.\n\nSaludos,\nCoordinación Médica HDSAR`)}`}
                          className="flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl font-bold text-xs uppercase transition-all"
                        >
                          <Mail className="w-4 h-4" />
                          Correo
                        </a>
                      </div>
                      <button
                        onClick={() => { setGeneratedLink(null); setInviteEmail(''); setInviteMessage(''); }}
                        className="w-full border border-slate-200 text-slate-500 py-2.5 rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2 hover:bg-slate-50 transition-all"
                      >
                        <Plus className="w-4 h-4" />
                        Nueva Invitación
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Correo Electrónico</label>
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                        placeholder="personal@hospital.gov.co"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Rol Sugerido</label>
                      <select
                        value={inviteRole}
                        onChange={e => setInviteRole(e.target.value as DoctorRole)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-sm bg-white"
                      >
                        {ROLES.map(role => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Mensaje Personalizado (Opcional)</label>
                      <textarea
                        value={inviteMessage}
                        onChange={e => setInviteMessage(e.target.value)}
                        placeholder="Hola, por favor completa tu registro en el sistema..."
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-sm resize-none h-20"
                      />
                    </div>

                    <button
                      onClick={handleCreateInvitation}
                      disabled={inviteLoading}
                      className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all disabled:opacity-50"
                    >
                      {inviteLoading ? (
                        <span className="animate-pulse">Generando...</span>
                      ) : (
                        <>
                          <Link2 className="w-4 h-4" />
                          Generar Enlace de Invitación
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
