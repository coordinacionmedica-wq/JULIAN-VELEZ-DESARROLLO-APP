import React, { useState, useEffect } from 'react';
import { 
  Users, Plus, Search, Filter, ClipboardList, Clock, 
  Trash2, Edit3, CheckCircle2, AlertCircle, Share2, 
  FileSpreadsheet, MessageSquare, ArrowRight, UserPlus,
  RefreshCcw, Cloud, CloudDownload, Send, Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDocs, where, setDoc } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { GoogleDriveService } from '../services/googleDriveService';
import * as XLSX from 'xlsx';
import { HospitalLogo } from './HospitalLogo';

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
  deliveredBy?: string;
  receivedBy?: string;
  isRemitido?: boolean;
  remitidoComment?: string;
}

interface Doctor {
  id: number;
  nombre: string;
  contacto?: string;
  apellidos?: string;
  registroMedico?: string;
}

interface Props {
  currentUser: Doctor | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
  doctors: Doctor[];
}

const SECTIONS = [
  "URGENCIAS",
  "OBSERVACION URGENCIAS",
  "HOSPITALIZACION",
  "PARTOS",
  "CIRUGIA"
];

function overwriteDocPatientBlock(docText: string, updatedPatient: Patient): string {
  // If the document is fundamentally empty or does not have standard separators,
  // we can just format it completely.
  if (!docText || !docText.includes('---')) {
    return `==================================================================================================\n` +
           `                              CENSO HOSPITALARIO - ENTREGA DE TURNOS\n` +
           `==================================================================================================\n` +
           `Fecha de Reporte: ${new Date().toLocaleString('es-CO')}\n` +
           `Total de Pacientes: 1\n` +
           `==================================================================================================\n\n` +
           `--------------------------------------------------------------------------------------------------\n` +
           `[ REGISTRO N° 1 - ENTREGA DE TURNO ]\n` +
           `--------------------------------------------------------------------------------------------------\n` +
           `Cama: ${updatedPatient.bed || 'S/C'}\n` +
           `Fecha: ${updatedPatient.entryDate || ''}\n` +
           `Paciente: ${updatedPatient.name || ''} (${updatedPatient.age || ''}) • EPS: ${updatedPatient.eps || ''}\n` +
           `Especialidad: ${updatedPatient.specialty || ''}\n` +
           `Seccion: ${updatedPatient.section || ''}\n` +
           `\n` +
           `Diagnostico:\n${updatedPatient.diagnoses || ''}\n` +
           `\n` +
           `Manejo:\n${updatedPatient.managementPlan || ''}\n` +
           `\n` +
           `Paraclinicos:\n${updatedPatient.paraclinicals || 'SIN REGISTRO'}\n` +
           `\n` +
           `Pendiente:\n${updatedPatient.pendientes || 'NINGUNO'}\n` +
           `\n` +
           `Remitido: ${updatedPatient.isRemitido ? 'SI' : 'NO'}\n` +
           `Estado: ${updatedPatient.remitidoComment || 'NINGUNO'}\n` +
           `Medico_Entrega: ${updatedPatient.deliveredBy || ''}\n` +
           `Medico_Recibe: ${updatedPatient.receivedBy || ''}\n` +
           `--------------------------------------------------------------------------------------------------\n\n`;
  }

  // Split content by dashes
  const parts = docText.split(/--------------------------------------------------------------------------------------------------/);
  
  // Normalized target Bed
  const targetBed = String(updatedPatient.bed || '').trim().toLowerCase();
  
  let replaced = false;
  
  const updatedParts = parts.map((part) => {
    // Check if this part contains the specific "Cama: targetBed"
    const bedRegex = /Cama:\s*([^\n]+)/i;
    const match = part.match(bedRegex);
    if (match && match[1].trim().toLowerCase() === targetBed) {
      replaced = true;
      
      // Get the existing register number from the block if present
      const regMatch = part.match(/\[\s*REGISTRO\s*N°\s*(\d+)/i);
      const regNum = regMatch ? regMatch[1] : '1';
      
      // Build updated block text
      let blockText = `\n[ REGISTRO N° ${regNum} - ENTREGA DE TURNO ]\n`;
      blockText += `Cama: ${updatedPatient.bed || 'S/C'}\n`;
      blockText += `Fecha: ${updatedPatient.entryDate || ''}\n`;
      blockText += `Paciente: ${updatedPatient.name || ''} (${updatedPatient.age || ''}) • EPS: ${updatedPatient.eps || ''}\n`;
      blockText += `Especialidad: ${updatedPatient.specialty || ''}\n`;
      blockText += `Seccion: ${updatedPatient.section || ''}\n`;
      blockText += `\n`;
      blockText += `Diagnostico:\n${updatedPatient.diagnoses || ''}\n`;
      blockText += `\n`;
      blockText += `Manejo:\n${updatedPatient.managementPlan || ''}\n`;
      blockText += `\n`;
      blockText += `Paraclinicos:\n${updatedPatient.paraclinicals || 'SIN REGISTRO'}\n`;
      blockText += `\n`;
      blockText += `Pendiente:\n${updatedPatient.pendientes || 'NINGUNO'}\n`;
      blockText += `\n`;
      blockText += `Remitido: ${updatedPatient.isRemitido ? 'SI' : 'NO'}\n`;
      blockText += `Estado: ${updatedPatient.remitidoComment || 'NINGUNO'}\n`;
      blockText += `Medico_Entrega: ${updatedPatient.deliveredBy || ''}\n`;
      blockText += `Medico_Recibe: ${updatedPatient.receivedBy || ''}\n`;
      
      return blockText;
    }
    return part;
  });

  if (replaced) {
    return updatedParts.join('--------------------------------------------------------------------------------------------------');
  }

  // If the cama wasn't found, find the last block index or count then append a new patient block
  let regNum = 1;
  parts.forEach(part => {
    const regMatch = part.match(/\[\s*REGISTRO\s*N°\s*(\d+)/i);
    if (regMatch) {
      const num = parseInt(regMatch[1], 10);
      if (num >= regNum) regNum = num + 1;
    }
  });

  let appendBlock = `--------------------------------------------------------------------------------------------------\n`;
  appendBlock += `[ REGISTRO N° ${regNum} - ENTREGA DE TURNO ]\n`;
  appendBlock += `--------------------------------------------------------------------------------------------------\n`;
  appendBlock += `Cama: ${updatedPatient.bed || 'S/C'}\n`;
  appendBlock += `Fecha: ${updatedPatient.entryDate || ''}\n`;
  appendBlock += `Paciente: ${updatedPatient.name || ''} (${updatedPatient.age || ''}) • EPS: ${updatedPatient.eps || ''}\n`;
  appendBlock += `Especialidad: ${updatedPatient.specialty || ''}\n`;
  appendBlock += `Seccion: ${updatedPatient.section || ''}\n`;
  appendBlock += `\n`;
  appendBlock += `Diagnostico:\n${updatedPatient.diagnoses || ''}\n`;
  appendBlock += `\n`;
  appendBlock += `Manejo:\n${updatedPatient.managementPlan || ''}\n`;
  appendBlock += `\n`;
  appendBlock += `Paraclinicos:\n${updatedPatient.paraclinicals || 'SIN REGISTRO'}\n`;
  appendBlock += `\n`;
  appendBlock += `Pendiente:\n${updatedPatient.pendientes || 'NINGUNO'}\n`;
  appendBlock += `\n`;
  appendBlock += `Remitido: ${updatedPatient.isRemitido ? 'SI' : 'NO'}\n`;
  appendBlock += `Estado: ${updatedPatient.remitidoComment || 'NINGUNO'}\n`;
  appendBlock += `Medico_Entrega: ${updatedPatient.deliveredBy || ''}\n`;
  appendBlock += `Medico_Recibe: ${updatedPatient.receivedBy || ''}\n`;
  appendBlock += `--------------------------------------------------------------------------------------------------\n\n`;

  return docText + appendBlock;
}

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
  const [driveFiles, setDriveFiles] = useState<{ id: string, name: string, webViewLink: string, createdTime?: string, mimeType?: string }[]>([]);
  const [driveYear, setDriveYear] = useState(new Date().getFullYear().toString());
  const [driveMonth, setDriveMonth] = useState((new Date().getMonth() + 1).toString().padStart(2, '0'));
  
  const [isImporting, setIsImporting] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'Sincronizado' | 'Error' | 'En espera' | 'Sincronizando'>('Sincronizado');
  const [showSyncSuccessToast, setShowSyncSuccessToast] = useState(false);
  const [selectedDriveFile, setSelectedDriveFile] = useState<{ id: string, name: string, webViewLink: string, mimeType?: string } | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [hasGoogleToken, setHasGoogleToken] = useState(!!localStorage.getItem('google_access_token'));
  const [patientToDelete, setPatientToDelete] = useState<string | null>(null);

  // Dynamic Department Titles States
  const [departmentTitles, setDepartmentTitles] = useState<Record<string, string>>({
    'all': 'CENSO GENERAL DE PACIENTES',
    'URGENCIAS': 'CENSO DE URGENCIAS',
    'OBSERVACION URGENCIAS': 'CENSO DE OBSERVACION DE URGENCIAS',
    'HOSPITALIZACION': 'CENSO DE HOSPITALIZACION',
    'PARTOS': 'CENSO DE SALA DE PARTOS',
    'CIRUGIA': 'CENSO DE QUIRÓFANOS (CIRUGÍA)'
  });
  const [editingTitleText, setEditingTitleText] = useState('');

  // Inline Editing States and Utilities
  const [isInlineEditEnabled, setIsInlineEditEnabled] = useState(true);
  const [activeCell, setActiveCell] = useState<{ id: string; field: string; value: string } | null>(null);
  const [savingCells, setSavingCells] = useState<{ [key: string]: boolean }>({});
  const [activeNoteInputId, setActiveNoteInputId] = useState<string | null>(null);
  const [quickNoteValue, setQuickNoteValue] = useState<string>('');

  // Background Sheets Sync helper
  const triggerDriveBackgroundSync = async (updatedPatientsList: Patient[]) => {
    if (!selectedDriveFile || !selectedDriveFile.id) return;
    const isSheet = selectedDriveFile.mimeType?.includes('spreadsheet');
    if (!isSheet) return;

    try {
      const values = [
        ['CAMA', 'FECHA_INGRESO', 'PACIENTE', 'EDAD', 'EPS', 'SECCION', 'DIAGNOSTICO', 'MANEJO', 'PARACLINICOS', 'PENDIENTE', 'REMITIDO', 'ESTADO_REMITIDO', 'ESPECIALIDAD', 'MEDICO_ENTREGA', 'MEDICO_RECIBE', 'ACTUALIZADO_POR', 'FECHA_ACTUALIZACION'],
        ...updatedPatientsList.map(p => [
          p.bed || 'S/C', 
          p.entryDate || '', 
          p.name || '', 
          p.age || '', 
          p.eps || '', 
          p.section || 'HOSPITALIZACION', 
          p.diagnoses || '', 
          p.managementPlan || '', 
          p.paraclinicals || '', 
          p.pendientes || '', 
          p.isRemitido ? 'SI' : 'NO', 
          p.remitidoComment || '', 
          p.specialty || '', 
          p.deliveredBy || '', 
          p.receivedBy || '', 
          p.updatedBy || '', 
          new Date(p.updatedAt || Date.now()).toISOString()
        ]).sort((a,b) => String(a[0]).localeCompare(String(b[0])))
      ];
      await GoogleDriveService.updateSheetValues(selectedDriveFile.id, 'Sheet1!A1', values);
      console.log("Auto-saved changes to Google Sheets successfully in background.");
    } catch (err) {
      console.error("Auto background Sheets sync failed:", err);
    }
  };

  // Synchronize a specific patient's text block inside their clinical location census file in Drive
  const triggerSinglePatientDriveDocSync = async (patient: Patient, updatedFields: Partial<Patient>) => {
    const token = localStorage.getItem('google_access_token');
    if (!token) {
      console.warn("No Google Drive access token found. Single patient Drive Doc Sync inactive.");
      return;
    }

    try {
      // 1. Get the patient section/department
      const section = updatedFields.section || patient.section || 'HOSPITALIZACION';
      
      // 2. Get or create (with auto-duplication of previous shifts!) the clinical census file for this department
      const docInfo = await GoogleDriveService.getOrCreateLocationCensusFile(section);
      if (!docInfo || !docInfo.id) {
        console.warn(`Could not retrieve or create Google Doc for section ${section}`);
        return;
      }

      // 3. Get the existing plain text content of the Google Doc
      let currentText = "";
      try {
        currentText = await GoogleDriveService.getGoogleDocText(docInfo.id);
      } catch (e) {
        console.warn("Google Doc is brand new or text retrieve failed, starting with clean format template.");
      }

      // 4. Overwrite/replace the exact patient block by CAMA
      const mergedPatient = { ...patient, ...updatedFields } as Patient;
      const updatedText = overwriteDocPatientBlock(currentText, mergedPatient);

      // 5. Save back to Google Doc
      await GoogleDriveService.updateGoogleDocText(docInfo.id, updatedText);
      console.log(`Successfully sync'd bed "${mergedPatient.bed}" to Drive Google Doc "${docInfo.name}" (${docInfo.id})`);
    } catch (err) {
      console.error("Error in triggerSinglePatientDriveDocSync:", err);
    }
  };

  const InlineCell = ({ 
    patient, 
    field, 
    type = 'text', 
    className = "", 
    viewClassName = "",
    placeholder = "Editar..."
  }: { 
    patient: Patient, 
    field: string, 
    type?: 'text' | 'textarea' | 'date', 
    className?: string,
    viewClassName?: string,
    placeholder?: string
  }) => {
    const isEditing = activeCell?.id === patient.id && activeCell?.field === field;
    const cellValue = String((patient as any)[field] || '');
    const cellKey = `${patient.id}-${field}`;
    const isSaving = savingCells[cellKey];

    const [localVal, setLocalVal] = useState(cellValue);

    useEffect(() => {
      if (!isEditing) {
        setLocalVal(cellValue);
      }
    }, [cellValue, isEditing]);

    const handleCommit = async () => {
      const trimmed = localVal.trim();
      if (trimmed === cellValue) {
        setActiveCell(null);
        return;
      }
      
      setSavingCells(prev => ({ ...prev, [cellKey]: true }));
      try {
        const patientRef = doc(db, 'census', patient.id);
        const updateData = {
          [field]: trimmed,
          updatedAt: Date.now(),
          updatedBy: currentUser?.nombre || 'SISTEMA'
        };
        await updateDoc(patientRef, updateData);
        
        // Background sync to Drive Spreadsheet
        const updatedList = patients.map(p => p.id === patient.id ? { ...p, ...updateData } : p);
        triggerDriveBackgroundSync(updatedList);

        // Background sync to location-specific Google Doc
        triggerSinglePatientDriveDocSync(patient, updateData);
        
      } catch (err) {
        console.error("Error committing inline edit:", err);
      } finally {
        setSavingCells(prev => ({ ...prev, [cellKey]: false }));
        setActiveCell(null);
      }
    };

    if (isEditing) {
      if (type === 'textarea') {
        return (
          <div className="relative w-full z-30">
            <textarea
              className={`w-full bg-amber-50 p-2 border-2 border-amber-400 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-amber-500 outline-none shadow-lg min-h-[90px] ${className}`}
              value={localVal}
              onChange={(e) => setLocalVal(e.target.value)}
              onBlur={handleCommit}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setLocalVal(cellValue);
                  setActiveCell(null);
                }
              }}
              autoFocus
            />
          </div>
        );
      }
      return (
        <input
          type={type}
          className={`w-full bg-amber-50 p-2 border-2 border-amber-400 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-amber-500 outline-none shadow-md ${className}`}
          value={localVal}
          onChange={(e) => setLocalVal(e.target.value)}
          onBlur={handleCommit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleCommit();
            } else if (e.key === 'Escape') {
              setLocalVal(cellValue);
              setActiveCell(null);
            }
          }}
          autoFocus
        />
      );
    }

    return (
      <div 
        onClick={() => {
          if (isInlineEditEnabled) {
            setActiveCell({ id: patient.id, field, value: cellValue });
          }
        }}
        className={`p-2 rounded-xl transition-all relative ${isInlineEditEnabled ? 'cursor-pointer hover:bg-emerald-50/50 hover:ring-2 hover:ring-emerald-400/20' : ''} ${isSaving ? 'opacity-50 animate-pulse' : ''} ${viewClassName}`}
      >
        {isSaving && (
          <div className="absolute right-2 top-2 w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        )}
        {cellValue ? (
          <span className="whitespace-pre-wrap">{cellValue}</span>
        ) : (
          <span className="text-slate-300 italic text-[10px] font-black uppercase">{placeholder}</span>
        )}
      </div>
    );
  };

  
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

      // Group patients by unique bed (CAMA) to prevent duplication, keeping only the most recent updated timestamp
      const map: Record<string, Patient[]> = {};
      data.forEach(p => {
        const bedVal = (p.bed || '').trim().toUpperCase();
        // If bed is empty or S/C, treat it as unique to avoid filtering out patients with unassigned beds
        const key = (bedVal && bedVal !== 'S/C') ? bedVal : `NO_BED_${p.id}`;
        if (!map[key]) map[key] = [];
        map[key].push(p);
      });

      const uniquePatients: Patient[] = [];
      const duplicateIdsToDelete: string[] = [];

      Object.values(map).forEach(group => {
        // Sort by updatedAt descending to preserve the most recently updated patient
        group.sort((a, b) => {
          const timeA = typeof a.updatedAt === 'number' ? a.updatedAt : (Date.parse(String(a.updatedAt)) || 0);
          const timeB = typeof b.updatedAt === 'number' ? b.updatedAt : (Date.parse(String(b.updatedAt)) || 0);
          return timeB - timeA;
        });
        uniquePatients.push(group[0]);

        // Handover legacy older duplicates to deletion queue
        for (let i = 1; i < group.length; i++) {
          duplicateIdsToDelete.push(group[i].id);
        }
      });

      // Clear duplicate entries from Cloud DB in the background
      duplicateIdsToDelete.forEach(async (id) => {
        try {
          await deleteDoc(doc(db, 'census', id));
          console.log(`Auto-removed duplicate patient record: ${id}`);
        } catch (e) {
          console.error("Failed to remove duplicate database document:", e);
        }
      });

      setPatients(uniquePatients);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'census');
    });
    return () => unsubscribe();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const docRef = doc(db, 'settings', 'department_titles');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Record<string, string>;
        setDepartmentTitles(prev => ({
          ...prev,
          ...data
        }));
      } else {
        setDoc(docRef, {
          'all': 'CENSO GENERAL DE PACIENTES',
          'URGENCIAS': 'CENSO DE URGENCIAS',
          'OBSERVACION URGENCIAS': 'CENSO DE OBSERVACION DE URGENCIAS',
          'HOSPITALIZACION': 'CENSO DE HOSPITALIZACION',
          'PARTOS': 'CENSO DE SALA DE PARTOS',
          'CIRUGIA': 'CENSO DE QUIRÓFANOS (CIRUGÍA)'
        }).catch(err => {
          console.error("Error initializing department titles in db:", err);
        });
      }
    }, (error) => {
      console.warn("Failed to subscribe component settings, fallback to defaults.", error);
    });
    return () => unsubscribe();
  }, [isAuthenticated]);

  useEffect(() => {
    setEditingTitleText(departmentTitles[filterSection] || '');
  }, [filterSection, departmentTitles]);

  const handleSaveCustomTitle = async () => {
    if (!editingTitleText.trim()) return;
    try {
      const docRef = doc(db, 'settings', 'department_titles');
      await setDoc(docRef, {
        [filterSection]: editingTitleText.trim()
      }, { merge: true });
      setDepartmentTitles(prev => ({
        ...prev,
        [filterSection]: editingTitleText.trim()
      }));
    } catch (error) {
      console.error("Error saving custom department title:", error);
    }
  };

  const [isSyncing, setIsSyncing] = useState(false);

  const handleGoogleLogin = async () => {
    if (loading) return;
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive');
    provider.addScope('https://www.googleapis.com/auth/spreadsheets');
    provider.addScope('https://www.googleapis.com/auth/documents');
    
    try {
      setLoading(true);
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        localStorage.setItem('google_access_token', credential.accessToken);
        setHasGoogleToken(true);
        // Retry fetching files
        await fetchDriveFiles(driveYear, driveMonth);
      } else {
        alert("No se recibió el token de acceso de Google. Por favor, intente de nuevo.");
      }
    } catch (err: any) {
      console.error("Google Login error inside CensusView:", err);
      if (err.code === 'auth/unauthorized-domain') {
        const currentDomain = window.location.hostname;
        alert(`⚠️ DOMINIO NO AUTORIZADO\n\nEl dominio "${currentDomain}" no está autorizado en tu consola de Firebase.\nSi eres Administrador, entra a tu Consola de Firebase > Authentication > Settings > Authorized Domains y añade este dominio.`);
      } else if (err.code === 'auth/cancelled-popup-request') {
        console.warn("Google Login popup request was cancelled or superseded in CensusView.");
      } else if (err.code === 'auth/popup-closed-by-user') {
        console.warn("User closed the Google login popup inside CensusView.");
      } else {
        alert("Error al iniciar sesión con Google: " + (err.message || String(err)));
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchDriveFiles = async (year: string, monthPrefix: string) => {
    const token = localStorage.getItem('google_access_token');
    if (!token) {
      setHasGoogleToken(false);
      setDriveFiles([]);
      setShowDriveFiles(true);
      return;
    }

    try {
      setLoading(true);
      const files = await GoogleDriveService.listMonthCensusFiles(year, monthPrefix);
      setDriveFiles(files || []);
      setHasGoogleToken(true);
      setShowDriveFiles(true);
    } catch (err: any) {
      if (err.message?.includes('token') || err.message?.includes('sesión de Google') || err.message?.includes('expired') || err.message?.includes('expired_credential')) {
        setHasGoogleToken(false);
      }
      alert(`Error al obtener archivos de Drive: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const parseTextToPatients = (text: string): Partial<Patient>[] => {
    const lines = text.split('\n');
    const tempPatients: Partial<Patient>[] = [];
    let currentPatient: Partial<Patient> | null = null;
    let lastField: 'diagnoses' | 'managementPlan' | 'paraclinicals' | 'pendientes' | 'name' | null = null;
    
    for (const rawLine of lines) {
      let line = rawLine.trim();
      if (!line) continue;
      
      const isSeparator = /^[=\-\*_#]+$/.test(line);
      if (isSeparator) continue;
      
      // Make parsing extremely robust by stripping common Google Doc / markdown formatting
      let cleanLine = line
        .replace(/\*\*/g, '')  // remove bold asterisks
        .replace(/\*/g, '')    // remove single asterisks
        .replace(/__/g, '')    // remove bold underscores
        .replace(/_/g, '')     // remove single underscores
        .trim();

      // Remove leading bullet/list markers
      cleanLine = cleanLine.replace(/^[\s\-●•➔➢+]+\s*/, '').trim();
      if (!cleanLine) continue;
      
      const camaMatch = cleanLine.match(/^(cama|camas|habitacion|habitación|bed|beds|hab)\s*[:\-\s]\s*(.+)$/i);
      if (camaMatch) {
        if (currentPatient && (currentPatient.name || currentPatient.bed)) {
          tempPatients.push(currentPatient);
        }
        currentPatient = {
          bed: camaMatch[2].trim(),
          name: '',
          diagnoses: '',
          managementPlan: '',
          paraclinicals: '',
          pendientes: '',
          age: '',
          eps: '',
          isRemitido: false,
          remitidoComment: '',
          specialty: 'MEDICINA INTERNA',
          section: 'HOSPITALIZACION',
        };
        lastField = null;
        continue;
      }
      
      if (currentPatient) {
        const nameMatch = cleanLine.match(/^(paciente|nombre|name|patient)\s*[:\-\s]\s*(.+)$/i);
        if (nameMatch) {
          const val = nameMatch[2].trim();
          const epsRegex = /(?:•?\s*EPS\s*:\s*(.+))/i;
          const epsMatch = val.match(epsRegex);
          let remaining = val;
          if (epsMatch) {
            currentPatient.eps = epsMatch[1].trim();
            remaining = val.replace(epsMatch[0], '').trim();
          }
          
          const ageRegex = /\(([^)]+)\)/;
          const ageMatch = remaining.match(ageRegex);
          if (ageMatch) {
            currentPatient.age = ageMatch[1].trim();
            currentPatient.name = remaining.replace(ageMatch[0], '').trim();
          } else {
            currentPatient.name = remaining;
          }
          lastField = 'name';
          continue;
        }

        const dateMatch = cleanLine.match(/^(fecha|entrydate|fecha_ingreso|date)\s*[:\-\s]\s*(.+)$/i);
        if (dateMatch) {
          currentPatient.entryDate = dateMatch[2].trim();
          lastField = null;
          continue;
        }
        
        const idxMatch = cleanLine.match(/^(diagnostico|diagnóstico|diagnosticos|diagnósticos|idx|diagnoses|dx|diagnostico\(s\))\s*[:\-\s]\s*(.+)$/i);
        if (idxMatch) {
          currentPatient.diagnoses = idxMatch[2].trim();
          lastField = 'diagnoses';
          continue;
        }
        
        const manejoMatch = cleanLine.match(/^(manejo|plan|tratamiento|management|plan de manejo)\s*[:\-\s]\s*(.+)$/i);
        if (manejoMatch) {
          currentPatient.managementPlan = manejoMatch[2].trim();
          lastField = 'managementPlan';
          continue;
        }

        const paracMatch = cleanLine.match(/^(paraclinicos|paraclínicos|paraclinicals|laboratorios|labs)\s*[:\-\s]\s*(.+)$/i);
        if (paracMatch) {
          currentPatient.paraclinicals = paracMatch[2].trim();
          lastField = 'paraclinicals';
          continue;
        }

        const pdteMatch = cleanLine.match(/^(pendiente|pendientes|pdte|pnd|pndtes)\s*[:\-\s]\s*(.+)$/i);
        if (pdteMatch) {
          currentPatient.pendientes = pdteMatch[2].trim();
          lastField = 'pendientes';
          continue;
        }

        const remitidoMatch = cleanLine.match(/^(remitido|es_remitido|is_remitido|isremitido)\s*[:\-\s]\s*(si|sí|true|yes|no|false)\s*$/i);
        if (remitidoMatch) {
          currentPatient.isRemitido = /^(si|sí|true|yes)$/i.test(remitidoMatch[2].trim());
          lastField = null;
          continue;
        }

        const commentMatch = cleanLine.match(/^(comentario|comentario_estado|comentario_remitido|remitido_comment|remitidocomment|estado)\s*[:\-\s]\s*(.+)$/i);
        if (commentMatch) {
          currentPatient.remitidoComment = commentMatch[2].trim();
          lastField = null;
          continue;
        }
        
        const espMatch = cleanLine.match(/^(especialidad|especialidades|servicio|specialty)\s*[:\-\s]\s*(.+)$/i);
        if (espMatch) {
          currentPatient.specialty = espMatch[2].trim();
          lastField = null;
          continue;
        }
        
        const seccMatch = cleanLine.match(/^(seccion|sección|ubicacion|ubicación|sala|section)\s*[:\-\s]\s*(.+)$/i);
        if (seccMatch) {
          currentPatient.section = seccMatch[2].trim().toUpperCase();
          lastField = null;
          continue;
        }

        const entregaMatch = cleanLine.match(/^(medico_entrega|médico_entrega|entrega|deliveredby)\s*[:\-\s]\s*(.+)$/i);
        if (entregaMatch) {
          currentPatient.deliveredBy = entregaMatch[2].trim();
          lastField = null;
          continue;
        }

        const recibeMatch = cleanLine.match(/^(medico_recibe|médico_recibe|recibe|receivedby)\s*[:\-\s]\s*(.+)$/i);
        if (recibeMatch) {
          currentPatient.receivedBy = recibeMatch[2].trim();
          lastField = null;
          continue;
        }

        const actPorMatch = cleanLine.match(/^(actualizado_por|actualizado|updatedby)\s*[:\-\s]\s*(.+)$/i);
        if (actPorMatch) {
          currentPatient.updatedBy = actPorMatch[2].trim();
          lastField = null;
          continue;
        }

        const actFecMatch = cleanLine.match(/^(fecha_actualizacion|fecha_actualización|updatedat)\s*[:\-\s]\s*(.+)$/i);
        if (actFecMatch) {
          const parsedTime = Date.parse(actFecMatch[2].trim());
          if (!isNaN(parsedTime)) {
            currentPatient.updatedAt = parsedTime;
          }
          lastField = null;
          continue;
        }
        
        // Multi-line continuation fallback
        if (lastField === 'diagnoses') {
          currentPatient.diagnoses += '\n' + cleanLine;
        } else if (lastField === 'managementPlan') {
          currentPatient.managementPlan += '\n' + cleanLine;
        } else if (lastField === 'paraclinicals') {
          currentPatient.paraclinicals += '\n' + cleanLine;
        } else if (lastField === 'pendientes') {
          currentPatient.pendientes += '\n' + cleanLine;
        } else if (!currentPatient.name) {
          currentPatient.name = cleanLine;
          lastField = 'name';
        } else if (!currentPatient.diagnoses) {
          currentPatient.diagnoses = cleanLine;
          lastField = 'diagnoses';
        } else {
          currentPatient.managementPlan += (currentPatient.managementPlan ? '\n' : '') + cleanLine;
          lastField = 'managementPlan';
        }
      } else {
        const csvParts = cleanLine.split(/[,\t;]+/);
        if (csvParts.length >= 2 && csvParts[0].trim().length <= 6 && /^\d+/.test(csvParts[0].trim())) {
          tempPatients.push({
            bed: csvParts[0].trim(),
            name: csvParts[1].trim(),
            section: 'HOSPITALIZACION',
            diagnoses: csvParts[2]?.trim() || '',
            managementPlan: csvParts[3]?.trim() || '',
            pendientes: csvParts[4]?.trim() || '',
            specialty: 'MEDICINA INTERNA'
          });
        }
      }
    }
    
    if (currentPatient && (currentPatient.name || currentPatient.bed)) {
      tempPatients.push(currentPatient);
    }
    
    return tempPatients;
  };

  const getDoctorFullLabel = (docName: string) => {
    if (!docName) return '';
    const match = doctors?.find(d => 
      d.nombre.toLowerCase().trim() === docName.toLowerCase().trim() || 
      `${d.nombre} ${d.apellidos || ''}`.toLowerCase().trim() === docName.toLowerCase().trim()
    );
    if (match) {
      const full = `${match.nombre} ${match.apellidos || ''}`.trim();
      return match.registroMedico ? `${full} - RM: ${match.registroMedico}` : full;
    }
    return docName;
  };

  const formatPatientsToPlainDocText = (patientsList: Patient[]): string => {
    let text = `==================================================================================================\n`;
    text += `                              CENSO HOSPITALARIO - ENTREGA DE TURNOS\n`;
    text += `==================================================================================================\n`;
    text += `Fecha de Reporte: ${new Date().toLocaleString('es-CO')}\n`;
    text += `Total de Pacientes: ${patientsList.length}\n`;
    text += `==================================================================================================\n\n`;

    patientsList.forEach((p, idx) => {
      text += `--------------------------------------------------------------------------------------------------\n`;
      text += `[ REGISTRO N° ${idx + 1} - ENTREGA DE TURNO ]\n`;
      text += `--------------------------------------------------------------------------------------------------\n`;
      text += `Cama: ${p.bed || 'S/C'}\n`;
      text += `Fecha: ${p.entryDate || ''}\n`;
      text += `Paciente: ${p.name || ''} (${p.age || ''}) • EPS: ${p.eps || ''}\n`;
      text += `Especialidad: ${p.specialty || ''}\n`;
      text += `Seccion: ${p.section || ''}\n`;
      text += `\n`;
      text += `Diagnostico:\n${p.diagnoses || ''}\n`;
      text += `\n`;
      text += `Manejo:\n${p.managementPlan || ''}\n`;
      text += `\n`;
      text += `Paraclinicos:\n${p.paraclinicals || 'SIN REGISTRO'}\n`;
      text += `\n`;
      text += `Pendiente:\n${p.pendientes || 'NINGUNO'}\n`;
      text += `\n`;
      text += `Remitido: ${p.isRemitido ? 'SI' : 'NO'}\n`;
      text += `Estado: ${p.remitidoComment || 'NINGUNO'}\n`;
      text += `Medico_Entrega: ${p.deliveredBy || ''}\n`;
      text += `Medico_Recibe: ${p.receivedBy || ''}\n`;
      text += `--------------------------------------------------------------------------------------------------\n\n`;
    });
    return text;
  };

  const handleImportLatestGoogleDoc = async () => {
    const token = localStorage.getItem('google_access_token');
    if (!token) {
      alert("Por favor vincule su cuenta de Google en el panel de 'Drive Censos' para buscar e importar automáticamente.");
      setShowDriveFiles(true);
      fetchDriveFiles(driveYear, driveMonth);
      return;
    }

    setIsImporting(true);
    try {
      let latestDoc = null;
      if (filterSection !== 'all') {
        const docInfo = await GoogleDriveService.getOrCreateLocationCensusFile(filterSection);
        latestDoc = { id: docInfo.id, name: docInfo.name };
      } else {
        latestDoc = await GoogleDriveService.getLatestCensusGoogleDoc();
      }

      if (!latestDoc) {
        alert("No se encontró ningún archivo de censo reciente en la carpeta de Google Drive. Se abrirá el listado manual para buscar en otros directorios.");
        setShowDriveFiles(true);
        fetchDriveFiles(driveYear, driveMonth);
        return;
      }

      const confirmImport = window.confirm(`Se encontró el archivo de Google Docs correspondiente para este departamento:\n\n"${latestDoc.name}"\n\n¿Desea importar y actualizar los pacientes del Censo con este documento?`);
      if (!confirmImport) {
        setIsImporting(false);
        return;
      }

      const text = await GoogleDriveService.getGoogleDocText(latestDoc.id);
      const parsedPatients = parseTextToPatients(text);
      if (parsedPatients.length === 0) {
        alert("No se pudieron extraer datos estructurados del documento más reciente. Formato esperado:\nCama: [Número]\nPaciente: [Nombre]\nDiagnósticos: [Texto]\nPlan: [Texto]");
        return;
      }

      let importedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      for (const p of parsedPatients) {
        if (!p.bed || !p.name) continue;

        const bed = String(p.bed).trim();
        const name = String(p.name).trim();
        const section = p.section || 'HOSPITALIZACION';
        const diagnoses = p.diagnoses || '';
        const managementPlan = p.managementPlan || '';
        const pendientes = p.pendientes || '';
        const specialty = p.specialty || 'MEDICINA INTERNA';
        const entrega = p.deliveredBy || '';
        const recibe = p.receivedBy || '';
        const age = p.age || '';
        const eps = p.eps || '';
        const paraclinicals = p.paraclinicals || '';
        const isRemitido = p.isRemitido || false;
        const remitidoComment = p.remitidoComment || '';
        const entryDate = p.entryDate || new Date().toISOString().split('T')[0];
        const actualizadoPor = p.updatedBy || currentUser?.nombre || 'Importación Google Docs';
        const updatedAt = p.updatedAt || Date.now();

        const existing = patients.find(pat => pat.bed === bed && (pat.section || 'HOSPITALIZACION').trim().toUpperCase() === (section || 'HOSPITALIZACION').trim().toUpperCase());

        if (existing) {
          const hasChanges = 
            (section !== existing.section) ||
            (diagnoses !== existing.diagnoses) ||
            (managementPlan !== existing.managementPlan) ||
            (pendientes !== existing.pendientes) ||
            (specialty !== existing.specialty) ||
            (entrega !== existing.deliveredBy) ||
            (recibe !== existing.receivedBy) ||
            (age !== existing.age) ||
            (eps !== existing.eps) ||
            (paraclinicals !== existing.paraclinicals) ||
            (isRemitido !== existing.isRemitido) ||
            (remitidoComment !== existing.remitidoComment);

          if (hasChanges || updatedAt > (existing.updatedAt || 0)) {
            await setDoc(doc(db, 'census', existing.id), {
              ...existing,
              section: section || existing.section,
              diagnoses: diagnoses || existing.diagnoses,
              managementPlan: managementPlan || existing.managementPlan,
              pendientes: pendientes || existing.pendientes,
              specialty: specialty || existing.specialty,
              deliveredBy: entrega || existing.deliveredBy || '',
              receivedBy: recibe || existing.receivedBy || '',
              age: age || existing.age || '',
              eps: eps || existing.eps || '',
              paraclinicals: paraclinicals || existing.paraclinicals || '',
              isRemitido: isRemitido !== undefined ? isRemitido : (existing.isRemitido || false),
              remitidoComment: remitidoComment || existing.remitidoComment || '',
              updatedAt: Date.now(),
              updatedBy: actualizadoPor
            });
            updatedCount++;
          } else {
            skippedCount++;
          }
        } else {
          await addDoc(collection(db, 'census'), {
            name,
            bed,
            section,
            diagnoses,
            managementPlan,
            pendientes,
            specialty,
            deliveredBy: entrega,
            receivedBy: recibe,
            entryDate,
            age,
            eps,
            paraclinicals,
            isRemitido,
            remitidoComment,
            updatedAt: Date.now(),
            updatedBy: actualizadoPor
          });
          importedCount++;
        }
      }

      alert(`Importación completada con éxito desde "${latestDoc.name}":\n- ${importedCount} nuevos pacientes creados\n- ${updatedCount} actualizados\n- ${skippedCount} omitidos por no presentar cambios.`);
    } catch (err: any) {
      if (err.message?.includes('token') || err.message?.includes('sesión de Google') || err.message?.includes('expired') || err.message?.includes('expired_credential')) {
        localStorage.removeItem('google_access_token');
        setHasGoogleToken(false);
      }
      alert(`Error al importar el último censo de Google Drive: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleOpenOnlineEditForActiveSection = async () => {
    const token = localStorage.getItem('google_access_token');
    if (!token) {
      alert("Por favor vincule su cuenta de Google primero.");
      setShowDriveFiles(true);
      return;
    }
    const section = filterSection === 'all' ? 'HOSPITALIZACION' : filterSection;
    setIsImporting(true);
    try {
      const docInfo = await GoogleDriveService.getOrCreateLocationCensusFile(section);
      setSelectedDriveFile({
        id: docInfo.id,
        name: docInfo.name,
        webViewLink: docInfo.webViewLink,
        mimeType: docInfo.mimeType
      });
      setShowDriveFiles(true);
    } catch (e: any) {
      alert("Error al abrir edición en línea: " + e.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportDriveSheet = async (fileId: string) => {
    if (!window.confirm("¿Importar pacientes desde este archivo? Sólo se agregarán o actualizarán pacientes (evitando duplicados basados en Cama y Paciente).")) return;
    
    setIsImporting(true);
    let tempDocId = '';
    try {
      let fileItem = driveFiles.find(f => f.id === fileId) || (selectedDriveFile?.id === fileId ? selectedDriveFile : null);
      if (!fileItem) {
        try {
          fileItem = await GoogleDriveService.getFileMetadata(fileId);
        } catch (e: any) {
          console.error("Error fetching file metadata from Google Drive:", e);
        }
      }
      const mimeType = fileItem?.mimeType || '';
      const isDocument = mimeType.includes('document') || mimeType.includes('word') || mimeType.includes('plain');
      
      let itemsToImport: any[] = [];
      
      if (isDocument) {
        let text = '';
        if (mimeType.includes('wordprocessingml.document')) {
          tempDocId = await GoogleDriveService.convertWordToGoogleDoc(fileId, fileItem?.name || 'Temp');
          text = await GoogleDriveService.getGoogleDocText(tempDocId);
        } else if (mimeType.includes('google-apps.document')) {
          text = await GoogleDriveService.getGoogleDocText(fileId);
        } else {
          text = await GoogleDriveService.getGoogleDocText(fileId);
        }
        
        const parsedPatients = parseTextToPatients(text);
        if (parsedPatients.length === 0) {
          alert("No se pudieron extraer datos estructurados del documento. Formato esperado:\nCama: [Número]\nPaciente: [Nombre]\nDiagnósticos: [Texto]\nPlan: [Texto]");
          return;
        }
        itemsToImport = parsedPatients.map(p => ([
          p.bed || '', 
          p.entryDate || '',
          p.name || '', 
          p.age || '',
          p.eps || '',
          p.section || 'HOSPITALIZACION', 
          p.diagnoses || '', 
          p.managementPlan || '', 
          p.paraclinicals || '',
          p.pendientes || '', 
          p.isRemitido ? 'SI' : 'NO',
          p.remitidoComment || '',
          p.specialty || '', 
          p.deliveredBy || '', 
          p.receivedBy || '', 
          p.updatedBy || '', 
          p.updatedAt ? new Date(p.updatedAt).toISOString() : ''
        ]));
      } else {
        const rows = await GoogleDriveService.getSheetValues(fileId, 'Sheet1!A2:Q');
        if (!rows || rows.length === 0) {
          alert("El archivo base está vacío o no tiene el formato correcto.");
          return;
        }
        itemsToImport = rows;
      }
      
      let importedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      for (const row of itemsToImport) {
        if (!row || row.length < 2) continue;
        const tempBed = row[0] ? String(row[0]).trim() : '';
        const tempName = (row.length >= 17 ? row[2] : row[1]) ? String(row.length >= 17 ? row[2] : row[1]).trim() : '';
        if (!tempBed && !tempName) continue; 
        
        let bed = '';
        let entryDate = '';
        let name = '';
        let age = '';
        let eps = '';
        let section = '';
        let diagnoses = '';
        let managementPlan = '';
        let paraclinicals = '';
        let pendientes = '';
        let isRemitido = false;
        let remitidoComment = '';
        let specialty = '';
        let entrega = '';
        let recibe = '';
        let actualizadoPor = '';
        let actualizadoStr = '';

        if (row.length >= 17) {
          bed = String(row[0]).trim();
          entryDate = row[1] ? String(row[1]).trim() : '';
          name = String(row[2]).trim();
          age = row[3] ? String(row[3]).trim() : '';
          eps = row[4] ? String(row[4]).trim() : '';
          section = row[5] ? String(row[5]).trim() : '';
          diagnoses = row[6] ? String(row[6]).trim() : '';
          managementPlan = row[7] ? String(row[7]).trim() : '';
          paraclinicals = row[8] ? String(row[8]).trim() : '';
          pendientes = row[9] ? String(row[9]).trim() : '';
          isRemitido = String(row[10]).trim().toUpperCase() === 'SI' || String(row[10]).trim().toLowerCase() === 'true';
          remitidoComment = row[11] ? String(row[11]).trim() : '';
          specialty = row[12] ? String(row[12]).trim() : '';
          entrega = row[13] ? String(row[13]).trim() : '';
          recibe = row[14] ? String(row[14]).trim() : '';
          actualizadoPor = row[15] ? String(row[15]).trim() : '';
          actualizadoStr = row[16] ? String(row[16]).trim() : '';
        } else {
          // Fallback legacy columns
          bed = String(row[0]).trim();
          name = String(row[1]).trim();
          section = row[2] ? String(row[2]).trim() : 'HOSPITALIZACION';
          diagnoses = row[3] ? String(row[3]).trim() : '';
          managementPlan = row[4] ? String(row[4]).trim() : '';
          pendientes = row[5] ? String(row[5]).trim() : '';
          specialty = row[6] ? String(row[6]).trim() : 'MEDICINA INTERNA';
          
          if (row.length >= 11) {
             entrega = row[7] ? String(row[7]).trim() : '';
             recibe = row[8] ? String(row[8]).trim() : '';
             actualizadoPor = row[9] ? String(row[9]).trim() : '';
             actualizadoStr = row[10] ? String(row[10]).trim() : '';
          } else if (row.length === 10) {
             entrega = row[7] ? String(row[7]).trim() : '';
             recibe = row[8] ? String(row[8]).trim() : '';
             actualizadoStr = row[9] ? String(row[9]).trim() : '';
          } else {
             entrega = row[7] ? String(row[7]).trim() : '';
             actualizadoStr = row[8] ? String(row[8]).trim() : '';
          }
        }
        
        const medico = actualizadoPor || entrega || recibe || currentUser?.nombre || 'Importación Drive';
        
        const existing = patients.find(p => p.bed === bed && (p.section || 'HOSPITALIZACION').trim().toUpperCase() === (section || 'HOSPITALIZACION').trim().toUpperCase());
        
        let sheetDate = 0;
        if (actualizadoStr) {
          const parsedParts = actualizadoStr.split(/[\s,/:-]+/);
          if (parsedParts.length >= 3) sheetDate = Date.parse(actualizadoStr) || Date.now();
        } else {
          sheetDate = Date.now();
        }

        if (existing) {
          const hasChanges = 
            (section && section !== existing.section) ||
            (diagnoses && diagnoses !== existing.diagnoses) ||
            (managementPlan && managementPlan !== existing.managementPlan) ||
            (pendientes && pendientes !== existing.pendientes) ||
            (specialty && specialty !== existing.specialty) ||
            (entrega && entrega !== existing.deliveredBy) ||
            (recibe && recibe !== existing.receivedBy) ||
            (age && age !== existing.age) ||
            (eps && eps !== existing.eps) ||
            (paraclinicals && paraclinicals !== existing.paraclinicals) ||
            (isRemitido !== existing.isRemitido) ||
            (remitidoComment && remitidoComment !== existing.remitidoComment);

          const isNewer = sheetDate > (existing.updatedAt || 0);

          if (hasChanges || isNewer) {
            await setDoc(doc(db, 'census', existing.id), {
              ...existing,
              section: section || existing.section,
              diagnoses: diagnoses || existing.diagnoses,
              managementPlan: managementPlan || existing.managementPlan,
              pendientes: pendientes || existing.pendientes,
              specialty: specialty || existing.specialty,
              deliveredBy: entrega || existing.deliveredBy || '',
              receivedBy: recibe || existing.receivedBy || '',
              age: age || existing.age || '',
              eps: eps || existing.eps || '',
              paraclinicals: paraclinicals || existing.paraclinicals || '',
              isRemitido: isRemitido !== undefined ? isRemitido : (existing.isRemitido || false),
              remitidoComment: remitidoComment || existing.remitidoComment || '',
              updatedAt: hasChanges ? Date.now() : sheetDate,
              updatedBy: medico
            });
            updatedCount++;
          } else {
             skippedCount++;
          }
        } else {
          await addDoc(collection(db, 'census'), {
            name: name,
            bed: bed,
            section: section || 'HOSPITALIZACION',
            diagnoses: diagnoses || '',
            managementPlan: managementPlan || '',
            pendientes: pendientes || '',
            specialty: specialty || 'MEDICINA INTERNA',
            deliveredBy: entrega || '',
            receivedBy: recibe || '',
            entryDate: entryDate || new Date().toISOString().split('T')[0],
            age: age || '',
            eps: eps || '',
            paraclinicals: paraclinicals || '',
            isRemitido: isRemitido || false,
            remitidoComment: remitidoComment || '',
            updatedAt: sheetDate,
            updatedBy: medico
          });
          importedCount++;
        }
      }
      
      alert(`Importación completada:\n- ${importedCount} nuevos creados\n- ${updatedCount} actualizados\n- ${skippedCount} omitidos (ya estaban actualizados).`);
      setShowDriveFiles(false);
    } catch (err: any) {
      if (err.message?.includes('token') || err.message?.includes('sesión de Google') || err.message?.includes('expired') || err.message?.includes('expired_credential')) {
        localStorage.removeItem('google_access_token');
        setHasGoogleToken(false);
      }
      alert(`Error de importación: ${err.message}`);
    } finally {
      setIsImporting(false);
      if (tempDocId) {
        await GoogleDriveService.deleteFile(tempDocId).catch(console.error);
      }
    }
  };

  const handleSyncToDrive = async (auto = false) => {
    try {
      if (!auto) setIsSyncing(true);
      setSyncStatus('Sincronizando');
      const now = new Date();
      const year = now.getFullYear().toString();
      const monthPrefix = (now.getMonth() + 1).toString().padStart(2, '0');
      const monthName = new Intl.DateTimeFormat('es', { month: 'long' }).format(now);
      const month = `${monthPrefix} - ${monthName.toUpperCase()}`; // e.g. "06 - JUNIO"
      const dayStr = now.getDate().toString().padStart(2, '0');
      
      const hour = now.getHours();
      let jornadaStr = "Mañana (7am-1pm)";
      if (hour >= 13 && hour < 19) jornadaStr = "Tarde (13:00 a 19:00 horas)";
      else if (hour >= 19 || hour < 7) jornadaStr = "Noche (7pm a 7am)";
      
      const folderId = await GoogleDriveService.getOrCreateDayJornadaFolder(year, month, dayStr, jornadaStr);
      
      const dateStr = now.toLocaleDateString().replace(/\//g, '-');
      const timeStr = `${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}`;
      
      // Fetch fresh data from DB to avoid stale state issues (because onSnapshot is async)
      const q = query(collection(db, 'census'));
      const snapshot = await getDocs(q);
      const freshPatients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Patient[];

      // Create matching Google Doc
      const docName = auto 
        ? `Censo_${year}_${monthPrefix}_${dayStr}_${timeStr.replace('-', '')}`
        : `CENSO_MANUAL_${filterSection === 'all' ? 'TOTAL' : filterSection.replace(/\//g, '-')}_${dateStr}_${timeStr}`;

      const docId = await GoogleDriveService.findOrCreateGoogleDoc(docName, folderId);
      const docText = formatPatientsToPlainDocText(freshPatients);
      await GoogleDriveService.updateGoogleDocText(docId, docText);
      
      setSyncStatus('Sincronizado');
      setShowSyncSuccessToast(true);
      setTimeout(() => setShowSyncSuccessToast(false), 3000);
      if (!auto) alert(`Sincronización exitosa con Drive (Documento Google Doc creado)`);
    } catch (err: any) {
      setSyncStatus('Error');
      if (err.message?.includes('token') || err.message?.includes('sesión de Google') || err.message?.includes('expired') || err.message?.includes('expired_credential')) {
        localStorage.removeItem('google_access_token');
        setHasGoogleToken(false);
      }
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
      const values = await GoogleDriveService.getSheetValues(spreadsheetId, 'Sheet1!A2:Q100');
      
      if (values.length === 0) {
         alert("No se encontraron datos en el archivo de Drive.");
         return;
      }

      const confirmImport = window.confirm(`Se importarán ${values.length} registros desde Drive. ¿Continuar?`);
      if (!confirmImport) return;

      // Logic to update Firestore
      for (const row of values) {
        if (!row || row.length < 2) continue;
        const tempBed = row[0] ? String(row[0]).trim() : '';
        const tempName = (row.length >= 17 ? row[2] : row[1]) ? String(row.length >= 17 ? row[2] : row[1]).trim() : '';
        if (!tempBed && !tempName) continue; 
        
        let bed = '';
        let entryDate = '';
        let name = '';
        let age = '';
        let eps = '';
        let section = '';
        let diagnoses = '';
        let managementPlan = '';
        let paraclinicals = '';
        let pendientes = '';
        let isRemitido = false;
        let remitidoComment = '';
        let specialty = '';
        let entrega = '';
        let recibe = '';
        let actualizadoPor = '';
        let actualizadoStr = '';

        if (row.length >= 17) {
          bed = String(row[0]).trim();
          entryDate = row[1] ? String(row[1]).trim() : '';
          name = String(row[2]).trim();
          age = row[3] ? String(row[3]).trim() : '';
          eps = row[4] ? String(row[4]).trim() : '';
          section = row[5] ? String(row[5]).trim() : '';
          diagnoses = row[6] ? String(row[6]).trim() : '';
          managementPlan = row[7] ? String(row[7]).trim() : '';
          paraclinicals = row[8] ? String(row[8]).trim() : '';
          pendientes = row[9] ? String(row[9]).trim() : '';
          isRemitido = String(row[10]).trim().toUpperCase() === 'SI' || String(row[10]).trim().toLowerCase() === 'true';
          remitidoComment = row[11] ? String(row[11]).trim() : '';
          specialty = row[12] ? String(row[12]).trim() : '';
          entrega = row[13] ? String(row[13]).trim() : '';
          recibe = row[14] ? String(row[14]).trim() : '';
          actualizadoPor = row[15] ? String(row[15]).trim() : '';
          actualizadoStr = row[16] ? String(row[16]).trim() : '';
        } else {
          // Fallback legacy columns
          bed = String(row[0]).trim();
          name = String(row[1]).trim();
          section = row[2] ? String(row[2]).trim() : 'HOSPITALIZACION';
          diagnoses = row[3] ? String(row[3]).trim() : '';
          managementPlan = row[4] ? String(row[4]).trim() : '';
          pendientes = row[5] ? String(row[5]).trim() : '';
          specialty = row[6] ? String(row[6]).trim() : 'MEDICINA INTERNA';
          
          if (row.length >= 11) {
             entrega = row[7] ? String(row[7]).trim() : '';
             recibe = row[8] ? String(row[8]).trim() : '';
             actualizadoPor = row[9] ? String(row[9]).trim() : '';
             actualizadoStr = row[10] ? String(row[10]).trim() : '';
          } else if (row.length === 10) {
             entrega = row[7] ? String(row[7]).trim() : '';
             recibe = row[8] ? String(row[8]).trim() : '';
             actualizadoStr = row[9] ? String(row[9]).trim() : '';
          } else {
             entrega = row[7] ? String(row[7]).trim() : '';
             actualizadoStr = row[8] ? String(row[8]).trim() : '';
          }
        }

        const existingPatient = patients.find(p => p.bed === bed && (p.section || 'HOSPITALIZACION').trim().toUpperCase() === (section || 'HOSPITALIZACION').trim().toUpperCase());
        const patientData = {
          bed,
          name,
          section: section || 'HOSPITALIZACION',
          diagnoses: diagnoses || '',
          managementPlan: managementPlan || '',
          pendientes: pendientes || '',
          specialty: specialty || 'MEDICINA INTERNA',
          entryDate: entryDate || new Date().toISOString().split('T')[0],
          age: age || '',
          eps: eps || '',
          paraclinicals: paraclinicals || '',
          isRemitido: isRemitido || false,
          remitidoComment: remitidoComment || '',
          deliveredBy: entrega || '',
          receivedBy: recibe || '',
          updatedBy: actualizadoPor || 'Importado de Drive',
          updatedAt: Date.now()
        };

        if (existingPatient) {
          await updateDoc(doc(db, 'census', existingPatient.id), patientData);
        } else {
          await addDoc(collection(db, 'census'), patientData);
        }
      }
      alert("Importación completada con éxito.");
    } catch (err: any) {
      if (err.message?.includes('token') || err.message?.includes('sesión de Google') || err.message?.includes('expired') || err.message?.includes('expired_credential')) {
        localStorage.removeItem('google_access_token');
        setHasGoogleToken(false);
      }
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
      
      const existingInBedVal = patients.find(p => (p.bed || '').trim().toUpperCase() === (formData.bed || '').trim().toUpperCase() && (p.section || 'HOSPITALIZACION').trim().toUpperCase() === (formData.section || 'HOSPITALIZACION').trim().toUpperCase());
      
      if (editingPatient) {
        await updateDoc(doc(db, 'census', editingPatient.id), data);
        triggerSinglePatientDriveDocSync(editingPatient, data);
      } else if (existingInBedVal) {
        await updateDoc(doc(db, 'census', existingInBedVal.id), data);
        triggerSinglePatientDriveDocSync(existingInBedVal, data);
      } else {
        const docRef = await addDoc(collection(db, 'census'), data);
        triggerSinglePatientDriveDocSync({ id: docRef.id, ...data } as Patient, {});
      }
      setIsAddingPatient(false);
      setEditingPatient(null);
      setFormData({ 
        section: SECTIONS[0], 
        isHighlight: false, 
        isRemitido: false,
        remitidoComment: '',
        entryDate: new Date().toISOString().split('T')[0],
        specialty: 'MEDICINA INTERNA',
        deliveredBy: '',
        receivedBy: ''
      });
      
      // Auto sync to Drive in background
      handleSyncToDrive(true);
    } catch (error) {
      console.error("Error saving patient:", error);
    }
  };

  const handleDeletePatient = async (id: string) => {
    setPatientToDelete(id);
  };

  const handlePrint = () => {
    try {
      const printableArea = document.getElementById("printable-census-area");
      if (!printableArea) {
        console.warn("Print target container #printable-census-area was not found in DOM.");
        window.print();
        return;
      }
      
      console.log("Triggering window.print() targeting #printable-census-area container specifically.");
      window.print();
    } catch (e) {
      console.error("Native printing specifically targeting #printable-census-area failed:", e);
    }
    // Automatically trigger visual hints if within a sandboxed iframe
    if (window.self !== window.top) {
      alert("💡 CONSEJO DE IMPRESIÓN:\n\nDebido a las políticas de seguridad de su previsualizador (iframe), es posible que la impresión nativa esté bloqueada.\n\nPara solucionar esto, por favor haga clic en el botón con flecha diagonal de la esquina superior derecha del previsualizador ('Abrir en pestaña nueva' / 'Open in new tab'), y presione 'Imprimir Censo' desde esa pestaña independiente.");
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
      const jornadaStr = handoverShift === 'm' ? 'Mañana (7am-1pm)' : handoverShift === 't' ? 'Tarde (13:00 a 19:00 horas)' : 'Noche (7pm a 7am)';
      
      const driveFileName = `ENTREGA_${filterSection === 'all' ? 'TOTAL' : filterSection.replace(/\//g, '-')}_${jornadaStr}_${day}-${monthPrefix}-${year}`;
      const timeStr = `${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}`;
      
      let driveLink = '';
      try {
        setIsSyncing(true);
        // Sync to Drive
        const folderId = await GoogleDriveService.getOrCreateDayJornadaFolder(year, month, day, jornadaStr);
        
        // Create Google Doc
        const docFileName = `${driveFileName}_${timeStr}`;
        const docId = await GoogleDriveService.findOrCreateGoogleDoc(docFileName, folderId);
        const docText = `==================================================\n` +
          `   ENTREGA DE TURNO [${jornadaStr.toUpperCase()}]\n` +
          `==================================================\n` +
          `Médico Entrega: ${handoverSender || 'N/A'}\n` +
          `Médico Recibe: ${handoverReceiver || 'N/A'}\n` +
          `Sección/Filtro: ${filterSection === 'all' ? 'CENSO TOTAL' : filterSection}\n` +
          `Fecha de Entrega: ${now.toLocaleString('es-CO')}\n` +
          `==================================================\n\n` +
          formatPatientsToPlainDocText(filteredPatients);
          
        await GoogleDriveService.updateGoogleDocText(docId, docText);
        driveLink = `https://docs.google.com/document/d/${docId}`;
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
      exportToExcel(`${driveFileName}_${timeStr}.xlsx`);
      
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
    <>
      <div className="flex flex-col h-full bg-slate-100 print:hidden">
      {/* Toast Notification */}
      <AnimatePresence>
        {showSyncSuccessToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-6 right-6 bg-slate-900 text-white px-5 py-4 rounded-3xl shadow-2xl border border-emerald-500/20 z-50 flex items-center gap-3"
          >
            <div className="p-2 bg-emerald-500 text-slate-900 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-emerald-950" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-emerald-400">Excelente</p>
              <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest mt-0.5">Sincronizado con Google Drive exitosamente.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic Header */}
      <div className="bg-emerald-800 text-white p-4 md:p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 -rotate-12 translate-x-20 -translate-y-20 rounded-full" />
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-black flex items-center gap-3 tracking-tighter">
              <ClipboardList className="w-8 h-8 text-emerald-300" /> CENSO HOSPITALARIO
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {syncStatus === 'Sincronizado' && (
                <span className="bg-emerald-600 text-white text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-widest border border-emerald-400/30 flex items-center gap-1.5 shadow-sm">
                  <span className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-ping"></span>
                  ● Sincronizado
                </span>
              )}
              {syncStatus === 'Sincronizando' && (
                <span className="bg-amber-600 text-white text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-widest border border-amber-400/30 flex items-center gap-1.5 shadow-sm">
                  <RefreshCcw className="w-2.5 h-2.5 animate-spin" />
                  Sincronizando...
                </span>
              )}
              {syncStatus === 'En espera' && (
                <span className="bg-amber-500 text-white text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-widest border border-amber-300/30 flex items-center gap-1.5 shadow-sm">
                  <span className="w-1.5 h-1.5 bg-amber-200 rounded-full"></span>
                  ● En espera
                </span>
              )}
              {syncStatus === 'Error' && (
                <span className="bg-red-600 text-white text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-widest border border-red-400/30 flex items-center gap-1.5 shadow-sm">
                  <span className="w-1.5 h-1.5 bg-red-200 rounded-full"></span>
                  ● Error de Sincronización
                </span>
              )}
              <span className="bg-emerald-950/40 text-emerald-100 text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-widest border border-white/5">
                {patients.length} Pacientes
              </span>
              <button 
                onClick={() => handleSyncToDrive(false)}
                disabled={syncStatus === 'Sincronizando'}
                className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border border-white/10 ml-2 disabled:opacity-50 active:scale-95 transition-all shadow-sm flex items-center gap-1"
                title="Sincronizar a drive manualmente"
              >
                <Cloud className="w-2.5 h-2.5" /> Forzar Sync Manual
              </button>
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
              onClick={() => {
                setFormData({ 
                  section: filterSection === 'all' ? SECTIONS[0] : filterSection, 
                  isHighlight: false, 
                  isRemitido: false,
                  remitidoComment: '',
                  entryDate: new Date().toISOString().split('T')[0],
                  specialty: 'MEDICINA INTERNA',
                  deliveredBy: '',
                  receivedBy: ''
                });
                setIsAddingPatient(true);
              }}
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
              onClick={handleImportLatestGoogleDoc}
              disabled={isImporting}
              className={`flex-1 md:flex-none bg-slate-800 text-white px-4 py-2.5 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-slate-700 transition-all shadow-lg ${isImporting ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Cargar el último Censo de Google Docs del día"
            >
              {isImporting ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4 text-sky-400" />} Importar Último Censo
            </button>
            <button 
              onClick={handleOpenOnlineEditForActiveSection}
              disabled={isImporting || isSyncing}
              className={`flex-1 md:flex-none bg-slate-800 text-white px-4 py-2.5 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-slate-700 transition-all shadow-lg`}
              title="Editar el censo de este departamento en línea usando Google Docs"
            >
              <Edit3 className="w-4 h-4 text-amber-400" /> Editar en Línea
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
              onClick={handlePrint}
              className="flex-1 md:flex-none bg-emerald-600 text-white px-4 py-2.5 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-emerald-500 transition-all shadow-lg active:scale-95"
            >
              <Printer className="w-4 h-4 text-white" /> Imprimir Censo
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

        {/* Department Title Control Widget */}
        <div className="mt-4 p-4 bg-emerald-950/30 rounded-2xl border border-emerald-700/30 relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
          <div className="flex-1">
            <span className="text-[9px] font-black uppercase text-emerald-300 tracking-wider block">Título del Componente para Reporte de Censo:</span>
            <input
              type="text"
              readOnly={!isAdmin}
              value={editingTitleText}
              onChange={(e) => setEditingTitleText(e.target.value)}
              className={`text-sm font-extrabold text-white bg-transparent border-b ${isAdmin ? 'border-emerald-500/50 focus:border-white' : 'border-transparent'} py-1 w-full outline-none transition-all placeholder-emerald-400/40`}
              placeholder="Escriba un título personalizado para este departamento (p.ej.: URGENCIAS)..."
            />
          </div>
          {isAdmin && (
            <button
              onClick={handleSaveCustomTitle}
              className="px-4 py-2 bg-emerald-400 hover:bg-emerald-300 active:scale-95 text-emerald-950 font-black text-[10px] uppercase rounded-xl transition-all shadow-md shrink-0 self-end sm:self-auto flex items-center gap-1.5"
            >
              Guardar Título
            </button>
          )}
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
                  className={`group bg-white rounded-3xl p-5 shadow-sm border-2 transition-all hover:shadow-xl hover:-translate-y-1 ${patient.isHighlight || patient.isRemitido ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-400/20 shadow-amber-900/5' : 'border-white hover:border-emerald-100'}`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner ${patient.isHighlight || patient.isRemitido ? 'bg-amber-400 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                        {patient.bed}
                      </div>
                      <div>
                        <h4 className="font-black text-slate-800 text-base leading-none mb-1">
                          {patient.name}
                          {patient.isRemitido && (
                            <span className="ml-2 inline-block bg-amber-200 text-amber-950 font-black text-[8px] uppercase tracking-wider px-2 py-0.5 rounded shadow-sm">
                              REMITIDO
                            </span>
                          )}
                        </h4>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">{patient.eps}</span>
                          <span className="text-[9px] font-mono text-slate-400">{patient.age} • Ingreso: {patient.entryDate}</span>
                        </div>
                      </div>
                    </div>
                    {(patient.isHighlight || patient.isRemitido) && (
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

                     {(patient.pendientes || patient.remitidoComment) && (
                       <div className={`p-3 rounded-2xl border ${patient.isHighlight || patient.isRemitido ? 'bg-amber-100 border-amber-300' : 'bg-slate-100 border-slate-200'}`}>
                         <div className={`text-[8px] font-black uppercase tracking-widest mb-1 ${patient.isHighlight || patient.isRemitido ? 'text-amber-700' : 'text-slate-500'}`}>
                           {patient.isRemitido ? 'Estado / Remisión & Pendientes' : 'Pendientes Críticos'}
                         </div>
                         {patient.pendientes && (
                           <p className={`text-xs font-black ${patient.isHighlight || patient.isRemitido ? 'text-amber-900 underline' : 'text-slate-700'}`}>{patient.pendientes}</p>
                         )}
                         {patient.remitidoComment && (
                           <div className="mt-1 bg-amber-200/50 border border-amber-300 text-amber-950 font-black text-[10px] p-2 rounded-lg uppercase">
                             📢 {patient.remitidoComment}
                           </div>
                         )}
                       </div>
                     )}
                  </div>

                  {/* Quick Actions Panel on Grid Cards */}
                  <div className="mt-4 pt-3 border-t border-dashed border-slate-100 text-left">
                    <div className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">Acciones Rápidas</div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Alert Toggle */}
                      <button
                        onClick={async () => {
                          const pRef = doc(db, 'census', patient.id);
                          const updateData = { isHighlight: !patient.isHighlight };
                          await updateDoc(pRef, updateData);
                          triggerSinglePatientDriveDocSync(patient, updateData);
                        }}
                        className={`px-2 py-1 rounded-lg text-[9px] font-black  uppercase tracking-tight flex items-center gap-1 transition-all ${
                          patient.isHighlight 
                            ? 'bg-amber-500 text-white shadow-sm scale-102 font-black' 
                            : 'bg-amber-105 text-amber-800 hover:bg-amber-100 border border-amber-200'
                        }`}
                        title="Configurar Alerta / Resaltar"
                      >
                        <AlertCircle className="w-2.5 h-2.5" />
                        {patient.isHighlight ? 'Con Alerta' : 'Alerta'}
                      </button>

                      {/* Add Note Button */}
                      <button
                        onClick={() => {
                          if (activeNoteInputId === patient.id) {
                            setActiveNoteInputId(null);
                          } else {
                            setActiveNoteInputId(patient.id);
                            setQuickNoteValue('');
                          }
                        }}
                        className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-tight flex items-center gap-1 transition-all ${
                          activeNoteInputId === patient.id
                            ? 'bg-sky-600 text-white shadow-md'
                            : 'bg-sky-55 text-sky-800 hover:bg-sky-100 border border-sky-200'
                        }`}
                        title="Agregar Nota / Pendiente"
                      >
                        <Plus className="w-2.5 h-2.5" />
                        +Nota
                      </button>

                      {/* Complete Tasks Button */}
                      <button
                        onClick={async () => {
                          const pRef = doc(db, 'census', patient.id);
                          const updateData = { pendientes: 'Ninguno' };
                          await updateDoc(pRef, updateData);
                          triggerSinglePatientDriveDocSync(patient, updateData);
                        }}
                        disabled={!patient.pendientes || patient.pendientes === 'Ninguno'}
                        className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-tight flex items-center gap-1 transition-all ${
                          !patient.pendientes || patient.pendientes === 'Ninguno'
                            ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border border-slate-200'
                            : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300'
                        }`}
                        title="Completar"
                      >
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Completar
                      </button>
                    </div>

                    {/* Inline note input inside Grid Card */}
                    {activeNoteInputId === patient.id && (
                      <div className="mt-2 flex gap-1.5 items-center animate-fadeIn">
                        <input
                          type="text"
                          placeholder="Escriba nota..."
                          value={quickNoteValue}
                          onChange={(e) => setQuickNoteValue(e.target.value)}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter') {
                              if (!quickNoteValue.trim()) return;
                              const pRef = doc(db, 'census', patient.id);
                              const currentPend = patient.pendientes && patient.pendientes !== 'Ninguno' ? patient.pendientes : '';
                              const newPend = currentPend ? `${currentPend}\n- ${quickNoteValue.trim()}` : `- ${quickNoteValue.trim()}`;
                              const updateData = { pendientes: newPend };
                              await updateDoc(pRef, updateData);
                              triggerSinglePatientDriveDocSync(patient, updateData);
                              setQuickNoteValue('');
                              setActiveNoteInputId(null);
                            }
                          }}
                          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-[10px] font-bold outline-none focus:ring-2 focus:ring-sky-500 w-full"
                          autoFocus
                        />
                        <button
                          onClick={async () => {
                            if (!quickNoteValue.trim()) return;
                            const pRef = doc(db, 'census', patient.id);
                            const currentPend = patient.pendientes && patient.pendientes !== 'Ninguno' ? patient.pendientes : '';
                            const newPend = currentPend ? `${currentPend}\n- ${quickNoteValue.trim()}` : `- ${quickNoteValue.trim()}`;
                            const updateData = { pendientes: newPend };
                            await updateDoc(pRef, updateData);
                            triggerSinglePatientDriveDocSync(patient, updateData);
                            setQuickNoteValue('');
                            setActiveNoteInputId(null);
                          }}
                          className="bg-sky-600 text-white rounded-xl px-2.5 py-1.5 hover:bg-sky-700 active:scale-95 transition-all font-black text-[10px]"
                        >
                          ✔
                        </button>
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
          /* Table View optimized for high-density census with real-time Excel-style inline editing */
          <div className="bg-white rounded-[32px] shadow-xl overflow-hidden border border-slate-200">
            {/* Inline edit option bar */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex flex-wrap justify-between items-center gap-4 no-print">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-slate-500">📝 Edición en Línea (Google Docs Style):</span>
                <button 
                  onClick={() => setIsInlineEditEnabled(!isInlineEditEnabled)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border ${isInlineEditEnabled ? 'bg-[#0f5132] text-white border-[#0f5132] shadow-sm' : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'}`}
                >
                  {isInlineEditEnabled ? 'Activado (Clic en Celda para Editar)' : 'Desactivado (Solo Lectura)'}
                </button>
              </div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white py-1 px-3 rounded-full border border-slate-200 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                Sincronización Automática con Drive & Nube
              </div>
            </div>

            <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
              <table className="w-full text-left border-collapse table-auto min-w-[1200px]">
                <thead>
                  <tr className="bg-slate-800 text-white uppercase text-[8px] font-black tracking-widest sticky top-0 z-20">
                    <th className="px-4 py-4 w-16 text-center">Cama</th>
                    <th className="px-4 py-4 w-28 text-center">Fecha</th>
                    <th className="px-4 py-4 w-52">Paciente / Edad / EPS</th>
                    <th className="px-4 py-4">Diagnóstico</th>
                    <th className="px-4 py-4">Manejo Plan de Tratamiento</th>
                    <th className="px-4 py-4">Resultados Paraclínicos</th>
                    <th className="px-4 py-4">Pendientes Críticos</th>
                    <th className="px-4 py-4 w-36 text-center">Especialidad</th>
                    <th className="px-4 py-4 w-60 sticky right-0 bg-slate-800 shadow-l shadow-slate-800 text-center">Rápidos / Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPatients.map(p => (
                    <tr key={p.id} className={`patient-row group hover:bg-emerald-50/50 transition-colors ${p.isHighlight || p.isRemitido ? 'bg-yellow-105' : ''}`}>
                      <td className="px-4 py-3 text-center bg-slate-50/50 group-hover:bg-emerald-100/30">
                        <InlineCell 
                          patient={p} 
                          field="bed" 
                          placeholder="Cama"
                          className="text-center font-black" 
                          viewClassName="text-center font-black text-emerald-700 text-xs" 
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <InlineCell 
                          patient={p} 
                          field="entryDate" 
                          type="date"
                          placeholder="Fecha"
                          className="text-center font-mono" 
                          viewClassName="text-center text-[10px] font-mono whitespace-nowrap min-w-[80px]" 
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 text-left">
                          <InlineCell 
                            patient={p} 
                            field="name" 
                            placeholder="Nombre Paciente"
                            viewClassName="font-extrabold text-xs text-slate-800 uppercase tracking-tight leading-none" 
                          />
                          <div className="flex flex-wrap items-center gap-1.5 text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                            <InlineCell 
                              patient={p} 
                              field="age" 
                              placeholder="Edad"
                              viewClassName="text-[9px] text-slate-500 font-black" 
                            />
                            <span>•</span>
                            <InlineCell 
                              patient={p} 
                              field="eps" 
                              placeholder="EPS"
                              viewClassName="text-[9px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100/50 font-black" 
                            />
                          </div>
                          {p.isRemitido && (
                            <span className="self-start mt-1.5 inline-block bg-amber-200 text-amber-950 font-black text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded">
                              Remitido
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <InlineCell 
                          patient={p} 
                          field="diagnoses" 
                          type="textarea"
                          placeholder="Diagnóstico..."
                          viewClassName="text-[10px] text-slate-600 leading-relaxed font-bold max-w-xs" 
                        />
                      </td>
                      <td className="px-4 py-3">
                        <InlineCell 
                          patient={p} 
                          field="managementPlan" 
                          type="textarea"
                          placeholder="Manejo plan..."
                          viewClassName="text-[10px] text-slate-600 italic whitespace-pre-wrap max-w-xs leading-relaxed" 
                        />
                      </td>
                      <td className="px-4 py-3">
                        <InlineCell 
                          patient={p} 
                          field="paraclinicals" 
                          type="textarea"
                          placeholder="Paraclínicos..."
                          viewClassName="text-[10px] text-blue-900 font-medium max-w-xs font-mono leading-tight" 
                        />
                      </td>
                      <td className="px-4 py-3 text-[10px] max-w-xs">
                        <InlineCell 
                          patient={p} 
                          field="pendientes" 
                          type="textarea"
                          placeholder="Pendientes..."
                          viewClassName={`font-bold text-[10px] leading-tight ${p.isHighlight || p.isRemitido ? 'text-amber-900 font-black underline' : 'text-slate-500'}`} 
                        />
                        {p.isHighlight || p.isRemitido ? (
                          <div className="mt-2 flex gap-1">
                            <button 
                              onClick={async () => {
                                const pRef = doc(db, 'census', p.id);
                                const updateData = { isHighlight: !p.isHighlight };
                                await updateDoc(pRef, updateData);
                                triggerSinglePatientDriveDocSync(p, updateData);
                              }}
                              className={`text-[8px] font-black rounded px-1.5 py-0.5 ${p.isHighlight ? 'bg-amber-500 text-white shadow-sm' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}
                            >
                              {p.isHighlight ? '⚙️ ALERTA ON' : '⚙️ ALERTA OFF'}
                            </button>
                            <button 
                              onClick={async () => {
                                const pRef = doc(db, 'census', p.id);
                                const updateData = { isRemitido: !p.isRemitido };
                                await updateDoc(pRef, updateData);
                                triggerSinglePatientDriveDocSync(p, updateData);
                              }}
                              className={`text-[8px] font-black rounded px-1.5 py-0.5 ${p.isRemitido ? 'bg-[#0f5132] text-white shadow-sm' : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'}`}
                            >
                              {p.isRemitido ? '🏥 REMITIDO' : '🏥 REMITIR'}
                            </button>
                          </div>
                        ) : (
                          <div className="mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                            <button 
                              onClick={async () => {
                                const pRef = doc(db, 'census', p.id);
                                const updateData = { isHighlight: true };
                                await updateDoc(pRef, updateData);
                                triggerSinglePatientDriveDocSync(p, updateData);
                              }}
                              className="text-[8px] font-black rounded px-1.5 py-0.5 bg-amber-100 text-amber-800 hover:bg-amber-200"
                            >
                              🔔 MARCAR ALERTA
                            </button>
                            <button 
                              onClick={async () => {
                                const pRef = doc(db, 'census', p.id);
                                const updateData = { isRemitido: true };
                                await updateDoc(pRef, updateData);
                                triggerSinglePatientDriveDocSync(p, updateData);
                              }}
                              className="text-[8px] font-black rounded px-1.5 py-0.5 bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                            >
                              🏥 MARCAR REMITIDO
                            </button>
                          </div>
                        )}
                        {p.isRemitido && (
                          <div className="mt-2">
                            <InlineCell 
                              patient={p} 
                              field="remitidoComment" 
                              placeholder="Falta comentar remisión..."
                              viewClassName="text-[8px] font-black uppercase bg-amber-100 border border-amber-200 px-2 py-1 rounded inline-block shadow-inner" 
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center w-36">
                        {activeCell?.id === p.id && activeCell?.field === 'specialty' ? (
                          <select
                            value={activeCell.value || ''}
                            onChange={async (e) => {
                              const val = e.target.value;
                              const pRef = doc(db, 'census', p.id);
                              const updateData = { 
                                specialty: val,
                                updatedAt: Date.now(),
                                updatedBy: currentUser?.nombre || 'SISTEMA'
                              };
                              await updateDoc(pRef, updateData);
                              triggerSinglePatientDriveDocSync(p, updateData);
                              setActiveCell(null);
                            }}
                            onBlur={() => setActiveCell(null)}
                            className="bg-amber-50 p-1.5 border-2 border-amber-400 rounded-xl text-[9px] font-black outline-none focus:ring-1 focus:ring-amber-500 w-full animate-fadeIn"
                            autoFocus
                          >
                            <option value="MEDICINA INTERNA">MEDICINA INTERNA</option>
                            <option value="PEDIATRIA">PEDIATRIA</option>
                            <option value="GINECOOBSTETRICIA">GINECOOBSTETRICIA</option>
                            <option value="CIRUGIA GENERAL">CIRUGIA GENERAL</option>
                            <option value="MEDICINA GENERAL">MEDICINA GENERAL</option>
                          </select>
                        ) : (
                          <div
                            onClick={() => setActiveCell({ id: p.id, field: 'specialty', value: p.specialty || '' })}
                            className="cursor-pointer font-black text-[9px] uppercase tracking-wider text-slate-800 inline-block"
                          >
                            <span className="bg-slate-100 p-1.5 rounded-lg border border-slate-200 hover:bg-white hover:ring-2 hover:ring-emerald-400/20 transition-all">{p.specialty || 'MEDICINA INTERNA'}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 sticky right-0 bg-white/90 group-hover:bg-emerald-50/90 shadow-l text-center min-w-[240px]">
                        <div className="flex flex-col gap-2 items-center justify-center">
                          <div className="flex justify-center gap-1.5">
                            {/* Configurar Alerta */}
                            <button
                              onClick={async () => {
                                const pRef = doc(db, 'census', p.id);
                                const updateData = { isHighlight: !p.isHighlight };
                                await updateDoc(pRef, updateData);
                                triggerSinglePatientDriveDocSync(p, updateData);
                              }}
                              className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-tight flex items-center gap-1 transition-all ${
                                p.isHighlight 
                                  ? 'bg-amber-500 text-white shadow-sm scale-102 font-black' 
                                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                              }`}
                              title="Configurar Alerta / Resaltar"
                            >
                              <AlertCircle className="w-2.5 h-2.5" />
                              {p.isHighlight ? 'Con Alerta' : 'Alerta'}
                            </button>

                            {/* Agregar Nota Rápida */}
                            <button
                              onClick={() => {
                                if (activeNoteInputId === p.id) {
                                  setActiveNoteInputId(null);
                                } else {
                                  setActiveNoteInputId(p.id);
                                  setQuickNoteValue('');
                                }
                              }}
                              className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-tight flex items-center gap-1 transition-all ${
                                activeNoteInputId === p.id
                                  ? 'bg-sky-600 text-white shadow-sm'
                                  : 'bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-200'
                              }`}
                              title="Agregar Nota o Pendiente"
                            >
                              <Plus className="w-2.5 h-2.5" />
                              +Nota
                            </button>

                            {/* Completar Tarea */}
                            <button
                              onClick={async () => {
                                const pRef = doc(db, 'census', p.id);
                                const updateData = { pendientes: 'Ninguno' };
                                await updateDoc(pRef, updateData);
                                triggerSinglePatientDriveDocSync(p, updateData);
                              }}
                              disabled={!p.pendientes || p.pendientes === 'Ninguno'}
                              className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-tight flex items-center gap-1 transition-all ${
                                !p.pendientes || p.pendientes === 'Ninguno'
                                  ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border border-slate-200'
                                  : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300'
                              }`}
                              title="Marcar Pendiente como Completado"
                            >
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              Completar
                            </button>
                          </div>

                          {/* Inline quick note input */}
                          {activeNoteInputId === p.id && (
                            <div className="flex gap-1 items-center animate-fadeIn w-full max-w-[200px]">
                              <input
                                type="text"
                                placeholder="Nota rápida..."
                                value={quickNoteValue}
                                onChange={(e) => setQuickNoteValue(e.target.value)}
                                onKeyDown={async (e) => {
                                  if (e.key === 'Enter') {
                                    if (!quickNoteValue.trim()) return;
                                    const pRef = doc(db, 'census', p.id);
                                    const currentPend = p.pendientes && p.pendientes !== 'Ninguno' ? p.pendientes : '';
                                    const newPend = currentPend ? `${currentPend}\n- ${quickNoteValue.trim()}` : `- ${quickNoteValue.trim()}`;
                                    const updateData = { pendientes: newPend };
                                    await updateDoc(pRef, updateData);
                                    triggerSinglePatientDriveDocSync(p, updateData);
                                    setQuickNoteValue('');
                                    setActiveNoteInputId(null);
                                  }
                                }}
                                className="bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-[9px] font-bold outline-none focus:ring-1 focus:ring-sky-500 w-full"
                                autoFocus
                              />
                              <button
                                onClick={async () => {
                                  if (!quickNoteValue.trim()) return;
                                  const pRef = doc(db, 'census', p.id);
                                  const currentPend = p.pendientes && p.pendientes !== 'Ninguno' ? p.pendientes : '';
                                  const newPend = currentPend ? `${currentPend}\n- ${quickNoteValue.trim()}` : `- ${quickNoteValue.trim()}`;
                                  const updateData = { pendientes: newPend };
                                  await updateDoc(pRef, updateData);
                                  triggerSinglePatientDriveDocSync(p, updateData);
                                  setQuickNoteValue('');
                                  setActiveNoteInputId(null);
                                }}
                                className="bg-sky-600 text-white rounded px-2 py-1 hover:bg-sky-700 active:scale-90 transition-all font-black text-[9px]"
                              >
                                ✔
                              </button>
                            </div>
                          )}

                          {/* Standard Edit/Delete Actions */}
                          <div className="flex justify-center gap-1.5 border-t border-slate-100 pt-1.5 w-full">
                            <button onClick={() => { setEditingPatient(p); setFormData(p); setIsAddingPatient(true); }} className="p-1.5 bg-slate-100 text-slate-500 hover:bg-[#0f5132] hover:text-white rounded-lg transition-transform hover:scale-110 active:scale-90" title="Editar en Ventana"><Edit3 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDeletePatient(p.id)} className="p-1.5 bg-slate-100 text-slate-400 hover:bg-rose-600 hover:text-white rounded-lg transition-transform hover:scale-110 active:scale-90" title="Eliminar Paciente"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-4 bg-amber-50 p-6 rounded-3xl border-2 border-amber-200 shadow-inner group">
                  <input 
                    type="checkbox" 
                    id="isRemitido" 
                    checked={formData.isRemitido || false}
                    onChange={(e) => setFormData({...formData, isRemitido: e.target.checked})}
                    className="w-8 h-8 accent-amber-500 cursor-pointer"
                  />
                  <label htmlFor="isRemitido" className="text-xs font-black text-amber-950 uppercase cursor-pointer select-none">
                    Marcar como Remitido (Fondo Amarillo)
                    <p className="text-[9px] font-bold text-amber-600/60 leading-none mt-0.5 tracking-tighter">MARCA EL PACIENTE COMO PROCESO DE REMISIÓN</p>
                  </label>
                </div>

                <div className="flex flex-col bg-slate-55 p-4 rounded-3xl border-2 border-slate-100 shadow-inner bg-slate-50">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Comentario de Estado / Remisión</label>
                  <input 
                    type="text"
                    className="w-full bg-white border-2 border-slate-100 p-3 rounded-xl font-bold text-slate-800 placeholder:font-normal placeholder:text-slate-400 outline-none focus:border-amber-400 transition-all text-xs"
                    value={formData.remitidoComment || ''}
                    onChange={(e) => setFormData({...formData, remitidoComment: e.target.value.toUpperCase()})}
                    placeholder="E.G. PDTE SALIDA, REMISIÓN, ETC."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-3 mb-1 block">Médico que Entrega (Firma)</label>
                  <input 
                    className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-bold text-slate-800 placeholder:text-slate-300 placeholder:font-normal" 
                    value={formData.deliveredBy || ''} 
                    onChange={(e) => setFormData({...formData, deliveredBy: e.target.value})} 
                    placeholder="Escriba nombre del médico saliente" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-3 mb-1 block">Médico que Recibe (Firma)</label>
                  <input 
                    className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-bold text-slate-800 placeholder:text-slate-300 placeholder:font-normal" 
                    value={formData.receivedBy || ''} 
                    onChange={(e) => setFormData({...formData, receivedBy: e.target.value})} 
                    placeholder="Escriba nombre del médico entrante" 
                  />
                </div>
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
                onClick={handlePrint}
                className="flex-1 bg-slate-800 text-white p-5 rounded-3xl font-black uppercase text-xs hover:bg-slate-700 active:scale-95 transition-all shadow-xl shadow-slate-800/20 flex justify-center items-center gap-2"
              >
                <Printer className="w-4 h-4 text-emerald-400" />
                Imprimir Reporte
              </button>
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

      {/* Delete Confirmation Modal */}
      {patientToDelete && (
        <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-md z-[300] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl border border-slate-100"
          >
            <div className="bg-rose-500 p-6 text-white flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-600 flex items-center justify-center text-white shadow-inner shrink-0">
                <Trash2 className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-tight leading-none mb-1">Confirmar Salida</h3>
                <p className="text-rose-100 text-[10px] font-bold uppercase tracking-wider">Alta / Egreso de Paciente</p>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-slate-600 text-xs font-semibold leading-relaxed">
                ¿Está completamente seguro de que desea confirmar la salida de este paciente? Esto eliminará de forma permanente al paciente del censo activo actual.
              </p>
              
              <div className="flex gap-3 pt-2">
                <button
                  onClick={async () => {
                    const id = patientToDelete;
                    setPatientToDelete(null);
                    try {
                      await deleteDoc(doc(db, 'census', id));
                      // Auto sync to Drive in background if we have token
                      if (localStorage.getItem('google_access_token')) {
                        handleSyncToDrive(true);
                      }
                    } catch (e: any) {
                      console.error("Error deleting patient:", e);
                      alert("Error al dar de alta al paciente: " + e.message);
                    }
                  }}
                  className="flex-1 bg-rose-600 text-white p-4 rounded-2xl font-black uppercase text-[10px] hover:bg-rose-700 active:scale-95 transition-all shadow-lg shadow-rose-600/20 cursor-pointer"
                >
                  Confirmar Alta
                </button>
                <button
                  onClick={() => setPatientToDelete(null)}
                  className="flex-1 bg-slate-100 text-slate-500 p-4 rounded-2xl font-black uppercase text-[10px] hover:bg-slate-200 transition-all active:scale-95 border border-slate-200 cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
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
            className={`bg-white w-full ${selectedDriveFile ? 'max-w-6xl' : 'max-w-lg'} rounded-[40px] overflow-hidden shadow-2xl ring-1 ring-white/20 transition-all`}
          >
            <div className="bg-amber-600 p-8 text-white relative">
              <div className="relative z-10 flex justify-between items-center text-center w-full">
                <div className="flex-1 text-left">
                   <h3 className="text-2xl font-black uppercase tracking-tight leading-none mb-1 flex items-center gap-3">
                     <FileSpreadsheet className="w-6 h-6" /> Archivos de Drive
                   </h3>
                   <p className="text-amber-100 text-xs font-bold uppercase tracking-widest">Entregas y Censos Recientes</p>
                </div>
                <button onClick={() => { setShowDriveFiles(false); setSelectedDriveFile(null); }} className="bg-amber-800/50 p-2 rounded-xl border border-white/20 hover:bg-amber-900 transition-all">✕</button>
              </div>
            </div>
            
            {!hasGoogleToken ? (
              <div className="p-8 text-center space-y-6 flex flex-col items-center justify-center min-h-[350px]">
                <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 mb-2 shadow-inner">
                  <Cloud className="w-8 h-8 animate-pulse" />
                </div>
                <div className="space-y-2">
                  <h4 className="font-black text-slate-800 text-lg uppercase tracking-tight">Vinculación de Google Requerida</h4>
                  <p className="text-slate-500 text-xs max-w-sm mx-auto leading-relaxed">
                    Para poder buscar, importar, editar en línea y sincronizar de manera bidireccional los censos o entregas en Google Drive, debe vincular su cuenta de Google.
                  </p>
                </div>
                <button
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full max-w-xs bg-amber-500 text-white p-4 rounded-2xl font-black text-xs uppercase hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 cursor-pointer"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5 bg-white p-0.5 rounded-full" alt="Google" />
                  {loading ? 'CONECTANDO...' : 'VINCULAR CUENTA DE GOOGLE'}
                </button>
              </div>
            ) : selectedDriveFile ? (
              <div className="flex flex-col lg:flex-row h-[75vh]">
                {/* Left side: Live Editor inside visual iframe */}
                <div className="flex-1 border-r border-slate-200 relative flex flex-col">
                  <div className="bg-slate-100 p-4 border-b border-slate-200 flex justify-between items-center">
                    <span className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Edición en Línea (Google Drive)
                    </span>
                    <a 
                      href={selectedDriveFile.webViewLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[10px] uppercase font-black text-amber-600 hover:underline"
                    >
                      Ver en Drive Completo ↗
                    </a>
                  </div>
                  <div className="flex-1 bg-slate-50 relative flex justify-center items-center">
                    {!iframeLoaded && (
                      <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-10 flex flex-col justify-center items-center gap-3">
                        <div className="w-8 h-8 rounded-full border-4 border-amber-200 border-t-amber-600 animate-spin"></div>
                        <p className="text-[10px] font-black uppercase text-slate-400">Abriendo documento de Google...</p>
                      </div>
                    )}
                    <iframe 
                      src={selectedDriveFile.mimeType?.includes('spreadsheet') 
                        ? `https://docs.google.com/spreadsheets/d/${selectedDriveFile.id}/edit`
                        : `https://docs.google.com/document/d/${selectedDriveFile.id}/edit`} 
                      className="w-full h-full border-0" 
                      onLoad={() => setIframeLoaded(true)}
                    />
                  </div>
                </div>

                {/* Right side: Synchronizer Panel */}
                <div className="w-full lg:w-96 bg-slate-50 p-6 flex flex-col justify-between overflow-y-auto">
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-black text-xs uppercase tracking-wider text-slate-400 mb-2">Archivo Abierto</h4>
                      <p className="font-black text-slate-800 text-sm break-all leading-tight">{selectedDriveFile.name}</p>
                      <span className="text-[10px] text-slate-500 font-mono mt-1 uppercase bg-slate-200 px-2 py-1 rounded-lg inline-block">
                        Formato: {selectedDriveFile.mimeType?.includes('document') ? 'Google Doc' : 'Google Sheet'}
                      </span>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                      <h5 className="font-black text-xs uppercase text-slate-700 flex items-center gap-2">
                        <Cloud className="w-4 h-4 text-emerald-600" /> Sincronizador Bidireccional
                      </h5>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Los cambios guardados en Google Drive se reflejarán aquí al pulsar 'Importar'. O puedes sobrescribir el archivo en Drive con los pacientes de la App.
                      </p>

                      <button
                        onClick={async () => {
                          try {
                            setIsImporting(true);
                            await handleImportDriveSheet(selectedDriveFile.id);
                          } catch (err: any) {
                            alert(`Error de sincronización hacia la App: ${err.message}`);
                          } finally {
                            setIsImporting(false);
                          }
                        }}
                        disabled={isImporting}
                        className="w-full bg-amber-600 text-white font-black text-xs uppercase p-4 rounded-2xl hover:bg-amber-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-600/10 active:scale-95 disabled:opacity-50"
                      >
                        <CloudDownload className="w-4 h-4" />
                        {isImporting ? 'Importando...' : '📥 Importar Cambios de Drive'}
                      </button>

                      <button
                        onClick={async () => {
                          try {
                            setIsSyncing(true);
                            const isSheet = selectedDriveFile.mimeType?.includes('spreadsheet');
                            
                            const q = query(collection(db, 'census'));
                            const snapshot = await getDocs(q);
                            const freshPatients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Patient[];

                            if (isSheet) {
                              const values = [
                                ['CAMA', 'FECHA_INGRESO', 'PACIENTE', 'EDAD', 'EPS', 'SECCION', 'DIAGNOSTICO', 'MANEJO', 'PARACLINICOS', 'PENDIENTE', 'REMITIDO', 'ESTADO_REMITIDO', 'ESPECIALIDAD', 'MEDICO_ENTREGA', 'MEDICO_RECIBE', 'ACTUALIZADO_POR', 'FECHA_ACTUALIZACION'],
                                ...freshPatients.map(p => [
                                  p.bed || 'S/C', 
                                  p.entryDate || '', 
                                  p.name || '', 
                                  p.age || '', 
                                  p.eps || '', 
                                  p.section || 'HOSPITALIZACION', 
                                  p.diagnoses || '', 
                                  p.managementPlan || '', 
                                  p.paraclinicals || '', 
                                  p.pendientes || '', 
                                  p.isRemitido ? 'SI' : 'NO', 
                                  p.remitidoComment || '', 
                                  p.specialty || '', 
                                  p.deliveredBy || '', 
                                  p.receivedBy || '', 
                                  p.updatedBy || '', 
                                  new Date(p.updatedAt || Date.now()).toISOString()
                                ]).sort((a,b) => String(a[0]).localeCompare(String(b[0])))
                              ];
                              await GoogleDriveService.updateSheetValues(selectedDriveFile.id, 'Sheet1!A1', values);
                            } else {
                              const docText = formatPatientsToPlainDocText(freshPatients);
                              await GoogleDriveService.updateGoogleDocText(selectedDriveFile.id, docText);
                            }
                            
                            alert("Sincronización exitosa. El archivo en Drive ha sido actualizado con los datos actuales de la App.");
                          } catch (err: any) {
                            alert(`Error al guardar en Drive: ${err.message}`);
                          } finally {
                            setIsSyncing(false);
                          }
                        }}
                        disabled={isSyncing}
                        className="w-full bg-slate-800 text-white font-black text-xs uppercase p-4 rounded-2xl hover:bg-slate-900 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-800/10 active:scale-95 disabled:opacity-50"
                      >
                        {isSyncing ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                          <Cloud className="w-4 h-4" />
                        )}
                        <span>📤 Guardar Censo en Drive</span>
                      </button>
                    </div>

                    {selectedDriveFile.mimeType?.includes('document') && (
                      <div className="bg-amber-50/50 border border-amber-200/50 p-4 rounded-2xl text-[10px] text-amber-800 leading-normal font-bold uppercase">
                        📌 Nota de Formato de Documento:<br/>
                        Para agregar un paciente, siga el siguiente formato:<br/>
                        <span className="font-mono text-slate-700 font-normal normal-case block mt-2 whitespace-pre leading-tight">
                          Cama: 101<br/>
                          Paciente: JUAN PEREZ<br/>
                          Sección: Hospitalizacion<br/>
                          Especialidad: MEDICINA INTERNA<br/>
                          Diagnósticos: DIAGNOSTICO DE PRUEBA<br/>
                          Manejo: PLAN DE PRUEBA
                        </span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setSelectedDriveFile(null);
                      setIframeLoaded(false);
                    }}
                    className="w-full mt-6 bg-slate-200 hover:bg-slate-300 text-slate-700 font-black text-xs uppercase p-4 rounded-2xl transition-all"
                  >
                    ← Volver a Lista de Archivos
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="p-8 space-y-4 max-h-[50vh] overflow-y-auto custom-scrollbar bg-slate-50">
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
                      <p className="text-slate-400 font-bold uppercase text-xs">No se encontraron archivos en este mes.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {driveFiles.map(file => (
                        <div key={file.id} className="bg-white border-2 border-slate-100 p-4 rounded-3xl flex flex-col gap-3 shadow-sm hover:border-amber-400 hover:shadow-md transition-all">
                          <div>
                            <p className="font-black text-slate-800 text-sm break-all">{file.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">Modificado: {file.createdTime ? new Date(file.createdTime).toLocaleString() : 'N/A'}</p>
                            <span className="text-[9px] uppercase font-black tracking-wider text-slate-400 font-mono mt-1 block">
                              Mime: {file.mimeType?.includes('document') ? 'Google Doc' : 'Google Sheet'}
                            </span>
                          </div>
                          <div className="flex gap-2 w-full">
                            <button 
                              onClick={() => {
                                setSelectedDriveFile(file);
                                setIframeLoaded(false);
                              }}
                              className="flex-1 bg-amber-500 text-white font-black text-[10px] uppercase p-3 rounded-2xl hover:bg-amber-600 transition-all shadow-md shadow-amber-500/10 active:scale-95"
                            >
                              Editar en Línea
                            </button>
                            <button 
                              onClick={() => window.open(file.webViewLink, '_blank')}
                              className="bg-slate-100 text-slate-600 font-bold text-[10px] uppercase p-2 rounded-xl border border-slate-200 hover:bg-slate-200 active:scale-95 transition-all text-center flex items-center justify-center"
                            >
                              Abrir
                            </button>
                            <button 
                              onClick={() => handleImportDriveSheet(file.id)}
                              disabled={isImporting}
                              className="bg-emerald-50 text-emerald-700 font-bold text-[10px] uppercase p-2 rounded-xl hover:bg-emerald-100 active:scale-95 disabled:opacity-50 transition-all text-center flex items-center justify-center"
                            >
                              {isImporting ? '...' : '📥 Importar'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-200">
                   <button 
                    onClick={async () => {
                      const rootId = await GoogleDriveService.getRootFolderId();
                      window.open(`https://drive.google.com/drive/folders/${rootId}?usp=drive_link`, '_blank');
                    }}
                    className="w-full bg-slate-200 text-slate-600 hover:bg-slate-300 p-4 rounded-2xl font-black text-xs uppercase transition-all"
                   >
                     Abrir Google Drive Completo
                   </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>

    {/* PRINT VIEW SECTION - DESIGNED EXACTLY AS HOSPITAL CENSUS GRID */}
    <div id="printable-census-area" className="hidden print:block w-full bg-white text-black p-4">
      {/* Printable Census Header */}
      <div className="flex justify-between items-center border-b-4 border-double border-slate-900 pb-4 mb-6">
        <div className="flex items-center gap-4">
          <HospitalLogo className="w-16 h-20 shrink-0 text-[#0f5132]" />
          <div>
            <h1 className="text-xl font-extrabold uppercase tracking-tight text-slate-950">
              {departmentTitles[filterSection] ? departmentTitles[filterSection].toUpperCase() : (filterSection === 'all' ? 'CENSO GENERAL DE PACIENTES' : `CENSO DE ${filterSection}`)}
            </h1>
            <p className="text-[10px] font-black text-[#0f5132] uppercase tracking-wide">
              HOSPITAL DEPARTAMENTAL SAN ANTONIO - ROLDANILLO E.S.E.
            </p>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
              IPS DE MEDIANA COMPLEJIDAD • SERVIR CON EXCELENCIA
            </p>
          </div>
        </div>
        <div className="text-right text-[10px] font-semibold leading-relaxed">
          <p className="font-extrabold text-[12px] text-slate-900">Fecha Impresión: {new Date().toLocaleDateString('es-CO')} {new Date().toLocaleTimeString('es-CO')}</p>
          <p className="font-bold text-[#0f5132] bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-100 mt-1 uppercase inline-block">
            {filterSection === 'all' ? 'CENSO GENERAL' : `ÁREA: ${filterSection}`}
          </p>
          {handoverSender && (
            <p className="font-bold text-slate-800 mt-1 whitespace-pre-wrap max-w-xs break-words ml-auto leading-tight">
              Entrega: {getDoctorFullLabel(handoverSender)} {handoverReceiver && `\nRecibe: ${getDoctorFullLabel(handoverReceiver)}`}
            </p>
          )}
        </div>
      </div>

      {/* Printable high-density grid matching requested style */}
      <table className="w-full text-left border-collapse table-fixed text-[10px] border-2 border-slate-900">
        <thead>
          <tr className="bg-slate-100 text-[8px] font-black uppercase tracking-wider text-slate-900 border-b-2 border-slate-900">
            <th className="px-2 py-3 border border-slate-400 w-[6%] text-center shrink-0">CAMA</th>
            <th className="px-2 py-3 border border-slate-400 w-[9%] text-center">FECHA</th>
            <th className="px-3 py-3 border border-slate-400 w-[18%]">NOMBRE</th>
            <th className="px-3 py-3 border border-slate-400 w-[20%]">DIAGNOSTICO</th>
            <th className="px-3 py-3 border border-slate-400 w-[18%]">MANEJO</th>
            <th className="px-3 py-3 border border-slate-400 w-[12%]">PARACLINICOS</th>
            <th className="px-3 py-3 border border-slate-400 w-[17%]">PENDIENTE</th>
            <th className="px-2 py-3 border border-slate-400 w-[10%] text-center">ESPECIALIDAD</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-400">
          {(() => {
            // Deduplicate filteredPatients by CAMA (bed ID) keeping only the most recent updated timestamp (updatedAt)
            const printableMap: Record<string, Patient> = {};
            filteredPatients.forEach(p => {
              const bedKey = (p.bed || '').trim().toUpperCase();
              if (bedKey && bedKey !== 'S/C') {
                const existing = printableMap[bedKey];
                if (!existing) {
                  printableMap[bedKey] = p;
                } else {
                  const timeA = typeof p.updatedAt === 'number' ? p.updatedAt : (Date.parse(String(p.updatedAt)) || 0);
                  const timeB = typeof existing.updatedAt === 'number' ? existing.updatedAt : (Date.parse(String(existing.updatedAt)) || 0);
                  if (timeA > timeB) {
                    printableMap[bedKey] = p;
                  }
                }
              }
            });

            const uniquePrintablePatients = filteredPatients.filter(p => {
              const bedKey = (p.bed || '').trim().toUpperCase();
              if (!bedKey || bedKey === 'S/C') return true;
              return printableMap[bedKey].id === p.id;
            });

            return uniquePrintablePatients.map(p => {
              const isRowYellow = p.isHighlight || p.isRemitido;
              return (
                <tr key={p.id} className={`patient-row align-top ${isRowYellow ? 'bg-yellow-105 print:bg-yellow-101' : ''}`}>
                  <td className="px-2 py-3 border border-slate-400 text-center font-black text-xs">{p.bed || 'S/C'}</td>
                  <td className="px-2 py-3 border border-slate-400 text-center text-[9px] font-mono whitespace-nowrap">{p.entryDate || ''}</td>
                  <td className="px-3 py-3 border border-slate-400 font-black leading-tight text-slate-900">
                    <p className="text-[10px]">{p.name || ''}</p>
                    <p className="text-[8px] font-bold text-slate-500 mt-1 uppercase tracking-tight">{p.age || 'S/E'} • {p.eps || 'S/A'}</p>
                  </td>
                  <td className="px-3 py-3 border border-slate-400 font-bold leading-normal text-[10px] whitespace-pre-wrap">{p.diagnoses || ''}</td>
                  <td className="px-3 py-3 border border-slate-400 italic text-[9.5px] leading-relaxed whitespace-pre-wrap">{p.managementPlan || ''}</td>
                  <td className="px-3 py-3 border border-slate-400 leading-normal text-[9.5px] font-mono whitespace-pre-wrap">{p.paraclinicals || '-'}</td>
                  <td className="px-3 py-3 border border-slate-400 font-extrabold text-[10px]">
                    {p.isRemitido && (
                      <div className="bg-yellow-200 border border-yellow-400 text-yellow-950 text-[8px] font-black uppercase px-2 py-0.5 rounded mb-1.5 text-center font-mono animate-none">
                        ⚠️ REMISION
                      </div>
                    )}
                    <div className="leading-snug">{p.pendientes || 'Ninguno'}</div>
                    {p.remitidoComment && (
                      <div className="text-[8px] font-black text-blue-900 border-t border-slate-400 pt-1 mt-1.5 bg-amber-200/40 p-1 rounded">
                        ESTADO: {p.remitidoComment}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-3 border border-slate-400 text-center font-black text-[9px] text-slate-800 tracking-tight">{p.specialty || ''}</td>
                </tr>
              );
            });
          })()}
        </tbody>
      </table>

      {/* Signatures block for clinical handover authenticity */}
      {handoverSender && (
        <div className="mt-12 pt-8 border-t border-slate-300 page-break-inside-avoid">
          <div className="grid grid-cols-2 gap-12 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="h-16 border-b border-dashed border-slate-400 mb-2"></div>
              <p className="text-[10px] font-black uppercase text-slate-800">Firma Médico Entrega</p>
              <p className="text-[9px] font-bold text-slate-500 mt-1">{getDoctorFullLabel(handoverSender)}</p>
            </div>
            {handoverReceiver && (
              <div className="text-center">
                <div className="h-16 border-b border-dashed border-slate-400 mb-2"></div>
                <p className="text-[10px] font-black uppercase text-slate-800">Firma Médico Recibe</p>
                <p className="text-[9px] font-bold text-slate-500 mt-1">{getDoctorFullLabel(handoverReceiver)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Professional's Footer with Name and License / Registration */}
      {currentUser && (
        <div className="mt-12 pt-6 border-t-2 border-slate-900 flex justify-between items-start text-[9.5px] text-slate-700 page-break-inside-avoid">
          <div>
            <p className="font-extrabold uppercase text-slate-900 tracking-tight">VALIDACIÓN DE DOCUMENTO CLÍNICO</p>
            <p className="mt-0.5 text-[8.5px] font-medium leading-snug">
              Este censo fue generado de manera segura y autenticado digitalmente.
              <br />
              Hospital Departamental San Antonio - Roldanillo E.S.E. • IPS de Mediana Complejidad
            </p>
          </div>
          <div className="text-right leading-relaxed shrink-0">
            <p className="font-extrabold uppercase text-slate-900">PROFESIONAL RESPONSABLE:</p>
            <p className="font-black text-[#0f5132] uppercase text-[10px]">
              {currentUser.nombre} {currentUser.apellidos || ''}
            </p>
            {currentUser.registroMedico && (
              <p className="font-bold text-slate-600">
                Registro/Licencia Médica N°: {currentUser.registroMedico}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
    </>
  );
}
