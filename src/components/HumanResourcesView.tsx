import React, { useMemo, useState } from 'react';
import { Download, FileText, Upload, Edit, Trash2, Clock, Database, Plus, Check, X, Search, Shield, Filter } from 'lucide-react';
import { Doctor, MonthlyData, VarSlotConfig, SlotType } from '../types';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface Props {
  doctors: Doctor[];
  currentMonthData: MonthlyData;
  variables: VarSlotConfig;
  selectedMonth: number;
  selectedYear: number;
  isAdmin: boolean;
  onUpdateDoctorStatus: (id: number, status: 'activo' | 'inactivo') => void;
  onEditDoctor: (doctor: Doctor) => void;
  onResetPassword: (id: number) => void;
  onAddDoctorClick: () => void;
  onDeleteDoctor?: (id: number) => void;
  onUpdateDoctorPermissions?: (id: number, permissions: string[]) => void;
  onImportDoctors?: (doctors: any[]) => void;
  onAssignFreeDays?: () => void;
  onReorderDoctors?: (sourceId: number, targetId: number) => void;
}

export function HumanResourcesView({ doctors, currentMonthData, variables, selectedMonth, selectedYear, isAdmin, onUpdateDoctorStatus, onEditDoctor, onResetPassword, onAddDoctorClick, onDeleteDoctor, onUpdateDoctorPermissions, onImportDoctors, onAssignFreeDays, onReorderDoctors }: Props) {
  
  const [cedulaSearch, setCedulaSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [editingPermissionsDoc, setEditingPermissionsDoc] = useState<Doctor | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const monthName = new Date(selectedYear, selectedMonth).toLocaleString('es-ES', { month: 'long' });

  const downloadTemplate = () => {
    const templateData = [
      ["ID", "Nombre", "Apellidos", "Cedula", "Registro_Medico", "Email", "Telefono", "Categoria", "Rol", "Estado", "Username", "Password"],
      [1, "Juan", "Perez", "123456", "RM-789", "juan@example.com", "3001234567", "Planta", "Médico General", "activo", "jperez", "pass123"],
      [2, "Ana", "Gomez", "654321", "RM-123", "ana@example.com", "3007654321", "Planta", "Enfermero Jefe", "activo", "agomez", "pass123"],
      [3, "Carlos", "Ruiz", "111111", "RM-111", "carlos@example.com", "3001111111", "Planta", "Auxiliar Enfermería", "activo", "cruiz", "pass123"],
      [4, "Dr", "Lopez", "222222", "RM-222", "drlopez@example.com", "3002222222", "Planta", "Médico Especialista", "activo", "drlopez", "pass123"]
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
        
        if (!data || data.length === 0) {
           alert("Error: El archivo de Talento Humano está vacío o no se pudo leer.");
           return;
        }

        // Map to Doctor fields following the refined standard
        const mappedData = data.map((item: any) => ({
          id: Number(item.ID || item.Id || item.id || Date.now() + Math.random()),
          nombre: (item.Nombre || item.nombre || item['Nombres'] || '').toString(),
          apellidos: (item.Apellidos || item.apellidos || '').toString(),
          cedula: (item.Cedula || item.cedula || item['Cédula'] || '').toString(),
          registroMedico: (item.Registro_Medico || item.registro_medico || item['Registro Médico'] || '').toString(),
          email: (item.Email || item.email || '').toString(),
          telefono: (item.Telefono || item.telefono || item['Teléfono'] || '').toString(),
          cat: (item.Categoria || item.categoria || item['Categoría'] || 'Planta').toString(),
          rol: (item.Rol || item.rol || 'Médico General').toString(),
          st: (item.Estado || item.estado || 'activo').toString(),
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

  // Compute stats
  const docsWithHours = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    return doctors.map(doc => {
      let totalHours = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        (['m', 't', 'n'] as SlotType[]).forEach(slot => {
          const sigla = currentMonthData[doc.id]?.[slot]?.[d] || 'X';
          const h = (() => {
            if (!sigla) return 0;
            const slotVars = variables[slot] || {};
            if (slotVars[sigla] !== undefined) return slotVars[sigla];
            const upperSigla = sigla.toUpperCase();
            const foundKey = Object.keys(slotVars).find(k => k.toUpperCase() === upperSigla);
            if (foundKey) return slotVars[foundKey];
            return 0;
          })();
          totalHours += h;
        });
      }
      return { ...doc, totalHours };
    });
  }, [doctors, currentMonthData, variables, selectedMonth, selectedYear]);

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

    (doc as any).autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 20,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [5, 150, 105], textColor: 255 }, // Emerald 600
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
                  onClick={onAssignFreeDays}
                  className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-4 py-2.5 rounded-xl font-black text-xs uppercase flex items-center gap-2 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                  title="Asignar día libre automático a personal de planta"
                >
                  <Clock className="w-4 h-4" /> Días Libres
                </button>
                <button 
                  onClick={onAddDoctorClick}
                  className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg hover:-translate-y-0.5"
                >
                  <Plus className="w-4 h-4" /> Registrar
                </button>

                <button 
                  onClick={downloadTemplate}
                  className="bg-white text-slate-600 border border-slate-200 px-3 py-2.5 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm"
                  title="Descargar plantilla Excel"
                >
                  <Download className="w-3.5 h-3.5" /> Plantilla
                </button>

                <label className="bg-white text-emerald-700 border border-emerald-200 px-3 py-2.5 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 hover:bg-emerald-50 transition-all shadow-sm cursor-pointer whitespace-nowrap">
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
                <th className="px-6 py-4 text-[10px] uppercase font-black text-slate-500 tracking-wider w-10">#</th>
                <th className="px-6 py-4 text-[10px] uppercase font-black text-slate-500 tracking-wider">Personal / Identificación</th>
                <th className="px-6 py-4 text-[10px] uppercase font-black text-slate-500 tracking-wider">Credenciales</th>
                <th className="px-6 py-4 text-[10px] uppercase font-black text-slate-500 tracking-wider">Cargo & Categoría</th>
                <th className="px-6 py-4 text-[10px] uppercase font-black text-slate-500 tracking-wider">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Horas ({monthName})
                  </div>
                </th>
                <th className="px-6 py-4 text-[10px] uppercase font-black text-slate-500 tracking-wider">Estado</th>
                {isAdmin && <th className="px-6 py-4 text-[10px] uppercase font-black text-slate-500 tracking-wider">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDocs.map((doc, index) => (
                <tr 
                  key={doc.id} 
                  draggable={isAdmin && !cedulaSearch && categoryFilter === 'all'}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', doc.id.toString());
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (!isAdmin || !onReorderDoctors) return;
                    const sourceIdStr = e.dataTransfer.getData('text/plain');
                    if (!sourceIdStr) return;
                    const sourceId = parseInt(sourceIdStr, 10);
                    if (sourceId !== doc.id) {
                      onReorderDoctors(sourceId, doc.id);
                    }
                  }}
                  className={`hover:bg-slate-50 transition-colors ${doc.st !== 'activo' && 'opacity-60 bg-rose-50/30'} cursor-move`}
                >
                  <td className="px-6 py-4 text-[10px] font-black text-slate-300 pointer-events-none">
                    {index + 1}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-800 text-sm">{doc.nombre} {doc.apellidos || ''}</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">CC: {doc.cedula || 'N/R'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-0.5">
                       <div className="text-[10px font-bold text-slate-600">Usuario: <span className="text-emerald-600">{doc.username}</span></div>
                       <div className="text-[10px] text-slate-400">Password: <span className="text-emerald-700 font-bold">{doc.password}</span></div>
                       <div className="text-[9px] text-slate-400 italic truncate max-w-[150px]">{doc.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs font-bold text-emerald-800 block mb-1">{doc.rol || 'Asistencial'}</div>
                    <span className="inline-block text-[9px] uppercase font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                      {doc.cat}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-block bg-slate-800 text-white font-mono text-xs px-2 py-1 rounded-lg font-bold shadow-sm">
                      {doc.totalHours}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 text-[10px] uppercase font-black px-2 py-1 rounded-full border ${
                      doc.st === 'activo' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'
                    }`}>
                      {doc.st === 'activo' ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
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
                          onClick={() => onResetPassword(doc.id)}
                          className="p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600 rounded-lg transition-colors border border-transparent hover:border-amber-200"
                          title="Restablecer contraseña"
                        >
                          <Clock className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => onUpdateDoctorStatus(doc.id, doc.st === 'activo' ? 'inactivo' : 'activo')}
                          className={`p-1.5 rounded-lg transition-colors border border-transparent ${
                            doc.st === 'activo' 
                              ? 'text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200' 
                              : 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200'
                          }`}
                          title={doc.st === 'activo' ? 'Desactivar' : 'Activar'}
                        >
                          {doc.st === 'activo' ? <Trash2 className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                        </button>
                        <button 
                          onClick={() => setEditingPermissionsDoc(doc)}
                          className="p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 rounded-lg transition-colors border border-transparent hover:border-emerald-200"
                          title="Gestionar Permisos"
                        >
                          <Shield className="w-4 h-4" />
                        </button>
                        {onDeleteDoctor && (
                          <button
                            onClick={() => onDeleteDoctor(doc.id)}
                            className="p-1.5 text-slate-400 hover:bg-rose-100 hover:text-rose-700 rounded-lg transition-colors border border-transparent hover:border-rose-300"
                            title="Eliminar médico por completo"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* Modal de Gestión de Permisos */}
      {editingPermissionsDoc && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[300] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl p-8 border border-emerald-100">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <Shield className="w-6 h-6 text-emerald-600" />
                  Configurar Permisos
                </h3>
                <p className="text-sm text-slate-500">{editingPermissionsDoc.nombre} {editingPermissionsDoc.apellidos || ''}</p>
              </div>
              <button 
                onClick={() => setEditingPermissionsDoc(null)}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4 py-4">
              <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-emerald-200 cursor-pointer transition-all group">
                <div className="flex-1">
                  <span className="block font-bold text-slate-700">Llamado a disponibilidad</span>
                  <span className="block text-[10px] text-slate-400 uppercase font-black tracking-wider">Permite reportar actividades de disponibilidad rural</span>
                </div>
                <input 
                  type="checkbox"
                  className="w-6 h-6 accent-emerald-600 rounded-lg cursor-pointer"
                  checked={(editingPermissionsDoc.permissions || []).includes('call_availability')}
                  onChange={(e) => {
                    const current = editingPermissionsDoc.permissions || [];
                    const updated = e.target.checked 
                      ? [...current, 'call_availability']
                      : current.filter(p => p !== 'call_availability');
                    
                    if (onUpdateDoctorPermissions) {
                      onUpdateDoctorPermissions(editingPermissionsDoc.id, updated);
                    }
                    setEditingPermissionsDoc({ ...editingPermissionsDoc, permissions: updated });
                  }}
                />
              </label>

              {/* Espacio para futuros permisos */}
              <div className="p-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 text-center">
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Futuros permisos disponibles próximamente</p>
              </div>
            </div>

            <button 
              onClick={() => setEditingPermissionsDoc(null)}
              className="w-full mt-6 bg-slate-800 text-white font-black py-4 rounded-xl hover:bg-slate-700 transition-all shadow-lg"
            >
              CERRAR GESTIÓN
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
