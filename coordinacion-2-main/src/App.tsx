/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Info, WifiOff } from 'lucide-react';
import { Doctor, DoctorRole, MonthlyData, SlotType, AvailabilityCall, TrainingActivity, RegistrationRequest } from './types';
import { MONTH_NAMES } from './constants';
import { setDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import * as XLSX from 'xlsx';
import { InductionManual } from './components/InductionManual';
import { AntibioticManual } from './components/AntibioticManual';
import { HumanResourcesView } from './components/HumanResourcesView';
import { ProductivityStatsView } from './components/ProductivityStatsView';
import { AdminToolbox } from './components/AdminToolbox';
import { AppProvider } from './context/AppContext';
import { BootScreen } from './components/BootScreen';
import { LoginPage } from './components/LoginPage';
import { AppHeader } from './components/AppHeader';
import { AyudaView } from './components/AyudaView';
import { DocsView } from './components/DocsView';
import { TurneroView } from './components/TurneroView';
import { HomeView } from './components/HomeView';
import { RuralView } from './components/RuralView';
import { PICView } from './components/PICView';
import { AdminView } from './components/AdminView';
import { CodigoRojoModal } from './components/CodigoRojoModal';
import { CodigoAzulModal } from './components/CodigoAzulModal';
import { AuthInboxModal } from './components/AuthInboxModal';
import { CallModal } from './components/CallModal';
import { EditDoctorModal } from './components/EditDoctorModal';
import { ActivitiesModal } from './components/ActivitiesModal';
import { SolicitudesView } from './components/SolicitudesView';
import { NovedadesView } from './components/NovedadesView';
import { AppStyles } from './components/AppStyles';
import { RegisterPage } from './components/RegisterPage';
import { ResetPasswordPage } from './components/ResetPasswordPage';
import { useAppContext } from './context/AppContext';
import { useShiftActions } from './hooks/useShiftActions';
import { useAIActions } from './hooks/useAIActions';
import { useExportActions } from './hooks/useExportActions';

function AppContent() {
  // ── Shared state & actions from AppContext ────────────────
  const {
    session, isBooting, isOnline,
    doctors, variables, currentMonthData,
    auditLogs, shiftRequests, activities, serviceMappings,
    selectedMonth, setSelectedMonth, selectedYear, setSelectedYear, daysInMonth,
    notification, setNotification, notify,
    theme, activeTab,
    pushNotification, updateMonthlyData, evaluations, saveEvaluation,
    saveEditedDoctor, addActivity, deleteActivity, deleteDoctor, saveDoctorOrder, toggleDoctorStatus,
    submitShiftRequest: ctxSubmitShiftRequest, updateRequestStatus,
    isGeneratingAI, aiReport, setAiReport,
    registrationRequests, approveRegistration, rejectRegistration,
  } = useAppContext();

  const { assignFreeDaysToPlanta, approveRequest, rejectRequest } = useShiftActions();
  const { generateAISchedulingProposal, generateAIStatsReport, generateAICapacityReport, generateAIServiceReport } = useAIActions();
  const exports = useExportActions({ showGridHours: false, doctorFilter: [], selectedRoles: [], selectedCategories: [] });

  // Form States (Admin)
  const [newDocName, setNewDocName] = useState('');
  const [newDocEmail, setNewDocEmail] = useState('');
  const [newDocCat, setNewDocCat] = useState<'Planta' | 'CTA' | 'APS' | 'Rural' | 'Disponibilidad'>('Planta');
  const [newDocRol, setNewDocRol] = useState<DoctorRole>('Médico General');
  const [newDocContact, setNewDocContact] = useState('');


  // Authorization Inbox
  const [showAuthInbox, setShowAuthInbox] = useState(false);


  // Editing Doctor
  const [editingDoc, setEditingDoc] = useState<Doctor | null>(null);
  
  // Availability Call States
  const [showCallModal, setShowCallModal] = useState(false);
  
  // Activities states
  const [showActivitiesModal, setShowActivitiesModal] = useState(false);
  const [showCodigoRojo, setShowCodigoRojo] = useState(false);
  const [showCodigoAzul, setShowCodigoAzul] = useState(false);
  const [newActivity, setNewActivity] = useState<Partial<TrainingActivity>>({
    modality: 'presencial',
    status: 'programada',
    files: {}
  });

  const [callDay, setCallDay] = useState(new Date().getDate());
  const [callSlot, setCallSlot] = useState<SlotType>('m');
  const [callTargetId, setCallTargetId] = useState<number | null>(null);
  const [callService, setCallService] = useState('Traslado Médico');
  const [callCaller, setCallCaller] = useState('');

  // Apply dynamic theme fonts to body
  useEffect(() => {
    const fontStack = theme.font === 'serif' ? 'ui-serif, Georgia, serif' :
                     theme.font === 'mono' ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' :
                     'Inter, ui-sans-serif, system-ui, sans-serif';
    document.body.style.fontFamily = fontStack;
  }, [theme.font]);

  // Request States
  const [reqDay, setReqDay] = useState<number>(1);
  const [reqSlot, setReqSlot] = useState<SlotType>('m');
  const [reqReason, setReqReason] = useState('');

  const [showInductionManual, setShowInductionManual] = useState(false);
  const [showAntibioticManual, setShowAntibioticManual] = useState(false);

  // -- Admin Actions --
  const addDoctor = async () => {
    if (!newDocName) return;

    // Find lowest available sortOrder (reuse gaps)
    const existingSortOrders = doctors
      .map(d => d.sortOrder)
      .filter((n): n is number => typeof n === 'number' && n > 0);
    const usedSortOrders = new Set(existingSortOrders);
    let newSortOrder = 1;
    while (usedSortOrders.has(newSortOrder)) newSortOrder++;

    const cleanName = newDocName.toLowerCase().replace(/\s+/g, '').substring(0, 8);
    const username = `${cleanName}${Math.floor(100 + Math.random() * 900)}`;
    const password = `ESE${Math.floor(1000 + Math.random() * 9000)}`;
    const id = Date.now();
    const newDoc: Doctor = {
      id, sortOrder: newSortOrder, nombre: newDocName, email: newDocEmail || undefined,
      cat: newDocCat, rol: newDocRol, st: 'activo',
      contacto: newDocContact || undefined, username, password,
      passwordLastChanged: Date.now()
    };
    try {
      await setDoc(doc(db, 'doctors', id.toString()), newDoc);
      setNewDocName(''); setNewDocEmail(''); setNewDocContact('');
      notify('Médico añadido correctamente', 'success');
    } catch (err) {
      notify('Error: No tiene permisos. Vincule Google en el banner superior.', 'error');
      handleFirestoreError(err, OperationType.WRITE, `doctors/${id}`);
    }
  };

  const handleBatchImportDoctors = async (importedDoctors: any[]) => {
    if (session?.r !== 'admin') return;

    if (!confirm(`¿Desea importar/actualizar ${importedDoctors.length} registros? Se actualizarán los datos existentes.`)) return;

    setNotification({ message: "Procesando Talento Humano...", type: 'info' });
    let successCount = 0;
    let errorCount = 0;

    // Get existing sortOrders and find starting point for new assignments
    const existingSortOrders = doctors
      .map(d => d.sortOrder)
      .filter((n): n is number => typeof n === 'number' && n > 0);
    const usedSortOrders = new Set(existingSortOrders);
    let nextSortOrder = 1;
    while (usedSortOrders.has(nextSortOrder)) nextSortOrder++;

    for (const docData of importedDoctors) {
      try {
        const id = docData.id || Date.now() + Math.random();
        const cleanCedula = (docData.cedula || '').toString().trim();
        if (!cleanCedula || !docData.nombre) continue;

        // Check if doctor already exists to preserve their sortOrder
        const existingDoc = doctors.find(d => d.id === Number(id));
        const sortOrder = existingDoc?.sortOrder ?? nextSortOrder++;

        const doctorData: Doctor = {
          id: Number(id),
          sortOrder,
          nombre: docData.nombre.toString().trim(),
          apellidos: (docData.apellidos || '').toString().trim(),
          cedula: cleanCedula,
          registroMedico: (docData.registroMedico || '').toString().trim(),
          email: (docData.email || '').toString().trim(),
          telefono: (docData.telefono || '').toString().trim(),
          cat: (docData.cat || 'Planta') as any,
          rol: (docData.rol || 'Médico General').toString().trim(),
          st: (docData.st || 'activo') as any,
          username: (docData.username || '').toString().trim(),
          password: (docData.password || '123456').toString().trim(),
          createdAt: Date.now(),
          passwordLastChanged: Date.now()
        };

        await setDoc(doc(db, 'doctors', String(id)), doctorData, { merge: true });
        successCount++;
      } catch (err) {
        console.error("Error importing doctor:", err);
        errorCount++;
      }
    }
    setNotification({ message: `Importación finalizada. Éxito: ${successCount}, Errores: ${errorCount}`, type: 'success' });
    setTimeout(() => window.location.reload(), 2000);
  };

const handleSubmitShiftRequest = async () => {
  await ctxSubmitShiftRequest(reqDay, reqSlot, reqReason);
  setReqReason('');
};

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
        if (rows.length < 2) { setNotification({ message: "El archivo está vacío", type: 'error' }); return; }

        const newData: MonthlyData = { ...currentMonthData };
        // All variable siglas for classification (case-insensitive lookup)
        const allVarKeys = { m: Object.keys(variables.m), t: Object.keys(variables.t), n: Object.keys(variables.n) };
        const allSiglasUpper = new Set([
          ...allVarKeys.m, ...allVarKeys.t, ...allVarKeys.n, 'X', 'PT', 'L', 'CAP'
        ].map(s => s.toUpperCase()));

        // Helper: find canonical sigla case from variables
        const canonicalize = (raw: string): string | null => {
          const u = raw.toUpperCase();
          if (['X', 'PT', 'L', 'CAP'].includes(u)) return u;
          for (const slot of ['m', 't', 'n'] as SlotType[]) {
            const match = allVarKeys[slot].find(k => k.toUpperCase() === u);
            if (match) return match;
          }
          return allSiglasUpper.has(u) ? raw : null;
        };

        // Helper: detect which slot a sigla belongs to
        const detectSlot = (sigla: string): SlotType | null => {
          const u = sigla.toUpperCase();
          if (allVarKeys.m.some(k => k.toUpperCase() === u)) return 'm';
          if (allVarKeys.t.some(k => k.toUpperCase() === u)) return 't';
          if (allVarKeys.n.some(k => k.toUpperCase() === u)) return 'n';
          if (['PT', 'L', 'CAP', 'X'].includes(u)) return null;
          return null;
        };

        // Detect format: check if first header row has 'ID_MEDICO' or 'JORNADA' (app template)
        const headerRow = rows[0].map((h: any) => (h || '').toString().trim().toUpperCase());
        const isAppTemplate = headerRow.includes('JORNADA') || headerRow.includes('ID_MEDICO');

        if (isAppTemplate) {
          // ── Format A: App template (ID_MEDICO/NOMBRE_MEDICO, JORNADA, DIA_1...) ──
          const headers = rows[0] as string[];
          for (let ri = 1; ri < rows.length; ri++) {
            const row = rows[ri];
            const journeyCol = headerRow.indexOf('JORNADA');
            const nameCol = headerRow.includes('NOMBRE_MEDICO') ? headerRow.indexOf('NOMBRE_MEDICO') : 0;
            const doctorName = row[nameCol]?.toString().trim();
            const slotStr = (journeyCol >= 0 ? row[journeyCol] : row[1])?.toString().trim()?.toLowerCase();
            if (!doctorName || !slotStr) continue;
            const doctor = doctors.find(d =>
              d.nombre.toLowerCase().includes(doctorName.toLowerCase()) ||
              d.id.toString() === row[0]?.toString().trim()
            );
            if (!doctor) continue;
            const slot: SlotType = slotStr.startsWith('ma') || slotStr === 'm' ? 'm'
              : slotStr.startsWith('ta') || slotStr === 't' ? 't' : 'n';
            if (!newData[doctor.id]) newData[doctor.id] = { m: {}, t: {}, n: {} };
            const dataStartCol = journeyCol >= 0 ? journeyCol + 1 : 2;
            for (let ci = dataStartCol; ci < row.length; ci++) {
              const headerVal = headers[ci]?.toString().replace(/\D/g, '');
              const day = parseInt(headerVal);
              if (isNaN(day) || day < 1 || day > 31) continue;
              const rawVal = row[ci]?.toString().trim();
              if (!rawVal) continue;
              const canonical = canonicalize(rawVal);
              if (canonical && canonical !== 'X') newData[doctor.id][slot][day] = canonical;
            }
          }
        } else {
          // ── Format B: Hospital Excel (MÉDICO column + day number columns) ──
          // Find the header row with day numbers (1,2,3...) in consecutive columns
          let headerRowIdx = -1;
          let dayColMap: { col: number; day: number }[] = [];
          let nameCol = 0;

          for (let ri = 0; ri < Math.min(rows.length, 10); ri++) {
            const row = rows[ri];
            const candidates: { col: number; day: number }[] = [];
            for (let ci = 1; ci < row.length; ci++) {
              const val = parseInt((row[ci] || '').toString().trim());
              if (!isNaN(val) && val >= 1 && val <= 31) candidates.push({ col: ci, day: val });
            }
            // Accept if we find at least 15 consecutive day numbers
            if (candidates.length >= 15) {
              const sorted = candidates.sort((a, b) => a.day - b.day);
              let consecutive = 1;
              for (let i = 1; i < sorted.length; i++) {
                if (sorted[i].day === sorted[i-1].day + 1) consecutive++;
              }
              if (consecutive >= 15) {
                headerRowIdx = ri;
                dayColMap = sorted;
                break;
              }
            }
          }

          if (headerRowIdx === -1) {
            // Fallback: try parsing with simple numeric headers in row 0
            const h = rows[0];
            for (let ci = 1; ci < h.length; ci++) {
              const d = parseInt((h[ci] || '').toString());
              if (!isNaN(d) && d >= 1 && d <= 31) dayColMap.push({ col: ci, day: d });
            }
            headerRowIdx = 0;
          }

          if (dayColMap.length === 0) {
            setNotification({ message: "No se pudo detectar el formato del Excel. Use la plantilla del sistema.", type: 'error' });
            return;
          }

          // Parse data rows after the header
          let importedCells = 0;
          let currentDoctor: typeof doctors[0] | null = null;
          const slotCycle: SlotType[] = ['m', 't', 'n'];
          let slotIdx = 0;

          for (let ri = headerRowIdx + 1; ri < rows.length; ri++) {
            const row = rows[ri];
            if (!row || row.every((c: any) => !c || c.toString().trim() === '')) continue;

            // Check if first column has a doctor name
            const firstCell = (row[nameCol] || '').toString().trim();
            if (firstCell) {
              // Try to match doctor by name (partial, case-insensitive)
              const nameLower = firstCell.toLowerCase()
                .replace(/^(dr\.|dra\.|dr |dra )/i, '').trim();
              const matched = doctors.find(d => {
                const docLower = d.nombre.toLowerCase();
                return docLower.includes(nameLower) || nameLower.includes(docLower) ||
                  docLower.split(' ').some(part => part.length > 3 && nameLower.includes(part));
              });
              if (matched) {
                currentDoctor = matched;
                slotIdx = 0;
                if (!newData[currentDoctor.id]) newData[currentDoctor.id] = { m: {}, t: {}, n: {} };
              }
            }

            if (!currentDoctor) continue;

            // Check if this row has a slot indicator (M/T/N or Mañana/Tarde/Noche)
            let rowSlot: SlotType | null = null;
            // Look for slot label in column right after name or in a "JORNADA" column
            for (let ci = 0; ci <= Math.min(2, row.length - 1); ci++) {
              const cellVal = (row[ci] || '').toString().trim().toLowerCase();
              if (cellVal === 'm' || cellVal.startsWith('mañ') || cellVal.startsWith('man')) { rowSlot = 'm'; break; }
              if (cellVal === 't' || cellVal.startsWith('tar')) { rowSlot = 't'; break; }
              if (cellVal === 'n' || cellVal.startsWith('noc')) { rowSlot = 'n'; break; }
            }

            const slotForRow: SlotType = rowSlot || slotCycle[slotIdx % 3];

            // Parse day values
            let hasData = false;
            for (const { col, day } of dayColMap) {
              if (col >= row.length) continue;
              const rawVal = (row[col] || '').toString().trim();
              if (!rawVal) continue;
              // Handle cells with multiple siglas separated by / or newline
              const parts = rawVal.split(/[\/\n\r]+/).map(p => p.trim()).filter(Boolean);
              for (const part of parts) {
                const canonical = canonicalize(part);
                if (canonical && canonical !== 'X') {
                  // If slot was auto-detected from sigla content and no explicit slot label
                  const sigSlot = rowSlot ? slotForRow : (detectSlot(canonical) || slotForRow);
                  newData[currentDoctor.id][sigSlot][day] = canonical;
                  hasData = true;
                  importedCells++;
                }
              }
            }

            if (!rowSlot && hasData) slotIdx++;
          }

          if (importedCells === 0) {
            setNotification({ message: "No se encontraron datos válidos para importar. Verifique nombres de médicos.", type: 'error' });
            return;
          }
        }

        await updateMonthlyData(newData);
        setNotification({ message: "Turnero importado correctamente", type: 'success' });
        setTimeout(() => setNotification(null), 3000);
      } catch (err) {
        console.error("Import error:", err);
        setNotification({ message: "Error al importar Excel. Verifique el formato.", type: 'error' });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleSaveEditedDoctor = async () => {
    if (!editingDoc) return;
    await saveEditedDoctor(editingDoc);
    setEditingDoc(null);
  };

  const handleAddActivity = async () => {
    await addActivity(newActivity);
    setNewActivity({ modality: 'presencial', status: 'programada', files: {} });
  };


  const isAdminUser = session?.r === 'admin';

  const handleCallAvailability = async () => {
    let targetDocId = callTargetId;
    if (!targetDocId) {
      // Find the first available if not selected
      Object.keys(currentMonthData).forEach(id => {
        const sigla = currentMonthData[Number(id)]?.[callSlot]?.[callDay] || 'X';
        if (sigla.startsWith('D')) {
          targetDocId = Number(id);
        }
      });
    }

    if (!targetDocId) {
      return alert("No se encontró ningún asistencial en Disponibilidad para este horario.");
    }

    if (!callService) {
      return alert("Por favor indique el servicio o labor administrativa.");
    }

    const docData = doctors.find(d => d.id === targetDocId);
    if (!docData) return;

    if (!confirm(`¿Confirmar llamado a Disponibilidad para: ${docData.nombre}?`)) return;

    const callId = Date.now().toString();
    const newCall: AvailabilityCall = {
      id: callId,
      timestamp: Date.now(),
      doctorId: docData.id,
      doctorName: docData.nombre,
      callerName: callCaller || session?.n || 'Personal Saliente',
      service: callService,
      day: callDay,
      slot: callSlot,
      month: selectedMonth,
      year: selectedYear
    };

    if (docData.telefono) {
      const cleanPhone = docData.telefono.replace(/\D/g, '');
      if (cleanPhone.length >= 10) {
        const text = encodeURIComponent(`🚨 LLAMADO DISPONIBILIDAD: ${callService.toUpperCase()}. Turno: ${callSlot.toUpperCase()}. Dr. ${docData.nombre}. Llamado por: ${newCall.callerName}`);
        window.open(`https://wa.me/57${cleanPhone}?text=${text}`, '_blank');
      }
    }

    try {
      await setDoc(doc(db, 'availabilityCalls', callId), newCall);
      await pushNotification(docData.id, `🚨 LLAMADO DISPONIBILIDAD: ${callService}. Por favor presentarse.`);
      
      setNotification({ message: `Llamado registrado con éxito`, type: 'success' });
      setShowCallModal(false);
      setCallService('');
      setCallCaller('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `availabilityCalls/${callId}`);
    }
  };

  // -- Calculations --
  const globalTotalHours = useMemo(() => {
    let total = 0;
    Object.keys(currentMonthData).forEach(docId => {
      const docShifts = currentMonthData[Number(docId)];
      (['m', 't', 'n'] as SlotType[]).forEach(slot => {
        if (docShifts[slot]) {
          Object.values(docShifts[slot]).forEach(sigla => {
            total += variables[slot][sigla] || 0;
          });
        }
      });
    });
    return total;
  }, [currentMonthData, variables]);

  if (isBooting) return <BootScreen />;

  if (!session) return <LoginPage />;

  {/* LoginPage extracted to components/LoginPage.tsx */}


  return (
    <div className={`bg-slate-100 min-h-screen text-slate-800 flex flex-col font-sans transition-all duration-500`} style={{ '--primary': theme.primary } as any}>
      <AppStyles theme={theme} />
      {/* Offline Alert */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-orange-500 text-white text-xs uppercase font-black py-1 px-4 flex items-center justify-center gap-2 overflow-hidden sticky top-0 z-[60]"
          >
            <WifiOff className="w-3 h-3" />
            Modo Offline: Los cambios se sincronizarán cuando vuelvas a tener conexión
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 20 }}
            exit={{ opacity: 0, y: -50 }}
            onClick={() => setNotification(null)}
            className={`cursor-pointer fixed top-4 left-1/2 -translate-x-1/2 z-[100] ${
              notification.type === 'error' ? 'bg-rose-600' : 
              notification.type === 'info' ? 'bg-sky-600' : 'bg-emerald-600'
            } text-white px-6 py-3 rounded-2xl font-bold shadow-2xl flex items-center gap-3`}
          >
            {notification.type === 'success' ? <Bell className="w-5 h-5 animate-bounce" /> : <Info className="w-5 h-5" />}
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>
      
      <AppHeader isAdminUser={isAdminUser} showAuthInbox={() => setShowAuthInbox(true)} />

      {/* Main Content */}
      <main className="flex-1 max-w-[100vw] overflow-x-hidden p-4 pb-8">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <HomeView
              globalTotalHours={globalTotalHours}
              onShowCodigoRojo={() => setShowCodigoRojo(true)}
              onShowCodigoAzul={() => setShowCodigoAzul(true)}
              onGenerateAIStats={generateAIStatsReport}
            />
          )}

          {activeTab === 'ayuda' && <AyudaView />}

          {activeTab === 'stats' && (
            <motion.div 
               key="stats"
               initial={{ opacity: 0, x: 10 }} 
               animate={{ opacity: 1, x: 0 }} 
               exit={{ opacity: 0, x: -10 }}
               className="max-w-7xl mx-auto"
            >
              <div className="flex justify-between items-center mb-8 bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                <div>
                   <h2 className="text-3xl font-black text-slate-800">Análisis de Productividad</h2>
                   <p className="text-sm text-slate-500">Visualización avanzada de carga laboral por servicio y médico</p>
                </div>
                <div className="flex gap-4">
                  <select 
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-800 font-bold outline-none focus:border-emerald-500"
                  >
                    {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
                  </select>
                  <select 
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-800 font-bold outline-none focus:border-emerald-500"
                  >
                    {Array.from({ length: 10 }, (_, i) => 2026 + i).map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>

              <ProductivityStatsView 
                doctors={doctors}
                currentMonthData={currentMonthData}
                variables={variables}
                serviceMappings={serviceMappings}
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
              />
            </motion.div>
          )}

          {activeTab === 'turnos' && (
            <TurneroView onOpenCallModal={() => setShowCallModal(true)} onDownloadTemplate={exports.downloadTemplateExcel} onImportExcel={handleImportExcel} globalTotalHours={globalTotalHours} />
          )}

          {activeTab === 'pic' && (
            <PICView
              onDeleteActivity={deleteActivity}
              newActivity={newActivity}
              setNewActivity={setNewActivity}
              onAddActivity={handleAddActivity}
              onExportExcel={exports.exportPICExcel}
              onExportPDF={exports.exportPICPDF}
            />
          )}

          {activeTab === 'toolbox' && session.r === 'admin' && (
            <motion.div 
              key="toolbox"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-5xl mx-auto"
            >
               <AdminToolbox 
                 onNotify={(msg, type) => setNotification({message: msg, type})}
                 variables={variables}
                 doctors={doctors}
                 onGenerateProposal={generateAISchedulingProposal}
                 isGenerating={isGeneratingAI}
                 selectedMonth={selectedMonth}
                 selectedYear={selectedYear}
               />
            </motion.div>
          )}

          {activeTab === 'solicitudes' && (
            <SolicitudesView
              session={session}
              daysInMonth={daysInMonth}
              reqDay={reqDay}
              setReqDay={setReqDay}
              reqSlot={reqSlot}
              setReqSlot={setReqSlot}
              reqReason={reqReason}
              setReqReason={setReqReason}
              onSubmit={handleSubmitShiftRequest}
              shiftRequests={shiftRequests}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              onExport={exports.exportShiftRequests}
              onUpdateStatus={(id, status) => updateRequestStatus(Number(id), status)}
            />
          )}

          {activeTab === 'rural' && <RuralView />}

          {activeTab === 'novedades' && (
            <NovedadesView
              session={session}
              monthName={MONTH_NAMES[selectedMonth]}
              selectedYear={selectedYear}
              auditLogs={auditLogs}
              selectedMonth={selectedMonth}
              onExportExcel={exports.exportNovedadesExcel}
              onExportPDF={exports.exportNovedadesPDF}
              onGenerateAI={generateAIStatsReport}
              isGeneratingAI={isGeneratingAI}
              aiReport={aiReport}
              setAiReport={setAiReport}
              onPushNotification={(id, msg) => { pushNotification(id, msg); }}
              registrationRequests={registrationRequests}
              onApproveRegistration={approveRegistration}
              onRejectRegistration={rejectRegistration}
            />
          )}

          {activeTab === 'bd' && (
            <motion.div
              key="bd"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <HumanResourcesView
                doctors={doctors}
                currentMonthData={currentMonthData}
                variables={variables}
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                isAdmin={session?.r === 'admin'}
                onUpdateDoctorStatus={toggleDoctorStatus}
                onEditDoctor={(docData) => {
                  setEditingDoc(docData);
                }}
                onDeleteDoctor={deleteDoctor}
                onSaveDoctorOrder={saveDoctorOrder}
                evaluations={evaluations}
                onSaveEvaluation={saveEvaluation}
                onAddDoctorClick={() => {
                  const cleanName = 'nuevo_usuario';
                  const username = `${cleanName}${Math.floor(100 + Math.random() * 900)}`;
                  const password = `ESE${Math.floor(1000 + Math.random() * 9000)}`;
                  setEditingDoc({
                    id: Date.now(),
                    nombre: '',
                    cat: 'Planta',
                    rol: 'Médico General',
                    st: 'activo',
                    username,
                    password,
                    permissions: [],
                    createdAt: Date.now()
                  });
                }}
                onUpdateDoctorPermissions={async (id, perms) => {
                  try {
                    await updateDoc(doc(db, 'doctors', id.toString()), { permissions: perms });
                  } catch (e) {
                    handleFirestoreError(e, OperationType.WRITE, `doctors/${id}/permissions`);
                  }
                }}
                onImportDoctors={handleBatchImportDoctors}
                onResetPassword={async (doctor) => {
                  if (!doctor.email) { notify('Este usuario no tiene correo registrado.', 'error'); return; }
                  try {
                    const res = await fetch('/api/send-reset-email', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ doctorId: doctor.id, doctorName: doctor.nombre, email: doctor.email })
                    });
                    const data = await res.json();
                    if (data.success) {
                      if (data.emailSent) {
                        notify(`Enlace enviado a ${doctor.email}`, 'success');
                      } else {
                        // SMTP not configured — show link for manual sharing
                        prompt('SMTP no configurado. Comparte este enlace manualmente:', data.resetUrl || '');
                      }
                    } else {
                      notify('Error al generar el enlace: ' + (data.error || ''), 'error');
                    }
                  } catch {
                    notify('No se pudo contactar el servidor.', 'error');
                  }
                }}
              />
            </motion.div>
          )}

          {activeTab === 'docs' && (
            <DocsView
              onShowAntibioticManual={() => setShowAntibioticManual(true)}
              onShowInductionManual={() => setShowInductionManual(true)}
            />
          )}

          {activeTab === 'admin' && session.r === 'admin' && (
            <AdminView
              onDownloadTemplate={exports.downloadTemplateExcel}
              onImportExcel={handleImportExcel}
              onAddDoctor={addDoctor}
              onEditDoctor={(doc) => setEditingDoc(doc)}
              onGenerateCapacityReport={generateAICapacityReport}
              onGenerateServiceReport={generateAIServiceReport}
              assignFreeDaysToPlanta={assignFreeDaysToPlanta}
              newDocName={newDocName}
              setNewDocName={setNewDocName}
              newDocEmail={newDocEmail}
              setNewDocEmail={setNewDocEmail}
              newDocContact={newDocContact}
              setNewDocContact={setNewDocContact}
              newDocCat={newDocCat}
              setNewDocCat={setNewDocCat}
              newDocRol={newDocRol}
              setNewDocRol={setNewDocRol}
            />
          )}
        </AnimatePresence>
      </main>

      {editingDoc && (
        <EditDoctorModal
          doctor={editingDoc}
          onChange={setEditingDoc}
          onSave={handleSaveEditedDoctor}
          onCancel={() => setEditingDoc(null)}
        />
      )}
      <AuthInboxModal
        isOpen={showAuthInbox}
        onClose={() => setShowAuthInbox(false)}
        requests={shiftRequests}
        doctors={doctors}
        onApprove={(id) => {
          const req = shiftRequests.find(r => r.id === id);
          if (req) approveRequest(req.id.toString(), req.doctorId, req.day, req.slot);
        }}
        onReject={(id) => {
          const req = shiftRequests.find(r => r.id === id);
          if (req) rejectRequest(req.id.toString(), req.doctorId, req.day, req.slot);
        }}
        registrationRequests={registrationRequests}
        onApproveRegistration={approveRegistration}
        onRejectRegistration={rejectRegistration}
      />
      {/* Modal Components */}
      <InductionManual 
        isOpen={showInductionManual} 
        onClose={() => setShowInductionManual(false)} 
      />
      <AntibioticManual
        isOpen={showAntibioticManual}
        onClose={() => setShowAntibioticManual(false)}
      />

      {/* Availability Call Modal */}
      <CallModal
        isOpen={showCallModal}
        onClose={() => setShowCallModal(false)}
        callDay={callDay}
        setCallDay={setCallDay}
        callSlot={callSlot}
        setCallSlot={setCallSlot}
        callTargetId={callTargetId}
        setCallTargetId={setCallTargetId}
        callService={callService}
        setCallService={setCallService}
        callCaller={callCaller}
        setCallCaller={setCallCaller}
        daysInMonth={daysInMonth}
        currentMonthData={currentMonthData}
        doctors={doctors}
        sessionName={session?.n}
        onConfirm={handleCallAvailability}
      />

      <ActivitiesModal
        isOpen={showActivitiesModal}
        onClose={() => setShowActivitiesModal(false)}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        monthName={MONTH_NAMES[selectedMonth]}
        newActivity={newActivity}
        setNewActivity={setNewActivity}
        onAdd={handleAddActivity}
        activities={activities}
        onDelete={deleteActivity}
        onExportExcel={exports.exportPICExcel}
        onExportPDF={exports.exportPICPDF}
      />

      <CodigoRojoModal isOpen={showCodigoRojo} onClose={() => setShowCodigoRojo(false)} />

      <CodigoAzulModal isOpen={showCodigoAzul} onClose={() => setShowCodigoAzul(false)} />
    </div>
  );
}

export default function App() {
  // Detect /register route — show standalone page without loading the full app
  const isRegisterRoute = window.location.pathname === '/register' || window.location.pathname.startsWith('/register?');
  const hasInviteParam = new URLSearchParams(window.location.search).has('invite');
  const isResetRoute = window.location.pathname === '/reset-password' || window.location.pathname.startsWith('/reset-password?');

  if (isResetRoute) {
    return <ResetPasswordPage />;
  }

  if (isRegisterRoute || hasInviteParam) {
    return <RegisterPage />;
  }

  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
