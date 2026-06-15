import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ShieldCheck,
  Bell,
  CheckCircle,
  LogOut,
  MessageCircle,
  Menu,
  X,
  ChevronDown,
  Calendar,
  Send,
  MapPin,
  ClipboardList,
  Settings,
  Database,
  FileText,
  BrainCircuit,
  BookOpen,
  BarChart3,
  Users,
  MoreHorizontal,
  Home,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { RegistrationRequest } from '../types';

interface AppHeaderProps {
  isAdminUser: boolean;
  showAuthInbox: () => void;
}

export function AppHeader({ isAdminUser, showAuthInbox }: AppHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const {
    session,
    activeTab,
    setActiveTab,
    doctors,
    shiftRequests,
    userNotifications,
    markNotificationRead,
    handleLogout,
    handleGoogleLogin,
    isFirebaseUnauthenticatedAdmin,
    registrationRequests,
  } = useAppContext();

  if (!session) return null;

  const pendingShift = shiftRequests.filter(r => r.status === 'pending').length;
  const pendingReg = registrationRequests.filter((r: RegistrationRequest) => r.status === 'pending').length;
  const pendingCount = pendingShift + pendingReg;

  return (
    <>
      {isFirebaseUnauthenticatedAdmin && (
        <div className="bg-amber-500 text-black text-xs uppercase font-black py-2 px-4 flex items-center justify-center gap-3 sticky top-0 z-[60] shadow-lg">
          <ShieldCheck className="w-4 h-4" />
          <span>Atención: Ha entrado como Administrador Maestro pero no ha iniciado sesión con Google. Los cambios no se guardarán en la nube.</span>
          <button
            onClick={handleGoogleLogin}
            className="bg-black text-white px-3 py-1 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            Vincular Google
          </button>
        </div>
      )}

      {/* ══ BRAND BAR ══ */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-800 no-print shadow-xl shadow-emerald-950/40 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 md:px-6 py-2.5 md:py-3 flex items-center justify-between gap-4">

          {/* ── Identidad institucional ── */}
          <div className="flex items-center gap-4 min-w-0">
            {/* Logo con marco blanco y sombra prominente */}
            <div className="bg-white rounded-2xl p-2 md:p-2.5 shadow-2xl ring-2 ring-white/20 shrink-0">
              <img
                src="/Logo_HDSA.jpg"
                alt="Logo HDSA"
                className="h-16 md:h-20 w-auto object-contain"
              />
            </div>

            {/* Separador vertical */}
            <div className="hidden sm:block w-px h-16 bg-white/20 shrink-0" />

            {/* Texto institucional */}
            <div className="min-w-0">
              <p className="text-emerald-300/80 text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] leading-none mb-1">
                ESE Hospital Departamental San Antonio
              </p>
              <h1 className="text-white font-black text-xl md:text-2xl leading-tight tracking-tight">
                Coordinación Médica
              </h1>
              <p className="text-emerald-200/70 text-xs md:text-sm font-medium mt-0.5 hidden sm:block">
                Dr. Julián Humberto Vélez Varela — Roldanillo, Valle
              </p>
            </div>
          </div>

          {/* ── Acciones (menú + notificaciones) ── */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Badge de pendientes */}
            {isAdminUser && pendingCount > 0 && (
              <button
                onClick={() => { showAuthInbox(); }}
                className="flex items-center gap-1.5 bg-amber-400 text-amber-900 px-3 py-1.5 rounded-full font-black text-xs hover:bg-amber-300 transition-all shadow-lg shadow-amber-500/30 animate-pulse"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
              </button>
            )}

            {/* Notificaciones del doctor */}
            {session?.doctorId && userNotifications.length > 0 && (
              <div className="relative">
                <div className="w-2 h-2 bg-rose-500 rounded-full absolute -top-0.5 -right-0.5 animate-pulse" />
                <Bell className="w-5 h-5 text-white/70" />
              </div>
            )}

            {/* Menú hamburguesa */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={`p-2.5 rounded-xl border-2 transition-all ${
                menuOpen
                  ? 'bg-white text-emerald-800 border-white shadow-lg'
                  : 'bg-white/10 text-white border-white/20 hover:bg-white/20 hover:border-white/40'
              }`}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-3 md:right-6 top-full mt-2 w-72 bg-white border border-slate-100 rounded-2xl shadow-2xl p-3 z-[60]"
                >
                  {/* Admin: Bandeja */}
                  {isAdminUser && (
                    <button
                      onClick={() => { showAuthInbox(); setMenuOpen(false); }}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl mb-2 transition-all ${
                        pendingCount > 0
                          ? 'bg-amber-50 border border-amber-200 text-amber-700'
                          : 'bg-emerald-50/50 border border-emerald-100 text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      <ShieldCheck className="w-5 h-5" />
                      <div className="text-left flex-1">
                        <div className="text-xs uppercase font-bold opacity-60">Administración</div>
                        <div className="text-sm font-black">Bandeja de Autorización</div>
                      </div>
                      {pendingCount > 0 && (
                        <span className="bg-amber-500 text-black text-xs w-6 h-6 rounded-full flex items-center justify-center font-black">
                          {pendingCount}
                        </span>
                      )}
                    </button>
                  )}

                  {/* Doctor: Notifications */}
                  {session?.doctorId && userNotifications.length > 0 && (
                    <div className="mb-2 border border-emerald-100 rounded-xl p-3 bg-emerald-50/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Bell className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs uppercase font-bold text-emerald-600">Notificaciones</span>
                        <span className="bg-rose-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold ml-auto">
                          {userNotifications.length}
                        </span>
                      </div>
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {userNotifications.map(n => (
                          <div key={n.id} className="text-sm bg-white p-2.5 rounded-lg border border-emerald-100 flex justify-between items-center">
                            <span className="text-slate-700 truncate mr-2">{n.message}</span>
                            <button
                              onClick={() => markNotificationRead(n.id)}
                              className="text-emerald-500 hover:scale-110 active:scale-95 shrink-0"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Chat Médico */}
                  <a
                    href="https://wa.me/573173683886?mode=gi_t"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 p-3 rounded-xl bg-[#25D366]/10 border border-[#25D366]/20 text-[#128C7E] hover:bg-[#25D366]/20 transition-all mb-2"
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span className="text-sm font-black uppercase">Chat Médico</span>
                  </a>

                  {/* Logout */}
                  <button
                    onClick={() => { handleLogout(); setMenuOpen(false); }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-100 transition-all"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="text-sm font-black uppercase">Cerrar Sesión</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ══ NAV BAR ══ */}
        {(() => {
          const isAdmin = session.r === 'admin';
          const isAdminOrRoot = session.r === 'admin' || session.r === 'root';
          const userDoc = !isAdmin && session?.doctorId ? doctors.find(d => d.id === session.doctorId) : null;
          const hasPerm = (key: string): boolean => {
            if (isAdmin) return true;
            const perms = userDoc?.permissions;
            return perms === undefined ? true : perms.includes(key);
          };

          const primaryTabs = [
            { id: 'home',        label: 'Inicio',         icon: Home,          show: true },
            { id: 'turnos',      label: 'Turnos',         icon: Calendar,      show: true },
            { id: 'pic',         label: 'PIC',            icon: BrainCircuit,  show: hasPerm('ver_pic') },
            { id: 'solicitudes', label: 'Solicitudes',    icon: Send,          show: hasPerm('solicitar_turno') },
            { id: 'rural',       label: 'Rural',          icon: MapPin,        show: hasPerm('call_availability') },
            { id: 'stats',       label: 'Estadísticas',   icon: BarChart3,     show: isAdminOrRoot },
            { id: 'docs',        label: 'Guías',          icon: FileText,      show: !isAdmin && hasPerm('ver_guias') },
            { id: 'novedades',   label: 'Novedades',      icon: ClipboardList, show: isAdmin },
            { id: 'bd',          label: 'Talento Humano', icon: Users,         show: isAdmin },
          ].filter(t => t.show);

          const secondaryTabs = isAdmin ? [
            { id: 'docs',    label: 'Guías',   icon: FileText },
            { id: 'admin',   label: 'Admin',   icon: Settings },
            { id: 'toolbox', label: 'IA',      icon: Database },
            { id: 'ayuda',   label: 'Órdenes', icon: BookOpen },
          ] : [];

          const allTabs = [...primaryTabs, ...secondaryTabs];
          const activeTabMeta = allTabs.find(t => t.id === activeTab);
          const secondaryActive = secondaryTabs.some(t => t.id === activeTab);

          return (
            <div className="border-t border-white/10 bg-emerald-950/30 backdrop-blur-sm">
              <div className="max-w-7xl mx-auto px-3 md:px-6">

                {/* MOBILE: tab activo + botón menú */}
                <div className="flex md:hidden items-center justify-between gap-2 py-1.5">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-white/15 text-white rounded-lg font-bold text-sm border border-white/20">
                    {activeTabMeta && <activeTabMeta.icon className="w-3.5 h-3.5 shrink-0" />}
                    <span className="truncate">{activeTabMeta?.label ?? 'Menú'}</span>
                  </div>
                  <button
                    onClick={() => setMoreMenuOpen(v => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 border border-white/20 text-white rounded-lg font-bold text-sm hover:bg-white/20 transition-all shrink-0"
                  >
                    {moreMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                    Menú
                  </button>
                </div>

                {/* MOBILE dropdown */}
                <AnimatePresence>
                  {moreMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-[55] md:hidden" onClick={() => setMoreMenuOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        className="md:hidden absolute left-3 right-3 mt-1 bg-white border border-slate-100 rounded-2xl shadow-2xl z-[60] p-2 grid grid-cols-2 gap-1"
                      >
                        {primaryTabs.map(tab => (
                          <button
                            key={tab.id}
                            onClick={() => { setActiveTab(tab.id); setMoreMenuOpen(false); }}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl font-bold text-sm transition-all ${
                              activeTab === tab.id ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-700 hover:bg-emerald-50'
                            }`}
                          >
                            <tab.icon className="w-4 h-4 shrink-0" />
                            {tab.label}
                          </button>
                        ))}
                        {secondaryTabs.length > 0 && (
                          <>
                            <div className="col-span-2 h-px bg-slate-100 my-1" />
                            {secondaryTabs.map(tab => (
                              <button
                                key={tab.id}
                                onClick={() => { setActiveTab(tab.id); setMoreMenuOpen(false); }}
                                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl font-bold text-sm transition-all ${
                                  activeTab === tab.id ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
                                }`}
                              >
                                <tab.icon className="w-4 h-4 shrink-0" />
                                {tab.label}
                              </button>
                            ))}
                          </>
                        )}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>

                {/* DESKTOP: tab bar */}
                <div className="hidden md:flex items-center gap-0.5 py-1">
                  {primaryTabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold text-sm transition-all whitespace-nowrap shrink-0 ${
                        activeTab === tab.id
                          ? 'bg-white text-emerald-800 shadow-md'
                          : 'text-white/80 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <tab.icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  ))}

                  {secondaryTabs.length > 0 && (
                    <div className="relative shrink-0 ml-auto">
                      <button
                        onClick={() => setMoreMenuOpen(v => !v)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${
                          secondaryActive || moreMenuOpen
                            ? 'bg-white text-emerald-800 shadow-md'
                            : 'text-white/80 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                        Más
                        <ChevronDown className={`w-3 h-3 transition-transform ${moreMenuOpen ? 'rotate-180' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {moreMenuOpen && (
                          <>
                            <div className="fixed inset-0 z-[55]" onClick={() => setMoreMenuOpen(false)} />
                            <motion.div
                              initial={{ opacity: 0, y: -8, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -8, scale: 0.95 }}
                              transition={{ duration: 0.12 }}
                              className="absolute right-0 top-full mt-1 bg-white border border-slate-100 rounded-xl shadow-xl p-1.5 z-[60] min-w-[150px]"
                            >
                              {secondaryTabs.map(tab => (
                                <button
                                  key={tab.id}
                                  onClick={() => { setActiveTab(tab.id); setMoreMenuOpen(false); }}
                                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg font-bold text-sm transition-all ${
                                    activeTab === tab.id ? 'bg-emerald-600 text-white' : 'text-emerald-700 hover:bg-emerald-50'
                                  }`}
                                >
                                  <tab.icon className="w-3.5 h-3.5" />
                                  {tab.label}
                                </button>
                              ))}
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>

              </div>
            </div>
          );
        })()}
      </div>
    </>
  );
}
