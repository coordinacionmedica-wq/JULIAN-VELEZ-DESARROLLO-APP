import {
  Calendar, ChevronRight, Send, MapPin, ClipboardList,
  Settings, BrainCircuit, BarChart3, Database, FileText, BookOpen
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export function BottomNav() {
  const { session, activeTab, setActiveTab, doctors } = useAppContext();

  const isAdmin = session?.r === 'admin';
  const isAdminOrRoot = session?.r === 'admin' || session?.r === 'root';
  const userDoc = !isAdmin && session?.doctorId ? doctors.find(d => d.id === session.doctorId) : null;
  const hasPerm = (key: string): boolean => {
    if (isAdmin) return true;
    const perms = userDoc?.permissions;
    return perms === undefined ? true : perms.includes(key);
  };

  const navItems = [
    { id: 'home',        icon: ChevronRight, label: 'Inicio',   show: true },
    { id: 'turnos',      icon: Calendar,     label: 'Turnos',   show: true },
    { id: 'pic',         icon: BrainCircuit, label: 'PIC',      show: hasPerm('ver_pic') },
    { id: 'solicitudes', icon: Send,         label: 'Solicita', show: hasPerm('solicitar_turno') },
    { id: 'rural',       icon: MapPin,       label: 'Rural',    show: hasPerm('call_availability') },
    { id: 'stats',       icon: BarChart3,    label: 'Stats',    show: isAdminOrRoot },
    { id: 'novedades',   icon: ClipboardList,label: 'Novedades',show: !!isAdmin },
    { id: 'bd',          icon: Database,     label: 'TH',       show: !!isAdmin },
    { id: 'docs',        icon: FileText,     label: 'Guías',    show: hasPerm('ver_guias') },
    { id: 'admin',       icon: Settings,     label: 'Admin',    show: !!isAdmin },
    { id: 'toolbox',     icon: Database,     label: 'AI',       show: !!isAdmin },
    { id: 'ayuda',       icon: BookOpen,     label: 'Órdenes',  show: !!isAdmin },
  ].filter(t => t.show);

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-emerald-100 z-50 no-print shadow-2xl">
      <div className="max-w-7xl mx-auto flex justify-around overflow-x-auto px-1 py-1 md:py-2">
        {navItems.map(btn => (
          <button
            key={btn.id}
            onClick={() => setActiveTab(btn.id)}
            className={`flex flex-col items-center justify-center p-2 rounded-xl min-w-[52px] md:min-w-[64px] transition-all ${
              activeTab === btn.id
                ? 'text-white bg-emerald-600 shadow-lg'
                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
            }`}
          >
            <btn.icon className="w-5 h-5 md:w-6 md:h-6 mb-0.5" />
            <span className="text-[9px] md:text-xs font-black uppercase tracking-tight whitespace-nowrap">{btn.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
