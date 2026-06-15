import React, { useMemo, useState } from 'react';
import { Download, FileText, Upload, Edit, Trash2, Clock, Database, Plus, Check, X, Search, Shield, Filter, RotateCcw, KeyRound, GripVertical, ListOrdered, Power, Save, Star } from 'lucide-react';
import { Doctor, MonthlyData, VarSlotConfig, SlotType, DoctorRole } from '../types';
import { PERMISSION_LABELS, DEFAULT_ROLE_PERMISSIONS, ALL_PERMISSIONS, MONTH_NAMES } from '../constants';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Componente de input de orden que edita el sortOrder directamente
interface OrderInputProps {
  doc: Doctor & { totalHours?: number };
  orderedDoctors: (Doctor & { totalHours?: number })[];
  onReorder: (newOrder: (Doctor & { totalHours?: number })[]) => void;
}

function OrderInput({ doc, orderedDoctors, onReorder }: OrderInputProps) {
  // Show the actual sortOrder value, or empty if not set
  const sortOrderValue = (doc.sortOrder && doc.sortOrder > 0) ? doc.sortOrder : '';
  const [tempValue, setTempValue] = useState(String(sortOrderValue));

  // Update temp value when doc.sortOrder changes externally
  React.useEffect(() => {
    setTempValue(String((doc.sortOrder && doc.sortOrder > 0) ? doc.sortOrder : ''));
  }, [doc.sortOrder]);

  const applyChange = () => {
    // Handle empty value - don't change anything
    if (!tempValue || tempValue.trim() === '') {
      setTempValue(String(sortOrderValue));
      return;
    }

    const newSortOrder = parseInt(tempValue, 10);
    if (isNaN(newSortOrder) || newSortOrder < 1) {
      setTempValue(String(sortOrderValue)); // Reset on invalid
      return;
    }
    if (newSortOrder === sortOrderValue) return;

    // Check if another doctor already has this sortOrder
    const currentOrderNum = (doc.sortOrder && doc.sortOrder > 0) ? doc.sortOrder : 0;
    const otherDoctorWithSameOrder = orderedDoctors.find(
      d => d.id !== doc.id && d.sortOrder === newSortOrder
    );

    let newOrder = [...orderedDoctors];

    if (otherDoctorWithSameOrder) {
      // Swap: the other doctor gets this doctor's old position
      newOrder = newOrder.map(d => {
        if (d.id === doc.id) {
          return { ...d, sortOrder: newSortOrder };
        }
        if (d.id === otherDoctorWithSameOrder.id) {
          // If current doctor had no order, find next available for the other
          if (currentOrderNum === 0) {
            // Find an available slot
            const usedOrders = new Set(
              newOrder.map(doc => doc.sortOrder).filter((n): n is number => typeof n === 'number' && n > 0 && n !== newSortOrder)
            );
            let nextAvailable = 1;
            while (usedOrders.has(nextAvailable)) nextAvailable++;
            return { ...d, sortOrder: nextAvailable };
          }
          return { ...d, sortOrder: currentOrderNum };
        }
        return d;
      });
    } else {
      // No conflict, just update this doctor
      newOrder = newOrder.map(d =>
        d.id === doc.id ? { ...d, sortOrder: newSortOrder } : d
      );
    }

    // Re-sort the array by the new sortOrder values
    newOrder.sort((a, b) => {
      const aVal = (a.sortOrder && a.sortOrder > 0) ? a.sortOrder : 9999;
      const bVal = (b.sortOrder && b.sortOrder > 0) ? b.sortOrder : 9999;
      return aVal - bVal;
    });

    onReorder(newOrder);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={tempValue}
      onChange={(e) => {
        // Allow only numbers and empty string
        const val = e.target.value.replace(/[^0-9]/g, '');
        setTempValue(val);
      }}
      onBlur={applyChange}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          applyChange();
          (e.target as HTMLInputElement).blur();
        }
        if (e.key === 'Escape') {
          setTempValue(String(sortOrderValue));
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="w-14 h-8 text-center bg-slate-50 border border-slate-200 rounded-lg font-black text-slate-700 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
    />
  );
}

