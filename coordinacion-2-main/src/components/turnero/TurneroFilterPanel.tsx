import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Search, Users, Layers, CheckCircle, FileSpreadsheet } from 'lucide-react';
import { Doctor } from '../../types';
import { MONTH_NAMES } from '../../constants';

interface TurneroFilterPanelProps {
  // Period
  selectedMonth: number;
  setSelectedMonth: (m: number) => void;
  selectedYear: number;
  setSelectedYear: (y: number) => void;
  // Doctor filter
  doctors: Doctor[];
  doctorFilter: number[];
  addDoctorFilter: (id: number) => void;
  removeDoctorFilter: (id: number) => void;
  clearDoctorFilter: () => void;
  // Role filter
  selectedRoles: string[];
  toggleRole: (role: string) => void;
  clearRoles: () => void;
  roleSearch: string;
  setRoleSearch: (s: string) => void;
  showRoleSelector: boolean;
  setShowRoleSelector: (v: boolean) => void;
  filteredRolesList: string[];
  // Category filter
  selectedCategories: string[];
  toggleCategory: (cat: string) => void;
  clearCategories: () => void;
  showCatSelector: boolean;
  setShowCatSelector: (v: boolean) => void;
  // Actions
  showGridHours: boolean;
  setShowGridHours: (v: boolean) => void;
  onDownloadTemplate: () => void;
  onExportExcel: () => void;
  onExportPDF: () => void;
  onImportExcel: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPublish: () => void;
  isAdmin: boolean;
  globalTotalHours: number;
}

