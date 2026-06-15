import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ShieldCheck, XCircle, CheckCircle, UserPlus, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { ShiftRequest, Doctor, RegistrationRequest } from '../types';

const ROLES = ['Médico General','Médico Rural','Médico Especialista','Médico Obstetra/Ginecólogo','Enfermero Jefe','Jefe de Partos','Auxiliar Enfermería','Interno','Triage','Odontólogo','Laboratorio','Fisioterapeuta','Rayos X'];
const CATS = ['Planta','CTA','APS','Rural','Disponibilidad'] as const;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  requests: ShiftRequest[];
  doctors: Doctor[];
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  registrationRequests?: RegistrationRequest[];
  onApproveRegistration?: (requestId: string, rol: string, cat: string) => Promise<any>;
  onRejectRegistration?: (requestId: string, reason: string) => Promise<void>;
}

export function AuthInboxModal({ isOpen, onClose, requests, doctors, onApprove, onReject, registrationRequests = [], onApproveRegistration, onRejectRegistration }: Props) {
  const pendingShift = requests.filter(r => r.status === 'pending');
  const pendingReg = registrationRequests.filter(r => r.status === 'pending');
  const totalPending = pendingShift.length + pendingReg.length;

  const [tab, setTab] = useState<'turnos' | 'registro'>('registro');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [regState, setRegState] = useState<Record<string, { rol: string; cat: string; rejectReason: string; showReject: boolean; loading: boolean }>>({});

  const getRegState = (id: string) => regState[id] || { rol: 'Médico General', cat: 'Planta', rejectReason: '', showReject: false, loading: false };
  const setRegField = (id: string, field: string, value: any) =>
    setRegState(prev => ({ ...prev, [id]: { ...getRegState(id), [field]: value } }));

  const handleApproveReg = async (req: RegistrationRequest) => {
    if (!onApproveRegistration) return;
    const st = getRegState(req.id);
    setRegField(req.id, 'loading', true);
    await onApproveRegistration(req.id, st.rol, st.cat);
    setRegField(req.id, 'loading', false);
    setExpandedId(null);
  };

  const handleRejectReg = async (req: RegistrationRequest) => {
    if (!onRejectRegistration) return;
    const st = getRegState(req.id);
    if (!st.rejectReason.trim()) return;
    setRegField(req.id, 'loading', true);
    await onRejectRegistration(req.id, st.rejectReason);
    setRegField(req.id, 'loading', false);
    setExpandedId(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-full max-w-2xl rounded-[32px] border border-emerald-100 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
              <ShieldCheck className="w-48 h-48 text-emerald-600" />
            </div>

            {/* Header */}
            <div className="flex justify-between items-center p-6 pb-4 relative z-10">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-emerald-600" />
                Bandeja de Autorización
                {totalPending > 0 && (
                  <span className="bg-rose-500 text-white text-xs font-black px-2 py-0.5 rounded-full">{totalPending}</span>
                )}
              </h2>
              <button onClick={onClose} className="bg-slate-50 p-2 rounded-xl text-slate-400 hover:text-rose-500 transition-colors border border-slate-200">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 px-6 pb-3 relative z-10">
              <button
                onClick={() => setTab('registro')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-sm uppercase transition-all ${
                  tab === 'registro' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                Registros
                {pendingReg.length > 0 && (
                  <span className={`text-xs font-black px-2 py-0.5 rounded-full ${ tab === 'registro' ? 'bg-white text-emerald-700' : 'bg-rose-500 text-white'}`}>{pendingReg.length}</span>
                )}
              </button>
              <button
                onClick={() => setTab('turnos')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-sm uppercase transition-all ${
                  tab === 'turnos' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                <Calendar className="w-4 h-4" />
                Cambios de Turno
                {pendingShift.length > 0 && (
                  <span className={`text-xs font-black px-2 py-0.5 rounded-full ${ tab === 'turnos' ? 'bg-white text-emerald-700' : 'bg-rose-500 text-white'}`}>{pendingShift.length}</span>
                )}
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto px-6 pb-6 space-y-3 relative z-10 flex-1">

              {/* ── REGISTRO TAB ── */}
              {tab === 'registro' && (
                pendingReg.length === 0 ? (
                  <div className="text-center py-16">
                    <UserPlus className="w-10 h-10 text-emerald-200 mx-auto mb-3" />
                    <p className="text-slate-400 font-bold text-sm italic">No hay solicitudes de registro pendientes</p>
                  </div>
                ) : (
                  pendingReg.map(req => {
                    const st = getRegState(req.id);
                    const isExpanded = expandedId === req.id;
                    const prefix = req.genero === 'F' ? 'Dra.' : 'Dr.';
                    return (
                      <div key={req.id} className="bg-white border border-amber-200 rounded-2xl shadow-sm overflow-hidden">
                        <div
                          className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-amber-50/40 transition-colors"
                          onClick={() => setExpandedId(isExpanded ? null : req.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 font-black border border-emerald-100">
                              {req.nombre.charAt(0)}
                            </div>
                            <div>
                              <div className="font-black text-slate-800 text-base">{prefix} {req.nombre} {req.apellidos}</div>
                              <div className="text-xs text-slate-400 font-mono">CC {req.cedula} · {req.requestedRol}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">{new Date(req.createdAt).toLocaleDateString()}</span>
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                          </div>
                        </div>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="border-t border-amber-100 bg-amber-50/30 overflow-hidden"
                            >
                              <div className="p-4 space-y-3">
                                <div className="grid grid-cols-2 gap-2 text-xs bg-white p-3 rounded-xl border border-slate-100">
                                  <div><span className="text-slate-400 uppercase font-bold text-xs">Email</span><br/><span className="font-bold text-slate-700 break-all text-sm">{req.email}</span></div>
                                  <div><span className="text-slate-400 uppercase font-bold text-xs">Teléfono</span><br/><span className="font-bold text-slate-700 text-sm">{req.telefono || '—'}</span></div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="text-xs uppercase font-black text-emerald-600 mb-1 block">Rol a asignar</label>
                                    <select
                                      className="w-full bg-white border border-emerald-200 p-2.5 rounded-xl text-sm font-bold outline-none"
                                      value={st.rol}
                                      onChange={e => setRegField(req.id, 'rol', e.target.value)}
                                    >
                                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="text-xs uppercase font-black text-emerald-600 mb-1 block">Categoría</label>
                                    <select
                                      className="w-full bg-white border border-emerald-200 p-2.5 rounded-xl text-sm font-bold outline-none"
                                      value={st.cat}
                                      onChange={e => setRegField(req.id, 'cat', e.target.value)}
                                    >
                                      {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                  </div>
                                </div>
                                {!st.showReject ? (
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleApproveReg(req)}
                                      disabled={st.loading}
                                      className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-50 transition-all"
                                    >
                                      {st.loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                      APROBAR Y ACTIVAR
                                    </button>
                                    <button
                                      onClick={() => setRegField(req.id, 'showReject', true)}
                                      className="px-4 bg-rose-50 text-rose-600 border border-rose-200 py-3 rounded-xl font-black text-sm hover:bg-rose-100 transition-all"
                                    >
                                      Rechazar
                                    </button>
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    <input
                                      className="w-full bg-white border border-rose-200 p-3 rounded-xl text-sm outline-none font-bold"
                                      placeholder="Motivo del rechazo..."
                                      value={st.rejectReason}
                                      onChange={e => setRegField(req.id, 'rejectReason', e.target.value)}
                                    />
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleRejectReg(req)}
                                        disabled={st.loading || !st.rejectReason.trim()}
                                        className="flex-1 bg-rose-600 text-white py-3 rounded-xl font-black text-sm disabled:opacity-50 hover:bg-rose-700 transition-all"
                                      >
                                        CONFIRMAR RECHAZO
                                      </button>
                                      <button
                                        onClick={() => setRegField(req.id, 'showReject', false)}
                                        className="px-4 bg-slate-100 text-slate-600 py-3 rounded-xl font-black text-sm hover:bg-slate-200 transition-all"
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
                      </div>
                    );
                  })
                )
              )}

              {/* ── TURNOS TAB ── */}
              {tab === 'turnos' && (
                pendingShift.length === 0 ? (
                  <div className="text-center py-16">
                    <Calendar className="w-10 h-10 text-emerald-200 mx-auto mb-3" />
                    <p className="text-slate-400 font-bold text-sm italic">No hay solicitudes de turno pendientes</p>
                  </div>
                ) : (
                  pendingShift.map(req => {
                    const docName = doctors.find(d => d.id === req.doctorId)?.nombre || 'Médico Desconocido';
                    return (
                      <div key={req.id} className="bg-slate-50 border border-emerald-100 p-5 rounded-2xl flex justify-between items-center group hover:border-emerald-500/50 transition-all shadow-sm">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-black text-slate-800 uppercase text-base">{docName}</span>
                            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold uppercase">Turno</span>
                          </div>
                          <div className="text-sm text-emerald-600">
                            Día {req.day} — Jornada: <span className="font-bold uppercase">{req.slot}</span>
                          </div>
                          <p className="text-sm text-slate-500 mt-2 italic bg-white p-3 rounded-xl border border-emerald-50 border-dashed">
                            "{req.reason || 'Sin motivo especificado'}"
                          </p>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => onApprove(req.id)}
                            className="w-11 h-11 flex items-center justify-center bg-emerald-600 text-white rounded-xl hover:scale-110 active:scale-95 transition-all shadow-lg shadow-emerald-500/20"
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => onReject(req.id)}
                            className="w-11 h-11 flex items-center justify-center bg-rose-500 text-white rounded-xl hover:scale-110 active:scale-95 transition-all shadow-lg shadow-rose-500/20"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )
              )}
            </div>

            <div className="px-6 pb-5 pt-3 border-t border-slate-100 text-xs text-slate-400 italic text-center relative z-10">
              Las autorizaciones se reflejan automáticamente en tiempo real.
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