interface Props {
  doctors: Doctor[];
  currentMonthData: MonthlyData;
  variables: VarSlotConfig;
  selectedMonth: number;
  selectedYear: number;
  isAdmin: boolean;
  onUpdateDoctorStatus: (id: number, status: 'activo' | 'inactivo') => void;
  onEditDoctor: (doctor: Doctor) => void;
  onDeleteDoctor?: (id: number) => void;
  onAddDoctorClick: () => void;
  onUpdateDoctorPermissions?: (id: number, permissions: string[]) => void;
  onImportDoctors?: (doctors: any[]) => void;
  onResetPassword?: (doctor: Doctor) => void;
  onSaveDoctorOrder?: (orderedIds: number[]) => Promise<void>;
  evaluations?: Record<string, any>;
  onSaveEvaluation?: (data: any) => Promise<void>;
}

export function HumanResourcesView({ doctors, currentMonthData, variables, selectedMonth, selectedYear, isAdmin, onUpdateDoctorStatus, onEditDoctor, onDeleteDoctor, onAddDoctorClick, onUpdateDoctorPermissions, onImportDoctors, onResetPassword, onSaveDoctorOrder, evaluations, onSaveEvaluation }: Props) {

  const [cedulaSearch, setCedulaSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [editingPermissionsDoc, setEditingPermissionsDoc] = useState<Doctor | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [showReorderPanel, setShowReorderPanel] = useState(false);
  const [orderedDoctors, setOrderedDoctors] = useState<(Doctor & { totalHours?: number })[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);
  const [ratingDoc, setRatingDoc] = useState<(Doctor & { totalHours?: number }) | null>(null);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [isSavingRating, setIsSavingRating] = useState(false);
  const monthName = MONTH_NAMES[selectedMonth];

  const handleSaveRating = async () => {
    if (!ratingDoc || !onSaveEvaluation) return;
    setIsSavingRating(true);
    await onSaveEvaluation({
      doctorId: ratingDoc.id,
      month: selectedMonth,
      year: selectedYear,
      score: ratingScore,
      comment: ratingComment,
      timestamp: Date.now()
    });
    setIsSavingRating(false);
    setRatingDoc(null);
    setRatingScore(5);
    setRatingComment('');
  };

  const downloadTemplate = () => {
    const templateData = [
      ["ID", "Nombre", "Apellidos", "Cedula", "Registro_Medico", "Email", "Telefono", "Categoria", "Rol", "Estado", "Username", "Password"],
      [1, "Juan", "Perez", "123456", "RM-789", "juan@example.com", "3001234567", "Planta", "Médico General", "activo", "jperez", "pass123"]
    ];

    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Talento Humano");
    XLSX.writeFile(wb, "Plantilla_Nomina_Medica.xlsx");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onImportDoctors) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        // Map to Doctor fields following the refined standard
        const mappedData = data.map((item: any) => ({
          id: Number(item.ID || item.Id || item.id || Date.now() + Math.random()),
          nombre: (item.Nombre || item.nombre || item['Nombres'] || '').toString(),
          apellidos: (item.Apellidos || item.apellidos || '').toString(),
          cedula: (item.Cedula || item.cedula || item['Cédula'] || '').toString(),
          registroMedico: (item.Registro_Medico || item.registro_medico || item['Registro Médico'] || '').toString(),
          email: (item.Email || item.email || '').toString(),
          telefono: (item.Telefono || item.telefono || item['Teléfono'] || '').toString(),
          cat: (item.Categoria || item.categoria || item['Categoría'] || 'Planta').toString() as 'Planta' | 'CTA' | 'APS' | 'Rural' | 'Disponibilidad',
          rol: (item.Rol || item.rol || 'Médico General').toString() as DoctorRole,
          st: (item.Estado || item.estado || 'activo').toString() as 'activo' | 'inactivo',
          username: (item.Username || item.username || '').toString(),
          password: (item.Password || item.password || '123456').toString()
        }));

        onImportDoctors(mappedData);
      } catch (err) {
        console.error("Error al importar:", err);
        alert("Error al procesar el archivo. Verifique el formato.");
      } finally {
        setIsImporting(false);
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  // Compute stats and detect duplicate sortOrders for display
  const docsWithHours = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

    // Calculate hours
    const withHours = doctors.map(doc => {
      let totalHours = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        (['m', 't', 'n'] as SlotType[]).forEach(slot => {
          const sigla = currentMonthData[doc.id]?.[slot]?.[d] || 'X';
          const h = variables[slot]?.[sigla] || 0;
          totalHours += h;
        });
      }
      return { ...doc, totalHours };
    });

    // Detect duplicate sortOrders
    const orderCount = new Map<number, number>();
    for (const doc of withHours) {
      if (doc.sortOrder && doc.sortOrder > 0) {
        orderCount.set(doc.sortOrder, (orderCount.get(doc.sortOrder) || 0) + 1);
      }
    }

    // Mark duplicates
    return withHours.map(doc => ({
      ...doc,
      isDuplicateOrder: doc.sortOrder && doc.sortOrder > 0 && (orderCount.get(doc.sortOrder) || 0) > 1
    }));
  }, [doctors, currentMonthData, variables, selectedMonth, selectedYear]);

  const openReorderPanel = () => {
    // Solo médicos activos pueden ser ordenados
    const activeDoctors = docsWithHours.filter(doc => doc.st === 'activo');
    
    // Sanitize: detect and fix duplicates
    const orderCount = new Map<number, typeof docsWithHours>();

    // Group doctors by their sortOrder
    for (const doc of activeDoctors) {
      if (doc.sortOrder && doc.sortOrder > 0) {
        if (!orderCount.has(doc.sortOrder)) {
          orderCount.set(doc.sortOrder, []);
        }
        orderCount.get(doc.sortOrder)!.push(doc);
      }
    }

    const existingOrders = new Set<number>();
    const sanitizedDocs: typeof docsWithHours = [];
    const docsNeedingAssignment: typeof docsWithHours = [];

    for (const doc of activeDoctors) {
      if (!doc.sortOrder || doc.sortOrder <= 0) {
        docsNeedingAssignment.push(doc);
        continue;
      }

      const duplicates = orderCount.get(doc.sortOrder);
      if (duplicates && duplicates.length > 1) {
        // This is a duplicate - only keep the first one with this order
        const isFirst = duplicates[0].id === doc.id;
        if (isFirst) {
          existingOrders.add(doc.sortOrder);
          sanitizedDocs.push(doc);
        } else {
          // Reassign this duplicate later
          docsNeedingAssignment.push(doc);
        }
      } else {
        // No duplicate, keep as-is
        existingOrders.add(doc.sortOrder);
        sanitizedDocs.push(doc);
      }
    }

    // Sort those with valid orders
    sanitizedDocs.sort((a, b) => (a.sortOrder! - b.sortOrder!));

    // Assign orders to those needing reassignment, filling gaps
    let nextAvailable = 1;
    for (const doc of docsNeedingAssignment) {
      while (existingOrders.has(nextAvailable)) {
        nextAvailable++;
      }
      sanitizedDocs.push({ ...doc, sortOrder: nextAvailable });
      existingOrders.add(nextAvailable);
    }

    // Final sort
    sanitizedDocs.sort((a, b) => (a.sortOrder! - b.sortOrder!));

    setOrderedDoctors(sanitizedDocs);
    setShowReorderPanel(true);
  };

  const saveOrder = async () => {
    if (!onSaveDoctorOrder) return;
    setSavingOrder(true);

    // Detect and fix any duplicate sortOrders before saving
    const usedOrders = new Set<number>();
    const finalOrder = orderedDoctors.map((d, idx) => {
      const requestedOrder = d.sortOrder && d.sortOrder > 0 ? d.sortOrder : idx + 1;

      if (usedOrders.has(requestedOrder)) {
        // Find next available
        let nextAvailable = 1;
        while (usedOrders.has(nextAvailable)) nextAvailable++;
        usedOrders.add(nextAvailable);
        return { id: d.id, sortOrder: nextAvailable };
      }

      usedOrders.add(requestedOrder);
      return { id: d.id, sortOrder: requestedOrder };
    });

    await onSaveDoctorOrder(finalOrder.map(d => d.id));
    setSavingOrder(false);
    setShowReorderPanel(false);
  };

  const filteredDocs = useMemo(() => {
    return docsWithHours.filter(d => {
      const matchCedula = !cedulaSearch.trim() || d.cedula?.toString().toLowerCase().includes(cedulaSearch.toLowerCase());
      const matchCategory = categoryFilter === 'all' || d.cat === categoryFilter;
      return matchCedula && matchCategory;
    });
  }, [docsWithHours, cedulaSearch, categoryFilter]);

  const exportExcel = () => {
    const wsData = filteredDocs.map(d => ({
      'ID': d.id,
      'Nombre': d.nombre,
      'Apellidos': d.apellidos || '',
      'Cedula': d.cedula || '',
      'Registro_Medico': d.registroMedico || '',
      'Email': d.email || '',
      'Telefono': d.telefono || '',
      'Categoria': d.cat,
      'Rol': d.rol,
      'Estado': d.st,
      'Username': d.username || '',
      'Password': d.password || '',
      [`Horas Trabajadas (${monthName} ${selectedYear})`]: d.totalHours
    }));

    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Talento Humano");
    XLSX.writeFile(wb, "Nomina_Personal_Actualizada.xlsx");
  };

  const exportPDF = () => {
    const doc = new jsPDF('landscape');
    doc.setFont("helvetica", "bold");
    doc.text(`Base de Datos - Talento Humano (${monthName} ${selectedYear})`, 14, 15);
    
    const tableColumn = ["Nombres y Apellidos", "Cédula", "Reg. Médico", "Contacto", "Rol", "Cat.", "Estado", "Horas (Mes)"];
    const tableRows = filteredDocs.map(d => [
      `${d.nombre} ${d.apellidos || ''}`,
      d.cedula || 'N/A',
      d.registroMedico || 'N/A',
      `${d.email || ''}\n${d.telefono || ''}`,
      d.rol,
      d.cat,
      d.st.toUpperCase(),
      `${d.totalHours}`
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 20,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [5, 150, 105], textColor: 255 },
    });

    doc.save(`Base_Datos_Talento_Humano_${monthName}_${selectedYear}.pdf`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animation-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-emerald-800 tracking-tight flex items-center gap-3">
            <Database className="w-8 h-8" />
            Base de Datos del Talento Humano
          </h2>
          <p className="text-slate-500 mt-1">Gestión integral de personal asistencial y registro de horas.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative group flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Buscar por cédula..."
              value={cedulaSearch}
              onChange={(e) => setCedulaSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
            />
            {cedulaSearch && (
              <button 
                onClick={() => setCedulaSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 hover:bg-slate-100 p-1 rounded-full text-slate-400"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="relative group flex-1 sm:w-48">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
            <select 
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm appearance-none"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">Categoría: TODAS</option>
              <option value="Planta">Categoría: Planta</option>
              <option value="CTA">Categoría: CTA</option>
              <option value="APS">Categoría: APS</option>
              <option value="Rural">Categoría: Rural</option>
              <option value="Disponibilidad">Categoría: Disponibilidad</option>
            </select>
          </div>

          <div className="flex gap-2">
            {isAdmin && (
              <>
                <button 
                  onClick={onAddDoctorClick}
                  className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg hover:-translate-y-0.5"
                >
                  <Plus className="w-4 h-4" /> Registrar
                </button>

                <button 
                  onClick={openReorderPanel}
                  className="bg-sky-600 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase flex items-center gap-2 hover:bg-sky-700 transition-all shadow-lg hover:-translate-y-0.5"
                  title="Cambiar orden de visualización"
                >
                  <ListOrdered className="w-4 h-4" /> Organizar
                </button>

                <button 
                  onClick={downloadTemplate}
                  className="bg-white text-slate-600 border border-slate-200 px-3 py-2.5 rounded-xl font-black text-xs uppercase flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm"
                  title="Descargar plantilla Excel"
                >
                  <Download className="w-3.5 h-3.5" /> Plantilla
                </button>

                <label className="bg-white text-emerald-700 border border-emerald-200 px-3 py-2.5 rounded-xl font-black text-xs uppercase flex items-center gap-2 hover:bg-emerald-50 transition-all shadow-sm cursor-pointer whitespace-nowrap">
                  <Upload className="w-3.5 h-3.5" /> 
                  {isImporting ? 'Cargando...' : 'Importar'}
                  <input 
                    type="file" 
                    className="hidden" 
                    accept=".xlsx, .xls, .csv" 
                    onChange={handleImport} 
                    disabled={isImporting}
                  />
                </label>
              </>
            )}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex overflow-hidden">
              <button 
                onClick={exportExcel}
                className="px-4 py-2.5 flex items-center gap-2 hover:bg-emerald-50 text-emerald-700 font-bold text-xs uppercase border-r border-slate-200 transition-colors"
              >
                <FileText className="w-4 h-4" /> Excel
              </button>
              <button 
                onClick={exportPDF}
                className="px-4 py-2.5 flex items-center gap-2 hover:bg-rose-50 text-rose-700 font-bold text-xs uppercase transition-colors"
              >
                <Download className="w-4 h-4" /> PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-4 text-xs uppercase font-black text-slate-500 tracking-wide w-16">Orden</th>
                <th className="px-6 py-4 text-xs uppercase font-black text-slate-500 tracking-wide">Personal / Identificación</th>
                <th className="px-6 py-4 text-xs uppercase font-black text-slate-500 tracking-wide">Contacto</th>
                <th className="px-6 py-4 text-xs uppercase font-black text-slate-500 tracking-wide">Cargo & Categoría</th>
                <th className="px-6 py-4 text-xs uppercase font-black text-slate-500 tracking-wide">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> Horas ({monthName})
                  </div>
                </th>
                <th className="px-6 py-4 text-xs uppercase font-black text-slate-500 tracking-wide">Estado</th>
                {isAdmin && <th className="px-6 py-4 text-xs uppercase font-black text-slate-500 tracking-wide">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDocs.map((doc, index) => (
                <tr key={doc.id} className={`hover:bg-slate-50 transition-colors ${doc.st !== 'activo' && 'opacity-60 bg-rose-50/30'}`}>
                  <td className="px-4 py-4">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shadow-sm ${
                        doc.isDuplicateOrder
                          ? 'bg-rose-100 text-rose-700 border-2 border-rose-300'
                          : doc.sortOrder && doc.sortOrder > 0
                            ? 'bg-sky-100 text-sky-700'
                            : 'bg-slate-100 text-slate-400'
                      }`}
                      title={doc.isDuplicateOrder ? 'Orden duplicado - use Organizar para corregir' : ''}
                    >
                      {doc.sortOrder && doc.sortOrder > 0 ? doc.sortOrder : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-800 text-base">{doc.nombre} {doc.apellidos || ''}</div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">CC: {doc.cedula || 'N/R'}</div>
                    <div className="text-xs text-slate-400 font-mono">RM/TP: {doc.registroMedico || 'N/R'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-slate-600 max-w-[200px] truncate">{doc.email || 'Sin correo'}</div>
                    <div className="text-sm text-slate-500">{doc.telefono || 'Sin teléfono'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-emerald-800 block mb-1">{doc.rol || 'Asistencial'}</div>
                    <span className="inline-block text-xs uppercase font-black bg-slate-100 text-slate-600 px-2 py-1 rounded-full border border-slate-200">
                      {doc.cat}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-block bg-slate-800 text-white font-mono text-sm px-3 py-1 rounded-lg font-bold shadow-sm">
                      {doc.totalHours}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 text-xs uppercase font-black px-3 py-1.5 rounded-full border ${
                      doc.st === 'activo' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'
                    }`}>
                      {doc.st === 'activo' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                      {doc.st === 'activo' ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => onEditDoctor(doc)}
                          className="p-1.5 text-slate-400 hover:bg-sky-50 hover:text-sky-600 rounded-lg transition-colors border border-transparent hover:border-sky-200"
                          title="Editar/Actualizar datos"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => onUpdateDoctorStatus(doc.id, doc.st === 'activo' ? 'inactivo' : 'activo')}
                          className={`p-1.5 rounded-lg transition-all border border-transparent ${
                            doc.st === 'activo' 
                              ? 'text-slate-400 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200' 
                              : 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200'
                          }`}
                          title={doc.st === 'activo' ? 'Desactivar' : 'Activar'}
                        >
                          {doc.st === 'activo' ? <Power className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                        </button>
                        {onDeleteDoctor && (
                          <button 
                            onClick={() => onDeleteDoctor(doc.id)}
                            className="p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-all border border-transparent hover:border-rose-200"
                            title="Eliminar registro"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <button 
                          onClick={() => setEditingPermissionsDoc(doc)}
                          className="p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 rounded-lg transition-colors border border-transparent hover:border-emerald-200"
                          title="Gestionar Permisos"
                        >
                          <Shield className="w-4 h-4" />
                        </button>
                        {onResetPassword && doc.email && (
                          <button
                            onClick={() => onResetPassword(doc)}
                            className="p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600 rounded-lg transition-colors border border-transparent hover:border-amber-200"
                            title="Enviar enlace de restablecimiento de contraseña"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {filteredDocs.length === 0 && (
            <div className="p-12 text-center">
              <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-500 font-medium">No se encontraron resultados para "{cedulaSearch}"</p>
              <button 
                onClick={() => setCedulaSearch('')}
                className="mt-2 text-emerald-600 text-sm font-bold hover:underline"
              >
                Limpiar búsqueda
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Reordenamiento con Tarjetas */}
      <AnimatePresence>
        {showReorderPanel && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[350] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-4xl rounded-[40px] shadow-2xl border border-emerald-100 flex flex-col max-h-[90vh]"
            >
              <div className="p-8 pb-4 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                    <ListOrdered className="w-7 h-7 text-sky-500" />
                    Organizar Personal
                  </h3>
                  <p className="text-slate-500 font-medium">Arrastra las tarjetas para cambiar el orden de visualización y análisis de desempeño.</p>
                </div>
                <button onClick={() => setShowReorderPanel(false)} className="p-2 bg-slate-100 rounded-full text-slate-400 hover:text-rose-500 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <Reorder.Group 
                  axis="y" 
                  values={orderedDoctors} 
                  onReorder={setOrderedDoctors}
                  className="space-y-3"
                >
                  {orderedDoctors.map((doc) => (
                    <Reorder.Item 
                      key={doc.id} 
                      value={doc}
                      className="bg-white border border-slate-200 p-5 rounded-[24px] flex items-center gap-5 shadow-sm hover:border-emerald-400 transition-all cursor-grab active:cursor-grabbing group select-none"
                    >
                      <div className="p-3 bg-slate-50 rounded-2xl text-slate-300 group-hover:text-emerald-500 group-hover:bg-emerald-50 transition-all">
                        <GripVertical className="w-6 h-6" />
                      </div>
                      <div className="flex-1 flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <div className="font-black text-slate-800 text-lg">{doc.nombre} {doc.apellidos || ''}</div>
                          <div className="flex items-center gap-2">
                             <span className="text-[10px] font-black uppercase bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{doc.rol}</span>
                             <span className="text-[10px] font-black uppercase bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">{doc.cat}</span>
                          </div>
                        </div>
                          <div className="flex items-center gap-4">
                           <div className="flex flex-col items-center">
                              <label className="text-[9px] font-black text-slate-400 uppercase">Orden</label>
                              <OrderInput
                                doc={doc}
                                orderedDoctors={orderedDoctors}
                                onReorder={setOrderedDoctors}
                              />
                           </div>
                           <div className="text-right">
                              <p className="text-[10px] font-black text-slate-400 uppercase leading-none">Carga Horaria</p>
                              <p className="text-xl font-black text-slate-800">{doc.totalHours || 0}h</p>
                           </div>
                           <div className={`w-3 h-3 rounded-full ${doc.st === 'activo' ? 'bg-emerald-500' : 'bg-rose-500'} shadow-sm shadow-black/10`} title={doc.st} />
                        </div>
                      </div>
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              </div>

              <div className="p-8 pt-4 border-t border-slate-100 flex gap-4">
                <button
                  onClick={() => setShowReorderPanel(false)}
                  className="flex-1 bg-slate-100 text-slate-500 font-black py-4 rounded-2xl hover:bg-slate-200 transition-all uppercase text-xs tracking-widest"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveOrder}
                  disabled={savingOrder}
                  className="flex-[2] bg-emerald-600 text-white font-black py-4 rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 uppercase text-xs tracking-widest"
                >
                  {savingOrder ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Guardar Nuevo Orden
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Gestión de Permisos */}
      {editingPermissionsDoc && (() => {
        const roleDefaults = DEFAULT_ROLE_PERMISSIONS[editingPermissionsDoc.rol] || [];
        const currentPerms = editingPermissionsDoc.permissions ?? roleDefaults;

        const togglePerm = (key: string, checked: boolean) => {
          const updated = checked
            ? [...currentPerms.filter(p => p !== key), key]
            : currentPerms.filter(p => p !== key);
          if (onUpdateDoctorPermissions) onUpdateDoctorPermissions(editingPermissionsDoc.id, updated);
          setEditingPermissionsDoc({ ...editingPermissionsDoc, permissions: updated });
        };

        const resetToDefaults = () => {
          if (onUpdateDoctorPermissions) onUpdateDoctorPermissions(editingPermissionsDoc.id, roleDefaults);
          setEditingPermissionsDoc({ ...editingPermissionsDoc, permissions: roleDefaults });
        };

        return (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[300] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl border border-emerald-100 flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="p-6 pb-4 border-b border-slate-100">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                      <Shield className="w-5 h-5 text-emerald-600" />
                      Permisos de Acceso
                    </h3>
                    <p className="text-sm font-bold text-slate-700 mt-0.5">{editingPermissionsDoc.nombre} {editingPermissionsDoc.apellidos || ''}</p>
                    <span className="inline-block text-xs font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full mt-1">
                      {editingPermissionsDoc.rol}
                    </span>
                  </div>
                  <button onClick={() => setEditingPermissionsDoc(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <button
                  onClick={resetToDefaults}
                  className="mt-3 flex items-center gap-2 text-xs font-bold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-xl transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restaurar permisos por defecto del rol
                </button>
              </div>

              {/* Permissions list */}
              <div className="overflow-y-auto p-6 space-y-2">
                {ALL_PERMISSIONS.map(key => {
                  const { label, description, icon } = PERMISSION_LABELS[key];
                  const isDefault = roleDefaults.includes(key);
                  const isChecked = currentPerms.includes(key);
                  return (
                    <label
                      key={key}
                      className={`flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-all ${
                        isChecked ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{icon}</span>
                          <span className="font-bold text-slate-800 text-sm">{label}</span>
                          {isDefault && (
                            <span className="text-xs font-black uppercase bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full">defecto</span>
                          )}
                        </div>
                        <p className="text-sm text-slate-400 mt-0.5 ml-6">{description}</p>
                      </div>
                      <div className="shrink-0 mt-0.5">
                        <div
                          onClick={() => togglePerm(key, !isChecked)}
                          className={`w-11 h-6 rounded-full transition-all cursor-pointer relative ${
                            isChecked ? 'bg-emerald-500' : 'bg-slate-300'
                          }`}
                        >
                          <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                            isChecked ? 'left-5' : 'left-0.5'
                          }`} />
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="p-6 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-400 mb-3 italic text-center">Los cambios se guardan automáticamente en Firestore.</p>
                <button
                  onClick={() => setEditingPermissionsDoc(null)}
                  className="w-full bg-slate-800 text-white font-black py-3.5 rounded-xl hover:bg-slate-700 transition-all"
                >
                  CERRAR
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal de Calificación */}
      <AnimatePresence>
        {ratingDoc && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[400] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-full max-w-md rounded-[32px] shadow-2xl p-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
                  Calificar Desempeño
                </h3>
                <button onClick={() => setRatingDoc(null)} className="text-slate-400 hover:text-rose-500"><X className="w-6 h-6" /></button>
              </div>
              <p className="text-sm text-slate-500 mb-6 font-bold uppercase tracking-tight">Médico: <span className="text-emerald-600">{ratingDoc.nombre}</span> <br/> Período: {monthName} {selectedYear}</p>
              
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-black uppercase text-slate-400 mb-3 block text-center">Puntuación (1 a 5 estrellas)</label>
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button key={star} onClick={() => setRatingScore(star)} className="transition-transform active:scale-90">
                        <Star className={`w-10 h-10 ${star <= ratingScore ? 'text-amber-500 fill-amber-500' : 'text-slate-200'}`} />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-black uppercase text-slate-400 mb-2 block">Observaciones y Retroalimentación</label>
                  <textarea 
                    className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl outline-none focus:border-emerald-500 font-bold text-sm min-h-[120px] resize-none"
                    placeholder="Escriba aquí los puntos destacados o áreas de mejora..."
                    value={ratingComment}
                    onChange={e => setRatingComment(e.target.value)}
                  />
                </div>
                <button 
                  onClick={handleSaveRating}
                  disabled={isSavingRating}
                  className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                >
                  {isSavingRating ? <RotateCcw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  GUARDAR VALORACIÓN
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