export function TurneroFilterPanel(props: TurneroFilterPanelProps) {
  const {
    selectedMonth, setSelectedMonth, selectedYear, setSelectedYear,
    doctors, doctorFilter, addDoctorFilter, removeDoctorFilter, clearDoctorFilter,
    selectedRoles, toggleRole, clearRoles, roleSearch, setRoleSearch,
    showRoleSelector, setShowRoleSelector, filteredRolesList,
    selectedCategories, toggleCategory, clearCategories,
    showCatSelector, setShowCatSelector,
    showGridHours, setShowGridHours,
    onDownloadTemplate, onExportExcel, onExportPDF, onImportExcel, onPublish,
    isAdmin, globalTotalHours,
  } = props;

  return (
    <div className="flex flex-col gap-3 bg-white p-3 md:p-4 rounded-xl md:rounded-2xl border border-slate-200 no-print shadow-sm">
      {/* Period + filters grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        {/* Period selector */}
        <div className="col-span-2 md:col-span-1">
          <label className="text-xs md:text-xs uppercase text-sky-600 ml-1 mb-1 block font-bold">Período</label>
          <div className="flex gap-1 md:gap-2">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="flex-1 bg-slate-50 border border-slate-200 p-2 md:p-3 rounded-lg md:rounded-xl text-xs md:text-sm text-slate-800 outline-none focus:border-sky-500"
            >
              {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="w-20 md:w-24 bg-slate-50 border border-slate-200 p-2 md:p-3 rounded-lg md:rounded-xl text-xs md:text-sm text-slate-800 outline-none focus:border-sky-500"
            >
              {Array.from({ length: 10 }, (_, i) => 2026 + i).map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {/* Doctor filter - Improved mobile experience */}
        <div className="col-span-2 md:col-span-1">
          <label className="text-xs md:text-xs uppercase text-sky-600 ml-1 mb-1 block font-bold flex items-center gap-1">
            <span className="hidden md:inline">Filtrar por</span> Médico
          </label>
          <select
            onChange={(e) => { addDoctorFilter(parseInt(e.target.value)); e.target.value = ""; }}
            className="w-full bg-slate-50 border border-slate-200 p-2 md:p-3 rounded-lg md:rounded-xl text-xs md:text-sm text-slate-800 outline-none focus:border-sky-500 touch-manipulation"
            style={{ fontSize: '16px' }} // Prevents iOS zoom on focus
          >
            <option value="">Todos los médicos...</option>
            {doctors.map(d => (
              <option key={d.id} value={d.id}>
                #{d.sortOrder || d.id} - {d.nombre} {d.apellidos || ''} ({d.cat})
              </option>
            ))}
          </select>
        </div>

        {/* Role filter */}
        <div className="relative">
          <label className="text-xs md:text-xs uppercase text-emerald-600/60 ml-1 mb-1 block font-bold flex items-center gap-1">
            <Users className="w-3 h-3" /> Rol
          </label>
          <button
            onClick={() => setShowRoleSelector(!showRoleSelector)}
            className="w-full bg-slate-50 border border-slate-200 p-2 md:p-3 rounded-lg md:rounded-xl text-left flex justify-between items-center hover:border-emerald-500 transition-all"
          >
            <span className="text-xs md:text-xs font-bold text-slate-700 truncate">
              {selectedRoles.length === 0 ? 'TODOS' : `${selectedRoles.length} sel.`}
            </span>
            <ChevronDown className={`w-3 h-3 md:w-4 md:h-4 text-slate-400 transition-transform ${showRoleSelector ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {showRoleSelector && (
              <>
                <div className="fixed inset-0 z-[100]" onClick={() => setShowRoleSelector(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl md:rounded-2xl shadow-2xl z-[101] overflow-hidden min-w-[200px]"
                >
                  <div className="p-2 border-b border-slate-100 bg-stone-50">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                      <input
                        autoFocus
                        placeholder="Buscar rol..."
                        className="w-full bg-white border border-slate-200 p-1.5 pl-7 rounded-lg text-xs md:text-xs outline-none focus:border-emerald-500"
                        value={roleSearch}
                        onChange={e => setRoleSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="max-h-[200px] overflow-y-auto p-1.5 custom-scrollbar">
                    <button
                      onClick={clearRoles}
                      className={`w-full text-left px-2 py-1.5 rounded-lg text-xs md:text-xs font-black uppercase mb-0.5 transition-colors ${selectedRoles.length === 0 ? 'bg-emerald-600 text-white' : 'hover:bg-slate-50 text-slate-600'}`}
                    >
                      TODOS
                    </button>
                    {filteredRolesList.map(r => (
                      <button
                        key={r}
                        onClick={() => toggleRole(r)}
                        className={`w-full text-left px-2 py-1.5 rounded-lg text-xs md:text-xs font-bold uppercase mb-0.5 transition-all flex items-center justify-between ${selectedRoles.includes(r) ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-slate-50 text-slate-600'}`}
                      >
                        {r}
                        {selectedRoles.includes(r) && <CheckCircle className="w-3 h-3 text-emerald-600" />}
                      </button>
                    ))}
                  </div>
                  {selectedRoles.length > 0 && (
                    <div className="p-1.5 border-t border-slate-100 bg-stone-50">
                      <button onClick={clearRoles} className="w-full py-1.5 text-xs font-black text-rose-500 hover:bg-rose-50 rounded-lg">
                        LIMPIAR
                      </button>
                    </div>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Category filter */}
        <div className="relative">
          <label className="text-xs md:text-xs uppercase text-emerald-600/60 ml-1 mb-1 block font-bold flex items-center gap-1">
            <Layers className="w-3 h-3" /> Categoría
          </label>
          <button
            onClick={() => setShowCatSelector(!showCatSelector)}
            className="w-full bg-slate-50 border border-slate-200 p-2 md:p-3 rounded-lg md:rounded-xl text-left flex justify-between items-center hover:border-emerald-500 transition-all"
          >
            <span className="text-xs md:text-xs font-bold text-slate-700 truncate">
              {selectedCategories.length === 0 ? 'TODAS' : `${selectedCategories.length} sel.`}
            </span>
            <ChevronDown className={`w-3 h-3 md:w-4 md:h-4 text-slate-400 transition-transform ${showCatSelector ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {showCatSelector && (
              <>
                <div className="fixed inset-0 z-[100]" onClick={() => setShowCatSelector(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl md:rounded-2xl shadow-2xl z-[101] overflow-hidden min-w-[180px]"
                >
                  <div className="max-h-[200px] overflow-y-auto p-1.5 custom-scrollbar">
                    <button
                      onClick={clearCategories}
                      className={`w-full text-left px-2 py-1.5 rounded-lg text-xs md:text-xs font-black uppercase mb-0.5 transition-colors ${selectedCategories.length === 0 ? 'bg-emerald-600 text-white' : 'hover:bg-slate-50 text-slate-600'}`}
                    >
                      TODAS
                    </button>
                    {['Planta', 'CTA', 'APS', 'Rural', 'Disponibilidad'].map(cat => (
                      <button
                        key={cat}
                        onClick={() => toggleCategory(cat)}
                        className={`w-full text-left px-2 py-1.5 rounded-lg text-xs md:text-xs font-bold uppercase mb-0.5 transition-all flex items-center justify-between ${selectedCategories.includes(cat) ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-slate-50 text-slate-600'}`}
                      >
                        {cat}
                        {selectedCategories.includes(cat) && <CheckCircle className="w-3 h-3 text-emerald-600" />}
                      </button>
                    ))}
                  </div>
                  {selectedCategories.length > 0 && (
                    <div className="p-1.5 border-t border-slate-100 bg-stone-50">
                      <button onClick={clearCategories} className="w-full py-1.5 text-xs font-black text-rose-500 hover:bg-rose-50 rounded-lg">
                        LIMPIAR
                      </button>
                    </div>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Active doctor filter chips */}
      {doctorFilter.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {doctorFilter.map(id => {
            const d = doctors.find(doc => doc.id === id);
            return (
              <div key={id} className="bg-emerald-600 text-white px-2 py-0.5 rounded-lg text-xs flex items-center gap-1 shadow-sm">
                {d?.nombre}
                <button onClick={() => removeDoctorFilter(id)} className="hover:text-rose-200 text-sm leading-none">×</button>
              </div>
            );
          })}
          <button onClick={clearDoctorFilter} className="text-xs text-rose-500 font-bold ml-1 hover:underline">Limpiar</button>
        </div>
      )}

      {/* Action buttons row */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setShowGridHours(!showGridHours)}
          className={`px-2 md:px-3 py-1.5 md:py-2 rounded-lg md:rounded-xl text-xs md:text-xs font-black uppercase border border-slate-200 transition-colors ${showGridHours ? 'bg-sky-100 text-sky-700' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
        >
          {showGridHours ? "SIGLAS" : "HORAS"}
        </button>
        <button onClick={onDownloadTemplate} className="px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-xs font-black bg-blue-50 text-blue-700 border border-blue-100 rounded-lg md:rounded-xl hover:bg-blue-100">PLANTILLA</button>
        <button onClick={onExportExcel} className="px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-xs font-black bg-emerald-50 text-emerald-700 rounded-lg md:rounded-xl hover:bg-emerald-100">EXCEL</button>
        <button onClick={onExportPDF} className="px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-xs font-black bg-rose-50 text-rose-700 rounded-lg md:rounded-xl hover:bg-rose-100">PDF</button>

        {isAdmin && (
          <>
            <label className="cursor-pointer bg-blue-600 text-white px-2 md:px-3 py-1.5 md:py-2 rounded-lg hover:bg-blue-700 transition-all shadow-sm flex items-center gap-1 md:gap-1.5 text-xs md:text-xs font-black uppercase" title="Importar Excel al Turnero">
              <FileSpreadsheet className="w-3.5 h-3.5 md:w-4 md:h-4" />
              IMPORTAR
              <input type="file" accept=".xlsx, .xls" className="hidden" onChange={onImportExcel} />
            </label>
            <button
              onClick={onPublish}
              className="bg-emerald-600 text-white px-3 md:px-4 py-1.5 md:py-2 rounded-lg font-black text-xs md:text-xs uppercase flex items-center gap-1 md:gap-2 hover:scale-105 transition-transform shadow-md shadow-emerald-500/20"
            >
              <CheckCircle className="w-3.5 h-3.5 md:w-4 md:h-4" /> Publicar
            </button>
          </>
        )}

        <div className="ml-auto flex items-center gap-1 px-2 md:px-3 py-1.5 md:py-2 bg-white rounded-lg md:rounded-xl border border-slate-200 text-emerald-600 font-black shadow-sm text-xs md:text-xs" title="Total de horas programadas en el mes para todos los médicos">
          <span className="text-slate-400 hidden sm:inline">TOTAL:</span>
          {globalTotalHours}h
        </div>
      </div>

      {/* Color legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 pt-2 border-t border-slate-100 mt-1">
        <span className="text-xs text-slate-400 font-black uppercase tracking-widest hidden sm:inline">Leyenda columnas semana:</span>
        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
          <span className="w-3.5 h-3.5 rounded bg-emerald-100 border border-emerald-300 shrink-0" />
          Normal (&lt;42h)
        </span>
        <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
          <span className="w-3.5 h-3.5 rounded bg-emerald-500 shrink-0" />
          Límite (≥42h)
        </span>
        <span className="flex items-center gap-1.5 text-xs font-bold text-rose-600">
          <span className="w-3.5 h-3.5 rounded bg-rose-500 shrink-0" />
          Excedida (≥66h)
        </span>
        <span className="flex items-center gap-1.5 text-xs font-bold text-sky-600">
          <span className="w-3.5 h-3.5 rounded bg-sky-500 shrink-0" />
          Total mes OK
        </span>
        <span className="flex items-center gap-1.5 text-xs font-bold text-amber-600">
          <span className="w-3.5 h-3.5 rounded bg-amber-500 shrink-0" />
          Bajo mínimo
        </span>
      </div>
    </div>
  );
}
