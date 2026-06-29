import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  FileDown, 
  FileSpreadsheet, 
  BrainCircuit, 
  Sparkles, 
  Save, 
  Info,
  CheckCircle,
  Database,
  Users as UsersIcon,
  Clock,
  AlertTriangle,
  Activity
} from 'lucide-react';
import { AIEngineSettings, SlotType, VarSlotConfig, Doctor, RuralAvailability } from '../types';
import * as XLSX from 'xlsx';
import { doc, getDoc, setDoc, collection } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

interface AdminToolboxProps {
  onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
  variables: VarSlotConfig;
  doctors: Doctor[];
  onGenerateProposal: (settings: AIEngineSettings) => Promise<void>;
  isGenerating: boolean;
  selectedMonth: number;
  selectedYear: number;
  ruralAvailabilities: RuralAvailability[];
}

export const AdminToolbox: React.FC<AdminToolboxProps> = ({ 
  onNotify, 
  variables, 
  doctors, 
  onGenerateProposal, 
  isGenerating,
  selectedMonth,
  selectedYear,
  ruralAvailabilities
}) => {
  const getFuzzyMatchDoctor = (rowNameOrId: string, doctorsList: Doctor[]): Doctor | null => {
    if (!rowNameOrId) return null;
    const numId = Number(rowNameOrId);
    if (!isNaN(numId)) {
      const found = doctorsList.find(d => d.id === numId);
      if (found) return found;
    }
    
    const clean = (s: string) => {
      return s.normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toLowerCase()
              .replace(/[^a-z0-9 ]/g, "")
              .trim();
    };
    
    const targetClean = clean(rowNameOrId);
    if (!targetClean) return null;
    
    for (const d of doctorsList) {
      const docFull = clean(`${d.nombre} ${d.apellidos || ''}`);
      const docNameOnly = clean(d.nombre);
      if (docFull === targetClean || docNameOnly === targetClean) {
        return d;
      }
    }

    let bestDoctor: Doctor | null = null;
    let highestScore = 0;

    for (const d of doctorsList) {
      const docFull = clean(`${d.nombre} ${d.apellidos || ''}`);
      
      const tokensTarget = targetClean.split(/\s+/);
      const tokensDoc = docFull.split(/\s+/);
      
      let matchedTokens = 0;
      tokensTarget.forEach(t => {
        if (tokensDoc.some(td => td.includes(t) || t.includes(td))) {
          matchedTokens++;
        }
      });
      
      const score = matchedTokens / Math.max(tokensTarget.length, tokensDoc.length);
      if (score > highestScore && score >= 0.4) {
        highestScore = score;
        bestDoctor = d;
      }
    }
    return bestDoctor;
  };

  const [aiSettings, setAiSettings] = useState<AIEngineSettings>({
    maxConsecutiveNights: 1,
    minRestHoursBetweenShifts: 12,
    maxShiftsPerMonth: 20,
    weekendSpacingWeeks: 2,
    priorityRuralD1: true,
    blockTriplets: true,
    enablePostShiftRest: true,
    mandatoryFreeWeekends: 1,
    customRules: ""
  });

  const [driveFolderId, setDriveFolderId] = useState('');
  const [isValidatingDrive, setIsValidatingDrive] = useState(false);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'aiEngineV3'));
        if (snap.exists()) {
          setAiSettings(snap.data() as AIEngineSettings);
        }
        const driveSnap = await getDoc(doc(db, 'settings', 'driveConfig'));
        if (driveSnap.exists()) {
          setDriveFolderId(driveSnap.data()?.folderId || '');
        }
      } catch (err) {
        console.error("Error loading AI settings:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  const saveSettings = async () => {
    try {
      await setDoc(doc(db, 'settings', 'aiEngineV3'), aiSettings);
      onNotify("Reglas institucionales actualizadas correctamente", 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/aiEngineV3');
      onNotify("Error al guardar reglas", 'error');
    }
  };

  const validateAndSaveDriveFolder = async () => {
    if (!driveFolderId) {
      onNotify("Debe ingresar un ID de carpeta", 'error');
      return;
    }
    const token = localStorage.getItem('google_access_token');
    if (!token) {
      onNotify("Debe iniciar sesión con Google primero", 'error');
      return;
    }
    setIsValidatingDrive(true);
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${driveFolderId}?supportsAllDrives=true`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error("No se pudo acceder a la carpeta. Verifica el ID y los permisos.");
      }
      const fileData = await res.json();
      if (fileData.mimeType !== 'application/vnd.google-apps.folder') {
        throw new Error("El ID proporcionado no corresponde a una carpeta.");
      }
      await setDoc(doc(db, 'settings', 'driveConfig'), { folderId: driveFolderId });
      onNotify("Carpeta validada y guardada correctamente", 'success');
    } catch (err: any) {
      console.error(err);
      onNotify(err.message || "Error validando la carpeta", 'error');
    } finally {
      setIsValidatingDrive(false);
    }
  };

  const [isSeeding, setIsSeeding] = useState(false);

  const seedRuralAvailabilities = async () => {
    setIsSeeding(true);
    try {
      // 1. Ensure at least 3 active rural doctors exist
      let ruralDocs = doctors.filter(d => d.cat === 'Rural' && d.st === 'activo');
      if (ruralDocs.length === 0) {
        onNotify("Generando médicos rurales de ejemplo en la base de datos...", "info");
        const sampleRuralDocs = [
          {
            id: 101,
            nombre: "Carlos Andrés",
            apellidos: "Gómez Montoya",
            cedula: "1017283491",
            registroMedico: "RM-94827",
            email: "carlos.gomez@correohdsa.gov.co",
            telefono: "3127483921",
            cat: "Rural" as const,
            rol: "Médico Rural",
            st: "activo" as const,
            username: "carlos.gomez",
            password: "password123",
            createdAt: Date.now()
          },
          {
            id: 102,
            nombre: "Valentina",
            apellidos: "Restrepo Alzate",
            cedula: "1020485938",
            registroMedico: "RM-83748",
            email: "valentina.restrepo@correohdsa.gov.co",
            telefono: "3178492049",
            cat: "Rural" as const,
            rol: "Médico Rural",
            st: "activo" as const,
            username: "valentina.restrepo",
            password: "password123",
            createdAt: Date.now()
          },
          {
            id: 103,
            nombre: "Mateo",
            apellidos: "Espinosa Castro",
            cedula: "1032485921",
            registroMedico: "RM-19482",
            email: "mateo.espinosa@correohdsa.gov.co",
            telefono: "3209485731",
            cat: "Rural" as const,
            rol: "Médico Rural",
            st: "activo" as const,
            username: "mateo.espinosa",
            password: "password123",
            createdAt: Date.now()
          }
        ];

        for (const docObj of sampleRuralDocs) {
          await setDoc(doc(db, 'doctors', String(docObj.id)), docObj);
        }
        ruralDocs = sampleRuralDocs;
      }

      // 2. Generate 10 distinct realistic rural availability records for the current selected month/year
      onNotify("Sincronizando 10 ejemplos con Firebase Firestore...", "info");

      const mockPatients = [
        { name: "Amalia Sofía Restrepo", id: "1.018.453.921", diag: "Apendicitis aguda con peritonitis localizada (K35.3)", place: "Hospital Universitario San Jorge" },
        { name: "Emilio José Palacios", id: "1.020.843.111", diag: "Trabajo de parto obstruido debido a presentación podálica (O64.1)", place: "Clínica Comfamiliar" },
        { name: "María Camila Ortiz", id: "1.037.948.332", diag: "Traumatismo intracraneal no especificado (S06.9)", place: "Hospital San Vicente de Paúl" },
        { name: "Juan Carlos Giraldo", id: "1.015.483.920", diag: "Crisis asmática severa, estado asmático (J45.9)", place: "Clínica del Café" },
        { name: "Luciana Beltrán Gómez", id: "1.042.847.219", diag: "Abdomen agudo quirúrgico, colecistitis aguda (K80.0)", place: "Hospital Departamental de Cartago" },
        { name: "Samuel Eduardo Muñoz", id: "1.033.485.922", diag: "Fractura de fémur expuesta grado II (S72.0)", place: "Hospital Universitario San Jorge" },
        { name: "Gabriela Torres Prada", id: "1.012.948.330", diag: "Preeclampsia severa con signos de severidad (O14.1)", place: "Clínica Comfamiliar" },
        { name: "Jerónimo Ruiz Salazar", id: "1.022.483.741", diag: "Hemorragia digestiva alta de origen no especificado (K92.2)", place: "Hospital San Vicente de Paúl" },
        { name: "Salomé Castro Velez", id: "1.039.485.201", diag: "Neumonía adquirida en comunidad con insuficiencia respiratoria (J18.9)", place: "Clínica del Café" },
        { name: "Tomás Henao Restrepo", id: "1.016.942.847", diag: "Infarto agudo de miocardio con elevación del segmento ST (I21.1)", place: "Hospital Universitario San Jorge" }
      ];

      const mockActivities = [
        "Acompañamiento en ambulancia de soporte vital básico por remisión de urgencia.",
        "Remisión y monitoreo continuo de paciente inestable en ambulancia medicalizada.",
        "Acompañamiento médico para valoración por especialista en tercer nivel.",
        "Traslado de paciente pediátrico con dificultad respiratoria severa.",
        "Acompañamiento de paciente obstétrica en código rojo por hemorragia posparto.",
        "Traslado y soporte de paciente politraumatizado en ambulancia básica.",
        "Remisión urgente para intervención neuroquirúrgica prioritaria.",
        "Acompañamiento y soporte hemodinámico durante traslado de urgencias.",
        "Remisión urgente por sospecha de patología quirúrgica abdominal.",
        "Soporte y reanimación básica durante traslado interinstitucional de urgencias."
      ];

      const coordinators = [
        { id: 1, name: "Dr. Alejandro Restrepo (Coordinador)" },
        { id: 2, name: "Dra. Liliana Gómez (Jefe Urgencias)" }
      ];

      // Clean sample base64 signatures for realistic render
      const mockSignature = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAABACAYAAABfIq9vAAAAAXNSR0IArs4c6QAAAAlwSFlzAAALEwAACxMBAJqcGAAAAWJJREFUeNrt2TFLw0AcBvDjvSAtCDp0dGsdVfAFFAVBpIOOOnRRFDqIDoIurvofXBT8BEVxd3ETuhSc/B4XpC9Z8iX3XpJLcl8IhEtyeZcLyR2HAAAAAAAAAAAAAAAAAAAAAAAAAAAAn9Z03H+7bOeeYx3H8Qy9M1s43S3rLut71t6W030A91V6W7Zyz8N9FwBcR3pb9vO3rLctp6e5p7ln7jMAvK/S27LXv2V9Yjm9vby3HMcBvF96Wzb6b/9uNf/NfdZyHHf9M6U78b8H4P0q3TPrW6v5L/eK5byO/H+pSg9gO+nO/C8BeK9K986bWc0Z6/XFp3bOfTf/fQDvU3q99UmsZp/15fX94GvT/VunpwcAngcA7vUvW1ms5qF16X1Sby89p/sA7vUvG8xqznOfXnvGcgAAAAA=";

      // Ensure some spread of days
      const days = [2, 5, 8, 12, 15, 18, 20, 22, 25, 28];

      for (let i = 0; i < 10; i++) {
        const docObj = ruralDocs[i % ruralDocs.length];
        const patient = mockPatients[i];
        const activity = mockActivities[i];
        const coordinator = coordinators[i % coordinators.length];
        
        const day = days[i];
        
        // Setup realistic start/end times
        const callHour = 8 + (i * 2) % 12; // ranges from 08:00 to 20:00
        const durationHours = 4 + (i * 3) % 6; // ranges from 4 to 9 hours
        
        const callDateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const callTimeStr = `${String(callHour).padStart(2, '0')}:00`;
        
        const endHour = callHour + durationHours;
        const endDay = endHour >= 24 ? day + 1 : day;
        const formattedEndHour = endHour % 24;
        
        const endDateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
        const endTimeStr = `${String(formattedEndHour).padStart(2, '0')}:00`;
        
        const start = new Date(`${callDateStr}T${callTimeStr}`);
        const end = new Date(`${endDateStr}T${endTimeStr}`);

        const id = `seed-${Date.now()}-${i}`;
        const gross = durationHours;
        const ded = (i % 4 === 0) ? 1.5 : 0; // Some have deduction due to schedule overlap
        const net = gross - ded;

        const record: RuralAvailability = {
          id,
          doctorId: docObj.id,
          doctorName: docObj.nombre + " " + (docObj.apellidos || ""),
          callDateTime: start.getTime(),
          hospitalArrivalTime: `${String(callHour).padStart(2, '0')}:15`,
          activity: `TRASLADO: ${activity}`,
          patientName: patient.name,
          patientId: patient.id,
          diagnosis: patient.diag,
          acceptancePlace: patient.place,
          calledBy: coordinator.name,
          calledById: coordinator.id,
          terminationDateTime: end.getTime(),
          totalHours: gross,
          timestamp: Date.now() - (10 - i) * 60000,
          targetMonth: selectedMonth,
          targetYear: selectedYear,
          authorizedStatus: i % 2 === 0 ? 'signed' : 'pending',
          authorizerSignature: i % 2 === 0 ? mockSignature : undefined,
          authorizedTimestamp: i % 2 === 0 ? Date.now() : undefined,
          
          activityType: 'TRASLADO',
          textLibre: activity,
          callDate: callDateStr,
          callTime: callTimeStr,
          endDate: endDateStr,
          endTime: endTimeStr,
          grossHours: gross,
          deduction: ded,
          netHours: net
        };

        await setDoc(doc(db, 'ruralAvailability', id), record);
      }

      onNotify("¡Se han generado exitosamente 10 ejemplos realistas de disponibilidad rural!", "success");
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      console.error(err);
      onNotify("Error al generar los ejemplos: " + (err.message || String(err)), "error");
    } finally {
      setIsSeeding(false);
    }
  };

  const downloadTableTemplate = (type: 'shifts' | 'users' | 'siglas') => {
    let data: any[] = [];
    let filename = "";

    if (type === 'shifts') {
      filename = `plantilla_turnos_importados_${new Date().getMonth() + 1}_${new Date().getFullYear()}.xlsx`;
      const header = ["ID_MEDICO", "NOMBRE_MEDICO", "JORNADA"];
      for (let i = 1; i <= 31; i++) header.push(`DIA_${i}`);
      header.push("NOTAS");
      data = [header];
      
      // Pre-fill with active doctors for convenience
      doctors.filter(d => d.st === 'activo').sort((a, b) => a.nombre.localeCompare(b.nombre)).forEach(d => {
        data.push([d.id, d.nombre, 'm', ...Array(31).fill(''), ""]);
        data.push([d.id, d.nombre, 't', ...Array(31).fill(''), ""]);
        data.push([d.id, d.nombre, 'n', ...Array(31).fill(''), ""]);
      });

      // Add a hidden sheet for Instructions
      const instructions = [
        ["INSTRUCCIONES PARA IMPORTACIÓN MASIVA"],
        ["1. Use las siglas configuradas en el sistema (Ej: 7-13, 13-19, N, D1, PT)."],
        ["2. No modifique los IDs de los médicos."],
        ["3. Deje en blanco si el médico no tiene turno ese día."],
        ["4. Los turnos de noche deben marcarse con la sigla 'N' o la configurada para la jornada nocturna."]
      ];
      data.push([], ...instructions);
    } else if (type === 'users') {
      filename = "nomina_personal_medico_actualizado.xlsx";
      data = [
        ["ID", "Nombre", "Apellidos", "Cedula", "Registro_Medico", "Email", "Telefono", "Categoria", "Rol", "Estado", "Username", "Password"],
      ];
      
      // If there are existing doctors, export them so they can be edited
      if (doctors.length > 0) {
        doctors.forEach(d => {
          data.push([
            d.id, 
            d.nombre, 
            d.apellidos || "", 
            d.cedula || "", 
            d.registroMedico || "", 
            d.email || "", 
            d.telefono || "", 
            d.cat, 
            d.rol, 
            d.st, 
            d.username || "", 
            d.password || ""
          ]);
        });
      } else {
        // Example if empty
        data.push([1, "Juan", "Perez", "123456", "RM-789", "juan@example.com", "3001234567", "Planta", "Médico General", "activo", "jperez", "pass123"]);
      }
    } else if (type === 'siglas') {
      filename = "configuracion_siglas_sistema.xlsx";
      data = [
        ["Sigla", "Jornada_m_t_n", "Horas_Carga"],
      ];

      // Export current variables configuration
      Object.entries(variables).forEach(([slot, map]) => {
        Object.entries(map).forEach(([sigla, horas]) => {
          data.push([sigla, slot, horas]);
        });
      });

      if (data.length === 1) {
        // Examples if no variables defined yet
        data.push(["7-13", "m", 6]);
        data.push(["13-19", "t", 6]);
        data.push(["N", "n", 12]);
        data.push(["D1", "m", 24]);
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, filename);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'shifts' | 'users' | 'siglas') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { defval: "" });

        if (!data || data.length === 0) {
          onNotify(`Error: El archivo de ${type === 'users' ? 'Talento Humano' : type === 'shifts' ? 'Turnos' : 'Siglas'} no tiene datos válidos.`, 'error');
          return;
        }

        if (type === 'users') {
          onNotify(`Iniciando importación de ${data.length} usuarios...`, 'info');
          for (const row of data as any[]) {
            const doctorId = row.ID || row.Id || row.id;
            if (!doctorId) continue;

            const docData: Partial<Doctor> = {
              id: Number(doctorId),
              nombre: row.Nombre || row.nombre || "",
              apellidos: row.Apellidos || row.apellidos || "",
              cedula: String(row.Cedula || row.cedula || ""),
              registroMedico: String(row.Registro_Medico || row.registro_medico || ""),
              email: row.Email || row.email || "",
              telefono: row.Telefono || row.telefono || "",
              cat: (row.Categoria || row.categoria || "Planta") as any,
              rol: row.Rol || row.rol || "Médico General",
              st: (row.Estado || row.estado || "activo") as any,
              username: row.Username || row.username || "",
              password: String(row.Password || row.password || "123456")
            };
            await setDoc(doc(db, 'doctors', String(doctorId)), docData, { merge: true });
          }
          onNotify("Talento Humano actualizado correctamente", 'success');
        } else if (type === 'siglas') {
          onNotify("Actualizando configuración de siglas...", 'info');
          const newVars: VarSlotConfig = { m: { ...variables.m }, t: { ...variables.t }, n: { ...variables.n } };
          
          let updatedCount = 0;
          for (let sIdx = 0; sIdx < wb.SheetNames.length; sIdx++) {
            const sName = wb.SheetNames[sIdx].toLowerCase();
            const sheet = wb.Sheets[wb.SheetNames[sIdx]];
            const sData = XLSX.utils.sheet_to_json(sheet, { defval: "" });

            let defaultSlot: SlotType | null = null;
            if (sName.includes('mañana') || sName.includes('manana') || sName.includes('mañ')) defaultSlot = 'm';
            if (sName.includes('tarde') || sName.includes('tar')) defaultSlot = 't';
            if (sName.includes('noche') || sName.includes('noc')) defaultSlot = 'n';

            for (const row of sData as any[]) {
              const siglaOriginal = String(row.Sigla || row.sigla || '').trim();
              if (!siglaOriginal) continue;

              const jornadaRaw = String(row.Jornada_m_t_n || row.jornada || row.Jornada || '').toLowerCase();
              let jornada: SlotType;
              if (jornadaRaw.includes('m') || jornadaRaw === 'm') jornada = 'm';
              else if (jornadaRaw.includes('t') || jornadaRaw === 't') jornada = 't';
              else if (jornadaRaw.includes('n') || jornadaRaw === 'n') jornada = 'n';
              else if (defaultSlot) jornada = defaultSlot;
              else jornada = 'm';

              const rawHoras = row.Horas_Carga !== undefined && row.Horas_Carga !== "" ? row.Horas_Carga : (row.horas !== undefined && row.horas !== "" ? row.horas : row.horas_carga);
              const horas = (rawHoras !== undefined && rawHoras !== null && rawHoras !== "") ? Number(rawHoras) : 0;
              
              // Only load the new ones! Do NOT overwrite those already configured!
              const exists = Object.keys(variables[jornada]).some(k => k.toLowerCase() === siglaOriginal.toLowerCase());
              if (!exists) {
                newVars[jornada][siglaOriginal] = isNaN(horas) ? 0 : horas;
                updatedCount++;
              }
            }
          }
          await setDoc(doc(db, 'settings', 'variables'), newVars);
          onNotify(`Configuración de siglas actualizada (${updatedCount} procesadas)`, 'success');
        } else if (type === 'shifts') {
          const monthKey = `${selectedYear}_${selectedMonth}`;
          onNotify(`Importando turnos para el mes ${selectedMonth + 1}/${selectedYear}...`, 'info');
          
          let successCount = 0;
          let failedCount = 0;

          for (const row of data as any[]) {
            const rowId = row.ID_MEDICO || row.id_medico || row.ID || row.Id || row.id;
            const rowName = row.NOMBRE_MEDICO || row.nombre_medico || row.NOMBRE || row.Nombre || row.medico || row.MEDICO || "";
            
            let matchedDoc: Doctor | null = null;
            
            // 1. Exact ID check
            if (rowId) {
              const parsedId = Number(rowId);
              if (!isNaN(parsedId)) {
                matchedDoc = doctors.find(d => d.id === parsedId) || null;
              }
            }
            
            // 2. Fuzzy name or ID string search check
            if (!matchedDoc && rowName) {
              matchedDoc = getFuzzyMatchDoctor(String(rowName), doctors);
            }
            if (!matchedDoc && rowId) {
              matchedDoc = getFuzzyMatchDoctor(String(rowId), doctors);
            }
            
            if (!matchedDoc) {
              console.warn(`No se pudo encontrar correspondencia para el médico en fila: ID=${rowId || 'N/A'}, Nombre=${rowName || 'N/A'}`);
              failedCount++;
              continue;
            }

            const doctorId = matchedDoc.id;
            const rawJ = String(row.JORNADA || row.jornada || row['JORNADA'] || row['Jornada'] || row['Slot'] || row['slot'] || "").trim().toLowerCase();
            let slot: SlotType = 'm';
            if (rawJ === 't' || rawJ === 'tarde' || rawJ.includes('tard')) slot = 't';
            else if (rawJ === 'n' || rawJ === 'noche' || rawJ.includes('noch')) slot = 'n';
            else if (rawJ === 'm' || rawJ === 'mañana' || rawJ.includes('mañ')) slot = 'm';
            else {
               if (rawJ.startsWith('t')) slot = 't';
               else if (rawJ.startsWith('n')) slot = 'n';
               else slot = 'm';
            }

            const shiftUpdate: any = {};
            // Iterate day columns
            for (let i = 1; i <= 31; i++) {
              const val = row[`DIA_${i}`] || row[i.toString()] || row[i] || row[`${i}`] || row[`dia_${i}`] || row[`dia ${i}`];
              if (val !== undefined && val !== null && val.toString().trim() !== '') {
                shiftUpdate[i.toString()] = val.toString().trim();
              }
            }

            if (Object.keys(shiftUpdate).length > 0) {
              await setDoc(doc(db, 'monthlyData', monthKey, 'doctors', String(doctorId)), {
                [slot]: shiftUpdate
              }, { merge: true });
              successCount++;
            }
          }
          if (failedCount > 0) {
            onNotify(`Turnos importados con éxito: ${successCount} filas procesadas. Advertencia: ${failedCount} médicos no coincidieron en BD.`, 'info');
          } else {
            onNotify(`Turnos importados exitosamente (${successCount} procesados)`, 'success');
          }
        }
        
        // Refresh page to see changes
        setTimeout(() => window.location.reload(), 1500);

      } catch (err) {
        console.error("Error en importación:", err);
        onNotify("Error al procesar el archivo. Verifica el formato.", 'error');
      }
    };
    reader.readAsBinaryString(file);
    // Reset input
    e.target.value = '';
  };

  if (isLoading) return <div className="p-8 text-center animate-pulse">Cargando Caja de Herramientas...</div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* AI ENGINE V3 COMPACT BUTTON */}
      <div className="bg-white rounded-[24px] p-6 border border-emerald-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
         <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600 shrink-0">
               <BrainCircuit className="w-6 h-6" />
            </div>
            <div>
               <h3 className="text-lg font-black text-slate-800 tracking-tight">IA SHIFT ENGINE</h3>
               <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">Crear Borrador de Turnos</p>
            </div>
         </div>
         <button 
            onClick={() => onGenerateProposal(aiSettings)}
            disabled={isGenerating}
            className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black px-6 py-4 rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-md shadow-emerald-600/20 uppercase tracking-widest text-xs flex items-center justify-center gap-3 disabled:opacity-50"
         >
            {isGenerating ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            GENERAR PROPUESTA V3
         </button>
      </div>

      {/* DRIVE SYNC SETTINGS */}
      <div className="bg-white rounded-[32px] p-8 border border-amber-100 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Database className="w-32 h-32 text-amber-600" />
        </div>
        
        <div className="flex items-center gap-4 mb-8">
          <div className="p-4 bg-amber-50 rounded-2xl text-amber-600">
             <Database className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Sincronización Cloud (Censos)</h3>
            <p className="text-[10px] text-amber-600 font-bold uppercase tracking-widest">Configuración Google Drive</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="flex-1 space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 block">ID Carpeta Base Censos</label>
            <input 
              type="text"
              className="w-full bg-slate-50 border border-slate-100 p-4 rounded-xl font-bold outline-none focus:border-amber-500 transition-all text-sm"
              placeholder="Ej: 1eQ6ZQV0I3rpC5lWsQvWlrHZ4AclKNF2C"
              value={driveFolderId}
              onChange={e => setDriveFolderId(e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-slate-500 mb-6">El sistema organizará los censos automáticamente dentro de esta carpeta por Año y Mes.</p>

        <div className="flex flex-col sm:flex-row gap-4">
          <button 
            onClick={validateAndSaveDriveFolder}
            disabled={isValidatingDrive}
            className="flex-1 bg-amber-500 text-white font-black py-4 rounded-2xl hover:bg-amber-600 active:scale-95 transition-all shadow-xl shadow-amber-500/20 uppercase tracking-widest text-sm flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {isValidatingDrive ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-5 h-5" />}
            Validar y Guardar ID
          </button>
        </div>
      </div>

      {/* IMPORT TEMPLATES */}
      <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-xl">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-4 bg-blue-50 rounded-2xl text-blue-600">
             <FileSpreadsheet className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">CENTRO DE PLANTILLAS</h3>
            <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">Descarga de Estructuras para Importación Masiva</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="flex flex-col gap-4">
            <button 
              onClick={() => downloadTableTemplate('shifts')}
              className="group bg-slate-50 p-8 rounded-[32px] border border-slate-100 hover:border-blue-500 transition-all text-left space-y-4 w-full"
            >
                <div className="w-12 h-12 bg-white rounded-2xl border border-slate-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                  <FileDown className="w-6 h-6" />
                </div>
                <h4 className="font-black text-slate-800 uppercase text-sm tracking-tight">Plantilla de Turnos</h4>
                <p className="text-[10px] text-slate-400 font-bold leading-relaxed uppercase">Estructura para importar la programación mensual completa.</p>
            </button>
            <label className="flex items-center justify-center gap-2 p-4 bg-blue-50 text-blue-700 rounded-2xl cursor-pointer hover:bg-blue-100 transition-all font-black text-[10px] uppercase tracking-widest border border-blue-200">
              <Database className="w-4 h-4" /> Importar Turnos
              <input type="file" className="hidden" accept=".xlsx,.xls" onChange={(e) => handleFileUpload(e, 'shifts')} />
            </label>
           </div>

           <div className="flex flex-col gap-4">
            <button 
              onClick={() => downloadTableTemplate('users')}
              className="group bg-slate-50 p-8 rounded-[32px] border border-slate-100 hover:border-blue-500 transition-all text-left space-y-4 w-full"
            >
                <div className="w-12 h-12 bg-white rounded-2xl border border-slate-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                  <UsersIcon className="w-6 h-6" />
                </div>
                <h4 className="font-black text-slate-800 uppercase text-sm tracking-tight">Carga Talento Humano</h4>
                <p className="text-[10px] text-slate-400 font-bold leading-relaxed uppercase">Actualización masiva de personal, roles y credenciales.</p>
            </button>
            <label className="flex items-center justify-center gap-2 p-4 bg-emerald-50 text-emerald-700 rounded-2xl cursor-pointer hover:bg-emerald-100 transition-all font-black text-[10px] uppercase tracking-widest border border-emerald-200">
              <Database className="w-4 h-4" /> Importar Usuarios
              <input type="file" className="hidden" accept=".xlsx,.xls" onChange={(e) => handleFileUpload(e, 'users')} />
            </label>
           </div>

           <div className="flex flex-col gap-4">
            <button 
              onClick={() => downloadTableTemplate('siglas')}
              className="group bg-slate-50 p-8 rounded-[32px] border border-slate-100 hover:border-blue-500 transition-all text-left space-y-4 w-full"
            >
                <div className="w-12 h-12 bg-white rounded-2xl border border-slate-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                  <Clock className="w-6 h-6" />
                </div>
                <h4 className="font-black text-slate-800 uppercase text-sm tracking-tight">Catálogo de Siglas</h4>
                <p className="text-[10px] text-slate-400 font-bold leading-relaxed uppercase">Configurar códigos horarios y su respectiva carga horaria.</p>
            </button>
            <label className="flex items-center justify-center gap-2 p-4 bg-amber-50 text-amber-700 rounded-2xl cursor-pointer hover:bg-amber-100 transition-all font-black text-[10px] uppercase tracking-widest border border-amber-200">
              <Database className="w-4 h-4" /> Importar Siglas
              <input type="file" className="hidden" accept=".xlsx,.xls" onChange={(e) => handleFileUpload(e, 'siglas')} />
            </label>
           </div>
         </div>
       </div>

      {/* SEED DATA FOR RURAL AVAILABILITY */}
      <div className="bg-white rounded-[32px] p-8 border border-emerald-100 shadow-xl mt-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-emerald-50 rounded-2xl text-emerald-600">
               <Database className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">DATOS DE PRUEBA (SEED DATA)</h3>
              <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest font-mono">Cargar Ejemplos para Pruebas del Administrador</p>
            </div>
          </div>
          <button
            onClick={seedRuralAvailabilities}
            disabled={isSeeding}
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-4 rounded-2xl transition-all shadow-xl shadow-emerald-500/20 uppercase tracking-widest text-xs flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {isSeeding ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
            GENERAR 10 EJEMPLOS RURALES
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-4 leading-relaxed">
          Este módulo creará automáticamente <strong>10 registros reales y consistentes de disponibilidades médicas rurales</strong> en Firebase Firestore para el mes seleccionado. Si no existen médicos rurales activos en la base de datos, el sistema creará automáticamente 3 médicos rurales de ejemplo de forma segura.
        </p>
      </div>

      {/* DATA QUALITY REPORT TABLE */}
      <div className="bg-white rounded-[32px] p-8 border border-rose-100 shadow-xl mt-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-4 bg-rose-50 rounded-2xl text-rose-600">
             <AlertTriangle className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">DATA QUALITY REPORT</h3>
            <p className="text-[10px] text-rose-600 font-bold uppercase tracking-widest font-mono">Registros de Disponibilidad Rural Incompletos o Inconsistentes</p>
          </div>
        </div>

        {(() => {
          const incompleteRecords = ruralAvailabilities
            .filter(r => r.targetMonth === selectedMonth && r.targetYear === selectedYear)
            .map(r => {
              const missing: string[] = [];
              if (!r.patientName || r.patientName.trim() === "") missing.push("Paciente");
              if (!r.patientId || r.patientId.trim() === "") missing.push("Cédula/Documento");
              if (!r.diagnosis || r.diagnosis.trim() === "") missing.push("Diagnóstico");
              if (!r.acceptancePlace || r.acceptancePlace.trim() === "") missing.push("Lugar Aceptación");
              
              const activityVal = (r.activityType || '') + (r.textLibre || '') + (r.activity || '');
              if (!activityVal || activityVal.trim() === "") {
                missing.push("Actividad");
              }

              if (!r.calledById) {
                missing.push("Autorizador");
              }

              return {
                ...r,
                missingFields: missing,
                isValid: missing.length === 0
              };
            })
            .filter(item => !item.isValid);

          if (incompleteRecords.length === 0) {
            return (
              <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-2xl text-center text-emerald-800">
                <p className="font-bold flex items-center justify-center gap-2">
                  🎉 ¡Enhorabuena! Todos los registros del mes están 100% completos y consistentes.
                </p>
                <p className="text-[10px] text-emerald-600 uppercase font-black mt-1">
                  Ningún registro rural presenta campos incompletos para {new Date(selectedYear, selectedMonth).toLocaleString('es', { month: 'long', year: 'numeric' })}.
                </p>
              </div>
            );
          }

          return (
            <div className="space-y-4">
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-800 text-xs">
                ⚠️ Se han detectado <strong>{incompleteRecords.length}</strong> registros con campos obligatorios vacíos para el mes actual. Estos registros deben corregirse en la base de datos para asegurar el correcto consolidado.
              </div>
              
              <div className="overflow-x-auto rounded-2xl border border-slate-100 shadow-sm">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-extrabold uppercase text-[10px]">
                      <th className="p-4">ID / Médico</th>
                      <th className="p-4">Fecha</th>
                      <th className="p-4">Paciente</th>
                      <th className="p-4 text-rose-600">Campos Faltantes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {incompleteRecords.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 font-bold text-slate-700">
                          <span className="text-[10px] text-slate-400 font-mono block">ID: {item.id}</span>
                          Dr(a). {item.doctorName}
                        </td>
                        <td className="p-4 text-slate-500 font-mono">
                          {item.callDate || new Date(item.callDateTime).toLocaleDateString()}
                        </td>
                        <td className="p-4 text-slate-600">
                          {item.patientName || <span className="text-rose-500 italic">No registrado</span>}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1.5">
                            {item.missingFields.map((field, fIdx) => (
                              <span key={fIdx} className="bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.5 rounded-full font-bold text-[10px] tracking-tight uppercase">
                                ⚠️ {field}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </div>
        </div>
      </div>
    </div>
  );
};
