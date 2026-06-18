import React, { useState, useEffect } from 'react';
import { 
  Users, Plus, Search, Filter, ClipboardList, Clock, 
  Trash2, Edit3, CheckCircle2, AlertCircle, Share2, 
  FileSpreadsheet, MessageSquare, ArrowRight, UserPlus,
  RefreshCcw, Cloud, CloudDownload, Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDocs, where, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { GoogleDriveService } from '../services/googleDriveService';
import * as XLSX from 'xlsx';

interface Patient {
  id: string;
  name: string;
  bed: string;
  section: string;
  entryDate: string;
  age: string;
  eps: string;
  diagnoses: string;
  managementPlan: string;
  paraclinicals: string;
  pendientes: string;
  isHighlight: boolean;
  specialty: string;
  updatedAt: number;
  updatedBy?: string;
}

interface Doctor {
  id: number;
  nombre: string;
  contacto?: string;
}

interface Props {
  currentUser: Doctor | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
  doctors: Doctor[];
}

const SECTIONS = [
  "OBSERVACION URGENCIAS",
  "HOSPITALIZACION",
  "URGENCIAS/PARTOS/CIRUGIA"
];

export function CensusView({ currentUser, isAdmin, isAuthenticated, doctors }: Props) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSection, setFilterSection] = useState('all');
  const [isAddingPatient, setIsAddingPatient] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [showDriveFiles, setShowDriveFiles] = useState(false);
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [handoverShift, setHandoverShift] = useState<'m' | 't' | 'n'>('m');
  const [handoverReceiver, setHandoverReceiver] = useState('');
  const [handoverSender, setHandoverSender] = useState('');
  const [driveFiles, setDriveFiles] = useState<{ id: string, name: string, webViewLink: string, createdTime?: string }[]>([]);
  const [driveYear, setDriveYear] = useState(new Date().getFullYear().toString());
  const [driveMonth, setDriveMonth] = useState((new Date().getMonth() + 1).toString().padStart(2, '0'));
  
  const [isImporting, setIsImporting] = useState(false);

  
  // Form State
  const [formData, setFormData] = useState<Partial<Patient>>({
    section: SECTIONS[0],
    isHighlight: false,
    entryDate: new Date().toISOString().split('T')[0],
    specialty: 'MEDICINA INTERNA'
  });

  useEffect(() => {
    if (!isAuthenticated) return;

    const q = query(collection(db, 'census'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Patient[];
      setPatients(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'census');
    });
    return () => unsubscribe();
  }, [isAuthenticated]);

  const [isSyncing, setIsSyncing] = useState(false);

  const fetchDriveFiles = async (year: string, monthPrefix: string) => {
    try {
      setLoading(true);
      const files = await GoogleDriveService.listMonthCensusFiles(year, monthPrefix);
      setDriveFiles(files || []);
      setShowDriveFiles(true);
    } catch (err: any) {
      alert(`Error al obtener archivos de Drive: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleImportDriveSheet = async (fileId: string) => {
    if (!window.confirm("¿Importar pacientes desde este archivo? Sólo se agregarán o actualizarán pacientes (evitando duplicados basados en Cama y Paciente).")) return;
    
    setIsImporting(true);
    try {
      const rows = await GoogleDriveService.getSheetValues(fileId, 'Sheet1!A2:K');
      if (!rows || rows.length === 0) {
        alert("El archivo base está vacío o no tiene el formato correcto.");
        return;
      }
      
      let importedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      for (const row of rows) {
        if (row.length < 2) continue; // Skip empty
        
        const bed = row[0] || '';
        const name = row[1] || '';
        const section = row[2] || '';
        const diagnoses = row[3] || '';
        const managementPlan = row[4] || '';
        const pendientes = row[5] || '';
        const specialty = row[6] || '';
        
        let entrega = '';
        let recibe = '';
        let actualizadoStr = '';
        
        // Handling both old format (9 columns) and new format (10 columns)
        if (row.length >= 10) {
           entrega = row[7] || '';
           recibe = row[8] || '';
           actualizadoStr = row[9] || '';
        } else {
           entrega = row[7] || '';
           actualizadoStr = row[8] || '';
        }
        
        const medico = entrega || recibe || currentUser?.nombre || 'Importación Drive';
        
        // Find existing patient
        const existing = patients.find(p => p.bed === bed && p.name.toLowerCase() === name.toLowerCase());
        
        let sheetDate = 0;
        if (actualizadoStr) {
          const parsedParts = actualizadoStr.split(/[\s,/:-]+/);
          if (parsedParts.length >= 3) sheetDate = Date.parse(actualizadoStr) || Date.now();
        } else {
          sheetDate = Date.now();
        }

        if (existing) {
          // Compare dates
          const localDate = existing.updatedAt || 0;
          if (sheetDate > localDate) {
            // Update existing
            await setDoc(doc(db, 'census', existing.id), {
              ...existing,
              section: section || existing.section,
              diagnoses: diagnoses || existing.diagnoses,
              managementPlan: managementPlan || existing.managementPlan,
              pendientes: pendientes || existing.pendientes,
              specialty: specialty || existing.specialty,
              updatedAt: sheetDate,
              updatedBy: medico
            });
            updatedCount++;
          } else {
             skippedCount++;
          }
        } else {
          // Add new
          await addDoc(collection(db, 'census'), {
            name: name,
            bed: bed,
            section: section || 'PISO B',
            diagnoses: diagnoses || '',
            managementPlan: managementPlan || '',
            pendientes: pendientes || '',
            specialty: specialty || 'MEDICINA INTERNA',
            entryDate: new Date().toISOString().split('T')[0],
            age: '', eps: '', paraclinicals: '',
            updatedAt: sheetDate,
            updatedBy: medico
          });
          importedCount++;
        }
      }
      
      alert(`Importación completada:\n- ${importedCount} nuevos creados\n- ${updatedCount} actualizados\n- ${skippedCount} omitidos (ya estaban actualizados).`);
      setShowDriveFiles(false);
    } catch (err: any) {
      alert(`Error de importación: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleSyncToDrive = async (auto = false) => {
    try {
      if (!auto) setIsSyncing(true);
      const now = new Date();
      const year = now.getFullYear().toString();
      const monthPrefix = (now.getMonth() + 1).toString().padStart(2, '0');
      const monthName = new Intl.DateTimeFormat('es', { month: 'long' }).format(now);
      const month = `${monthPrefix} - ${monthName.toUpperCase()}`; // e.g. "06 - JUNIO"
      const dayStr = now.getDate().toString().padStart(2, '0');
      
      const hour = now.getHours();
      let jornadaStr = "Mañana";
      if (hour >= 13 && hour < 19) jornadaStr = "Tarde";
      else if (hour >= 19 || hour < 7) jornadaStr = "Noche";
      
      const folderId = await GoogleDriveService.getOrCreateDayJornadaFolder(year, month, dayStr, jornadaStr);
      
      const dateStr = now.toLocaleDateString().replace(/\//g, '-');
      const timeStr = `${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}`;
      
      const fileName = auto 
        ? `Censo_${year}_${monthPrefix}_${dayStr}_${timeStr.replace('-', '')}.xlsx`
        : `CENSO_MANUAL_${filterSection === 'all' ? 'TOTAL' : filterSection.replace(/\//g, '-')}_${dateStr}_${timeStr}.xlsx`;

      const spreadsheetId = await GoogleDriveService.findOrCreateSheet(fileName, folderId);
      
      // Fetch fresh data from DB to avoid stale state issues (because onSnapshot is async)
      const q = query(collection(db, 'census'));
      const snapshot = await getDocs(q);
      const freshPatients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Patient[];

      const values = [
        ['CAMA', 'PACIENTE', 'SECCION', 'DIAGNOSTICOS', 'MANEJO', 'PENDIENTES', 'ESPECIALIDAD', 'MEDICO', 'ACTUALIZADO'],
        ...freshPatients.map(p => [
          p.bed, p.name, p.section, p.diagnoses, p.managementPlan, p.pendientes, p.specialty, p.updatedBy || '', new Date(p.updatedAt || Date.now()).toISOString()
        ])
      ];
      
      await GoogleDriveService.updateSheetValues(spreadsheetId, 'Sheet1!A1', values);
      if (!auto) alert(`Sincronización exitosa con Drive: ${fileName}`);
    } catch (err: any) {
      if (!auto) alert(`Error de sincronización: ${err.message}`);
      else console.error("Auto Sync Error:", err);
    } finally {
      if (!auto) setIsSyncing(false);
    }
  };

  const handleImportFromDrive = async () => {
    try {
      setIsSyncing(true);
      const now = new Date();
      const year = now.getFullYear().toString();
      const monthPrefix = (now.getMonth() + 1).toString().padStart(2, '0');
      const monthName = new Intl.DateTimeFormat('es', { month: 'long' }).format(now);
      const month = `${monthPrefix} - ${monthName.toUpperCase()}`; // e.g. "06 - JUNIO"
      
      const monthFolderId = await GoogleDriveService.getOrCreateMonthFolder(year, month);
      
      const dateStr = now.toLocaleDateString().replace(/\//g, '-');
      // For import, we'll try to guess the last one, but it's hard if there are multiple.
      // Usually import should maybe pick the newest, but let's just use a generic name or prompt.
      // Easiest is to prompt the user for the exact file name.
      const searchUrlFile = prompt("Ingrese el nombre exacto del archivo a importar (ej. CENSO_TOTAL_08-06-2026_14-30):");
      if (!searchUrlFile) return;

      const spreadsheetId = await GoogleDriveService.findOrCreateSheet(searchUrlFile, monthFolderId); // Find existing
      const values = await GoogleDriveService.getSheetValues(spreadsheetId, 'Sheet1!A2:H100');
      
      if (values.length === 0) {
        alert("No se encontraron datos en el archivo de Drive.");
        return;
      }

      const confirmImport = window.confirm(`Se importarán ${values.length} registros desde Drive. ¿Continuar?`);
      if (!confirmImport) return;

      // Logic to update Firestore
      for (const row of values) {
        if (!row[0] || !row[1]) continue; // Skip empty rows
        
        const existingPatient = patients.find(p => p.bed === row[0] && p.name === row[1]);
        const patientData = {
          bed: row[0],
          name: row[1],
          section: row[2] || 'HOSPITALIZACION',
          diagnoses: row[3] || '',
          managementPlan: row[4] || '',
          pendientes: row[5] || '',
          specialty: row[6] || 'GENERAL',
          updatedBy: row[7] || 'Importado de Drive',
          updatedAt: serverTimestamp()
        };

        if (existingPatient) {
          await updateDoc(doc(db, 'census', existingPatient.id), patientData);
        } else {
          await setDoc(doc(collection(db, 'census')), {
            ...patientData,
            createdAt: serverTimestamp()
          });
        }
      }
      alert("Importación completada con éxito.");
    } catch (err: any) {
      alert(`Error al importar de Drive: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSavePatient = async () => {
    if (!formData.name || !formData.bed) return;

    try {
      const data = {
        ...formData,
        updatedAt: Date.now(),
        updatedBy: currentUser?.nombre || 'SISTEMA'
      };
      
      if (editingPatient) {
        await updateDoc(doc(db, 'census', editingPatient.id), data);
      } else {
        await addDoc(collection(db, 'census'), data);
      }
      setIsAddingPatient(false);
      setEditingPatient(null);
      setFormData({ 
        section: SECTIONS[0], 
        isHighlight: false, 
        entryDate: new Date().toISOString().split('T')[0],
        specialty: 'MEDICINA INTERNA'
      });
      
      // Auto sync to Drive in background
      handleSyncToDrive(true);
    } catch (error) {
      console.error("Error saving patient:", error);
    }
  };

  const handleDeletePatient = async (id: string) => {
    if (window.confirm("¿Confirmar salida del paciente? Esto lo eliminará del censo activo.")) {
      await deleteDoc(doc(db, 'census', id));
      // Auto sync to Drive in background
      handleSyncToDrive(true);
    }
  };

  const executeHandover = async () => {
    if (!handoverReceiver.trim() || !handoverSender.trim()) {
      alert("Para cerrar la entrega de turno debe indicar quién entrega y quién recibe.");
      return;
    }

    try {
      const now = new Date();
      const year = now.getFullYear().toString();
      const monthPrefix = (now.getMonth() + 1).toString().padStart(2, '0');
      const monthName = new Intl.DateTimeFormat('es', { month: 'long' }).format(now);
      const month = `${monthPrefix} - ${monthName.toUpperCase()}`; // e.g. "06 - JUNIO"
      const day = now.getDate().toString().padStart(2, '0');
      const jornadaStr = handoverShift === 'm' ? 'Mañana' : handoverShift === 't' ? 'Tarde' : 'Noche';
      
      const driveFileName = `ENTREGA_${filterSection === 'all' ? 'TOTAL' : filterSection.replace(/\//g, '-')}_${jornadaStr}_${day}-${monthPrefix}-${year}`;
      const timeStr = `${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}`;
      const fileName = `${driveFileName}_${timeStr}.xlsx`;
      
      let driveLink = '';
      try {
        setIsSyncing(true);
        // Sync to Drive
        const folderId = await GoogleDriveService.getOrCreateDayJornadaFolder(year, month, day, jornadaStr);
        const spreadsheetId = await GoogleDriveService.findOrCreateSheet(fileName, folderId);
        
        const values = [
          ['CAMA', 'PACIENTE', 'SECCION', 'DIAGNOSTICOS', 'MANEJO', 'PENDIENTES', 'ESPECIALIDAD', 'ENTREGA', 'RECIBE', 'ACTUALIZADO'],
          ...filteredPatients.map(p => [
            p.bed, p.name, p.section, p.diagnoses, p.managementPlan, p.pendientes, p.specialty, handoverSender || 'N/A', handoverReceiver, new Date(p.updatedAt || Date.now()).toISOString()
          ])
        ];
        await GoogleDriveService.updateSheetValues(spreadsheetId, 'Sheet1!A1', values);
        driveLink = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
      } catch (err: any) {
        console.error("No se pudo sincronizar a Drive:", err);
      } finally {
        setIsSyncing(false);
      }

      // Format WhatsApp Summary optimized for mobile
      const summary = filteredPatients.map(p => 
        `🛏️ *Cama ${p.bed}*: ${p.name}\n📋 *IDX*: ${p.diagnoses.substring(0, 60)}...\n⚠️ *PDTE*: ${p.pendientes || 'Ninguno'}\n`
      ).join('\n');
      
      const message = `🚨 *HDSA: ENTREGA DE TURNO [${jornadaStr.toUpperCase()}]*\n👨‍⚕️ *Entrega:* ${handoverSender}\n👩‍⚕️ *Recibe:* ${handoverReceiver}\n🕒 *Hora:* ${now.toLocaleTimeString()}\n🏥 *Componente:* ${filterSection === 'all' ? 'CENSO TOTAL' : filterSection}\n👥 *Pacientes:* ${filteredPatients.length}\n\n*RESUMEN:*\n${summary}\n${driveLink ? `*🔗 Enlace Drive:* \n${driveLink}\n\n` : ''}_Reporte generado desde App Talento Humano_`;
      
      // Save Handover record to Firestore 
      await addDoc(collection(db, 'census_handovers'), {
         timestamp: Date.now(),
         year: now.getFullYear(),
         month: now.getMonth() + 1,
         shift: handoverShift,
         jornadaStr,
         deliveredBy: handoverSender || 'Desconocido',
         receivedBy: handoverReceiver,
         section: filterSection,
         patientCount: filteredPatients.length,
         driveLink: driveLink || null
      });

      const encodedMsg = encodeURIComponent(message);
      window.open(`https://wa.me/573173683886?text=${encodedMsg}`, '_blank');
      
      // Trigger Excel download with formal headers as backup
      exportToExcel(fileName);
      
      setShowHandoverModal(false);
      setHandoverReceiver('');
      setHandoverSender('');
      
      alert(`Entrega finalizada.\n1. Firma Digital Registrada y guardada en base de datos: Entrega ${handoverSender}, Recibe ${handoverReceiver}\n2. Se preparó el resumen de WhatsApp.\n3. Se generó archivo local y enlace a Drive.`);
    } catch (error) {
      console.error("Error finishing handover:", error);
      alert("Error al finalizar entrega");
    }
  };

  const exportToExcel = (customName?: string) => {
    const data = filteredPatients.map(p => ({
      CAMA: p.bed,
      FECHA_ING: p.entryDate,
      PACIENTE: `${p.name} (${p.age}) - ${p.eps}`,
      DIAGNOSTICO: p.diagnoses,
      MANEJO: p.managementPlan,
      PARACLINICOS: p.paraclinicals,
      PENDIENTE: p.pendientes,
      ESPECIALIDAD: p.specialty
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Censo Diario");
    
    const name = customName || `Censo_HDSA_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, name);
  };

  const filteredPatients = patients
    .filter(p => filterSection === 'all' || p.section === filterSection)
    .filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.bed.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.diagnoses.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => a.bed.localeCompare(b.bed, undefined, {numeric: true}));

  return (
    <div className="flex flex-col h-full bg-slate-100">
      {/* Dynamic Header */}
      <div className="bg-emerald-800 text-white p-4 md:p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 -rotate-12 translate-x-20 -translate-y-20 rounded-full" />
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-black flex items-center gap-3 tracking-tighter">
              <ClipboardList className="w-8 h-8 text-emerald-300" /> ENTREGA DE TURNOS
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="bg-emerald-600 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border border-white/20">Sync Real-Time</span>
              <p className="text-[10px] text-emerald-100 font-bold uppercase">{patients.length} Pacientes en Censo</p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <button 
              onClick={() => {
                setShowDriveFiles(true);
                fetchDriveFiles(driveYear, driveMonth);
              }}
              className="flex-1 md:flex-none bg-slate-100 text-amber-600 border border-amber-200 px-4 py-2.5 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-amber-50 transition-all shadow-sm"
              title="Buscar e importar archivos en Drive"
            >
              <FileSpreadsheet className="w-4 h-4" /> Drive Censos
            </button>
            <button 
              onClick={() => setIsAddingPatient(true)}
              className="flex-1 md:flex-none bg-emerald-400 text-emerald-950 px-4 py-2.5 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-white transition-all shadow-lg active:scale-95"
            >
              <Plus className="w-4 h-4" /> Ingresar Paciente
            </button>
            <button 
              onClick={() => handleSyncToDrive(false)}
              disabled={isSyncing}
              className={`flex-1 md:flex-none bg-slate-800 text-white px-4 py-2.5 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-slate-700 transition-all shadow-lg ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Guardar censo actual en Google Sheets"
            >
              {isSyncing ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4 text-emerald-400" />} Sync Drive
            </button>
            <button 
              onClick={handleImportFromDrive}
              disabled={isSyncing}
              className={`flex-1 md:flex-none bg-slate-800 text-white px-4 py-2.5 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-slate-700 transition-all shadow-lg ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Cargar datos desde Google Sheets hacia la aplicación"
            >
              {isSyncing ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4 text-sky-400" />} Import Drive
            </button>
            <button 
              onClick={() => {
                setHandoverSender(currentUser?.nombre || '');
                setShowHandoverModal(true);
              }}
              className="flex-1 md:flex-none bg-sky-500 text-white px-4 py-2.5 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-sky-400 transition-all shadow-lg"
            >
              <Share2 className="w-4 h-4" /> Entregar Turno
            </button>
            <button 
              onClick={() => setViewMode(viewMode === 'grid' ? 'table' : 'grid')}
              className="bg-white/10 text-white p-2.5 rounded-2xl hover:bg-white/20 transition-all border border-white/20"
              title="Cambiar vista"
            >
              {viewMode === 'grid' ? <ClipboardList className="w-5 h-5" /> : <Users className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="mt-6 flex flex-col md:flex-row gap-3 relative z-10">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-300" />
            <input 
              type="text" 
              placeholder="Buscar cama, nombre o diagnóstico..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-emerald-900/50 border border-emerald-700/50 p-4 pl-12 rounded-2xl text-white font-bold text-sm outline-none focus:bg-emerald-900 focus:border-emerald-400 transition-all"
            />
          </div>
          <select 
            value={filterSection}
            onChange={(e) => setFilterSection(e.target.value)}
            className="bg-emerald-900/50 border border-emerald-700/50 p-4 rounded-2xl text-emerald-100 font-black text-[10px] uppercase outline-none focus:border-emerald-400 transition-all"
          >
            <option value="all">TODO EL CENSO</option>
            {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50">
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence>
              {filteredPatients.map(patient => (
                <motion.div 
                  key={patient.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={`group bg-white rounded-3xl p-5 shadow-sm border-2 transition-all hover:shadow-xl hover:-translate-y-1 ${patient.isHighlight ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-400/20 shadow-amber-900/5' : 'border-white hover:border-emerald-100'}`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner ${patient.isHighlight ? 'bg-amber-400 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                        {patient.bed}
                      </div>
                      <div>
                        <h4 className="font-black text-slate-800 text-base leading-none mb-1">{patient.name}</h4>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">{patient.eps}</span>
                          <span className="text-[9px] font-mono text-slate-400">{patient.age} • Ingreso: {patient.entryDate}</span>
                        </div>
                      </div>
                    </div>
                    {patient.isHighlight && (
                      <div className="bg-amber-500 text-white p-1.5 rounded-xl shadow-lg ring-4 ring-amber-100 animate-pulse">
                        <AlertCircle className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100 group-hover:bg-white transition-colors">
                      <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 flex justify-between">
                        <span>Diagnóstico & Especialidad</span>
                        <span className="text-emerald-600">{patient.specialty}</span>
                      </div>
                      <p className="text-slate-700 font-bold text-xs leading-relaxed">{patient.diagnoses}</p>
                    </div>

                    <div className="p-3 rounded-2xl border bg-emerald-50/40 border-emerald-100/50">
                      <div className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-1">Plan de Manejo</div>
                      <p className="text-slate-700 text-[11px] italic whitespace-pre-wrap">{patient.managementPlan}</p>
                    </div>

                    {patient.paraclinicals && (
                      <div className="p-3 rounded-2xl border bg-blue-50/40 border-blue-100">
                        <div className="text-[8px] font-black text-blue-600 uppercase tracking-widest mb-1">Resultados / Paraclínicos</div>
                        <p className="text-blue-900 text-[11px] font-medium leading-tight">{patient.paraclinicals}</p>
                      </div>
                    )}

                    {patient.pendientes && (
                      <div className={`p-3 rounded-2xl border ${patient.isHighlight ? 'bg-amber-100 border-amber-300' : 'bg-slate-100 border-slate-200'}`}>
                        <div className={`text-[8px] font-black uppercase tracking-widest mb-1 ${patient.isHighlight ? 'text-amber-700' : 'text-slate-500'}`}>Pendientes Críticos</div>
                        <p className={`text-xs font-black ${patient.isHighlight ? 'text-amber-900 underline' : 'text-slate-700'}`}>{patient.pendientes}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center mt-5 pt-4 border-t border-slate-100">
                    <div className="flex flex-col">
                       <span className="text-[7px] text-slate-300 uppercase font-black">Actualizado por</span>
                       <span className="text-[9px] text-slate-500 font-bold truncate max-w-[120px]">{patient.updatedBy || 'SISTEMA'}</span>
                    </div>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => { setEditingPatient(patient); setFormData(patient); setIsAddingPatient(true); }}
                        className="p-3 bg-slate-100 text-slate-500 hover:bg-emerald-600 hover:text-white rounded-2xl transition-all active:scale-90"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeletePatient(patient.id)}
                        className="p-3 bg-slate-100 text-slate-500 hover:bg-rose-600 hover:text-white rounded-2xl transition-all active:scale-90"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          /* Table View optimized for high-density census */
          <div className="bg-white rounded-[32px] shadow-xl overflow-hidden border border-slate-200">
            <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
              <table className="w-full text-left border-collapse table-auto min-w-[1200px]">
                <thead>
                  <tr className="bg-slate-800 text-white uppercase text-[8px] font-black tracking-widest sticky top-0 z-20">
                    <th className="px-4 py-4 w-16">Cama</th>
                    <th className="px-4 py-4 w-24">Fecha</th>
                    <th className="px-4 py-4 w-48">Paciente / Edad / EPS</th>
                    <th className="px-4 py-4 truncate max-w-xs">Diagnóstico</th>
                    <th className="px-4 py-4 truncate max-w-xs">Manejo</th>
                    <th className="px-4 py-4 truncate max-w-xs">Paraclínicos</th>
                    <th className="px-4 py-4 truncate max-w-xs">Pendientes</th>
                    <th className="px-4 py-4 w-32 text-center">Especialidad</th>
                    <th className="px-4 py-4 w-24 sticky right-0 bg-slate-800 shadow-l shadow-slate-800">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPatients.map(p => (
                    <tr key={p.id} className={`group hover:bg-emerald-50/50 transition-colors ${p.isHighlight ? 'bg-amber-100/50' : ''}`}>
                      <td className="px-4 py-3 font-black text-emerald-700 text-center bg-slate-50/50 group-hover:bg-emerald-100/50">{p.bed}</td>
                      <td className="px-4 py-3 text-[10px] font-mono whitespace-nowrap">{p.entryDate}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-xs text-slate-800 leading-tight mb-1">{p.name}</div>
                        <div className="text-[10px] text-slate-500">{p.age} • {p.eps}</div>
                      </td>
                      <td className="px-4 py-3 text-[10px] text-slate-600 leading-relaxed font-semibold max-w-xs">{p.diagnoses}</td>
                      <td className="px-4 py-3 text-[10px] text-slate-600 line-clamp-3 italic whitespace-pre-wrap">{p.managementPlan}</td>
                      <td className="px-4 py-3 text-[10px] text-blue-800 font-medium max-w-xs">{p.paraclinicals}</td>
                      <td className={`px-4 py-3 text-[10px] font-black max-w-xs ${p.isHighlight ? 'text-rose-600' : 'text-slate-500'}`}>{p.pendientes}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-[8px] bg-slate-100 p-1.5 rounded-lg group-hover:bg-white">{p.specialty || 'General'}</span>
                      </td>
                      <td className="px-4 py-3 sticky right-0 bg-white/90 group-hover:bg-emerald-50/90 shadow-l text-center">
                         <div className="flex justify-center gap-1">
                            <button onClick={() => { setEditingPatient(p); setFormData(p); setIsAddingPatient(true); }} className="p-1.5 text-slate-400 hover:text-emerald-600"><Edit3 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDeletePatient(p.id)} className="p-1.5 text-slate-400 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
                         </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal - Large Overlay Form */}
      {isAddingPatient && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-2xl rounded-[40px] overflow-hidden shadow-2xl ring-1 ring-white/20"
          >
            <div className="bg-emerald-600 p-8 text-white relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 -rotate-45 translate-x-10 -translate-y-10 rounded-full" />
              <div className="relative z-10 flex justify-between items-center text-center w-full">
                <div className="flex-1">
                   <h3 className="text-3xl font-black uppercase tracking-tight leading-none mb-1">
                     {editingPatient ? 'Actualizar Ronda' : 'Nuevo Ingreso'}
                   </h3>
                   <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest">Hospitalización & Urgencias</p>
                </div>
                <button onClick={() => { setIsAddingPatient(false); setEditingPatient(null); }} className="bg-emerald-800/50 p-2 rounded-xl border border-white/20 hover:bg-emerald-900 transition-all">✕</button>
              </div>
            </div>
            
            <div className="p-8 space-y-6 max-h-[65vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="col-span-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-3 mb-1 block">Número de Cama</label>
                  <input 
                    className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-black text-emerald-600 text-xl outline-none focus:border-emerald-500 focus:bg-white text-center transition-all"
                    value={formData.bed || ''}
                    onChange={(e) => setFormData({...formData, bed: e.target.value.toUpperCase()})}
                    placeholder="201"
                  />
                </div>
                <div className="col-span-1 md:col-span-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-3 mb-1 block">Componente / Sección</label>
                  <select 
                    className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-black text-slate-700 outline-none focus:border-emerald-500 focus:bg-white transition-all"
                    value={formData.section}
                    onChange={(e) => setFormData({...formData, section: e.target.value})}
                  >
                    {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-3 mb-1 block">Nombre Completo del Paciente</label>
                <input 
                  className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-black text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-all uppercase"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({...formData, name: e.target.value.toUpperCase()})}
                  placeholder="GARCIA LOPEZ JUAN"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-3 mb-1 block">Edad & Sexo</label>
                  <input className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-bold" value={formData.age || ''} onChange={(e) => setFormData({...formData, age: e.target.value})} placeholder="75 Años" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-3 mb-1 block">Aseguradora (EPS)</label>
                  <input className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-bold" value={formData.eps || ''} onChange={(e) => setFormData({...formData, eps: e.target.value})} placeholder="Nueva EPS" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-3 mb-1 block">Especialidad</label>
                  <input className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-bold" value={formData.specialty || ''} onChange={(e) => setFormData({...formData, specialty: e.target.value.toUpperCase()})} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-3 mb-1 block">Diagnósticos Principales</label>
                    <textarea className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl h-24 outline-none focus:border-emerald-500 font-medium text-sm transition-all" value={formData.diagnoses || ''} onChange={(e) => setFormData({...formData, diagnoses: e.target.value.toUpperCase()})} />
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-3 mb-1 block">Plan de Manejo Farmacológico / QX</label>
                    <textarea className="w-full bg-slate-100 border-2 border-slate-100 p-4 rounded-2xl h-24 outline-none focus:border-emerald-500 font-medium text-sm transition-all italic" value={formData.managementPlan || ''} onChange={(e) => setFormData({...formData, managementPlan: e.target.value})} />
                 </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-3 mb-1 block">Resultados Paraclínicos (Clave)</label>
                <textarea className="w-full bg-blue-50 border-2 border-blue-100 p-4 rounded-2xl h-20 outline-none focus:border-blue-500 font-medium text-sm transition-all" value={formData.paraclinicals || ''} onChange={(e) => setFormData({...formData, paraclinicals: e.target.value})} placeholder="Plaquetas: 50.000, Creatinina: 1.2..." />
              </div>

              <div>
                <label className="text-[10px] font-black text-amber-600 uppercase ml-3 mb-1 block">Pendientes / Alertas de Seguridad</label>
                <textarea className="w-full bg-amber-50 border-2 border-amber-100 p-4 rounded-2xl h-24 outline-none focus:border-amber-400 font-black text-xs transition-all placeholder:text-amber-300" value={formData.pendientes || ''} onChange={(e) => setFormData({...formData, pendientes: e.target.value})} placeholder="REQUERIMIENTO DE TRANSFUSIÓN, PDTE VALORACIÓN ORTOPEDIA..." />
              </div>

              <div className="flex items-center gap-4 bg-emerald-50 p-6 rounded-3xl border-2 border-emerald-100 shadow-inner group">
                <input 
                  type="checkbox" 
                  id="highlight" 
                  checked={formData.isHighlight}
                  onChange={(e) => setFormData({...formData, isHighlight: e.target.checked})}
                  className="w-8 h-8 accent-emerald-600 cursor-pointer"
                />
                <label htmlFor="highlight" className="text-xs font-black text-emerald-950 uppercase cursor-pointer select-none">
                  Resaltar en Amarillo (Prioridad Clínica)
                  <p className="text-[9px] font-bold text-emerald-600/60 leading-none mt-0.5 tracking-tighter">EL PACIENTE SERÁ DESTACADO EN EL CENSO Y LOS REPORTES</p>
                </label>
              </div>
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-200 flex gap-4">
              <button 
                onClick={handleSavePatient}
                className="flex-[2] bg-emerald-700 text-white p-5 rounded-3xl font-black uppercase text-xs hover:bg-emerald-600 active:scale-95 transition-all shadow-xl shadow-emerald-700/20"
              >
                {editingPatient ? 'Guardar Cambios' : 'Registrar Ingreso'}
              </button>
              <button 
                onClick={() => { setIsAddingPatient(false); setEditingPatient(null); }}
                className="flex-1 bg-white text-slate-400 p-5 rounded-3xl font-black uppercase text-xs border-2 border-slate-100 hover:bg-slate-200 hover:text-slate-600 transition-all"
              >
                Descartar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Handover Modal */}
      {showHandoverModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-lg rounded-[40px] overflow-hidden shadow-2xl ring-1 ring-white/20"
          >
            <div className="bg-sky-600 p-8 text-white relative">
              <div className="relative z-10 flex justify-between items-center text-center w-full">
                <div className="flex-1 text-left">
                   <h3 className="text-2xl font-black uppercase tracking-tight leading-none mb-1 flex items-center gap-3">
                     <Share2 className="w-6 h-6" /> Entrega de Turno
                   </h3>
                   <p className="text-sky-100 text-xs font-bold uppercase tracking-widest">Firma Digital</p>
                </div>
                <button onClick={() => setShowHandoverModal(false)} className="bg-sky-800/50 p-2 rounded-xl border border-white/20 hover:bg-sky-900 transition-all">✕</button>
              </div>
            </div>
            
            <div className="p-8 bg-slate-50 space-y-6">
               <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-2 block">Médico que Entrega</label>
                    <input 
                      type="text" 
                      list="doctors-list"
                      placeholder="Quien entrega..." 
                      className="w-full bg-slate-100 border border-slate-200 focus:border-slate-400 p-4 rounded-2xl font-black text-slate-800 outline-none transition-all placeholder:font-medium placeholder:text-slate-400"
                      value={handoverSender}
                      onChange={e => setHandoverSender(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-sky-500 uppercase tracking-widest ml-2 mb-2 block">Médico que Recibe (Firma)</label>
                    <input 
                      type="text" 
                      list="doctors-list"
                      placeholder="Nombre del médico..." 
                      className="w-full bg-white border-2 border-sky-100 focus:border-sky-500 p-4 rounded-2xl font-black text-slate-800 outline-none transition-all placeholder:font-medium placeholder:text-slate-300"
                      value={handoverReceiver}
                      onChange={e => setHandoverReceiver(e.target.value)}
                    />
                    <datalist id="doctors-list">
                      {doctors?.map(d => (
                        <option key={d.id} value={d.nombre} />
                      ))}
                    </datalist>
                  </div>
               </div>

               <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-4 block">Jornada de Entrega</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => setHandoverShift('m')} className={`p-4 rounded-2xl font-black text-xs uppercase transition-all ${handoverShift === 'm' ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>Mañana</button>
                    <button onClick={() => setHandoverShift('t')} className={`p-4 rounded-2xl font-black text-xs uppercase transition-all ${handoverShift === 't' ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>Tarde</button>
                    <button onClick={() => setHandoverShift('n')} className={`p-4 rounded-2xl font-black text-xs uppercase transition-all ${handoverShift === 'n' ? 'bg-slate-800 text-white shadow-md shadow-slate-800/20' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>Noche</button>
                  </div>
               </div>
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-200 flex gap-4">
              <button 
                onClick={executeHandover}
                disabled={!handoverReceiver.trim() || !handoverSender.trim()}
                className="flex-[2] bg-sky-600 text-white p-5 rounded-3xl font-black uppercase text-xs hover:bg-sky-500 active:scale-95 transition-all shadow-xl shadow-sky-600/20 disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {isSyncing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Send className="w-4 h-4" />}
                Confirmar y Entregar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Drive Modal */}
      {showDriveFiles && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-lg rounded-[40px] overflow-hidden shadow-2xl ring-1 ring-white/20"
          >
            <div className="bg-amber-600 p-8 text-white relative">
              <div className="relative z-10 flex justify-between items-center text-center w-full">
                <div className="flex-1 text-left">
                   <h3 className="text-2xl font-black uppercase tracking-tight leading-none mb-1 flex items-center gap-3">
                     <FileSpreadsheet className="w-6 h-6" /> Archivos de Drive
                   </h3>
                   <p className="text-amber-100 text-xs font-bold uppercase tracking-widest">Entregas y Censos Recientes</p>
                </div>
                <button onClick={() => setShowDriveFiles(false)} className="bg-amber-800/50 p-2 rounded-xl border border-white/20 hover:bg-amber-900 transition-all">✕</button>
              </div>
            </div>
            
            <div className="p-8 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar bg-slate-50">
              <div className="flex gap-2 max-w-full">
                <select 
                  className="bg-white border-2 border-slate-200 text-slate-800 p-3 rounded-2xl font-bold flex-1"
                  value={driveYear}
                  onChange={(e) => {
                    setDriveYear(e.target.value);
                    fetchDriveFiles(e.target.value, driveMonth);
                  }}
                >
                  <option value="2024">2024</option>
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                </select>
                <select 
                  className="bg-white border-2 border-slate-200 text-slate-800 p-3 rounded-2xl font-bold flex-1"
                  value={driveMonth}
                  onChange={(e) => {
                    setDriveMonth(e.target.value);
                    fetchDriveFiles(driveYear, e.target.value);
                  }}
                >
                  {["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map((m, i) => (
                    <option key={m} value={m}>{['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][i]}</option>
                  ))}
                </select>
              </div>

              {loading ? (
                <div className="text-center py-10 flex flex-col justify-center items-center gap-4">
                  <div className="w-8 h-8 rounded-full border-4 border-amber-200 border-t-amber-600 animate-spin"></div>
                  <p className="text-slate-400 font-bold uppercase text-xs animate-pulse">Buscando archivos...</p>
                </div>
              ) : driveFiles.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-slate-400 font-bold uppercase text-xs">No se encontraron archivos.</p>
                </div>
              ) : (
                driveFiles.map(file => (
                  <div key={file.id} className="bg-white border-2 border-slate-100 p-4 rounded-3xl flex flex-col gap-3 shadow-sm hover:border-amber-400 hover:shadow-md transition-all">
                    <div>
                      <p className="font-black text-slate-800 text-sm break-all">{file.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">Modificado: {file.createdTime ? new Date(file.createdTime).toLocaleString() : 'N/A'}</p>
                    </div>
                    <div className="flex gap-2 w-full">
                      <button 
                        onClick={() => window.open(file.webViewLink, '_blank')}
                        className="flex-1 bg-slate-100 text-slate-600 font-bold text-[10px] uppercase p-3 rounded-2xl hover:bg-slate-200"
                      >
                        Ver Documento
                      </button>
                      <button 
                        onClick={() => handleImportDriveSheet(file.id)}
                        disabled={isImporting}
                        className={`flex-1 ${isImporting ? 'bg-amber-300' : 'bg-amber-500 hover:bg-amber-600'} text-white font-bold text-[10px] uppercase p-3 rounded-2xl  transition-all`}
                      >
                        {isImporting ? 'Importando...' : 'Importar a App'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-200">
               <button 
                onClick={async () => {
                  const rootId = await GoogleDriveService.getRootFolderId();
                  window.open(`https://drive.google.com/drive/folders/${rootId}?usp=drive_link`, '_blank');
                }}
                className="w-full bg-slate-200 text-slate-600 p-4 rounded-2xl font-black text-xs uppercase"
               >
                 Abrir Google Drive Completo
               </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
