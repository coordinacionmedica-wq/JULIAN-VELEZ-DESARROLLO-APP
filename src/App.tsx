/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Database,
  Calendar, 
  Settings, 
  FileText, 
  LogOut, 
  Plus, 
  UserPlus, 
  Save, 
  Printer, 
  ChevronRight,
  ChevronDown,
  Search,
  ShieldCheck,
  Stethoscope,
  Trash2,
  Power,
  Wand2,
  Palette,
  BellRing,
  CheckCircle,
  XCircle,
  X,
  BrainCircuit,
  Sparkles,
  Bell,
  Info,
  Send,
  Clock,
  MapPin,
  FileSpreadsheet,
  FileDown,
  MessageCircle,
  Palette as PaletteIcon,
  Brain as BrainIcon,
  Stethoscope as StethoscopeIcon,
  WifiOff,
  PhoneIncoming,
  ClipboardList,
  BookOpen,
  Edit2,
  Flame,
  Activity,
  HeartPulse,
  AlertCircle,
  Syringe,
  Timer,
  BarChart3,
  Layers,
  ClipboardPaste,
  Phone,
  FileCheck,
  Upload
} from 'lucide-react';
import { 
  Doctor, 
  DoctorRole,
  MonthlyData, 
  VarSlotConfig, 
  UserSession, 
  SlotType, 
  DoctorShifts, 
  AuditEntry,
  ShiftRequest,
  RuralAvailability,
  AvailabilityCall,
  TrainingActivity,
  ServiceMapping,
  AIEngineSettings
} from './types';
import { 
  MASTER_ADMIN, 
  MASTER_READER, 
  DEFAULT_VARS, 
  DAY_NAMES, 
  MONTH_NAMES, 
  STORAGE_KEYS 
} from './constants';
import { GoogleGenAI } from "@google/genai";
import { 
  collection, 
  onSnapshot, 
  setDoc, 
  doc, 
  query, 
  where, 
  getDocs, 
  deleteDoc, 
  updateDoc,
  serverTimestamp,
  orderBy,
  limit,
  getDoc
} from 'firebase/firestore';
import { 
  auth, 
  db, 
  handleFirestoreError, 
  OperationType,
  firebaseConfig
} from './firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  signInAnonymously,
  signInWithCustomToken,
  signOut,
  User
} from 'firebase/auth';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import Markdown from 'react-markdown';
import { InductionManual } from './components/InductionManual';
import { AntibioticManual } from './components/AntibioticManual';
import { HumanResourcesView } from './components/HumanResourcesView';
import { CensusView } from './components/CensusView';
import { ProductivityStatsView } from './components/ProductivityStatsView';
import { AdminToolbox } from './components/AdminToolbox';
import { CommitteeView } from './components/CommitteeView';

export const sortDoctors = (a: Doctor, b: Doctor) => {
  if (a.order !== undefined && b.order !== undefined) {
    if (a.order !== b.order) return a.order - b.order;
  } else {
    // If only one has an order, the one with order goes first
    if (a.order !== undefined) return -1;
    if (b.order !== undefined) return 1;
  }
  
  const catOrder: Record<string, number> = { 'Rural': 1, 'Planta': 2, 'CTA': 3, 'APS': 4 };
  const orderA = catOrder[a.cat] || 99;
  const orderB = catOrder[b.cat] || 99;
  if (orderA !== orderB) return orderA - orderB;
  return a.nombre.localeCompare(b.nombre);
};

export default function App() {
  // View States
  const [isBooting, setIsBooting] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [session, setSession] = useState<UserSession | null>(null);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [selectionStart, setSelectionStart] = useState<{ doctorId: number; day: number; slot: SlotType } | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  const [activeTab, setActiveTab] = useState<'home' | 'turnos' | 'census' | 'committee' | 'solicitudes' | 'novedades' | 'rural' | 'bd' | 'docs' | 'admin' | 'ayuda' | 'stats' | 'pic' | 'toolbox'>('turnos');
  
  // Date Selection
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const [doctorFilter, setDoctorFilter] = useState<number[]>([]); 
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [roleSearch, setRoleSearch] = useState('');
  const [showRoleSelector, setShowRoleSelector] = useState(false);
  const [showCatSelector, setShowCatSelector] = useState(false);
  const [showGridHours, setShowGridHours] = useState(false);
  const [editingCell, setEditingCell] = useState<{ id: number, d: number, slot: SlotType, val: string } | null>(null);

  // Data States
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [variables, setVariables] = useState<VarSlotConfig>(DEFAULT_VARS);
  const [customLegends, setCustomLegends] = useState<{role: string, legend: string}[]>([]);
  const [newLegendRole, setNewLegendRole] = useState('');
  const [newLegendContent, setNewLegendContent] = useState('');
  const [currentMonthData, setCurrentMonthData] = useState<MonthlyData>({});

  const getVarHours = (slot: SlotType, sigla: string): number => {
    if (!sigla) return 0;
    const s = sigla.trim();
    if (s === 'X') return 0;
    
    const slotVars = variables[slot] || {};
    const upperS = s.toUpperCase();
    
    const foundKey = Object.keys(slotVars).find(k => k.toUpperCase() === upperS);
    if (foundKey !== undefined) {
      return slotVars[foundKey];
    }
    
    if (['PT','L','P','COMPENSA','D1','D2','D3','D4'].includes(upperS)) return 0;
    return 0;
  };
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [shiftRequests, setShiftRequests] = useState<ShiftRequest[]>([]);
  const [ruralAvailabilities, setRuralAvailabilities] = useState<RuralAvailability[]>([]);
  const [availabilityCalls, setAvailabilityCalls] = useState<AvailabilityCall[]>([]);
  const [userNotifications, setUserNotifications] = useState<any[]>([]);
  const [notification, setNotification] = useState<{message: string, type: 'info' | 'success' | 'error'} | null>(null);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  const generateAISchedulingProposal = async (settings: AIEngineSettings) => {
    setIsGeneratingAI(true);
    setAiReport(null);
    try {
      const activeDoctors = doctors.filter(d => d.st === 'activo');
      const monthRequests = shiftRequests.filter(r => r.targetMonth === selectedMonth && r.targetYear === selectedYear);
      const daysCount = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      
      const siglaStats = Object.entries(variables).map(([slot, map]) => `${slot.toUpperCase()}: [${Object.keys(map).join(', ')}]`).join(' | ');

      const prompt = `Actúa como un experto en logística hospitalaria y Programación Médica (Shift Scheduling).
      CONTEXTO: Generar la propuesta de turnos para ${MONTH_NAMES[selectedMonth]} ${selectedYear} (${daysCount} días).
      
      PERSONAL DISPONIBLE:
      ${activeDoctors.map(d => `- ID: ${d.id}, Nombre: ${d.nombre}, Rol: ${d.rol}, Categoría: ${d.cat}`).join('\n')}
      
      SIGLAS DISPONIBLES:
      ${siglaStats}
      
      SOLICITUDES / RESTRICCIONES PREVIAS:
      ${monthRequests.map(r => `- Dr. ${r.doctorName} (ID ${r.doctorId}) pidió ${r.slot.toUpperCase()} el día ${r.day}: ${r.reason}`).join('\n')}
      
      REGLAS INSTITUCIONALES (SHIFT ENGINE V3):
      1. Máximo noches consecutivas: ${settings.maxConsecutiveNights}
      2. Descanso mínimo entre turnos: ${settings.minRestHoursBetweenShifts}h
      3. Máximo turnos por mes por médico: ${settings.maxShiftsPerMonth}
      4. Espaciado entre fines de semana: ${settings.weekendSpacingWeeks} semanas.
      5. Mínimo fines de semana libres: ${settings.mandatoryFreeWeekends}
      6. Priorizar Rurales para Disponibilidad (D1/D2/D3): ${settings.priorityRuralD1 ? 'SÍ' : 'NO'}
      7. Bloquear Tripletes: ${settings.blockTriplets ? 'SÍ' : 'NO'}
      8. Habilitar Descanso Post-Turno (PT): ${settings.enablePostShiftRest ? 'SÍ' : 'NO'}
      ${settings.customRules ? `OTRAS REGLAS ESPECÍFICAS:\n${settings.customRules}` : ''}
      
      TAREA:
      Genera una PROPUESTA DE PROGRAMACIÓN lógica y optimizada.
      Entretén una estructura de tabla o lista clara para que el administrador pueda revisarla.
      Enfócate en cubrir los servicios críticos (Urgencias, Hospitalización).
      Indica claramente por qué tomaste ciertas decisiones (Justificación técnica).
      
      FORMATO DE SALIDA: Markdown profesional con tablas y secciones de "Razonamiento del Algoritmo".`;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt,
      });

      setAiReport(response.text || "No se pudo generar la propuesta.");
    } catch (err) {
      console.error(err);
      setAiReport("Error al generar propuesta con el Engine V3. Verifica el API Key de Gemini.");
    } finally {
      setIsGeneratingAI(false);
    }
  };
  const [serviceMappings, setServiceMappings] = useState<ServiceMapping[]>([
    { id: '1', name: 'Urgencias', siglas: ['13'] },
    { id: '2', name: 'Observación', siglas: ['16'] },
    { id: '3', name: 'Apoyos', siglas: ['14'] },
    { id: '4', name: 'Hospitalización', siglas: ['10'] },
    { id: '5', name: 'Cirugía', siglas: ['15'] },
    { id: '6', name: 'Partos', siglas: ['11'] }
  ]);
  const [showProductivityStats, setShowProductivityStats] = useState(false);
  const [productivityResults, setProductivityResults] = useState<any[]>([]);
  
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && notification) {
        setNotification(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [notification]);

  // Form States (Admin)
  const [loginU, setLoginU] = useState('');
  const [loginP, setLoginP] = useState('');
  const [newDocName, setNewDocName] = useState('');
  const [newDocEmail, setNewDocEmail] = useState('');
  const [newDocCat, setNewDocCat] = useState<'Planta' | 'CTA' | 'APS' | 'Rural' | 'Disponibilidad'>('Planta');
  const [newDocRol, setNewDocRol] = useState<DoctorRole>('Médico General');
  const [newDocContact, setNewDocContact] = useState('');
  const [newVarCode, setNewVarCode] = useState('');
  const [newVarHour, setNewVarHour] = useState('');
  const [newVarSlot, setNewVarSlot] = useState<SlotType>('m');
  const [editingVar, setEditingVar] = useState<{slot: SlotType, code: string} | null>(null);

  // Registration States
  const [showRegModal, setShowRegModal] = useState(false);
  const [regNombre, setRegNombre] = useState('');
  const [regApellidos, setRegApellidos] = useState('');
  const [regCedula, setRegCedula] = useState('');
  const [regRegistroMedico, setRegRegistroMedico] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regTelefono, setRegTelefono] = useState('');
  const [regRol, setRegRol] = useState<DoctorRole>('Médico General');
  const [generatedCreds, setGeneratedCreds] = useState<{u: string, p: string} | null>(null);

  // Change Password States
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');

  // Authorization Inbox
  const [showAuthInbox, setShowAuthInbox] = useState(false);

  const authUser = auth.currentUser;
  const isFirebaseUnauthenticatedAdmin = session?.r === 'admin' && !authUser;

  // Editing Doctor
  const [editingDoc, setEditingDoc] = useState<Doctor | null>(null);
  
  // Availability Call States
  const [showCallModal, setShowCallModal] = useState(false);
  
  // Activities states
  const [activities, setActivities] = useState<TrainingActivity[]>([]);
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

  // Theme State
  const [theme, setTheme] = useState({
    primary: '#00c8f0',
    font: 'sans'
  });

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

  // Rural Availability Form States
  const [ruralCallDate, setRuralCallDate] = useState('');
  const [ruralCallTime, setRuralCallTime] = useState('');
  const [ruralHospitalArrival, setRuralHospitalArrival] = useState('');
  const [ruralActivity, setRuralActivity] = useState('');
  const [ruralPatientName, setRuralPatientName] = useState('');
  const [ruralPatientId, setRuralPatientId] = useState('');
  const [ruralDiagnosis, setRuralDiagnosis] = useState('');
  const [ruralAcceptancePlace, setRuralAcceptancePlace] = useState('');
  const [ruralCalledBy, setRuralCalledBy] = useState('');
  const [ruralEndDate, setRuralEndDate] = useState('');
  const [ruralEndTime, setRuralEndTime] = useState('');

  const [ruralActivityType, setRuralActivityType] = useState('Traslado / Disponibilidad');
  const [showInductionManual, setShowInductionManual] = useState(false);
  const [showAntibioticManual, setShowAntibioticManual] = useState(false);

  const ruralActivityOptions = [
    'Traslado Médico',
    'Apoyo Urgencias',
    'Apoyo Hospitalización',
    'Apoyo Observación',
    'Apoyo al Triage',
    'Cubrir Incapacidad',
    'Ayudantía Quirúrgica',
    'Brigadas',
    'Consulta Externa',
    'Administrativo'
  ];

  const [fbUser, setFbUser] = useState<any>(null);

  const sendEmailNotification = async (to: string, doctorName: string, requestDetails: any, status: 'approved' | 'rejected') => {
    try {
      const subject = `Notificación de Solicitud de Cambio - ${status === 'approved' ? 'APROBADA' : 'RECHAZADA'}`;
      const statusText = status === 'approved' ? 'aprobada' : 'rechazada';
      const color = status === 'approved' ? '#059669' : '#e11d48';

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: ${color}; text-align: center;">Tu solicitud ha sido ${statusText.toUpperCase()}</h2>
          <p>Hola <strong>${doctorName}</strong>,</p>
          <p>Te informamos que tu solicitud de cambio de turno ha sido procesada por la coordinación médica.</p>
          
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p><strong>Detalles de la solicitud:</strong></p>
            <ul>
              <li><strong>Día:</strong> ${requestDetails.day} de ${MONTH_NAMES[requestDetails.targetMonth]} ${requestDetails.targetYear}</li>
              <li><strong>Jornada:</strong> ${requestDetails.slot === 'm' ? 'Mañana' : requestDetails.slot === 't' ? 'Tarde' : 'Noche'}</li>
              <li><strong>Motivo:</strong> ${requestDetails.reason}</li>
              <li><strong>Estado Final:</strong> <span style="color: ${color}; font-weight: bold;">${statusText.toUpperCase()}</span></li>
            </ul>
          </div>
          
          <p>Puedes consultar más detalles iniciando sesión en el Turnero Digital.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #64748b; text-align: center;">Este es un mensaje automático, por favor no respondas a este correo.</p>
        </div>
      `;

      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          subject,
          text: `Hola ${doctorName}, tu solicitud del día ${requestDetails.day} ha sido ${statusText}.`,
          html
        })
      });

      const result = await response.json();
      if (result.success) {
        console.log("Email notification sent successfully to:", to);
      } else {
        console.warn("Email could not be sent:", result.message);
      }
    } catch (error) {
      console.error("Failed to send email notification:", error);
    }
  };

  const currentUserProfile = useMemo(() => {
    if (!session?.doctorId) return null;
    return doctors.find(d => d.id === session.doctorId);
  }, [session?.doctorId, doctors]);

  const canSeeCodigoRojo = useMemo(() => {
    if (session?.r === 'admin') return true;
    if (!currentUserProfile) return false;
    const role = currentUserProfile.rol;
    return ['Jefe de Partos', 'Enfermero Jefe', 'Médico Obstetra/Ginecólogo', 'Médico Especialista'].includes(role) || 
           (currentUserProfile.cat === 'Disponibilidad' && (role.includes('Médico') || role.includes('Especialista')));
  }, [session?.r, currentUserProfile]);

  const canSeeCodigoAzul = useMemo(() => {
    if (session?.r === 'admin') return true;
    if (!currentUserProfile) return false;
    const role = currentUserProfile.rol;
    // Urgentists, generals, triage, and admin
    return ['Médico Rural', 'Médico General', 'Triage', 'Enfermero Jefe', 'Médico Especialista', 'Intensivista'].some(r => role.includes(r)) || 
           (currentUserProfile.cat === 'Planta' && role.includes('Médico'));
  }, [session?.r, currentUserProfile]);

  // -- Initialization & Auth --
  useEffect(() => {
    const savedSess = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (savedSess) setSession(JSON.parse(savedSess));

    // Test Connection (Quietly)
    const testConnection = async () => {
      try {
        const { doc, getDocFromServer } = await import('firebase/firestore');
        await getDocFromServer(doc(db, 'test', 'connection'));
        console.log("🔥 Firebase Connection: OK");
      } catch (error) {
        if(error instanceof Error && error.message.includes('permission-denied')) {
          console.warn("Permission denied on test/connection - this is expected if rules are rigid.");
        } else if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    // Firebase Auth Listener
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setFbUser(user);
      if (user) {
        console.log("Logged in UID:", user.uid, user.isAnonymous ? "(Anonymous)" : "(Authenticated)");
        
        // Whitelist primary admin emails
        const adminEmails = ['julive17@gmail.com', 'coordinacionmedica@correohdsa.gov.co'];
        const isWhitelisted = adminEmails.includes(user.email || '');
        
        if (isWhitelisted) {
          const sess: UserSession = { r: 'admin', n: user.displayName || 'Coordinador Médico' };
          setSession(sess);
          localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sess));
          setNotification({ message: `Sesión vinculada: ${user.email} (Administrador)`, type: 'success' });
          
          setDoc(doc(db, 'admins', user.uid), { 
            email: user.email, 
            name: user.displayName || 'Coordinador Médico',
            lastLogin: serverTimestamp()
          }, { merge: true }).catch(e => console.warn("Admin sync failed (expected if rules are propagating):", e));
        } else if (!user.isAnonymous) {
          try {
            const adminSnap = await getDocs(query(collection(db, 'admins'), where('email', '==', user.email)));
            if (!adminSnap.empty) {
              const sess: UserSession = { r: 'admin', n: user.displayName || 'Admin' };
              setSession(sess);
              localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sess));
              setNotification({ message: `Sesión de administrador iniciada (${user.email})`, type: 'success' });
            } else if (localStorage.getItem(STORAGE_KEYS.SESSION)) {
               // Re-sync name from current session if logged in via doctor credentials but auth'd with google
            }
          } catch (err) {
            console.error("Admin check failed:", err);
          }
        }
      } else {
        if (!localStorage.getItem(STORAGE_KEYS.SESSION)) {
          signInAnonymously(auth).catch(err => {
            if (err.code === 'auth/admin-restricted-operation') {
              console.warn("Anonymous auth disabled. Read-only mode.");
            }
          });
        }
      }
    });

    setTimeout(() => setIsBooting(false), 2000);

    return () => unsubAuth();
  }, []);

  // -- Main Data Subscriptions (Dependent on Auth) --
  useEffect(() => {
    if (!fbUser) return;

    // Real-time Doctors
    const unsubDocs = onSnapshot(collection(db, 'doctors'), (snap) => {
      let list = snap.docs.map(d => d.data() as Doctor);
      list.sort(sortDoctors);
      setDoctors(list);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'doctors'));

    // Audit Logs
    const qLogs = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(100));
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      const list = snap.docs.map(d => d.data() as AuditEntry);
      setAuditLogs(list);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'auditLogs'));

    // Shift Requests
    const unsubReqs = onSnapshot(collection(db, 'shiftRequests'), (snap) => {
      const list = snap.docs.map(d => d.data() as ShiftRequest);
      setShiftRequests(list);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'shiftRequests'));

    // Rural Availabilities
    const unsubRural = onSnapshot(collection(db, 'ruralAvailability'), (snap) => {
      const list = snap.docs.map(d => d.data() as RuralAvailability);
      setRuralAvailabilities(list);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'ruralAvailability'));

    // Availability Calls
    const qCalls = query(collection(db, 'availabilityCalls'), orderBy('timestamp', 'desc'), limit(50));
    const unsubCalls = onSnapshot(qCalls, (snap) => {
      const list = snap.docs.map(d => d.data() as AvailabilityCall);
      setAvailabilityCalls(list);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'availabilityCalls'));

    // Training Activities
    const unsubActivities = onSnapshot(collection(db, 'trainingActivities'), (snap) => {
      const list = snap.docs.map(d => d.data() as TrainingActivity);
      setActivities(list);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'trainingActivities'));

    // Global Settings (Published Status)
    const unsubPublished = onSnapshot(collection(db, 'monthlyData'), (snap) => {
      // Small metadata metadata
    }, (err) => {
       if (err.code !== 'permission-denied') {
          handleFirestoreError(err, OperationType.LIST, 'monthlyData');
       }
    });

    // Global Settings (Variables)
    const unsubVars = onSnapshot(doc(db, 'settings', 'variables'), async (snap) => {
      let data: VarSlotConfig = { m: {}, t: {}, n: {} };
      if (snap.exists() && Object.keys(snap.data() || {}).length > 0) {
        const cloudData = snap.data() as VarSlotConfig;
        (['m', 't', 'n'] as SlotType[]).forEach(slot => {
          if (cloudData[slot]) {
            data[slot] = { ...cloudData[slot] };
          }
        });
      } else {
        data = JSON.parse(JSON.stringify(DEFAULT_VARS));
      }
      (['m', 't', 'n'] as SlotType[]).forEach(slot => {
        if (!data[slot]) data[slot] = {};
      });
      setVariables(data);
      
      const legSnap = await getDoc(doc(db, 'settings', 'legends'));
      if (legSnap.exists() && legSnap.data().list) {
        setCustomLegends(legSnap.data().list);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'settings/variables'));

    // Theme
    const unsubTheme = onSnapshot(doc(db, 'settings', 'theme'), (snap) => {
      if (snap.exists()) {
        setTheme(snap.data() as any);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'settings/theme'));
    
    // Service Mappings
    const unsubMappings = onSnapshot(doc(db, 'settings', 'serviceMappings'), (snap) => {
      if (snap.exists()) {
        setServiceMappings(snap.data().mappings || []);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'settings/serviceMappings'));

    return () => {
      unsubDocs();
      unsubLogs();
      unsubReqs();
      unsubRural();
      unsubCalls();
      unsubActivities();
      unsubPublished();
      unsubVars();
      unsubTheme();
      unsubMappings();
    };
  }, [fbUser]);


  // -- Monthly Data Sync (Dependent on Auth) --
  const [isMonthPublished, setIsMonthPublished] = useState(false);
  useEffect(() => {
    if (!fbUser) return;

    const monthKey = `${selectedYear}_${selectedMonth}`;
    const docRef = doc(db, 'monthlyData', monthKey);
    const unsubMeta = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        setIsMonthPublished(!!snap.data().published);
      } else {
        setIsMonthPublished(false);
      }
    }, (err) => {
      if (err.code !== 'permission-denied') {
        handleFirestoreError(err, OperationType.GET, `monthlyData/${monthKey}`);
      }
    });

    const q = collection(db, 'monthlyData', monthKey, 'doctors');
    const unsubData = onSnapshot(q, (snap) => {
      const newData: MonthlyData = {};
      snap.docs.forEach(d => {
        newData[Number(d.id)] = d.data() as any;
      });
      setCurrentMonthData(newData);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `monthlyData/${monthKey}/doctors`));

    return () => {
      unsubMeta();
      unsubData();
    };
  }, [selectedMonth, selectedYear, fbUser]);


  // -- Notifications Listen --
  useEffect(() => {
    if (!fbUser || !session?.doctorId) return;

    const q = query(
      collection(db, 'notifications'), 
      where('doctorId', '==', session.doctorId),
      where('read', '==', false),
      orderBy('timestamp', 'desc')
    );
    
    const unsub = onSnapshot(q, (snap) => {
      const notes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUserNotifications(notes as any);
      if (notes.length > 0) {
        setNotification({ message: `Tienes ${notes.length} notificaciones nuevas`, type: 'info' });
      }
    }, (err) => {
      if (err.code !== 'permission-denied') {
         handleFirestoreError(err, OperationType.LIST, 'notifications');
      }
    });
    
    return () => unsub();
  }, [fbUser, session?.doctorId]);

  // -- Firestore Actions --
  const pushNotification = async (doctorId: number, message: string) => {
    const noteId = Date.now().toString();
    try {
      await setDoc(doc(db, 'notifications', noteId), {
        doctorId,
        message,
        read: false,
        timestamp: Date.now()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `notifications/${noteId}`);
    }
  };

  const markNotificationRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `notifications/${id}`);
    }
  };

  const triggerEmergencyCode = async (type: 'ROJO' | 'AZUL') => {
    const now = new Date();
    const realMonth = now.getMonth();
    const realYear = now.getFullYear();
    const day = now.getDate();
    const currentHour = now.getHours();
    
    // Determine Slot
    let slot: SlotType = 'm';
    if (currentHour >= 14 && currentHour < 22) slot = 't';
    else if (currentHour >= 22 || currentHour < 6) slot = 'n';

    const targetSiglas = type === 'ROJO' ? ['10', '11'] : ['13', '14'];
    const message = `🚨 ¡CÓDIGO ${type}! Se requiere su presencia inmediata en el servicio.`;

    let dataToUse: MonthlyData = currentMonthData;

    // Fetch real-time data if selected month doesn't match current time
    if (selectedMonth !== realMonth || selectedYear !== realYear) {
      try {
        const monthKey = `${realYear}_${realMonth}`;
        const q = collection(db, 'monthlyData', monthKey, 'doctors');
        const snap = await getDocs(q);
        const realData: MonthlyData = {};
        snap.docs.forEach(d => {
          realData[Number(d.id)] = d.data() as any;
        });
        dataToUse = realData;
      } catch (err) {
        console.error("Error fetching real-time data for emergency:", err);
      }
    }

    let notifiedDocs: Doctor[] = [];

    // First scan those in the shift data
    Object.entries(dataToUse).forEach(([doctorIdStr, shifts]) => {
      const docId = Number(doctorIdStr);
      const doctor = doctors.find(d => d.id === docId);
      if (!doctor || doctor.st !== 'activo') return;

      const dayShifts = (shifts as DoctorShifts)[slot];
      let hasSigla = false;
      if (dayShifts && dayShifts[day]) {
        const siglaStr = dayShifts[day].toString();
        hasSigla = targetSiglas.some(target => siglaStr.includes(target));
      }

      let isTarget = hasSigla;
      if (type === 'ROJO' && doctor.rol === 'Enfermero Jefe') isTarget = true;
      if (type === 'AZUL' && doctor.rol === 'Interno') isTarget = true;

      if (isTarget) {
        pushNotification(docId, message);
        notifiedDocs.push(doctor);
      }
    });

    // Also forcefully include any Interno / Jefe even if they have no shift data yet
    doctors.forEach(doctor => {
      if (doctor.st !== 'activo') return;
      if (notifiedDocs.some(d => d.id === doctor.id)) return;

      let isTarget = false;
      if (type === 'ROJO' && doctor.rol === 'Enfermero Jefe') isTarget = true;
      if (type === 'AZUL' && doctor.rol === 'Interno') isTarget = true;

      if (isTarget) {
        pushNotification(doctor.id, message);
        notifiedDocs.push(doctor);
      }
    });

    setNotification({ 
      message: `CÓDIGO ${type} ACTIVADO. ${notifiedDocs.length} personas requeridas.`, 
      type: 'success' 
    });

    const wpMessage = `🚨 *¡CÓDIGO ${type}!* 🚨\nSe requiere presencia inmediata en el servicio de reanimación/urgencias.\n\n*Personal requerido (${slot.toUpperCase()}):*\n${notifiedDocs.length > 0 ? notifiedDocs.map(d => `▫️ ${d.nombre} (${d.rol})`).join('\n') : '▫️ Revisar personal de turno'}\n\n_Generado automáticamente desde Sistema HDSAR_`;
    window.open(`https://wa.me/573173683886?text=${encodeURIComponent(wpMessage)}`, '_blank');

    if (type === 'ROJO') setShowCodigoRojo(true);
    else setShowCodigoAzul(true);
  };

  const updateMonthlyData = async (newData: MonthlyData) => {
    const monthKey = `${selectedYear}_${selectedMonth}`;
    try {
      // In our current architecture, each doctor is a separate document
      // We'll write only the keys provided in newData to avoid excessive writes
      const promises = Object.keys(newData).map(doctorId => {
        return setDoc(doc(db, 'monthlyData', monthKey, 'doctors', doctorId), newData[Number(doctorId)]);
      });
      await Promise.all(promises);
      setCurrentMonthData(newData);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `monthlyData/${monthKey}`);
    }
  };

  const updateDoctorMonth = async (doctorId: number, data: any) => {
    const monthKey = `${selectedYear}_${selectedMonth}`;
    try {
      await setDoc(doc(db, 'monthlyData', monthKey, 'doctors', doctorId.toString()), data);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `monthlyData/${monthKey}/doctors/${doctorId}`);
    }
  };

  // -- Auth --
  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive');
    provider.addScope('https://www.googleapis.com/auth/spreadsheets');
    
    try {
      const result = await signInWithPopup(auth, provider);
      // Optional: Store the credential for later API calls if needed
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        localStorage.setItem('google_access_token', credential.accessToken);
      }
      setNotification({ message: "Sesión de Google iniciada con permisos de Drive", type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    } catch (err: any) {
      console.error("Google Login error:", err);
      if (err.code === 'auth/unauthorized-domain') {
        const currentDomain = window.location.hostname;
        const fullUrl = window.location.origin;
        setNotification({ 
          message: `⚠️ DOMINIO NO AUTORIZADO`, 
          type: 'error' 
        });
        alert(`⚠️ ERROR DE SEGURIDAD DE FIREBASE:\n\nEl dominio "${currentDomain}" no está en la lista blanca de tu proyecto.\n\nSI NO TIENES ACCESO A LA CONSOLA:\nSolicita al administrador del sistema que añada los siguientes dominios a "Authentication > Settings > Authorized Domains":\n\n1. ${currentDomain}\n2. ais-pre-xlref7u3vswxjgd2ec2l7j-500854713267.us-west2.run.app\n\nSi tú eres el administrador, asegúrate de estar logueado con la cuenta correcta en Firebase.`);
      } else {
        alert("Error al iniciar sesión con Google: " + (err.message || String(err)));
      }
    }
  };

  const handleLogin = async () => {
    // Admin Login
    if (loginU === MASTER_ADMIN.u && loginP === MASTER_ADMIN.p) {
      const sess: UserSession = { r: 'admin', n: 'Admin General' };
      setSession(sess);
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sess));
      return;
    }
    
    // Reader Login
    if (loginU === MASTER_READER.u) {
      const sess: UserSession = { r: 'read', n: 'Personal Invitado' };
      setSession(sess);
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sess));
      return;
    }

    // Doctor Login via API (Secure)
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ u: loginU, p: loginP })
      });
      const result = await response.json();

      if (result.success) {
        // Sign in to Firebase with Custom Token
        if (result.customToken) {
          try {
            await signInWithCustomToken(auth, result.customToken);
          } catch (tokenErr: any) {
            console.error("Firebase custom token auth failed:", tokenErr);
            if (tokenErr.code === 'auth/unauthorized-domain') {
              const currentDomain = window.location.hostname;
              const consoleUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`;
              alert(`⚠️ ERROR DE DOMINIO (Auth Token):\n\nEl dominio "${currentDomain}" no está autorizado. \n\nPara solucionar esto:\n1. Abre: ${consoleUrl}\n2. Añade el dominio: ${currentDomain}\n3. Recarga la página.`);
            }
          }
        }

        const sess = result.session;
        const expiryDays = 90;
        const lastChanged = result.passwordLastChanged || 0;
        const daysSince = (Date.now() - lastChanged) / (1000 * 60 * 60 * 24);
        
        if (daysSince > expiryDays) {
          alert("Su contraseña ha expirado (vence cada 3 meses). Por favor cámbiela inmediatamente.");
        }

        setSession(sess);
        localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sess));
      } else {
        alert(result.error || "Credenciales incorrectas");
      }
    } catch (err) {
      console.error("Login API error:", err);
      alert("Error de conexión con el servidor");
    }
  };

  const [idleTimeout, setIdleTimeout] = useState(() => Number(localStorage.getItem('idleTimeout')) || 15);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);

  // Idle timer check
  useEffect(() => {
    if (!session) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const diffInMinutes = (now - lastActivity) / 60000;
      const diffInSeconds = (now - lastActivity) / 1000;
      const totalSecondsAllowed = idleTimeout * 60;
      const secondsLeft = totalSecondsAllowed - diffInSeconds;

      if (secondsLeft <= 0) {
        handleLogout();
        setNotification({ message: "Sesión cerrada por inactividad.", type: 'info' });
        clearInterval(interval);
      } else if (secondsLeft <= 5) {
        setNotification({ message: `⚠️ CERRANDO SESIÓN EN ${Math.ceil(secondsLeft)} SEGUNDOS...`, type: 'error' });
      } else if (secondsLeft <= 60 && !showInactivityWarning) {
        setShowInactivityWarning(true);
        setNotification({ message: "Su sesión caducará pronto por inactividad.", type: 'info' });
      } else if (secondsLeft > 60 && showInactivityWarning) {
        setShowInactivityWarning(false);
      }
    }, 1000);

    const resetTimer = () => setLastActivity(Date.now());
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    window.addEventListener('scroll', resetTimer);

    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('scroll', resetTimer);
    };
  }, [session, lastActivity, idleTimeout, showInactivityWarning]);

  const processPastedText = async (pastedText: string) => {
      try {
        const rows = pastedText.split(/\r?\n/).map(row => row.split('\t'));
        if (rows.length === 0 || (rows.length === 1 && rows[0].length <= 1)) return; // No real table data

        if (!confirm(`¿Desea pegar y procesar datos de turnos (${rows.length} filas)?`)) return;

        setNotification({ message: 'Procesando datos pegados...', type: 'info' });
        
        const newData = { ...currentMonthData };
        let count = 0;
        let lastDoctorId: string | null = null;
        
        for (const rawRow of rows) {
            if (rawRow.length <= 1) continue; 
            
            let medName = String(rawRow[0] || '').trim();
            let jornada = String(rawRow[1] || '').trim().toLowerCase();
            
            if (medName) {
              const cleanNameTokens = medName.toLowerCase().replace(/dr\.?|dra\.?|medico|médico/g, '').trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/\x20+/);
              const found = doctors.find(d => {
                 const dName = d.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                 const dNameTokens = dName.split(/\x20+/);
                 return cleanNameTokens.filter(t => t.length > 2).every(t => dNameTokens.includes(t)) || 
                        dName === cleanNameTokens.join(' ') || dName.includes(cleanNameTokens.join(' ')) || cleanNameTokens.join(' ').includes(dName);
              });
              if (found) {
                  lastDoctorId = found.id.toString();
              } else {
                  lastDoctorId = null;
              }
            }
            
            if (!lastDoctorId) continue;
            
            let slot: SlotType = 'm';
            if (jornada.startsWith('t') || jornada.includes('tard') || jornada.includes('t')) slot = 't';
            else if (jornada.startsWith('n') || jornada.includes('noch') || jornada.includes('n')) slot = 'n';
            else if (jornada.startsWith('m') || jornada.includes('mañ') || jornada.includes('m')) slot = 'm';
            
            if (!newData[Number(lastDoctorId)]) newData[Number(lastDoctorId)] = { m: {}, t: {}, n: {} };
            
            let dayColOffset = 2; 
            for (let d = 1; d <= daysInMonth; d++) {
               let val = String(rawRow[dayColOffset + d - 1] || '').trim();
               if (val && val !== '0' && val !== '0h' && val !== 'X' && !val.includes('TOTAL')) {
                   newData[Number(lastDoctorId)][slot][d] = val;
               } else if (val === 'X' || val === '') {
                   delete newData[Number(lastDoctorId)][slot][d];
               }
            }
            count++;
        }
        
        if (count > 0) {
            const monthKey = `${selectedYear}_${selectedMonth}`;
            const promises = Object.keys(newData).map(doctorId => {
               return setDoc(doc(db, 'monthlyData', monthKey, 'doctors', doctorId), newData[Number(doctorId)]);
            });
            await Promise.all(promises);
            setCurrentMonthData(newData);
            setNotification({ message: `Turnos pegados con éxito (${count} filas).`, type: 'success' });
        } else {
            setNotification({ message: 'No se encontraron datos reconocibles con nombres de médicos exactos', type: 'error' });
        }

      } catch (err) {
        console.error("Paste parse error:", err);
        setNotification({ message: 'Error al pegar datos. Verifique el formato', type: 'error' });
      }
  };

  // Global Paste Handler for Excel Import
  useEffect(() => {
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      // Only process when in Turnos view and is Admin/Root
      if (activeTab !== 'turnos' || (session?.r !== 'admin' && session?.r !== 'root')) return;

      // Do nothing if user is focused inside an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const clipboardData = e.clipboardData;
      if (!clipboardData) return;
      
      const pastedText = clipboardData.getData('text');
      if (!pastedText) return;
      
      processPastedText(pastedText);
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [activeTab, session, doctors, currentMonthData, daysInMonth, selectedYear, selectedMonth]);

  const [isGeneratingAISuggestions, setIsGeneratingAISuggestions] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<MonthlyData | null>(null);

  const generateAISuggestions = async () => {
    if (!session) return;
    setIsGeneratingAISuggestions(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const activeDoctors = doctors.filter(d => d.st === 'activo');
      
      // Sort doctors for AI: Rural doctors first (indices 1-5), then next items.
      const sortedDoctors = [...activeDoctors].sort((a, b) => {
        const catOrder: Record<string, number> = { 'Rural': 1, 'Planta': 2, 'CTA': 3, 'APS': 4, 'Disponibilidad': 5 };
        const orderA = catOrder[a.cat] || 99;
        const orderB = catOrder[b.cat] || 99;
        return orderA - orderB;
      });

      const doctorsList = sortedDoctors.map((d, index) => ({
        id: d.id,
        nombre: d.nombre,
        cat: d.cat,
        rol: d.rol,
        index: index + 1 // To follow the "first 5", "next 3" rule
      }));
      
      const monthRequests = shiftRequests.filter(r => r.targetMonth === selectedMonth && r.targetYear === selectedYear);
      let requestsText = "No hay solicitudes registradas para este mes.";
      if (monthRequests.length > 0) {
        requestsText = monthRequests.map(r => `- Dr/a. ${r.doctorName} (ID ${r.doctorId}) solicita en el día ${r.day} turno/jornada '${r.slot.toUpperCase()}' estado de la solicitud: ${r.status}. Motivo: ${r.reason}`).join('\n');
      }
      
      const prompt = `Eres un experto en gestión de turnos hospitalarios. Genera una propuesta de turnos para el periodo ${MONTH_NAMES[selectedMonth]} ${selectedYear}.
Médicos disponibles (ordenados por importancia administrativa): ${JSON.stringify(doctorsList)}

SOLICITUDES DE CAMBIO DE TURNO (MUY IMPORTANTE):
${requestsText}
Integra estas solicitudes en la malla en la medida de lo posible, especialmente si están 'approved' o 'pending'.

REGLAS ESTRICTAS DE ASIGNACIÓN:
1. Médicos Rurales (Primeros 5 médicos en la lista - Índices 1 al 5): Son los encargados de la disponibilidad crítica. Deben rotar las siglas 'D1', 'D2' y 'D3'.
2. Siguientes 3 médicos (Índices 6 al 8): Pueden hacer disponibilidad pero SOLAMENTE 'D2' o 'D3'. NUNCA 'D1'.
3. Médicos Categoría 'CTA' o de Contrato: Deben tener un fin de semana LIBRE (sábado y domingo completo sin turnos) cada 15 días (ej: libre fin de semana 1 y 3, o 2 y 4).
4. Carga Equitativa de Noches: Los médicos de 'Planta' deben tener la misma cantidad de turnos de noche ('n') en el mes entre ellos, y esta cantidad debe ser balanceada con la de los médicos de 'CTA'.
5. Reglas Generales de Seguridad:
   - Evitar turnos dobles consecutivos.
   - Máximo un turno por slot (m, t, n) por día.
   - Si un médico tiene Noche ('n'), el día siguiente en la mañana ('m') debe ser 'PT' (Descanso Post-Turno).
   - Respetar solicitudes previas si las hay (aunque no se listan aquí, intenta ser balanceado).

SIGLAS DISPONIBLES:
- Mañana (m): M, 10m, 11m, 12m, 13m, 14m, 15m, 16m, D1, PT, L (Libre)
- Tarde (t): T, 10t, 11t, 12t, 13t, 14t, 15t, 16t, CX2, D2, PT, L (Libre)
- Noche (n): N, 11-10n, 13n, 14n, 16n, 13-10-11n, 13n-16n, D3, PT, L (Libre)

Responde ÚNICAMENTE con un objeto JSON (sin markdown, solo el objeto) con esta estructura:
{
  "doctorId": {
    "m": { "1": "SIGLA", "2": "SIGLA", ... },
    "t": { "1": "SIGLA", "2": "SIGLA", ... },
    "n": { "1": "SIGLA", "2": "SIGLA", ... }
  }
}
Donde doctorId es el ID numérico del médico y las llaves de los días son del 1 al ${daysInMonth}.`;

      const response = await ai.models.generateContent({
        model: "gemini-1.5-pro",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const text = response.text;
      const suggestions = JSON.parse(text);
      setAiSuggestions(suggestions);
      setNotification({ message: "Sugerencias de la IA generadas con éxito.", type: 'success' });
    } catch (error) {
      console.error("AI Error:", error);
      setNotification({ message: "Error al generar sugerencias con IA.", type: 'error' });
    } finally {
      setIsGeneratingAISuggestions(false);
    }
  };

  const applyAISuggestions = () => {
    if (!aiSuggestions) return;
    
    // Create audit entries for applying AI changes
    const newAuditEntries: AuditEntry[] = [];
    const now = Date.now();
    
    Object.entries(aiSuggestions).forEach(([docIdStr, shifts]) => {
      const docId = parseInt(docIdStr);
      const doctor = doctors.find(d => d.id === docId);
      if (!doctor) return;

      ['m', 't', 'n'].forEach(slot => {
        Object.entries((shifts as any)[slot] || {}).forEach(([dayStr, sigla]) => {
          const day = parseInt(dayStr);
          const oldSigla = currentMonthData[docId]?.[slot as SlotType]?.[day] || '';
          if (oldSigla !== sigla) {
            newAuditEntries.push({
              id: Math.floor(Math.random() * 1000000),
              timestamp: now,
              targetMonth: selectedMonth,
              targetYear: selectedYear,
              doctorId: docId,
              doctorName: doctor.nombre,
              day,
              slot: slot as SlotType,
              oldSigla,
              newSigla: sigla as string,
              adminName: session?.n || 'AI Suggestion'
            });
          }
        });
      });
    });

    setCurrentMonthData(prev => ({
      ...prev,
      ...aiSuggestions
    }));
    
    setAuditLogs(prev => [...newAuditEntries, ...prev]);
    setAiSuggestions(null); // Clear after applying
    setNotification({ message: "Sugerencias aplicadas. Los cambios se han guardado.", type: 'success' });
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.warn("Sign out error:", err);
    }
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    setSession(null);
    setLoginU('');
    setLoginP('');
    setActiveTab('turnos');
  };

  const changePassword = async () => {
    if (!session?.doctorId || !newPass) return;
    const docRef = doc(db, 'doctors', session.doctorId.toString());
    const d = doctors.find(doc => doc.id === session.doctorId);
    if (!d) return;
    
    if (d.password !== oldPass) return alert("La contraseña actual es incorrecta");
    if (newPass.length < 4) return alert("La nueva contraseña debe tener al menos 4 caracteres");

    try {
      await updateDoc(docRef, { 
        password: newPass, 
        passwordLastChanged: Date.now() 
      });
      
      setOldPass('');
      setNewPass('');
      setNotification({ message: "Contraseña actualizada con éxito", type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `doctors/${session.doctorId}`);
    }
  };

  // -- Admin Actions --
  const addDoctor = async () => {
    if (!newDocName) return;
    const cleanName = newDocName.toLowerCase().replace(/\s+/g, '').substring(0, 8);
    const username = `${cleanName}${Math.floor(100 + Math.random() * 900)}`;
    const password = `ESE${Math.floor(1000 + Math.random() * 9000)}`;
    const id = Date.now();

    const newDoc: Doctor = { 
      id, 
      nombre: newDocName, 
      email: newDocEmail || undefined,
      cat: newDocCat, 
      rol: newDocRol,
      st: 'activo',
      contacto: newDocContact || undefined,
      username,
      password,
      passwordLastChanged: Date.now()
    };
    
    try {
      const docRef = doc(db, 'doctors', id.toString());
      // Optimistic Update
      setDoctors(prev => [...prev, newDoc]);
      
      await setDoc(docRef, newDoc);
      setNewDocName('');
      setNewDocEmail('');
      setNewDocContact('');
      setNotification({ message: "Médico añadido correctamente", type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      setNotification({ message: "Error crítico: No tiene permisos. Vincule Google en el banner superior.", type: 'error' });
      // Revert if failed (listener will eventually sync anyway, but this helps)
      setDoctors(prev => prev.filter(d => d.id !== id));
      handleFirestoreError(err, OperationType.WRITE, `doctors/${id}`);
    }
  };

  const [isRegistering, setIsRegistering] = useState(false);

  const handleSelfRegister = async () => {
    // 1. Basic required fields check
    if (!regNombre.trim() || !regApellidos.trim() || !regEmail.trim() || !regCedula.trim()) {
      return alert("Por favor complete los campos obligatorios: Nombres, Apellidos, Correo y Cédula.");
    }
    
    // 2. Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(regEmail.trim())) {
      return alert("El formato del correo electrónico no es válido.");
    }

    // 3. Cedula numeric validation (usually 6 to 12 digits in Colombia)
    const cleanCedula = regCedula.trim();
    if (!/^\d+$/.test(cleanCedula) || cleanCedula.length < 5 || cleanCedula.length > 12) {
      return alert("La cédula debe ser un número válido (entre 5 y 12 dígitos).");
    }

    try {
      setIsRegistering(true);
      setNotification({ message: "Verificando datos...", type: 'info' });
      
      // Verify if already exists via API (since doctors list may be restricted)
      const checkRes = await fetch('/api/check-doctor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cedula: cleanCedula })
      });
      const checkData = await checkRes.json();
      
      if (!checkData.success) throw new Error(checkData.error);
      
      const cleanName = regNombre.trim().toLowerCase().replace(/\s+/g, '').substring(0, 5);
      const username = `${cleanName}${cleanCedula.slice(-4)}`;
      const password = `ESE${Math.floor(1000 + Math.random() * 9000)}`;

      if (checkData.exists) {
        // If doctor exists but has no credentials, we "activate" them
        if (!checkData.username) {
          const updateData = {
            username,
            password,
            passwordLastChanged: Date.now(),
            email: regEmail.trim(),
            telefono: regTelefono.trim(),
            nombre: `${regNombre.trim()} ${regApellidos.trim()}`,
            apellidos: regApellidos.trim(),
            registroMedico: regRegistroMedico.trim()
          };

          const response = await fetch('/api/register-doctor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              doctorId: checkData.id,
              doctorData: updateData,
              isUpdate: true
            })
          });

          const result = await response.json();
          if (!result.success) throw new Error(result.error);

          // Send Email Notification
          await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: regEmail.trim(),
              subject: 'Activación de Cuenta - Turnero HDSAR',
              text: `Hola ${regNombre}, tu cuenta ha sido activada. Usuario: ${username}, Contraseña: ${password}`,
              html: `
                <div style="font-family: sans-serif; padding: 20px; color: #334155;">
                  <h2 style="color: #059669;">¡Cuenta Activada!</h2>
                  <p>Estimado(a) <strong>${regNombre}</strong>,</p>
                  <p>Tu acceso al Turnero Digital ha sido generado con éxito.</p>
                  <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
                    <p style="margin: 5px 0;"><strong>Usuario:</strong> <code style="color: #059669; font-weight: bold;">${username}</code></p>
                    <p style="margin: 5px 0;"><strong>Contraseña:</strong> <code style="color: #059669; font-weight: bold;">${password}</code></p>
                  </div>
                  <p style="font-size: 12px; color: #64748b;">Le recomendamos cambiar su contraseña en el primer inicio de sesión.</p>
                </div>
              `
            })
          }).catch(e => console.error("Email registration err:", e));

          // Auth in Firebase with Custom Token
          if (result.customToken) {
            try {
              await signInWithCustomToken(auth, result.customToken);
            } catch (tokenErr: any) {
              console.error("Firebase custom token auth failed (Activation):", tokenErr);
              if (tokenErr.code === 'auth/unauthorized-domain') {
                 console.warn("Unauthorized domain for custom token auth - session persistence limited.");
              }
            }
          }

          setGeneratedCreds({ u: username, p: password });
          setNotification({ message: "¡Cuenta activada! Sus credenciales han sido generadas.", type: 'success' });
        } else {
          // Already has an account
          alert(`Ya existe una cuenta para esta cédula. Su usuario es: ${checkData.username}`);
          setShowRegModal(false);
          setLoginU(checkData.username);
          setNotification(null);
        }
      } else {
        // Create new doctor record
        const id = Date.now();
        const newDoc: Doctor = { 
          id, 
          nombre: `${regNombre.trim()} ${regApellidos.trim()}`,
          apellidos: regApellidos.trim(),
          cedula: cleanCedula,
          registroMedico: regRegistroMedico.trim(),
          email: regEmail.trim(),
          telefono: regTelefono.trim(),
          cat: regRol === 'Médico Rural' ? 'Rural' : 'Planta',
          rol: regRol,
          st: 'activo',
          username,
          password,
          passwordLastChanged: Date.now(),
          createdAt: Date.now()
        };

        const response = await fetch('/api/register-doctor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            doctorId: id,
            doctorData: newDoc,
            isUpdate: false
          })
        });

        const result = await response.json();
        if (!result.success) throw new Error(result.error);

        // Send Email Notification
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: regEmail.trim(),
            subject: 'Registro Exitoso - Turnero HDSAR',
            text: `Hola ${regNombre}, tu registro ha sido exitoso. Usuario: ${username}, Contraseña: ${password}`,
            html: `
              <div style="font-family: sans-serif; padding: 20px; color: #334155;">
                <h2 style="color: #059669;">¡Registro Exitoso!</h2>
                <p>Estimado(a) <strong>${regNombre}</strong>,</p>
                <p>Bienvenido al sistema de Coordinación Médica HDSAR.</p>
                <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
                  <p style="margin: 5px 0;"><strong>Usuario:</strong> <code style="color: #059669; font-weight: bold;">${username}</code></p>
                  <p style="margin: 5px 0;"><strong>Contraseña:</strong> <code style="color: #059669; font-weight: bold;">${password}</code></p>
                </div>
                <p style="font-size: 12px; color: #64748b;">Le recomendamos cambiar su contraseña en el primer inicio de sesión.</p>
              </div>
            `
          })
        }).catch(e => console.error("Email registration err:", e));

        // Auth in Firebase with Custom Token
        if (result.customToken) {
          try {
            await signInWithCustomToken(auth, result.customToken);
          } catch (tokenErr: any) {
            console.error("Firebase custom token auth failed (Registration):", tokenErr);
            if (tokenErr.code === 'auth/unauthorized-domain') {
               console.warn("Unauthorized domain for custom token auth - registration worked but persistence limited.");
            }
          }
        }

        setGeneratedCreds({ u: username, p: password });
        setNotification({ message: "¡Registro exitoso! Sus credenciales han sido generadas.", type: 'success' });
      }
    } catch (err) {
      console.error("Registration error:", err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setNotification({ message: `Error: ${errMsg}`, type: 'error' });
      handleFirestoreError(err, OperationType.WRITE, `doctors/registration-api`);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleBatchImportDoctors = async (importedDoctors: any[]) => {
    if (session?.r !== 'admin') return;
    
    if (!confirm(`¿Desea importar/actualizar ${importedDoctors.length} registros? Se actualizarán los datos existentes.`)) return;

    setNotification({ message: "Procesando Talento Humano...", type: 'info' });
    let successCount = 0;
    let errorCount = 0;

    for (const docData of importedDoctors) {
      try {
        const id = docData.id || Date.now() + Math.random();
        const cleanCedula = (docData.cedula || '').toString().trim();
        if (!cleanCedula || !docData.nombre) continue;

        const doctorData: Doctor = {
          id: Number(id),
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

  const resetDoctorPass = async (id: number) => {
    const defaultPass = `ESE${Math.floor(1000 + Math.random() * 9000)}`;
    try {
      await updateDoc(doc(db, 'doctors', id.toString()), { 
        password: defaultPass, 
        passwordLastChanged: Date.now() 
      });
      alert(`Nueva contraseña genérica para este usuario: ${defaultPass}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `doctors/${id}`);
    }
  };

  const submitShiftRequest = async () => {
    if (!session?.doctorId || !reqReason) return alert("Por favor escriba un motivo.");
    const id = Date.now();
    
    const newReq: ShiftRequest = {
      id,
      timestamp: Date.now(),
      doctorId: session.doctorId,
      doctorName: session.n,
      day: reqDay,
      slot: reqSlot,
      reason: reqReason,
      status: 'pending',
      targetMonth: selectedMonth,
      targetYear: selectedYear
    };

    try {
      await setDoc(doc(db, 'shiftRequests', id.toString()), newReq);
      setReqReason('');
      setNotification({ 
        message: isOnline 
          ? "Solicitud de cambio enviada correctamente" 
          : "Solicitud guardada localmente. Se enviará automáticamente al reconectar.", 
        type: 'success' 
      });
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `shiftRequests/${id}`);
    }
  };

  const updateRequestStatus = async (id: number, status: 'approved' | 'rejected') => {
    const req = shiftRequests.find(r => r.id === id);
    if (!req) return;

    try {
      await updateDoc(doc(db, 'shiftRequests', id.toString()), { status });
      
      // PUSH NOTIFICATION
      await pushNotification(req.doctorId, `Tu solicitud del día ${req.day} ha sido ${status === 'approved' ? 'APROBADA' : 'RECHAZADA'}.`);
      
      // EMAIL NOTIFICATION
      const doctor = doctors.find(d => d.id === req.doctorId);
      if (doctor && doctor.email) {
        sendEmailNotification(doctor.email, doctor.nombre, req, status);
      }

      // WHATSAPP NOTIFICATION
      if (status === 'approved' && doctor?.telefono) {
        const cleanPhone = doctor.telefono.replace(/\D/g, '');
        if (cleanPhone.length >= 10) {
          const text = encodeURIComponent(`Hola Dr(a). ${doctor.nombre}, su solicitud de cambio de turno para el día ${req.day} ha sido APROBADA en el sistema HDSAR.`);
          window.open(`https://wa.me/57${cleanPhone}?text=${text}`, '_blank');
        }
      }

      setNotification({ message: `Solicitud ${status === 'approved' ? 'aprobada' : 'rechazada'}`, type: 'info' });
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `shiftRequests/${id}`);
    }
  };

  const submitRuralAvailability = async () => {
    if (!session?.doctorId) return;
    if (!ruralCallDate || !ruralCallTime || !ruralEndDate || !ruralEndTime || !ruralPatientName) {
      return alert("Por favor complete los campos obligatorios.");
    }

    const start = new Date(`${ruralCallDate}T${ruralCallTime}`);
    const end = new Date(`${ruralEndDate}T${ruralEndTime}`);
    
    if (end < start) {
      return alert("La fecha de término no puede ser anterior a la de llamado.");
    }

    // -- Calculate overlap with existing shifts --
    // We deduct hours if the doctor had a shift during the reported availability
    let totalGrossHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    let deduction = 0;

    // Helper to get slot interval
    const getSlotInterval = (day: number, slot: SlotType, month: number, year: number) => {
      const d = new Date(year, month, day);
      let s = new Date(d);
      let e = new Date(d);
      if (slot === 'm') { s.setHours(7,0,0,0); e.setHours(13,0,0,0); }
      if (slot === 't') { s.setHours(13,0,0,0); e.setHours(19,0,0,0); }
      if (slot === 'n') { s.setHours(19,0,0,0); e.setDate(e.getDate() + 1); e.setHours(7,0,0,0); }
      return { s, e };
    };

    const docShifts = currentMonthData[session.doctorId];
    if (docShifts) {
      // Check each day of the month for overlaps
      for (let day = 1; day <= daysInMonth; day++) {
        (['m', 't', 'n'] as SlotType[]).forEach(slot => {
          const sigla = docShifts[slot][day];
          // If sigla exists and is not empty or 'L' (libre), it considers it a programmed shift
          if (sigla && sigla !== 'X' && sigla !== 'L') {
            const interval = getSlotInterval(day, slot, selectedMonth, selectedYear);
            
            // Check intersection between [start, end] and [interval.s, interval.e]
            const intersectStart = Math.max(start.getTime(), interval.s.getTime());
            const intersectEnd = Math.min(end.getTime(), interval.e.getTime());
            
            if (intersectStart < intersectEnd) {
              const overlapHours = (intersectEnd - intersectStart) / (1000 * 60 * 60);
              deduction += overlapHours;
            }
          }
        });
      }
    }

    const finalHours = Math.max(0, totalGrossHours - deduction);
    
    if (deduction > 0) {
      if (!confirm(`Se detectó un cruce de ${deduction.toFixed(1)}h con turnos ya programados. Estas horas se descontarán del reporte (Total: ${finalHours.toFixed(1)}h). ¿Desea continuar?`)) return;
    }

    const id = Date.now().toString();
    const newEntry: RuralAvailability = {
      id,
      doctorId: session.doctorId,
      doctorName: session.n,
      callDateTime: start.getTime(),
      hospitalArrivalTime: ruralHospitalArrival,
      activity: `${ruralActivityType}: ${ruralActivity}`,
      patientName: ruralPatientName,
      patientId: ruralPatientId,
      diagnosis: ruralDiagnosis,
      acceptancePlace: ruralAcceptancePlace,
      calledBy: ruralCalledBy,
      terminationDateTime: end.getTime(),
      totalHours: Number(finalHours.toFixed(2)),
      timestamp: Date.now(),
      targetMonth: selectedMonth,
      targetYear: selectedYear
    };

    try {
      await setDoc(doc(db, 'ruralAvailability', id), newEntry);
      
      // Reset Form
      setRuralCallDate('');
      setRuralCallTime('');
      setRuralHospitalArrival('');
      setRuralActivity('');
      setRuralPatientName('');
      setRuralPatientId('');
      setRuralDiagnosis('');
      setRuralAcceptancePlace('');
      setRuralCalledBy('');
      setRuralEndDate('');
      setRuralEndTime('');
      setRuralActivityType('Traslado / Disponibilidad');

      setNotification({ 
        message: isOnline 
          ? `Reporte guardado (${finalHours.toFixed(1)}h netas)` 
          : `Reporte guardado localmente (${finalHours.toFixed(1)}h). Se sincronizará pronto.`, 
        type: 'success' 
      });
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `ruralAvailability/${id}`);
    }
  };

  const exportShiftRequests = () => {
    const filtered = shiftRequests.filter(r => r.targetMonth === selectedMonth && r.targetYear === selectedYear);
    if (filtered.length === 0) return alert("No hay solicitudes para exportar.");

    let content = `REPORTE DE SOLICITUDES DE CAMBIO - ESE ROLDANILLO\n`;
    content += `Mes: ${MONTH_NAMES[selectedMonth]} ${selectedYear}\n`;
    content += `Generado: ${new Date().toLocaleString()}\n`;
    content += `==============================================\n\n`;

    filtered.forEach(req => {
      content += `[${new Date(req.timestamp).toLocaleString()}]\n`;
      content += `Médico: ${req.doctorName}\n`;
      content += `Día: ${req.day} | Slot: ${req.slot.toUpperCase()}\n`;
      content += `Motivo: ${req.reason}\n`;
      content += `Estado: ${req.status.toUpperCase()}\n`;
      content += `----------------------------------------------\n`;
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Solicitudes_Cambios_${selectedMonth + 1}_${selectedYear}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleDoctorStatus = async (id: number) => {
    const d = doctors.find(doc => doc.id === id);
    if (!d) return;
    try {
      await updateDoc(doc(db, 'doctors', id.toString()), { st: d.st === 'activo' ? 'inactivo' : 'activo' });
    } catch(err) {
      handleFirestoreError(err, OperationType.WRITE, `doctors/${id}`);
    }
  };

  const handleReorderDoctors = async (sourceId: number, targetId: number) => {
    const currentOrder = [...doctors].sort(sortDoctors);
    const sourceIndex = currentOrder.findIndex(d => d.id === sourceId);
    const targetIndex = currentOrder.findIndex(d => d.id === targetId);
    
    if (sourceIndex === -1 || targetIndex === -1) return;

    const items = Array.from(currentOrder);
    const [reorderedItem] = items.splice(sourceIndex, 1);
    items.splice(targetIndex, 0, reorderedItem);

    const batchOps = items.map((docItem, index) => {
      return { id: docItem.id, newOrder: index + 1 };
    });

    const newDocs = doctors.map(d => {
      const bo = batchOps.find(b => b.id === d.id);
      return bo ? { ...d, order: bo.newOrder } : d;
    });
    setDoctors(newDocs);

    try {
      const promises = batchOps.map(bo => updateDoc(doc(db, 'doctors', bo.id.toString()), { order: bo.newOrder }));
      await Promise.all(promises);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'doctors/order');
    }
  };

  const deleteDoctor = async (id: number) => {
    if (!confirm("¿Eliminar permanentemente?")) return;
    try {
      await deleteDoc(doc(db, 'doctors', id.toString()));
    } catch(err) {
      handleFirestoreError(err, OperationType.DELETE, `doctors/${id}`);
    }
  };

  const addVariable = async () => {
    const hourStr = newVarHour.toString().trim();
    const h = parseFloat(hourStr);
    
    // Strict numeric validation: No empty string, must be a number, must be non-negative
    // and must not contain invalid characters that parseFloat might ignore (like "12abc")
    if (!newVarCode || isNaN(h) || !/^\d+(\.\d+)?$/.test(hourStr)) {
      alert("Por favor ingrese una Sigla válida y un número de horas decimal válido (Ej: 6 o 6.5)");
      return;
    }
    const code = newVarCode.trim(); // Preserve original casing
    
    // Validate duplicates
    const isNew = !editingVar;
    const changedIdentity = editingVar && (editingVar.slot !== newVarSlot || editingVar.code !== code);
    
    if (isNew || changedIdentity) {
      if (variables[newVarSlot][code] !== undefined) {
         alert(`ERROR: La sigla "${code}" ya existe registrada en la jornada ${newVarSlot === 'm' ? 'MAÑANA' : newVarSlot === 't' ? 'TARDE' : 'NOCHE'}.`);
         return;
      }
    }

    let updated = { ...variables };
    
    // If editing and changed slot or code, remove from old place
    if (editingVar && (editingVar.slot !== newVarSlot || editingVar.code !== code)) {
      const oldSlotData = { ...updated[editingVar.slot] };
      delete oldSlotData[editingVar.code];
      updated[editingVar.slot] = oldSlotData;
    }
    
    updated[newVarSlot] = { ...updated[newVarSlot], [code]: h };
    
    // Optimistic Update
    setVariables(updated);
    
    // Ensure object structure is intact
    ['m', 't', 'n'].forEach(s => {
      const slot = s as SlotType;
      if (!updated[slot]) updated[slot] = {};
    });

    try {
      await setDoc(doc(db, 'settings', 'variables'), updated);
      setNewVarCode('');
      setNewVarHour('');
      setEditingVar(null);
      setNotification({ message: "Sigla guardada en el servidor", type: 'success' });
      setTimeout(() => setNotification(null), 2000);
    } catch(err) {
      setNotification({ message: "Error: No tiene permisos de escritura", type: 'error' });
      handleFirestoreError(err, OperationType.WRITE, `settings/variables`);
    }
  };

  const removeVariable = async (slot: SlotType, code: string) => {
    if (!confirm(`¿Eliminar la sigla ${code}?`)) return;
    
    const updated = { ...variables };
    const slotData = { ...updated[slot] };
    delete slotData[code];
    updated[slot] = slotData;

    // Optimistic Update
    setVariables(updated);

    try {
      await setDoc(doc(db, 'settings', 'variables'), updated);
    } catch(err) {
      handleFirestoreError(err, OperationType.WRITE, `settings/variables`);
    }
  };

  const addLegend = async () => {
    if (!newLegendRole.trim() || !newLegendContent.trim()) return;
    const newLegends = [...customLegends, { role: newLegendRole.trim(), legend: newLegendContent.trim() }];
    setCustomLegends(newLegends);
    setNewLegendRole('');
    setNewLegendContent('');
    try {
      await setDoc(doc(db, 'settings', 'legends'), { list: newLegends });
      setNotification({ message: "Leyenda agregada", type: 'success' });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/legends');
    }
  };

  const removeLegend = async (idx: number) => {
    if (!confirm("Eliminar este panel de siglas?")) return;
    const newLegends = customLegends.filter((_, i) => i !== idx);
    setCustomLegends(newLegends);
    try {
      await setDoc(doc(db, 'settings', 'legends'), { list: newLegends });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/legends');
    }
  };

  const downloadTemplateExcel = () => {
    const filename = `Plantilla_Turnos_${MONTH_NAMES[selectedMonth]}_${selectedYear}.xlsx`;
    const header = ["ID_MEDICO", "NOMBRE_MEDICO", "JORNADA"];
    for (let i = 1; i <= 31; i++) header.push(`DIA_${i}`);
    header.push("NOTAS");
    
    const rows: any[][] = [header];
    
    doctors.filter(d => d.st === 'activo')
    .sort(sortDoctors)
    .forEach(med => {
      (['m', 't', 'n'] as SlotType[]).forEach((slot) => {
        const rowData: any[] = [
          med.id, 
          med.nombre, 
          slot === 'm' ? 'Mañana' : slot === 't' ? 'Tarde' : 'Noche'
        ];
        for (let d = 1; d <= 31; d++) {
          const val = currentMonthData[med.id]?.[slot]?.[d] || '';
          rowData.push(val);
        }
        rowData.push(""); // Notes placeholder
        rows.push(rowData);
      });
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Turnos");
    XLSX.writeFile(wb, filename);
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setNotification({ message: "Importando turnos...", type: 'info' });
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { defval: "" }) as any[];
        
        if (!data || data.length === 0) {
          setNotification({ message: "Error: El archivo de turnos está vacío o no tiene el formato correcto.", type: 'error' });
          return;
        }

        const monthKey = `${selectedYear}_${selectedMonth}`;
        let count = 0;

        for (const row of data) {
          let doctorId = row.ID_MEDICO || row.id_medico || row.ID || row.Id || row.id;
          const medName = row.NOMBRE_MEDICO || row.nombre_medico || row['MÉDICO'] || row['Nombre'] || row['Médico'];
          
          // Robust Slot detection
          const rawJ = String(row.JORNADA || row.jornada || row['JORNADA'] || row['Jornada'] || row['Slot'] || row['slot'] || "").trim().toLowerCase();
          let slot: SlotType = 'm';
          if (rawJ === 't' || rawJ === 'tarde' || rawJ.includes('tard')) slot = 't';
          else if (rawJ === 'n' || rawJ === 'noche' || rawJ.includes('noch')) slot = 'n';
          else if (rawJ === 'm' || rawJ === 'mañana' || rawJ.includes('mañ')) slot = 'm';
          else {
             // Fallback: check if the rawJ just says 't' or 'n' or 'm'
             if (rawJ.startsWith('t')) slot = 't';
             else if (rawJ.startsWith('n')) slot = 'n';
             else slot = 'm';
          }

          if (!doctorId && medName) {
            const found = doctors.find(d => d.nombre.toLowerCase().trim() === medName.toString().toLowerCase().trim());
            if (found) doctorId = found.id;
          }

          if (!doctorId) continue;

          const shiftUpdate: Record<string, string> = {};
          for (let d = 1; d <= 31; d++) {
            const val = row[`DIA_${d}`] || row[d.toString()] || row[d] || row[`DIA ${d}`] || row[`dia_${d}`] || row[`dia ${d}`];
            if (val !== undefined && val !== null && val.toString().trim() !== '') {
              shiftUpdate[d.toString()] = val.toString().trim();
            }
          }

          if (Object.keys(shiftUpdate).length > 0) {
            await setDoc(doc(db, 'monthlyData', monthKey, 'doctors', String(doctorId)), {
              [slot]: shiftUpdate
            }, { merge: true });
            count++;
          }
        }

        setNotification({ message: `¡Éxito! Se actualizaron turnos para ${count} registros.`, type: 'success' });
        setTimeout(() => window.location.reload(), 1500);
      } catch (err) {
        console.error("Error importing turns:", err);
        setNotification({ message: "Error al importar. Verifique el formato del archivo.", type: 'error' });
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const addActivity = async () => {
    if (!newActivity.activityName || !newActivity.day) {
      return alert("El nombre de la actividad y el día son obligatorios.");
    }

    try {
      const activityId = Date.now().toString();
      const activity: TrainingActivity = {
        ...newActivity as TrainingActivity,
        id: activityId,
        month: selectedMonth,
        year: selectedYear,
        timestamp: Date.now(),
        attendees: [],
        status: 'programada',
      };

      await setDoc(doc(db, 'trainingActivities', activityId), activity);
      setNewActivity({
        modality: 'presencial',
        status: 'programada',
        files: {}
      });
      setShowActivitiesModal(false);
      setNotification({ message: "Actividad programada correctamente", type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'trainingActivities');
    }
  };

  const deleteActivity = async (id: string) => {
    if (!confirm("¿Está seguro de eliminar esta actividad?")) return;
    try {
      await deleteDoc(doc(db, 'trainingActivities', id));
      setNotification({ message: "Actividad eliminada", type: 'info' });
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `trainingActivities/${id}`);
    }
  };

  const exportPICExcel = () => {
    const currentActivities = activities.filter(a => a.month === selectedMonth && a.year === selectedYear);
    if (currentActivities.length === 0) return alert("No hay actividades para exportar.");

    const rows = currentActivities.map(a => ({
      'Día': a.day,
      'Actividad': a.activityName,
      'Lugar': a.place,
      'Modalidad': a.modality,
      'Horas': a.hours,
      'Responsable': a.responsible,
      'Dirigida a': a.targetGroup,
      'Población': a.targetPopulation,
      'Estado': a.status
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PIC_" + MONTH_NAMES[selectedMonth]);
    XLSX.writeFile(wb, `PIC_Capacitaciones_${MONTH_NAMES[selectedMonth]}_${selectedYear}.xlsx`);
  };

  const exportPICPDF = () => {
    const currentActivities = activities.filter(a => a.month === selectedMonth && a.year === selectedYear);
    if (currentActivities.length === 0) return alert("No hay actividades para exportar.");

    const doc = new jsPDF('l', 'pt', 'a4');
    
    // Header
    doc.setFillColor(245, 158, 11); // Amber-500
    doc.rect(0, 0, 842, 60, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("PIC - PROGRAMA INSTITUCIONAL DE CAPACITACIONES", 40, 38);
    
    doc.setFontSize(10);
    doc.text(`PLAN DE CAPACITACIÓN HDSAR - ${MONTH_NAMES[selectedMonth].toUpperCase()} ${selectedYear}`, 40, 52);
    
    const tableData = currentActivities.sort((a, b) => a.day - b.day).map(a => [
      a.day,
      a.activityName,
      a.place,
      a.modality.toUpperCase(),
      a.hours,
      a.responsible,
      a.targetGroup,
      a.targetPopulation
    ]);

    (doc as any).autoTable({
      startY: 80,
      head: [['DÍA', 'ACTIVIDAD', 'LUGAR', 'MODALIDAD', 'H', 'RESPONSABLE', 'DIRIGIDA A', 'POBLACIÓN']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 150 },
        2: { cellWidth: 80 },
        3: { cellWidth: 70 },
        4: { cellWidth: 20 },
        5: { cellWidth: 100 },
        6: { cellWidth: 100 },
        7: { cellWidth: 100 }
      },
      margin: { top: 80 }
    });

    doc.save(`PIC_${MONTH_NAMES[selectedMonth]}_${selectedYear}.pdf`);
  };

  const updateTheme = async (newTheme: typeof theme) => {
    try {
      await setDoc(doc(db, 'settings', 'theme'), newTheme);
      setTheme(newTheme);
    } catch(err) {
      handleFirestoreError(err, OperationType.WRITE, `settings/theme`);
    }
  };

  const saveEditedDoctor = async () => {
    if (!editingDoc) return;
    try {
      await setDoc(doc(db, 'doctors', editingDoc.id.toString()), editingDoc);
      setEditingDoc(null);
      setNotification({ message: "Médico actualizado correctamente", type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      setNotification({ message: "Error: No se pudo actualizar el médico", type: 'error' });
      handleFirestoreError(err, OperationType.WRITE, `doctors/${editingDoc.id}`);
    }
  };

  const approveRequest = async (reqId: string, doctorId: number, day: number, slot: SlotType) => {
    try {
      await updateDoc(doc(db, 'shiftRequests', reqId), { status: 'approved' });
      await pushNotification(doctorId, `✅ SOLICITUD APROBADA: Tu cambio para el día ${day} (${slot.toUpperCase()}) ha sido autorizado y aplicado.`);
      setNotification({ message: "Solicitud autorizada y médico notificado", type: 'success' });
      setTimeout(() => setNotification(null), 2000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `shiftRequests/${reqId}`);
    }
  };

  const rejectRequest = async (reqId: string, doctorId: number, day: number, slot: SlotType) => {
    try {
      await updateDoc(doc(db, 'shiftRequests', reqId), { status: 'rejected' });
      await pushNotification(doctorId, `❌ SOLICITUD RECHAZADA: Tu solicitud para el día ${day} (${slot.toUpperCase()}) no pudo ser procesada en este momento.`);
      setNotification({ message: "Solicitud rechazada", type: 'info' });
      setTimeout(() => setNotification(null), 2000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `shiftRequests/${reqId}`);
    }
  };

  const publishTurnos = async () => {
    if (!confirm(`¿Desea publicar los turnos y notificar al talento humano para el mes de ${MONTH_NAMES[selectedMonth]} (${daysInMonth} días)?`)) return;
    
    const docIdsWithShifts = Object.keys(currentMonthData);

    if (docIdsWithShifts.length === 0) {
      setNotification({ message: "No hay turnos programados para publicar.", type: 'info' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    const monthKey = `${selectedYear}_${selectedMonth}`;
    try {
      await setDoc(doc(db, 'monthlyData', monthKey), { published: true }, { merge: true });
      for (const idStr of docIdsWithShifts) {
        const id = Number(idStr);
        await pushNotification(id, `📅 TURNERO PUBLICADO: Se ha publicado la programación de ${MONTH_NAMES[selectedMonth]} ${selectedYear}. Por favor revisa el turnero.`);
      }
      
      setNotification({ 
        message: `¡Turnero publicado! Notificados ${docIdsWithShifts.length} funcionarios.`, 
        type: 'success' 
      });
      setTimeout(() => setNotification(null), 4000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `monthlyData/${monthKey}`);
    }
  };

  const handleManualPaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      processPastedText(text);
    } catch (err) {
      console.error(err);
      alert("No se pudo acceder al portapapeles. Habilite permisos o use Ctrl+V.");
    }
  };

  const getFilteredTurneroData = () => {
    return doctors.filter(d => 
      (selectedRoles.length === 0 || selectedRoles.includes(d.rol || 'Médico General')) &&
      (selectedCategories.length === 0 || selectedCategories.includes(d.cat)) &&
      (doctorFilter.length === 0 || doctorFilter.includes(d.id)) && 
      (d.st === 'activo' || (currentMonthData[d.id] && Object.values(currentMonthData[d.id]).some(f => Object.keys(f).length > 0)))
    )
    .sort(sortDoctors)
    .map(med => {
      let medTotalMonth = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        (['m', 't', 'n'] as SlotType[]).forEach(slot => {
          const sigla = currentMonthData[med.id]?.[slot]?.[d] || 'X';
          medTotalMonth += getVarHours(slot, sigla);
        });
      }
      return { med, medTotalMonth };
    });
  };

  const exportTurneroExcel = () => {
    const data = getFilteredTurneroData();
    const rows: any[] = [];

    // Header Row for manual formula mapping later if needed, 
    // but SheetJS uses 'A1', 'B1' etc.
    // 1-indexed for XLSX
    
    data.forEach(({ med, medTotalMonth }) => {
      (['m', 't', 'n'] as SlotType[]).forEach((slot, sIdx) => {
        const rowData: any = {
          'MÉDICO': sIdx === 0 ? med.nombre : '',
          'JORNADA': slot === 'm' ? 'Mañana' : slot === 't' ? 'Tarde' : 'Noche',
        };
        for (let d = 1; d <= daysInMonth; d++) {
          const val = currentMonthData[med.id]?.[slot]?.[d] || 'X';
          rowData[d.toString()] = val.toUpperCase() !== 'X' ? (showGridHours ? `${val} (${getVarHours(slot, val)})` : val) : '';
        }
        
        // We will add the formula in the worksheet object directly after json_to_sheet
        if (sIdx === 0) rowData['TOTAL HORAS'] = medTotalMonth;
        rows.push(rowData);
      });
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    
    // Add formulas for TOTAL HORAS
    // Column Index for 'TOTAL HORAS' is: MÉDICO (0), JORNADA (1), Days (1 to daysInMonth), then TOTAL (2 + daysInMonth)
    const totalColIdx = 2 + daysInMonth;
    const totalColLetter = XLSX.utils.encode_col(totalColIdx);
    
    data.forEach((_, idx) => {
      const rowNum = (idx * 3) + 2; // +2 for header and 0-indexing
      // Sum the 3 rows' hours if they were all converted to numbers? 
      // Actually, we want to sum the specific values for the doctor across the 3 rows.
      // But let's just make the existing calculated total a value for now, or use a complex formula.
      // The user wants "the same parameters", so maybe just a sum of the days?
      // Since SheetJS json_to_sheet doesn't easily support multi-row formulas per cell, 
      // we'll just set the value we calculated.
      // However, to satisfy "Excel with formula", I'll add a SUM of the row.
      // But wait, the total is only for the first row of the 3-row group.
      
      const startCol = XLSX.utils.encode_col(2); // Day 1
      const endCol = XLSX.utils.encode_col(1 + daysInMonth); // Last day
      
      // We'll set formulas for all 3 rows just in case, but usually it's one per doc
      for(let j=0; j<3; j++) {
        const r = rowNum + j;
        const cellRef = `${totalColLetter}${r}`;
        if (showGridHours) {
           const startCell = XLSX.utils.encode_cell({r: r-1, c: 2});
           const endCell = XLSX.utils.encode_cell({r: r-1, c: 1 + daysInMonth});
           ws[cellRef] = { t: 'n', f: `SUM(${startCell}:${endCell})` };
        }
      }
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Turnero_${MONTH_NAMES[selectedMonth]}`);
    XLSX.writeFile(wb, `Turnero_${MONTH_NAMES[selectedMonth]}_${selectedYear}.xlsx`);
  };

  const exportTurneroPDF = () => {
    const doc = new jsPDF('landscape');
    doc.setFont("helvetica", "bold");
    doc.text(`Turnero Médico - ${MONTH_NAMES[selectedMonth]} ${selectedYear}`, 14, 15);
    
    const data = getFilteredTurneroData();
    const daysArr = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
    const tableColumn = ["MÉDICO", "JORNADA", ...daysArr, "TOTAL"];
    
    const tableRows: any[] = [];
    data.forEach(({ med, medTotalMonth }) => {
      (['m', 't', 'n'] as SlotType[]).forEach((slot, sIdx) => {
        const row: any[] = [
          sIdx === 0 ? med.nombre : '',
          slot === 'm' ? 'M' : slot === 't' ? 'T' : 'N'
        ];
        for (let d = 1; d <= daysInMonth; d++) {
          const val = currentMonthData[med.id]?.[slot]?.[d] || 'X';
          row.push(val.toUpperCase() !== 'X' ? (showGridHours ? `${val} (${getVarHours(slot, val)})` : val) : '');
        }
        row.push(sIdx === 0 ? `${medTotalMonth}h` : '');
        tableRows.push(row);
      });
    });

    (doc as any).autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 20,
      theme: 'grid',
      styles: { fontSize: 6, cellPadding: 1, halign: 'center' },
      columnStyles: { 0: { halign: 'left', cellWidth: 30 } },
      headStyles: { fillColor: [5, 150, 105], textColor: 255 }, 
    });

    doc.save(`Turnero_${MONTH_NAMES[selectedMonth]}_${selectedYear}.pdf`);
  };

  const assignFreeDaysToPlanta = async () => {
    if (!confirm("¿Desea asignar automáticamente un día libre ('L') a la semana para todo el personal de PLANTA?")) return;
    
    const newData = { ...currentMonthData };
    let changesCount = 0;

    doctors.filter(d => d.cat === 'Planta' && d.st === 'activo').forEach(doc => {
      if (!newData[doc.id]) newData[doc.id] = { m: {}, t: {}, n: {} };
      
      const weeks = [[1, 7], [8, 14], [15, 21], [22, 28], [29, daysInMonth]];
      
      weeks.forEach(([start, end]) => {
        // Check if already has a free day in this week
        let hasFree = false;
        for (let d = start; d <= end; d++) {
          if (newData[doc.id].m[d] === 'L' || newData[doc.id].t[d] === 'L' || newData[doc.id].n[d] === 'L') {
            hasFree = true;
            break;
          }
        }

        if (!hasFree) {
          // Find a day with no shifts assigned in ANY slot
          const availableDays = [];
          for (let d = start; d <= end; d++) {
            if (!newData[doc.id].m[d] && !newData[doc.id].t[d] && !newData[doc.id].n[d]) {
              availableDays.push(d);
            }
          }

          if (availableDays.length > 0) {
            const chosenDay = availableDays[Math.floor(Math.random() * availableDays.length)];
            // Assign 'L' to morning slot as convention for free day
            newData[doc.id].m[chosenDay] = 'L';
            changesCount++;
          }
        }
      });
    });

    try {
      await updateMonthlyData(newData);
      setNotification({ message: `Días libres asignados: ${changesCount}`, type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'monthlyData');
    }
  };

  const isAdminUser = session?.r === 'admin';
  const isSignedInUser = !!fbUser;

  // -- Cycle Logic --
  const setDocShift = async (doctorId: number, day: number, slot: SlotType, sigla: string) => {
    const cellKey = `${doctorId}-${slot}-${day}`;
    let affected = [{ docId: doctorId, s: slot, d: day }];

    if (selectedCells.has(cellKey)) {
      affected = Array.from(selectedCells).map(k => {
        const [dIdStr, sSlot, dDayStr] = k.split('-');
        return { docId: Number(dIdStr), s: sSlot as SlotType, d: Number(dDayStr) };
      });
      setSelectedCells(new Set());
      setSelectionStart(null);
    }

    setCurrentMonthData(prev => {
      const cloned = { ...prev };
      const docUpdates: Record<number, any> = {};

      affected.forEach(({ docId, s, d }) => {
        if (!cloned[docId]) {
          cloned[docId] = { m: {}, t: {}, n: {} };
        } else {
          cloned[docId] = {
            m: { ...cloned[docId].m },
            t: { ...cloned[docId].t },
            n: { ...cloned[docId].n }
          };
        }
        cloned[docId][s][d] = sigla;
        docUpdates[docId] = cloned[docId];
      });

      setTimeout(() => {
        Object.entries(docUpdates).forEach(([dIdStr, updatedData]) => {
          updateDoctorMonth(Number(dIdStr), updatedData);
        });
      }, 0);

      return cloned;
    });
  };

  const handleGridPaste = async (e: React.ClipboardEvent<HTMLTableDataCellElement>, startDocId: number, startSlot: SlotType, startDay: number) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text');
    if (!pasteData) return;

    // Filtered list of visible rows in the grid to know navigation
    const visibleDocs = doctors.filter(d => 
      (selectedRoles.length === 0 || selectedRoles.includes(d.rol || 'Médico General')) &&
      (selectedCategories.length === 0 || selectedCategories.includes(d.cat)) &&
      (doctorFilter.length === 0 || doctorFilter.includes(d.id)) && 
      (d.st === 'activo')
    ).sort(sortDoctors);

    const rowsLayout: {docId: number, slot: SlotType}[] = [];
    visibleDocs.forEach(d => {
      rowsLayout.push({docId: d.id, slot: 'm'});
      rowsLayout.push({docId: d.id, slot: 't'});
      rowsLayout.push({docId: d.id, slot: 'n'});
    });
    
    const startRowIdx = rowsLayout.findIndex(r => r.docId === startDocId && r.slot === startSlot);
    if (startRowIdx === -1) return;

    const rows = pasteData.split(/\r?\n/).filter(line => line.trim() !== '');
    const maxDays = daysInMonth;
    
    const newData = JSON.parse(JSON.stringify(currentMonthData)); // deep clone
    let changed = false;

    // Support single value paste to multiple selected cells
    if (rows.length === 1 && rows[0].split('\t').length === 1 && selectedCells.size > 1) {
      const startSigla = rows[0].trim();
      for (const cellKey of selectedCells) {
        const [docIdStr, slotStr, dayStr] = cellKey.split('-');
        const cDocId = Number(docIdStr);
        const cSlot = slotStr as SlotType;
        const cDay = Number(dayStr);
        if (cDay > maxDays) continue;
        
        let sigla = startSigla;
        if (!sigla) sigla = 'X';
        else {
          const upperList = ['X','PT','L','CAP','P','COMPENSA','D1','D2','D3','D4'];
          if (!upperList.includes(sigla.toUpperCase())) {
            const slotVars = variables[cSlot] || {};
            const foundKey = Object.keys(slotVars).find(k => k.toUpperCase() === sigla.toUpperCase());
            if (foundKey !== undefined) sigla = foundKey;
            else sigla = 'X';
          } else {
            if (sigla.toUpperCase() === 'L') sigla = 'L';
            else if (sigla.toUpperCase() === 'X') sigla = 'X';
            else if (sigla.toUpperCase() === 'PT') sigla = 'PT';
            else if (sigla.toUpperCase() === 'P') sigla = 'P';
            else if (sigla.toUpperCase() === 'COMPENSA') sigla = 'COMPENSA';
          }
        }

        if (!newData[cDocId]) newData[cDocId] = {m:{}, t:{}, n:{}};
        newData[cDocId][cSlot][cDay] = sigla;
        changed = true;
      }
    } else {
      for (let i = 0; i < rows.length; i++) {
          const rowIdx = startRowIdx + i;
          if (rowIdx >= rowsLayout.length) break;
          
          const targetLayout = rowsLayout[rowIdx];
          const cells = rows[i].split('\t');
          
          for (let j = 0; j < cells.length; j++) {
              const targetDay = startDay + j;
              if (targetDay > maxDays) break;
              
              let sigla = cells[j].trim();
              if (!sigla) sigla = 'X';
              else {
                const upperList = ['X','PT','L','CAP','P','COMPENSA','D1','D2','D3','D4'];
                if (!upperList.includes(sigla.toUpperCase())) {
                  const slotVars = variables[targetLayout.slot] || {};
                  const foundKey = Object.keys(slotVars).find(k => k.toUpperCase() === sigla.toUpperCase());
                  if (foundKey !== undefined) sigla = foundKey;
                  else sigla = 'X';
                } else {
                  if (sigla.toUpperCase() === 'L') sigla = 'L';
                  else if (sigla.toUpperCase() === 'X') sigla = 'X';
                  else if (sigla.toUpperCase() === 'PT') sigla = 'PT';
                  else if (sigla.toUpperCase() === 'P') sigla = 'P';
                  else if (sigla.toUpperCase() === 'COMPENSA') sigla = 'COMPENSA';
                }
              }

              if (!newData[targetLayout.docId]) newData[targetLayout.docId] = {m:{}, t:{}, n:{}};
              newData[targetLayout.docId][targetLayout.slot][targetDay] = sigla;
              changed = true;
          }
      }
    }

    if (changed) {
        updateMonthlyData(newData);
        setNotification({ message: 'Datos pegados con éxito', type: 'success' });
    }
  };

  const cycleShift = async (doctorId: number, day: number, slot: SlotType) => {
    if (session?.r !== 'admin') return;

    setCurrentMonthData(prev => {
      const docShifts = prev[doctorId] ? { 
        m: { ...prev[doctorId].m }, 
        t: { ...prev[doctorId].t }, 
        n: { ...prev[doctorId].n } 
      } : { m: {}, t: {}, n: {} };
      
      const slotVars = ['X', ...Object.keys(variables[slot])];
      const currentSigla = String(docShifts[slot][day] || 'X').trim();
      
      const lowerVars = slotVars.map(s => String(s).toLowerCase());
      const lowerCurrent = currentSigla.toLowerCase();
      
      let currentIdx = lowerVars.indexOf(lowerCurrent);
      if (currentIdx === -1) currentIdx = 0; 
      
      const nextIdx = (currentIdx + 1) % slotVars.length;
      const nextSigla = slotVars[nextIdx];
      const oldSigla = docShifts[slot][day] || 'X';
      
      docShifts[slot][day] = nextSigla;
      
      const today = new Date();
      const isLateInMonth = today.getDate() >= 29;
      const isNovedad = isMonthPublished || isLateInMonth;

      setTimeout(async () => {
        if (nextSigla === 'CAP') {
          const docData = doctors.find(d => d.id === doctorId);
          if (docData) {
            await pushNotification(doctorId, `CAPACITACIÓN: Día ${day}. Credenciales: ${docData.username}/${docData.password}.`);
          }
        }

        const activeOnDay = [docShifts.m[day] || 'X', docShifts.t[day] || 'X', docShifts.n[day] || 'X'].filter(v => v !== 'X' && v !== 'PT');
        if (nextSigla !== 'X' && nextSigla !== 'PT') {
          if (activeOnDay.length > 1) {
            setNotification({ message: `Nota: El médico ya tiene turno este día (${activeOnDay.join(', ')}).`, type: 'info' });
          }
        }

        try {
          if (isNovedad) {
            const docData = doctors.find(d => d.id === doctorId);
            const logId = Date.now();
            const newLog: AuditEntry = {
              id: logId,
              timestamp: Date.now(),
              targetMonth: selectedMonth,
              targetYear: selectedYear,
              doctorId,
              doctorName: docData?.nombre || 'Desconocido',
              doctorContact: (docData?.telefono || docData?.email) ?? '',
              day,
              slot,
              oldSigla,
              newSigla: nextSigla,
              adminName: session?.n || 'Admin'
            };
            await setDoc(doc(db, 'auditLogs', logId.toString()), newLog);
          }
          
          if (slot === 'n' && nextSigla !== 'X' && nextSigla !== 'PT') {
            const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
            if (day < lastDay) {
              docShifts.m[day + 1] = 'PT';
            }
          }

          await updateDoctorMonth(doctorId, docShifts);
          if (new Date().getDate() === 1) {
            setNotification({ message: `Turno ${nextSigla} guardado`, type: 'success' });
          }
        } catch(err: any) {
          console.error("CycleShift operation failed:", err);
        }
      }, 0);

      return { ...prev, [doctorId]: docShifts };
    });
  };

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

    const text = encodeURIComponent(`🚨 *LLAMADO A DISPONIBILIDAD* 🚨\n\n👨‍⚕️ *Profesional:* Dr(a). ${docData.nombre}\n🏥 *Servicio:* ${callService.toUpperCase()}\n🕒 *Jornada:* ${callSlot.toUpperCase()} (Día ${callDay})\n👤 *Llamado por:* ${newCall.callerName}\n\n_Notificación generada por Sistema HDSAR_`);
    window.open(`https://wa.me/573173683886?text=${text}`, '_blank');

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

  const exportNovedadesExcel = () => {
    const filteredLogs = auditLogs.filter(log => log.targetMonth === selectedMonth && log.targetYear === selectedYear);
    if (filteredLogs.length === 0) return alert("No hay novedades para este mes.");

    const rows = filteredLogs.map(log => ({
      'Fecha': new Date(log.timestamp).toLocaleString(),
      'Médico': log.doctorName,
      'Día': log.day,
      'Jornada': log.slot.toUpperCase(),
      'Anterior': log.oldSigla,
      'Nuevo': log.newSigla,
      'Autor': log.adminName
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Novedades");
    XLSX.writeFile(wb, `Reporte_Novedades_${MONTH_NAMES[selectedMonth]}_${selectedYear}.xlsx`);
  };

  const exportNovedadesPDF = () => {
    const filteredLogs = auditLogs.filter(log => log.targetMonth === selectedMonth && log.targetYear === selectedYear);
    if (filteredLogs.length === 0) return alert("No hay novedades para este mes.");

    const doc = new jsPDF('p', 'pt', 'a4');
    doc.setFillColor(5, 150, 105); // Emerald-600
    doc.rect(0, 0, 595, 60, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("REPORTE MENSUAL DE NOVEDADES", 40, 38);
    
    doc.setFontSize(10);
    doc.text(`ESE ROLDANILLO - ${MONTH_NAMES[selectedMonth].toUpperCase()} ${selectedYear}`, 40, 52);
    
    const tableData = filteredLogs.map(log => [
      new Date(log.timestamp).toLocaleDateString(),
      log.doctorName,
      log.day,
      log.slot.toUpperCase(),
      log.oldSigla,
      log.newSigla,
      log.adminName
    ]);

    (doc as any).autoTable({
      startY: 80,
      head: [['FECHA', 'MÉDICO', 'DÍA', 'SLOT', 'ANT.', 'NUEV.', 'AUTOR']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [51, 65, 85], fontSize: 8 },
      bodyStyles: { fontSize: 8 }
    });

    doc.save(`Novedades_${MONTH_NAMES[selectedMonth]}_${selectedYear}.pdf`);
  };

  const generateAIStatsReport = async () => {
    setIsGeneratingAI(true);
    setAiReport(null);

    try {
      const daysCount = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      
      // 1. Capacidad Instalada
      let usedSlots = 0;
      let totalHours = 0;
      const activeDoctors = doctors.filter(d => d.st === 'activo');
      const totalPossibleSlots = activeDoctors.length * daysCount * 3;
      
      // Area Breakdown
      const areaStats: Record<string, number> = {
        'Urgencias': 0,
        'Hospitalización': 0,
        'Cirugía': 0,
        'Consulta Externa': 0,
        'Triage': 0,
        'Otros': 0
      };

      activeDoctors.forEach(doc => {
        ['m', 't', 'n'].forEach(slot => {
          for (let d = 1; d <= daysCount; d++) {
            const sigla = currentMonthData[doc.id]?.[slot as SlotType]?.[d];
            if (sigla && sigla.toUpperCase() !== 'X' && sigla.toUpperCase() !== 'DESC' && sigla.toUpperCase() !== 'PT') {
              usedSlots++;
              const h = getVarHours(slot as SlotType, sigla);
              totalHours += h;
              
              // Map to area (heuristics based on common siglas)
              const s = sigla.toUpperCase();
              if (s.includes('CX')) areaStats['Cirugía']++;
              else if (s === 'EXT' || s.startsWith('CE')) areaStats['Consulta Externa']++;
              else if (s === 'TR' || (doc.rol === 'Triage')) areaStats['Triage']++;
              else if (s === 'H' || s.startsWith('12')) areaStats['Hospitalización']++;
              else if (['M', 'T', 'N', '10', '11', '13', '14', '15', '16'].some(x => s.startsWith(x))) areaStats['Urgencias']++;
              else areaStats['Otros']++;
            }
          }
        });
      });

      // 2. Indicadores de Capacitación
      const monthActivities = activities.filter(a => a.month === selectedMonth && a.year === selectedYear);
      const planned = monthActivities.length;
      const completed = monthActivities.filter(a => a.status === 'realizada').length;
      const canceled = monthActivities.filter(a => a.status === 'cancelada').length;

      // 3. Indicadores de Uso
      const monthLogs = auditLogs.filter(l => l.targetMonth === selectedMonth && l.targetYear === selectedYear);
      const ruralReports = ruralAvailabilities.filter(r => r.targetMonth === selectedMonth && r.targetYear === selectedYear);

      const prompt = `Actúa como un experto en analítica hospitalaria. Analiza los siguientes indicadores del mes de ${MONTH_NAMES[selectedMonth]} ${selectedYear}:
      
      ESTADÍSTICAS OPERATIVAS:
      - Capacidad Instalada (Slots usados / totales): ${usedSlots} / ${totalPossibleSlots} (${((usedSlots/totalPossibleSlots)*100).toFixed(1)}%)
      - Horas totales asistenciales: ${totalHours}h
      
      DISTRIBUCIÓN POR ÁREAS (Servicios):
      - Urgencias: ${areaStats['Urgencias']} turnos
      - Hospitalización: ${areaStats['Hospitalización']} turnos
      - Cirugía: ${areaStats['Cirugía']} turnos
      - Triage: ${areaStats['Triage']} turnos
      - Consulta Externa: ${areaStats['Consulta Externa']} turnos
      
      CALIDAD Y CAPACITACIÓN (PIC):
      - Actividades Programadas: ${planned}
      - Actividades Realizadas: ${completed} (${planned > 0 ? ((completed/planned)*100).toFixed(1) : 0}%)
      - Actividades Canceladas: ${canceled}
      
      INDICADORES DE USO DE LA APP:
      - Cambios/Novedades registrados: ${monthLogs.length}
      - Reportes de disponibilidad rural: ${ruralReports.length}
      - Médicos activos participando: ${activeDoctors.length}

      Genera un análisis estadístico gerencial estructurado que:
      1. Evalúe la EFICIENCIA de la capacidad instalada.
      2. Muestre el CUMPLIMIENTO del plan de capacitaciones (PIC).
      3. Analice la ADOPCIÓN TECNOLÓGICA basada en el uso de la app.
      4. Identifique posibles cuellos de botella en servicios específicos (Urgencias vs otros).
      
      Usa un tono directivo, formal y enfocado en indicadores. Solo usa negritas y viñetas.`;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt,
      });

      setAiReport(response.text || "No se pudo generar el reporte.");
    } catch (err) {
      console.error(err);
      setAiReport("Error al generar reporte IA.");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const saveServiceMappings = async (newMappings: ServiceMapping[]) => {
    try {
      // Clean up before saving: trim spaces and remove empty entries
      const cleaned = newMappings.map(m => ({
        ...m,
        siglas: m.siglas.map(s => s.trim().toUpperCase()).filter(s => s !== '')
      }));
      await setDoc(doc(db, 'settings', 'serviceMappings'), { mappings: cleaned });
      setNotification({ message: "Mapeos de servicios guardados", type: 'success' });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/serviceMappings');
    }
  };

  const addServiceMapping = () => {
    const newId = Date.now().toString();
    const newService: ServiceMapping = {
      id: newId,
      name: 'NUEVO SERVICIO',
      siglas: []
    };
    setServiceMappings([...serviceMappings, newService]);
  };

  const deleteServiceMapping = (id: string) => {
    if (confirm('¿Eliminar este mapeo de servicio?')) {
      setServiceMappings(serviceMappings.filter(m => m.id !== id));
    }
  };

  const calculateProductivity = () => {
    const activeDoctorsList = doctors.filter(d => d.st === 'activo');
    const daysInCurrentMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    
    const results = activeDoctorsList.map(doc => {
      const stats: Record<string, { shifts: number, hours: number }> = {};
      serviceMappings.forEach(m => {
        stats[m.name] = { shifts: 0, hours: 0 };
      });
      stats['Otros'] = { shifts: 0, hours: 0 };
      
      let totalDocHours = 0;
      
      (['m', 't', 'n'] as SlotType[]).forEach(slot => {
        for (let d = 1; d <= daysInCurrentMonth; d++) {
          const sigla = currentMonthData[doc.id]?.[slot]?.[d];
          if (sigla && sigla.toUpperCase() !== 'X' && sigla.toUpperCase() !== 'DESC' && sigla.toUpperCase() !== 'PT') {
            const h = getVarHours(slot, sigla);
            totalDocHours += h;
            
            const mapping = serviceMappings.find(m => m.siglas.some(s => s.trim().toUpperCase() === sigla.trim().toUpperCase()));
            if (mapping) {
              stats[mapping.name].shifts++;
              stats[mapping.name].hours += h;
            } else {
              stats['Otros'].shifts++;
              stats['Otros'].hours += h;
            }
          }
        }
      });
      
      return {
        doctor: doc.nombre,
        role: doc.rol,
        stats,
        totalDocHours
      };
    });
    
    setProductivityResults(results);
    setShowProductivityStats(true);
  };

  const exportNovedades = () => {

    const filteredLogs = auditLogs.filter(log => log.targetMonth === selectedMonth && log.targetYear === selectedYear);
    if (filteredLogs.length === 0) return alert("No hay novedades para este mes.");
    
    let content = `REPORTE DE NOVEDADES - ESE ROLDANILLO\n`;
    content += `Mes: ${MONTH_NAMES[selectedMonth]} ${selectedYear}\n`;
    content += `Generado: ${new Date().toLocaleString()}\n`;
    content += `==============================================\n\n`;
    
    filteredLogs.forEach(log => {
      content += `[${new Date(log.timestamp).toLocaleString()}]\n`;
      content += `Médico: ${log.doctorName}\n`;
      content += `Cambio: Día ${log.day} (${log.slot}) -> de [${log.oldSigla}] a [${log.newSigla}]\n`;
      content += `Autor: ${log.adminName}\n`;
      content += `----------------------------------------------\n`;
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Novedades_ESE_Roldanillo_${selectedMonth + 1}_${selectedYear}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const generateAICapacityReport = async (period: 'semanal' | 'quincenal' | 'mensual') => {
    setIsGeneratingAI(true);
    setAiReport(null);

    try {
      const days = period === 'semanal' ? Array.from({length: 7}, (_, i) => i + 1) :
                   period === 'quincenal' ? Array.from({length: 15}, (_, i) => i + 1) :
                   Array.from({length: daysInMonth}, (_, i) => i + 1);

      // Calculate Metrics
      let totalHours = 0;
      const hoursByCat: Record<string, number> = { Planta: 0, CTA: 0, APS: 0 };
      const workload: Record<string, number> = {};
      let usedSlots = 0;
      const totalPossibleDocSlots = doctors.filter(d => d.st === 'activo').length * days.length * 3;

      days.forEach(day => {
        doctors.forEach(doc => {
          if (doc.st !== 'activo') return;
          ['m', 't', 'n'].forEach(slot => {
            const sigla = currentMonthData[doc.id]?.[slot as SlotType]?.[day];
            if (sigla && sigla.toUpperCase() !== 'X' && sigla.toUpperCase() !== 'DESC') {
              const h = getVarHours(slot as SlotType, sigla);
              totalHours += h;
              hoursByCat[doc.cat] += h;
              workload[doc.nombre] = (workload[doc.nombre] || 0) + h;
              usedSlots++;
            }
          });
        });
      });

      const topWorkload = Object.entries(workload)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([n, h]) => `${n}: ${h}h`)
        .join(', ');

      const prompt = `Analiza la capacidad instalada y el talento humano de un hospital para el periodo ${period} de ${MONTH_NAMES[selectedMonth]} ${selectedYear}.
      Datos:
      - Horas totales programadas: ${totalHours}h
      - Distribución por categoría: Planta (${hoursByCat.Planta}h), CTA (${hoursByCat.CTA}h), APS (${hoursByCat.APS}h)
      - Cobertura de turnos asignados: ${((usedSlots / (days.length * 3)) * 100).toFixed(1)}% (basado en slots m/t/n requeridos)
      - Médicos con mayor carga: ${topWorkload}
      - Total médicos activos: ${doctors.filter(d => d.st === 'activo').length}

      Genera un reporte gerencial conciso en español que incluya:
      1. Resumen de capacidad (¿Estamos sobrecargados o hay subutilización?)
      2. Análisis de riesgos (¿Pocas horas en alguna categoría? ¿Concentración de carga?)
      3. Recomendaciones estratégicas para la Coordinación Médica.
      Utiliza un tono profesional y directo. No uses Markdown excesivo, solo negritas y puntos.`;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt,
      });

      setAiReport(response.text || "No se pudo generar el reporte.");
    } catch (err) {
      console.error(err);
      setAiReport("Error al contactar con la IA. Verifica tu conexión.");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const generateAIServiceReport = async () => {
    setIsGeneratingAI(true);
    setAiReport(null);

    try {
      const activeDoctors = doctors.filter(d => d.st === 'activo');
      
      // 1. Calculate stats per service
      const serviceStats: Record<string, { hours: number, shifts: number, slotsByDay: number[] }> = {};
      serviceMappings.forEach(m => {
        serviceStats[m.name] = { hours: 0, shifts: 0, slotsByDay: new Array(daysInMonth).fill(0) };
      });
      serviceStats['Otros'] = { hours: 0, shifts: 0, slotsByDay: new Array(daysInMonth).fill(0) };

      let globalTotalHours = 0;
      let globalUsedSlots = 0;

      activeDoctors.forEach(doc => {
        (['m', 't', 'n'] as SlotType[]).forEach(slot => {
          for (let d = 1; d <= daysInMonth; d++) {
            const sigla = currentMonthData[doc.id]?.[slot]?.[d];
            if (sigla && sigla.toUpperCase() !== 'X' && sigla.toUpperCase() !== 'DESC' && sigla.toUpperCase() !== 'PT') {
              const h = getVarHours(slot, sigla);
              globalTotalHours += h;
              globalUsedSlots++;

              const mapping = serviceMappings.find(m => m.siglas.some(s => s.trim().toUpperCase() === sigla.trim().toUpperCase()));
              if (mapping) {
                serviceStats[mapping.name].hours += h;
                serviceStats[mapping.name].shifts++;
                serviceStats[mapping.name].slotsByDay[d-1]++;
              } else {
                serviceStats['Otros'].hours += h;
                serviceStats['Otros'].shifts++;
                serviceStats['Otros'].slotsByDay[d-1]++;
              }
            }
          }
        });
      });

      // Analyzed Occupation Patterns (Busy days vs Quiet days)
      const serviceDetails = Object.entries(serviceStats).map(([name, stats]) => {
        const peakDay = stats.slotsByDay.indexOf(Math.max(...stats.slotsByDay)) + 1;
        const avgShiftsPerDay = (stats.shifts / daysInMonth).toFixed(2);
        return `- **${name}**: ${stats.hours}h totales, ${stats.shifts} turnos. (Promedio diario: ${avgShiftsPerDay} turnos. Pico: Día ${peakDay})`;
      }).join('\n');

      const totalCapacityPossible = activeDoctors.length * daysInMonth * 3; // Max theoretical slots
      const totalHoursCapacity = activeDoctors.length * 240; // Rough theoretical max hours (if 240 is full time)
      
      const prompt = `Actúa como un Consultor de Gerencia Hospitalaria. Analiza los datos de servicios del mes de ${MONTH_NAMES[selectedMonth]} ${selectedYear}:

ESTADÍSTICAS POR SERVICIO:
${serviceDetails}

DATOS GLOBALES:
- Total Médicos Activos: ${activeDoctors.length}
- Horas Totales Ejecutadas: ${globalTotalHours}h
- Slots Totales Utilizados: ${globalUsedSlots} de ${totalCapacityPossible} (${((globalUsedSlots/totalCapacityPossible)*100).toFixed(1)}% de ocupación teórica)
- Novedades/Cambios: ${auditLogs.filter(l => l.targetMonth === selectedMonth).length}

INSTRUCCIONES:
Genera un INFORME GERENCIAL DE CAPACIDAD Y SERVICIOS que incluya:
1. ANÁLISIS DE OCUPACIÓN: Evalúa si la distribución de carga es equilibrada entre servicios.
2. PATRONES DE USO: Identifica días de mayor congestión y servicios con mayor demanda de talento humano.
3. CAPACIDAD INSTALADA: Analiza si el recurso médico actual es suficiente o si hay subutilización/sobrecarga crítica.
4. RECOMENDACIONES ESTRATÉGICAS: 3 acciones concretas para mejorar la eficiencia operativa y cobertura.

Usa un tono directivo, formal y conciso en español. Solo usa negritas y viñetas para estructurar la información.`;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-1.5-pro", // Use Pro for more complex analysis
        contents: prompt,
      });

      setAiReport(response.text || "No se pudo generar el reporte.");
    } catch (err) {
      console.error(err);
      setAiReport("Error al generar análisis de servicios. Intente nuevamente.");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // -- Calculations --
  const conflicts = useMemo(() => {
    const map: Record<string, { type: string, message: string }[]> = {};
    const criticalCoverageMap: Record<string, string[]> = {};
    const criticalSiglas: Record<SlotType, string[]> = {
      m: ['M'],
      t: ['T'],
      n: ['N']
    };
    
    doctors.forEach(doc => {
      if (doc.st !== 'activo') return;
      
      for (let d = 1; d <= daysInMonth; d++) {
        const m = currentMonthData[doc.id]?.m?.[d] || 'X';
        const t = currentMonthData[doc.id]?.t?.[d] || 'X';
        const n = currentMonthData[doc.id]?.n?.[d] || 'X';

        const activeSlots = [
          { s: 'm' as SlotType, v: m },
          { s: 't' as SlotType, v: t },
          { s: 'n' as SlotType, v: n }
        ].filter(x => x.v.toUpperCase() !== 'X' && x.v.toUpperCase() !== 'PT');

        // 1. Same Day Overlap
        if (activeSlots.length > 1) {
          activeSlots.forEach(as => {
            const key = `${doc.id}-${d}-${as.s}`;
            if (!map[key]) map[key] = [];
            map[key].push({ 
              type: 'overlap', 
              message: `Sobrecarga: El médico tiene múltiples turnos activos el mismo día (${activeSlots.map(x => x.s.toUpperCase()).join(', ')}).` 
            });
          });
        }

        // 2. Post-Turno (Night -> Morning day+1)
        if (n.toUpperCase() !== 'X' && n.toUpperCase() !== 'PT' && d < daysInMonth) {
          const nextM = currentMonthData[doc.id]?.m?.[d + 1] || 'X';
          if (nextM.toUpperCase() !== 'X' && nextM.toUpperCase() !== 'PT') {
            const keyN = `${doc.id}-${d}-n`;
            const keyM = `${doc.id}-${d+1}-m`;
            if (!map[keyN]) map[keyN] = [];
            if (!map[keyM]) map[keyM] = [];
            const msg = `Conflicto Post-Turno: El médico tiene turno de noche y turno de mañana al día siguiente sin descanso (PT).`;
            map[keyN].push({ type: 'post-turno', message: msg });
            map[keyM].push({ type: 'post-turno', message: msg });
          }
        }
      }
    });

    // 3. Critical Coverage
    for (let d = 1; d <= daysInMonth; d++) {
      (['m', 't', 'n'] as SlotType[]).forEach(slot => {
        const assigned = Object.values(currentMonthData).map(ds => ds[slot]?.[d] || 'X');
        criticalSiglas[slot].forEach(sigla => {
          if (!assigned.some(a => a.toUpperCase() === sigla.toUpperCase())) {
            const key = `${d}-${slot}`;
            if (!criticalCoverageMap[key]) criticalCoverageMap[key] = [];
            criticalCoverageMap[key].push(`Falta cobertura crítica: '${sigla}'`);
          }
        });
      });
    }

    return { personal: map, coverage: criticalCoverageMap };
  }, [currentMonthData, doctors, daysInMonth]);

  const globalTotalHours = useMemo(() => {
    let total = 0;
    Object.keys(currentMonthData).forEach(docId => {
      const docShifts = currentMonthData[Number(docId)];
      (['m', 't', 'n'] as SlotType[]).forEach(slot => {
        if (docShifts[slot]) {
          Object.values(docShifts[slot]).forEach(sigla => {
            total += getVarHours(slot, sigla);
          });
        }
      });
    });
    return total;
  }, [currentMonthData, variables]);

  const sundays = useMemo(() => {
    const list: number[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      if (new Date(selectedYear, selectedMonth, d).getDay() === 0 || d === daysInMonth) {
        list.push(d);
      }
    }
    return list;
  }, [selectedMonth, selectedYear, daysInMonth]);

  if (isBooting) {
    return (
      <div className="fixed inset-0 bg-stone-50 flex flex-col items-center justify-center z-50">
        <motion.div 
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-6xl mb-4"
        >
          🏥
        </motion.div>
        <h1 className="font-bold text-3xl text-emerald-700 tracking-widest uppercase mb-1">COORDINACION MEDICA HDSAR</h1>
        <p className="text-sm font-bold text-emerald-600 uppercase tracking-widest mb-2">Servir con Excelencia</p>
        <p className="text-xs text-emerald-600/60 font-mono">CONSOLIDACIÓN TOTAL V27.0 - REACT</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6 overflow-y-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 md:p-10 rounded-[32px] border border-emerald-100 w-full max-w-md text-center shadow-2xl relative my-4 md:my-8"
        >
          <div className="flex justify-center mb-6">
            <div className="bg-emerald-50 p-4 rounded-full border border-emerald-100">
               <ShieldCheck className="w-10 h-10 text-emerald-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-emerald-700 mb-1 uppercase tracking-widest">COORDINACION MEDICA HDSAR</h2>
          <p className="text-sm font-bold text-emerald-600 uppercase tracking-widest mb-8">Servir con Excelencia</p>
          
          {fbUser && (
            <div className="mb-6 flex items-center justify-center gap-2 bg-emerald-50/50 py-2 px-4 rounded-full border border-emerald-100/50">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[9px] uppercase font-black text-emerald-600/70 tracking-widest">
                Acceso Cifrado y Protegido
              </span>
            </div>
          )}

          <div className="space-y-4">
            <input 
              type="text" 
              placeholder="Usuario / ID" 
              className="w-full bg-stone-50 border border-slate-200 text-slate-800 p-4 rounded-xl outline-none focus:border-emerald-500 transition-colors font-bold"
              value={loginU}
              onChange={(e) => setLoginU(e.target.value)}
            />
            <input 
              type="password" 
              placeholder="Contraseña" 
              className="w-full bg-stone-50 border border-slate-200 text-slate-800 p-4 rounded-xl outline-none focus:border-emerald-500 transition-colors font-bold"
              value={loginP}
              onChange={(e) => setLoginP(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
            <button 
              onClick={handleLogin}
              className="w-full bg-emerald-600 text-white p-4 rounded-xl font-black text-lg shadow-xl shadow-emerald-500/20 active:scale-95 transition-transform"
            >
              ACCEDER AL SISTEMA
            </button>

            <button 
              onClick={() => setShowRegModal(true)}
              className="w-full bg-emerald-50 text-emerald-700 p-4 rounded-xl font-bold border border-emerald-100 hover:bg-emerald-100 transition-colors"
            >
              REGISTRAR TALENTO HUMANO
            </button>

            <a 
              href="https://wa.me/573173683886" 
              target="_blank" 
              rel="noopener noreferrer"
              className="mt-6 flex items-center justify-center gap-2 text-emerald-700 font-bold bg-emerald-50/50 p-3 rounded-xl border border-emerald-100/50 hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" className="w-6 h-6 text-emerald-500">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.878-.788-1.472-1.761-1.645-2.06-.173-.298-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <div className="text-left">
                <span className="block text-[10px] uppercase text-emerald-600/70">Contacto Coordinador</span>
                <span>+57 317 3683886</span>
              </div>
            </a>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-widest"><span className="bg-white px-4 text-slate-400">O acceder con</span></div>
            </div>

            <button 
              onClick={handleGoogleLogin}
              className="w-full bg-white border border-slate-200 text-slate-800 p-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
              CONTINUAR CON GOOGLE
            </button>
          </div>
          <p className="text-[10px] text-slate-500 mt-8 tracking-widest uppercase font-mono">Consolidado 2026</p>
        </motion.div>

        {/* Modal de Registro para Usuarios Nuevos */}
        <AnimatePresence>
          {showRegModal && (
            <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[200] flex items-center justify-center p-0 sm:p-4 overflow-y-auto">
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                className="bg-white w-full h-full sm:h-auto sm:max-w-2xl sm:rounded-[40px] shadow-2xl p-6 sm:p-10 border-0 sm:border sm:border-emerald-100 relative flex flex-col pt-20 sm:pt-10"
              >
                {/* Botón Cerrar / Cancelar */}
                <button 
                  onClick={() => {
                    setShowRegModal(false);
                    setGeneratedCreds(null);
                  }}
                  className="absolute top-6 right-6 p-3 bg-slate-100/50 hover:bg-rose-50 rounded-full text-slate-400 hover:text-rose-600 transition-all active:scale-90 z-[210] flex items-center gap-2 group"
                >
                  <span className="text-[10px] uppercase font-black tracking-widest hidden sm:inline group-hover:inline">Cancelar</span>
                  <X className="w-6 h-6" />
                </button>

                {generatedCreds ? (
                  <div className="text-center py-10 space-y-6">
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <CheckCircle className="w-10 h-10 text-emerald-600" />
                    </div>
                    <h2 className="text-3xl font-black text-slate-800">¡Registro Exitoso!</h2>
                    <p className="text-slate-500">Sus credenciales han sido enviadas a <span className="font-bold text-emerald-600">{regEmail}</span>.</p>
                    
                    <div className="bg-emerald-50 p-8 rounded-3xl border border-emerald-100 space-y-4">
                      <div className="flex justify-between items-center border-b border-emerald-200/50 pb-3">
                        <span className="text-[10px] uppercase font-black text-emerald-600/50">Usuario</span>
                        <span className="text-xl font-mono font-black text-emerald-700">{generatedCreds.u}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase font-black text-emerald-600/50">Contraseña</span>
                        <span className="text-xl font-mono font-black text-emerald-700">{generatedCreds.p}</span>
                      </div>
                    </div>

                    <button 
                      onClick={() => {
                        setShowRegModal(false);
                        setGeneratedCreds(null);
                        setLoginU(generatedCreds.u);
                        setLoginP(generatedCreds.p);
                      }}
                      className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-emerald-500/20 active:scale-95 transition-transform"
                    >
                      INICIAR SESIÓN AHORA
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mb-8">
                      <h2 className="text-3xl font-black text-slate-800 tracking-tight">Auto-Registro de Talento Humano</h2>
                      <p className="text-sm text-slate-400 italic">Complete todos los requerimientos para acceder al sistema hospitalario.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-4">
                        <div>
                          <label className="text-[10px] uppercase font-black text-emerald-600 ml-2 mb-1 block">Nombres *</label>
                          <input className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:border-emerald-500 font-bold" value={regNombre} onChange={e => setRegNombre(e.target.value)} />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-black text-emerald-600 ml-2 mb-1 block">Apellidos *</label>
                          <input className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:border-emerald-500 font-bold" value={regApellidos} onChange={e => setRegApellidos(e.target.value)} />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-black text-emerald-600 ml-2 mb-1 block">Cédula de Ciudadanía *</label>
                          <input className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:border-emerald-500 font-bold" value={regCedula} onChange={e => setRegCedula(e.target.value)} />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-black text-emerald-600 ml-2 mb-1 block">Registro Médico / Tarjeta Prof.</label>
                          <input className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:border-emerald-500 font-bold" value={regRegistroMedico} onChange={e => setRegRegistroMedico(e.target.value)} />
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="text-[10px] uppercase font-black text-emerald-600 ml-2 mb-1 block">Correo Electrónico *</label>
                          <input type="email" className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:border-emerald-500 font-bold" value={regEmail} onChange={e => setRegEmail(e.target.value)} />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-black text-emerald-600 ml-2 mb-1 block">Teléfono / WhatsApp</label>
                          <input className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:border-emerald-500 font-bold" value={regTelefono} onChange={e => setRegTelefono(e.target.value)} />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-black text-emerald-600 ml-2 mb-1 block">Cargo / Rol *</label>
                          <select className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:border-emerald-500 font-bold" value={regRol} onChange={e => setRegRol(e.target.value as any)}>
                            <option value="Médico General">Médico General</option>
                            <option value="Médico Rural">Médico Rural</option>
                            <option value="Médico Especialista">Médico Especialista</option>
                            <option value="Médico Obstetra/Ginecólogo">Médico Ginecobstetra</option>
                            <option value="Enfermero Jefe">Enfermera(o) Jefe</option>
                            <option value="Jefe de Partos">Jefe de Partos</option>
                            <option value="Auxiliar Enfermería">Auxiliar de Enfermería</option>
                            <option value="Interno">Médico Interno</option>
                            <option value="Triage">Personal de Triage</option>
                            <option value="Odontólogo">Odontólogo</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={handleSelfRegister}
                      disabled={isRegistering}
                      className={`w-full mt-8 ${isRegistering ? 'bg-slate-300' : 'bg-emerald-600'} text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3`}
                    >
                      {isRegistering ? (
                        <>
                          <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                          PROCESANDO...
                        </>
                      ) : (
                        'FINALIZAR REGISTRO Y GENERAR ACCESOS'
                      )}
                    </button>
                  </>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  const roles = [
    'Médico Rural', 
    'Médico General', 
    'Médico Especialista', 
    'Enfermero Jefe', 
    'Auxiliar Enfermería', 
    'Interno', 
    'Triage', 
    'Laboratorio', 
    'Odontólogo',
    'Especialista',
    'Fisioterapeuta',
    'Rayos X'
  ];
  const filteredRolesList = roles.filter(r => r.toLowerCase().includes(roleSearch.toLowerCase()));

  return (
    <div className={`bg-stone-50 min-h-screen text-slate-800 flex flex-col font-sans transition-all duration-500`} style={{ '--primary': theme.primary } as any}>
      <style>{`
        :root { 
          --primary: ${theme.primary}; 
          --primary-soft: ${theme.primary}15;
          --primary-mid: ${theme.primary}66;
        }
        .bg-primary { background-color: var(--primary); }
        .text-primary { color: var(--primary); }
        .border-primary { border-color: var(--primary); }
        .hover\\:bg-primary:hover { background-color: var(--primary); }
        .hover\\:text-primary:hover { color: var(--primary); }
        
        .font-sans { font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
        .font-serif { font-family: ui-serif, Georgia, serif; }
        .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }

        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: var(--primary-mid);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: var(--primary);
        }
        .safe-area-bottom {
          padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 0.25rem);
        }
      `}</style>
      {/* Offline Alert */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-orange-500 text-white text-[10px] uppercase font-black py-1 px-4 flex items-center justify-center gap-2 overflow-hidden sticky top-0 z-[60]"
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
      
          {isFirebaseUnauthenticatedAdmin && (
            <div className="bg-amber-500 text-black text-[10px] uppercase font-black py-2 px-4 flex items-center justify-center gap-3 sticky top-0 z-[60] shadow-lg">
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
      <header className="bg-white/95 backdrop-blur-md border-b border-emerald-100 sticky top-0 z-40 p-2 md:p-4 no-print shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
             <div>
                <h1 className="font-black text-emerald-700 tracking-tighter flex items-center gap-2">
                   <StethoscopeIcon className="w-5 h-5" />
                   COORDINACIÓN MÉDICA HDSAR
                </h1>
                <p className="text-[10px] text-stone-500 font-mono italic">Julián Humberto Vélez Varela Md - Coordinador Médico</p>
             </div>

             {/* Bandeja de Autorización for Admins */}
             {isAdminUser && (
               <button 
                 onClick={() => setShowAuthInbox(true)}
                 className={`
                    p-2 rounded-xl border flex items-center gap-2 transition-all relative ml-4
                    ${shiftRequests.filter(r => r.status === 'pending').length > 0 
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 animate-pulse' 
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'}
                 `}
               >
                 <ShieldCheck className="w-5 h-5" />
                 <div className="text-left hidden lg:block">
                   <div className="text-[8px] uppercase font-bold opacity-50">Administración</div>
                   <div className="text-[10px] uppercase font-black">Bandeja de Autorización</div>
                 </div>
                 {shiftRequests.filter(r => r.status === 'pending').length > 0 && (
                   <span className="absolute -top-1 -right-1 bg-amber-500 text-black text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-black shadow-lg">
                     {shiftRequests.filter(r => r.status === 'pending').length}
                   </span>
                 )}
               </button>
             )}

             {/* Dynamic Notification Indicator */}
             {session?.doctorId && userNotifications.length > 0 && (
               <div className="relative group">
                 <button className="bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20 text-emerald-600 relative">
                    <Bell className="w-5 h-5" />
                    <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                      {userNotifications.length}
                    </span>
                 </button>
                 {/* Tooltip-like dropdown */}
                 <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-emerald-100 rounded-2xl shadow-2xl p-4 hidden group-hover:block z-[60]">
                    <h4 className="text-[10px] uppercase text-emerald-600 font-bold mb-3 border-b border-emerald-500/10 pb-2">Notificaciones</h4>
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                       {userNotifications.map(n => (
                         <div key={n.id} className="text-[11px] bg-emerald-50/30 p-3 rounded-xl border border-emerald-100 group/item">
                            <p className="text-slate-700">{n.message}</p>
                            <div className="flex justify-between items-center mt-2">
                              <span className="text-[8px] text-slate-400">{new Date(n.timestamp).toLocaleTimeString()}</span>
                              <button 
                                onClick={() => markNotificationRead(n.id)}
                                className="text-emerald-500 hover:scale-110 active:scale-95"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                              </button>
                            </div>
                         </div>
                       ))}
                    </div>
                 </div>
               </div>
             )}
          </div>
          <div className="flex items-center gap-3">
            <a 
              href="https://wa.me/573173683886?mode=gi_t" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-[#25D366] text-white px-4 py-1.5 rounded-xl text-xs font-black hover:bg-[#20ba59] transition-all shadow-lg shadow-emerald-500/10 no-print"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden md:inline uppercase">Chat Médico</span>
            </a>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 text-rose-500 font-bold text-xs bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20 no-print"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline uppercase">Cerrar Sesión</span>
            </button>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto mt-4 overflow-x-auto">
          <div className="flex gap-2">
            {[
              { id: 'home', label: 'Dashboard', icon: ChevronRight },
              { id: 'turnos', label: 'Turnero Hospitalario', icon: Calendar },
              { id: 'census', label: 'Entrega de Turnos', icon: ClipboardList },
              { id: 'committee', label: 'Comité H.C.', icon: FileCheck },
              { id: 'pic', label: 'Capacitaciones (PIC)', icon: BrainCircuit },
              { id: 'solicitudes', label: 'Solicitudes', icon: Send },
              { id: 'rural', label: 'Disponibilidades Rurales', icon: MapPin },
              ...((session.r === 'admin' || session.r === 'root') ? [
                { id: 'stats', label: 'Estadísticas', icon: BarChart3 }
              ] : []),
              { id: 'novedades', label: 'Novedades', icon: ClipboardList },
              { id: 'bd', label: 'Talento Humano', icon: Database },
              { id: 'docs', label: 'Guías & Manuales', icon: FileText },
              ...(session.r === 'admin' ? [
                { id: 'admin', label: 'Panel Administrativo', icon: Settings },
                { id: 'toolbox', label: 'Caja de Herramientas AI', icon: Database },
                { id: 'ayuda', label: 'Resumen Órdenes', icon: BookOpen }
              ] : [])
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                  activeTab === tab.id 
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' 
                    : 'bg-white text-emerald-800/60 hover:bg-emerald-50 border border-emerald-100'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[100vw] overflow-x-hidden p-4 pb-24 md:pb-32">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, x: -10 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: 10 }}
              className="space-y-6 max-w-4xl mx-auto"
            >
              <div className="flex justify-between items-center bg-white p-8 rounded-[32px] border border-emerald-100 shadow-xl relative overflow-hidden group">
                <div className="relative z-10">
                  <h2 className="text-3xl font-black text-slate-800">Bienvenido, {session.n}</h2>
                  <p className="text-xs text-slate-400 mt-1 uppercase font-bold tracking-widest">Gestión Hospitalaria E.S.E v3.0</p>
                </div>
                <div className="flex gap-4">
                  <a 
                    href="https://wa.me/573173683886?mode=gi_t" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 bg-[#25D366] text-white px-8 py-4 rounded-2xl font-black text-sm uppercase hover:scale-105 active:scale-95 transition-all shadow-xl shadow-emerald-500/20"
                  >
                    <MessageCircle className="w-6 h-6" />
                    Unirse al Grupo Médico
                  </a>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-8 rounded-3xl border border-emerald-100 relative overflow-hidden group shadow-sm">
                  <div className="absolute right-[-20px] top-[-20px] opacity-5 group-hover:opacity-10 transition-opacity">
                    <Calendar className="w-32 h-32 text-emerald-600" />
                  </div>
                  <p className="text-xs uppercase tracking-widest text-slate-400 mb-2 font-bold focus:brand-primary">Consumo Global (Mes Actual)</p>
                  <div className="text-6xl font-black text-emerald-600">{globalTotalHours}h</div>
                  <div className="mt-4 flex items-center gap-2 text-slate-400 text-sm">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                    Sincronizado en tiempo real
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="bg-white p-6 rounded-3xl border border-emerald-100 text-center shadow-sm">
                      <p className="text-[10px] uppercase text-emerald-600 mb-1 font-bold">MÉDICOS</p>
                      <div className="text-3xl font-bold text-slate-800">{doctors.filter(d => d.st === 'activo').length}</div>
                   </div>
                   <div className="bg-white p-6 rounded-3xl border border-emerald-100 text-center shadow-sm">
                      <p className="text-[10px] uppercase text-emerald-600 mb-1 font-bold">REGLAS ACTIVAS</p>
                      <div className="text-3xl font-bold text-slate-800">12</div>
                   </div>
                   <button 
                    onClick={() => window.print()}
                    className="bg-white border border-emerald-500/20 p-4 rounded-3xl flex items-center justify-center gap-3 font-bold text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                  >
                    <Printer className="w-5 h-5" />
                    <span className="text-xs uppercase">Imprimir</span>
                  </button>
                  <button 
                    onClick={generateAIStatsReport}
                    className="bg-violet-600 text-white p-4 rounded-3xl flex items-center justify-center gap-3 font-bold hover:bg-violet-700 transition-all shadow-lg shadow-violet-500/20 animate-pulse"
                  >
                    <Sparkles className="w-5 h-5" />
                    <span className="text-xs uppercase">Análisis IA</span>
                  </button>
                  <button 
                    onClick={calculateProductivity}
                    className="col-span-2 bg-emerald-700 text-white p-4 rounded-3xl flex items-center justify-center gap-3 font-bold hover:bg-emerald-800 transition-all shadow-lg shadow-emerald-500/20"
                  >
                    <ClipboardList className="w-5 h-5" />
                    <span className="text-xs uppercase">Estadísticas de Productividad</span>
                  </button>

                  <a 
                    href="https://wa.me/573173683886?mode=gi_t"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="col-span-2 bg-[#25D366] text-white p-4 rounded-3xl flex items-center justify-center gap-3 font-black hover:bg-[#20ba59] transition-all shadow-lg shadow-emerald-500/20 group"
                  >
                    <MessageCircle className="w-6 h-6 animate-bounce" />
                    <div className="text-left">
                      <div className="text-[8px] uppercase opacity-80 leading-none mb-1">Comunidad Médica</div>
                      <div className="text-sm">UNIRSE AL GRUPO WHATSAPP</div>
                    </div>
                  </a>

                  {/* EMERGENCY BUTTONS */}
                  {canSeeCodigoRojo && (
                    <button 
                      onClick={() => triggerEmergencyCode('ROJO')}
                      className="col-span-1 bg-gradient-to-br from-rose-600 to-rose-700 text-white p-4 rounded-3xl flex items-center justify-center gap-3 font-black hover:scale-105 active:scale-95 transition-all shadow-xl shadow-rose-500/20 border-2 border-rose-400 group"
                    >
                      <div className="bg-white/20 p-2 rounded-xl group-hover:rotate-12 transition-transform">
                        <Flame className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-left">
                        <div className="text-[8px] uppercase opacity-80 leading-none mb-1">Obstetricia</div>
                        <div className="text-sm">CÓDIGO ROJO</div>
                      </div>
                    </button>
                  )}

                  {canSeeCodigoAzul && (
                    <button 
                      onClick={() => triggerEmergencyCode('AZUL')}
                      className="col-span-1 bg-gradient-to-br from-blue-600 to-blue-700 text-white p-4 rounded-3xl flex items-center justify-center gap-3 font-black hover:scale-105 active:scale-95 transition-all shadow-xl shadow-blue-500/20 border-2 border-blue-400 group"
                    >
                      <div className="bg-white/20 p-2 rounded-xl group-hover:animate-pulse">
                        <Activity className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-left">
                        <div className="text-[8px] uppercase opacity-80 leading-none mb-1">RCP / Paro</div>
                        <div className="text-sm">CÓDIGO AZUL</div>
                      </div>
                    </button>
                  )}
                </div>
              </div>

              {showProductivityStats && productivityResults.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white p-8 rounded-[40px] border border-emerald-100 shadow-xl overflow-hidden"
                >
                   <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <ClipboardList className="w-6 h-6 text-emerald-600" /> 
                        Productividad por Servicio - {MONTH_NAMES[selectedMonth]} {selectedYear}
                      </h3>
                      <button 
                        onClick={() => setShowProductivityStats(false)}
                        className="text-slate-400 hover:text-rose-500 transition-colors"
                      >
                         <XCircle className="w-6 h-6" />
                      </button>
                   </div>
                   
                   <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                           <tr className="bg-emerald-50 text-[10px] text-emerald-800 font-bold uppercase tracking-wider">
                              <th className="p-4 rounded-tl-2xl">MÉDICO / ROL</th>
                              {serviceMappings.map(m => (
                                <th key={m.id} className="p-4 text-center">{m.name}</th>
                              ))}
                              <th className="p-4 text-center">OTROS</th>
                              <th className="p-4 text-center rounded-tr-2xl">TOTAL</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {productivityResults.map((res, i) => (
                             <tr key={i} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4">
                                   <div className="font-bold text-slate-800 text-sm">{res.doctor}</div>
                                   <div className="text-[9px] text-slate-400 uppercase font-mono">{res.role}</div>
                                </td>
                                {serviceMappings.map(m => (
                                  <td key={m.id} className="p-4 text-center">
                                     <div className="font-black text-emerald-600 text-sm">{res.stats[m.name].shifts} <span className="text-[9px] font-normal text-slate-400">T</span></div>
                                     <div className="text-[9px] text-slate-400">{res.stats[m.name].hours}h</div>
                                  </td>
                                ))}
                                <td className="p-4 text-center">
                                   <div className="font-black text-amber-600 text-sm">{res.stats['Otros'].shifts} <span className="text-[9px] font-normal text-slate-400">T</span></div>
                                   <div className="text-[9px] text-slate-400">{res.stats['Otros'].hours}h</div>
                                </td>
                                <td className="p-4 text-center font-black text-slate-800 bg-emerald-50/20">
                                   <div className="text-sm">{res.totalDocHours}h</div>
                                </td>
                             </tr>
                           ))}
                        </tbody>
                      </table>
                   </div>
                   <div className="mt-6 flex justify-end gap-3 no-print">
                      <button 
                        onClick={() => {
                          const ws = XLSX.utils.json_to_sheet(productivityResults.map(r => ({
                            'Médico': r.doctor,
                            'Rol': r.role,
                            ...Object.fromEntries(serviceMappings.map(m => [`${m.name} (H)`, r.stats[m.name].hours])),
                            'Otros (H)': r.stats['Otros'].hours,
                            'Total (H)': r.totalDocHours
                          })));
                          const wb = XLSX.utils.book_new();
                          XLSX.utils.book_append_sheet(wb, ws, "Productividad");
                          XLSX.writeFile(wb, `Productividad_${MONTH_NAMES[selectedMonth]}_${selectedYear}.xlsx`);
                        }}
                        className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl border border-emerald-200 font-bold text-[10px] uppercase flex items-center gap-2"
                      >
                         <FileSpreadsheet className="w-4 h-4" /> Exportar Excel
                      </button>
                   </div>
                </motion.div>
              )}

              {isGeneratingAI && (
                <div className="bg-white p-12 rounded-[32px] border border-violet-100 text-center space-y-4">
                  <div className="flex justify-center">
                    <Sparkles className="w-12 h-12 text-violet-500 animate-spin" />
                  </div>
                  <p className="text-violet-600 font-black animate-pulse uppercase tracking-widest text-xs">Analizando indicadores con IA...</p>
                </div>
              )}

              {aiReport && !isGeneratingAI && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-slate-900 border-l-4 border-violet-500 p-8 rounded-3xl text-white shadow-2xl relative overflow-hidden"
                >
                   <div className="absolute top-0 right-0 p-8 opacity-10">
                      <Sparkles className="w-32 h-32" />
                   </div>
                   <div className="flex justify-between items-start mb-6 border-b border-white/10 pb-4">
                      <h3 className="text-xl font-bold flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-violet-400" /> Dashboard Estadístico IA
                      </h3>
                      <button 
                        onClick={() => setAiReport(null)}
                        className="text-white/40 hover:text-white transition-colors"
                      >
                         <XCircle className="w-5 h-5" />
                      </button>
                   </div>
                   <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-li:my-1">
                      <Markdown>{aiReport}</Markdown>
                   </div>
                   <div className="mt-8 pt-4 border-t border-white/10 flex justify-between items-center">
                      <p className="text-[9px] text-white/40 uppercase font-mono italic">Generado el {new Date().toLocaleString()}</p>
                      <button 
                        onClick={() => {
                          const win = window.open('', '_blank');
                          win?.document.write(`<html><head><title>Informe Estadístico IA</title><style>body{font-family:sans-serif;padding:40px;line-height:1.6;color:#333}h2{color:#7c3aed}pre{white-space:pre-wrap;background:#f4f4f4;padding:20px;border-radius:10px}</style></head><body><h2>Informe Estadístico Gerencial - IA</h2><div style="font-size:14px">${aiReport.replace(/\n/g, '<br>')}</div></body></html>`);
                        }}
                        className="text-[10px] font-black underline underline-offset-4 hover:text-violet-400"
                      >
                        ABRIR PARA IMPRIMIR
                      </button>
                   </div>
                </motion.div>
              )}

              {session.r === 'doctor' && (
                <div className="bg-white p-8 rounded-3xl border border-emerald-100 shadow-xl">
                  <h3 className="text-xl font-bold text-emerald-700 mb-6 flex items-center gap-2">
                    <ShieldCheck className="w-6 h-6 text-emerald-600" /> Gestión de Seguridad
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <input 
                      type="password"
                      placeholder="Contraseña Actual"
                      className="bg-stone-50 border border-emerald-100 p-4 rounded-xl outline-none focus:border-emerald-500 text-slate-800"
                      value={oldPass}
                      onChange={(e) => setOldPass(e.target.value)}
                    />
                    <input 
                      type="password"
                      placeholder="Nueva Contraseña"
                      className="bg-stone-50 border border-emerald-100 p-4 rounded-xl outline-none focus:border-emerald-500 text-slate-800"
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                    />
                    <button 
                      onClick={changePassword}
                      className="bg-emerald-600 text-white font-black rounded-xl hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-emerald-500/20"
                    >
                      ACTUALIZAR CONTRASEÑA
                    </button>
                  </div>
                  <p className="text-[10px] text-emerald-600/50 mt-4 italic">Frecuencia de cambio obligatoria: Cada 90 días.</p>
                </div>
              )}

              <div className="bg-emerald-50/50 border border-emerald-100 p-6 rounded-3xl">
                 <h3 className="text-emerald-800 font-bold mb-4 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" /> 
                    Estado del Sistema
                 </h3>
                 <p className="text-sm text-slate-600 leading-relaxed">
                    Motor V27.0 activo. El cálculo "Triple Sum" consolida las 24 horas por profesional antes de computar los semáforos semanales. Los cambios en el panel de administrador afectan retroactivamente a los cálculos si se modifican las siglas horarias.
                 </p>
              </div>
            </motion.div>
          )}

          {activeTab === 'ayuda' && (
            <motion.div 
               key="ayuda"
               initial={{ opacity: 0, y: 10 }} 
               animate={{ opacity: 1, y: 0 }} 
               exit={{ opacity: 0, y: -10 }}
               className="space-y-6 max-w-5xl mx-auto pb-20"
            >
              <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-5">
                   <BookOpen className="w-64 h-64" />
                </div>
                
                <h2 className="text-3xl font-black text-slate-800 mb-2">Resumen de Funciones y Órdenes</h2>
                <p className="text-slate-500 font-medium mb-8">Guía operativa para la administración del sistema V27.0 - ESE Roldanillo</p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   <div className="p-6 bg-sky-50 rounded-3xl border border-sky-100 group hover:shadow-md transition-all">
                      <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-sky-600 mb-4">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <h4 className="font-bold text-sky-900 mb-2">Gestión de Turnos</h4>
                      <p className="text-xs text-sky-700 leading-relaxed">
                        Ciclo de siglas: Clic en celdas para cambiar turnos. El sistema valida automáticamente conflictos de agenda y genera descansos (PT) tras noches.
                      </p>
                   </div>

                   <div className="p-6 bg-rose-50 rounded-3xl border border-rose-100 group hover:shadow-md transition-all">
                      <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-rose-600 mb-4">
                        <PhoneIncoming className="w-5 h-5" />
                      </div>
                      <h4 className="font-bold text-rose-900 mb-2">Llamado Disponibilidad</h4>
                      <p className="text-xs text-rose-700 leading-relaxed">
                        Procedimiento de crisis: Busca al médico asignado a Disponibilidad (Siglas D) y envía una notificación push de alta prioridad al dispositivo del médico.
                      </p>
                   </div>

                   <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100 group hover:shadow-md transition-all">
                      <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-emerald-600 mb-4">
                        <ClipboardList className="w-5 h-5" />
                      </div>
                      <h4 className="font-bold text-emerald-900 mb-2">Control de Auditoría</h4>
                      <p className="text-xs text-emerald-700 leading-relaxed">
                        Registro irreversible de novedades: Cada cambio de turno queda grabado con sello de tiempo, admin responsable y valor anterior.
                      </p>
                   </div>

                   <div className="p-6 bg-violet-50 rounded-3xl border border-violet-100 group hover:shadow-md transition-all">
                      <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-violet-600 mb-4">
                        <BrainIcon className="w-5 h-5" />
                      </div>
                      <h4 className="font-bold text-violet-900 mb-2">PIC (Programa Institucional de Capacitaciones)</h4>
                      <p className="text-xs text-violet-700 leading-relaxed">
                        Módulo PIC: Permite programar capacitaciones mensuales cargando soportes de Pre-test, asistencia firmada y evaluación post-test obligatoria.
                      </p>
                   </div>

                   <div className="p-6 bg-amber-50 rounded-3xl border border-amber-100 group hover:shadow-md transition-all">
                      <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-amber-600 mb-4">
                        <Users className="w-5 h-5" />
                      </div>
                      <h4 className="font-bold text-amber-900 mb-2">Roles y Permisos</h4>
                      <p className="text-xs text-amber-700 leading-relaxed">
                        Diferenciación jerárquica: Solo Admins pueden programar. Enfermeros Jefes pueden gestionar llamados a disponibilidad y alertas.
                      </p>
                   </div>

                   <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-100 group hover:shadow-md transition-all">
                      <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-indigo-600 mb-4">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <h4 className="font-bold text-indigo-900 mb-2">Auto-Registro</h4>
                      <p className="text-xs text-indigo-700 leading-relaxed">
                        Flujo de ingreso: Médicos nuevos se registran &rarr; Admin valida y activa &rarr; Se generan credenciales para el logueo del profesional.
                      </p>
                   </div>

                   <div className="p-6 bg-slate-900 rounded-3xl border border-slate-800 text-white group hover:shadow-md transition-all">
                      <div className="w-10 h-10 bg-slate-800 rounded-xl shadow-sm flex items-center justify-center text-sky-400 mb-4">
                        <FileText className="w-5 h-5" />
                      </div>
                      <h4 className="font-bold mb-2">Informes de Función</h4>
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        Resumen para Administrador: Este panel consolida todas las reglas de negocio aplicadas al motor de turnos del hospital.
                      </p>
                   </div>
                </div>

                <div className="mt-12 space-y-4">
                   <h3 className="text-xl font-black text-slate-800">Órdenes de Sistema (Comandos)</h3>
                   <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 overflow-x-auto">
                      <table className="w-full text-left text-sm font-medium text-slate-600">
                         <thead>
                            <tr className="border-b border-slate-200 uppercase text-[10px] font-black tracking-widest text-slate-400">
                               <th className="pb-4 py-2">Comando / Función</th>
                               <th className="pb-4 py-2">Propósito Operativo</th>
                               <th className="pb-4 py-2">Acceso</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100">
                            <tr>
                               <td className="py-4 font-bold text-slate-800">cycleShift()</td>
                               <td className="py-4">Ciclar turnos en la cuadrícula mensual</td>
                               <td className="py-4"><span className="px-2 py-1 bg-sky-100 text-sky-700 rounded-lg text-[10px] font-black">ADMIN</span></td>
                            </tr>
                            <tr>
                               <td className="py-4 font-bold text-slate-800">pushNotification()</td>
                               <td className="py-4">Enviar alertas push a dispositivos registrados</td>
                               <td className="py-4"><span className="px-2 py-1 bg-sky-100 text-sky-700 rounded-lg text-[10px] font-black">ADMIN / ENF JEF</span></td>
                            </tr>
                            <tr>
                               <td className="py-4 font-bold text-slate-800">handleCallAvailability()</td>
                               <td className="py-4">Activar protocolo de médico de guardia</td>
                               <td className="py-4"><span className="px-2 py-1 bg-rose-100 text-rose-700 rounded-lg text-[10px] font-black">ADMIN / ENF JEF</span></td>
                            </tr>
                            <tr>
                               <td className="py-4 font-bold text-slate-800">updateDoctorMonth()</td>
                               <td className="py-4">Persistencia granular por profesional</td>
                               <td className="py-4"><span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black">SISTEMA</span></td>
                            </tr>
                         </tbody>
                      </table>
                   </div>
                </div>
              </div>
            </motion.div>
          )}

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
            <motion.div 
              key="turnos"
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm no-print">
                <div>
                  <h2 className="text-2xl font-black text-slate-800">Turnero Hospitalario</h2>
                  <p className="text-xs text-stone-500 font-mono italic">Sistema de Gestión de Talento Humano</p>
                </div>
                <div className="flex gap-3">
                  {(session.r === 'admin' || (session.doctorId && doctors.find(d => d.id === session.doctorId)?.permissions?.includes('call_availability'))) && (
                    <button 
                      onClick={() => setShowCallModal(true)}
                      className="bg-rose-500 text-white px-3 py-2 sm:px-6 sm:py-3 rounded-xl font-black flex items-center gap-2 hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20 text-[10px] sm:text-sm"
                    >
                      <PhoneIncoming className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
                      LLAMAR DISPONIBILIDAD
                    </button>
                  )}
                </div>
              </div>

              {/* Status Section */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
                 <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] text-emerald-600 uppercase font-black mb-1">Último Llamado</p>
                    <div className="text-[11px] font-bold text-slate-800 truncate">
                      {availabilityCalls[0] ? `${availabilityCalls[0].doctorName} (${new Date(availabilityCalls[0].timestamp).toLocaleTimeString()})` : 'Sin llamados hoy'}
                    </div>
                 </div>
                 <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] text-sky-600 uppercase font-black mb-1">Personal Planta</p>
                    <div className="text-xl font-black text-slate-800">{doctors.filter(d => d.cat === 'Planta' && d.st === 'activo').length}</div>
                 </div>
                 <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] text-rose-600 uppercase font-black mb-1">Personal Rural</p>
                    <div className="text-xl font-black text-slate-800">{doctors.filter(d => d.cat === 'Rural' && d.st === 'activo').length}</div>
                 </div>
                 <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] text-amber-600 uppercase font-black mb-1">Notificaciones Mes</p>
                    <div className="text-xl font-black text-slate-800">{auditLogs.filter(l => l.targetMonth === selectedMonth).length}</div>
                 </div>
              </div>

              {/* AI Shift Engine Panel */}
              {(session.r === 'admin' || session.r === 'root') && (
                <div className="bg-emerald-900 text-emerald-100 p-6 rounded-[32px] border border-emerald-800 shadow-xl no-print">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                       <div className="p-3 bg-emerald-800 rounded-2xl text-emerald-400">
                          <BrainCircuit className="w-6 h-6 animate-pulse" />
                       </div>
                       <div>
                          <h3 className="font-black uppercase tracking-tight text-white">IA Shift Engine V2</h3>
                          <p className="text-[10px] uppercase font-bold opacity-60">Generador de mallas automáticas bajo reglas institucionales</p>
                       </div>
                    </div>
                    <div className="flex gap-2">
                      {aiSuggestions ? (
                        <>
                          <button 
                            onClick={() => setAiSuggestions(null)}
                            className="bg-slate-800 text-white px-4 py-2.5 rounded-xl font-bold text-xs hover:bg-slate-700 transition-all border border-slate-700"
                          >
                            DESCARTAR
                          </button>
                          <button 
                            onClick={applyAISuggestions}
                            className="bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-black text-xs hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
                          >
                            APLICAR MALLA GENERADA
                          </button>
                        </>
                      ) : (
                        <button 
                          onClick={generateAISuggestions}
                          disabled={isGeneratingAISuggestions}
                          className="bg-white text-emerald-900 px-6 py-2.5 rounded-xl font-black text-xs hover:bg-emerald-50 transition-all shadow-lg shadow-white/10 disabled:opacity-50"
                        >
                          {isGeneratingAISuggestions ? (
                            <span className="flex items-center gap-2">
                              <Wand2 className="w-4 h-4 animate-spin" /> PROCESANDO...
                            </span>
                          ) : (
                            <span className="flex items-center gap-2">
                              <Sparkles className="w-4 h-4" /> GENERAR PROPUESTA MES
                            </span>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {aiSuggestions && (
                    <div className="mt-6 p-4 bg-emerald-950/50 rounded-2xl border border-emerald-800/50">
                      <p className="text-[10px] font-bold text-emerald-400 mb-0 uppercase italic flex items-center gap-2">
                        <Info className="w-3 h-3" /> Se ha generado una propuesta completa de turnos siguiendo las secuencias ordenadas. Revise los cambios antes de aplicar permanentemente.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Selectors */}
              <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-2xl border border-slate-200 no-print shadow-sm sticky top-0 z-[60]">
                <div className="flex-1 min-w-[200px]">
                   <label className="text-[10px] uppercase text-sky-600 ml-2 mb-1 block font-bold">Período de Nómina</label>
                   <div className="flex gap-2">
                    <select 
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                      className="flex-1 bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-800 outline-none focus:border-sky-500"
                    >
                      {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </select>
                    <select 
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                      className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-800 outline-none focus:border-sky-500"
                    >
                      {Array.from({ length: 10 }, (_, i) => 2026 + i).map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                   </div>
                </div>

                <div className="flex-1 min-w-[250px]">
                  <label className="text-[10px] uppercase text-sky-600 ml-2 mb-1 block font-bold">Filtrar por Médico</label>
                  <div className="relative group">
                    <select 
                      onChange={(e) => {
                        const id = parseInt(e.target.value);
                        if (id && !doctorFilter.includes(id)) setDoctorFilter([...doctorFilter, id]);
                        e.target.value = "";
                      }}
                      className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-800 outline-none focus:border-sky-500"
                    >
                      <option value="">Seleccionar médicos...</option>
                      {doctors.map(d => (
                        <option key={d.id} value={d.id}>{d.nombre}</option>
                      ))}
                    </select>
                  </div>
                  {doctorFilter.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                       {doctorFilter.map(id => {
                         const d = doctors.find(doc => doc.id === id);
                         return (
                           <div key={id} className="bg-emerald-600 border border-white/20 text-white px-2 py-1 rounded-lg text-[9px] flex items-center gap-2 shadow-sm">
                              {d?.nombre}
                              <button onClick={() => setDoctorFilter(doctorFilter.filter(fid => fid !== id))} className="hover:text-rose-200 text-lg line-height-1">×</button>
                           </div>
                         );
                       })}
                       <button onClick={() => setDoctorFilter([])} className="text-[9px] text-rose-500 font-bold ml-1 hover:underline">Limpiar todo</button>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1 items-start w-full md:w-auto relative">
                   <label className="text-[10px] uppercase text-emerald-600/60 ml-2 block font-bold flex items-center gap-2">
                     <Users className="w-3 h-3" />
                     Filtrar por Rol
                   </label>
                   
                   <div className="relative w-full md:w-[220px]">
                      <button 
                        onClick={() => setShowRoleSelector(!showRoleSelector)}
                        className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-left flex justify-between items-center group hover:border-emerald-500 transition-all"
                      >
                         <span className="text-[10px] md:text-xs font-bold text-slate-700 truncate">
                           {selectedRoles.length === 0 ? 'TODOS LOS ROLES' : `${selectedRoles.length} seleccionado(s)`}
                         </span>
                         <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showRoleSelector ? 'rotate-180' : ''}`} />
                      </button>

                      <AnimatePresence>
                        {showRoleSelector && (
                          <>
                            <div className="fixed inset-0 z-[100]" onClick={() => setShowRoleSelector(false)} />
                            <motion.div 
                              initial={{ opacity: 0, y: 10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 10, scale: 0.95 }}
                              className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[101] overflow-hidden"
                            >
                               <div className="p-3 border-b border-slate-100 bg-stone-50">
                                  <div className="relative">
                                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                     <input 
                                       autoFocus
                                       placeholder="Buscar rol..."
                                       className="w-full bg-white border border-slate-200 p-2 pl-9 rounded-lg text-xs outline-none focus:border-emerald-500"
                                       value={roleSearch}
                                       onChange={e => setRoleSearch(e.target.value)}
                                     />
                                  </div>
                               </div>
                               <div className="max-h-[250px] overflow-y-auto p-2 custom-scrollbar">
                                  <button 
                                    onClick={() => setSelectedRoles([])}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-black uppercase mb-1 transition-colors ${selectedRoles.length === 0 ? 'bg-emerald-600 text-white' : 'hover:bg-slate-50 text-slate-600'}`}
                                  >
                                    TODOS
                                  </button>
                                  {filteredRolesList.map(r => (
                                    <button
                                      key={r}
                                      onClick={() => {
                                        if (selectedRoles.includes(r)) {
                                          setSelectedRoles(selectedRoles.filter(sr => sr !== r));
                                        } else {
                                          setSelectedRoles([...selectedRoles, r]);
                                        }
                                      }}
                                      className={`
                                        w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold uppercase mb-0.5 transition-all flex items-center justify-between
                                        ${selectedRoles.includes(r) ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-slate-50 text-slate-600'}
                                      `}
                                    >
                                      {r}
                                      {selectedRoles.includes(r) && <CheckCircle className="w-3 h-3 text-emerald-600" />}
                                    </button>
                                  ))}
                                  {filteredRolesList.length === 0 && (
                                    <p className="text-center py-4 text-[10px] text-slate-400 italic">No se encontraron roles</p>
                                  )}
                               </div>
                               {selectedRoles.length > 0 && (
                                 <div className="p-2 border-t border-slate-100 bg-stone-50">
                                    <button 
                                      onClick={() => setSelectedRoles([])}
                                      className="w-full py-2 text-[9px] font-black text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                    >
                                      LIMPIAR SELECCIÓN
                                    </button>
                                 </div>
                               )}
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                   </div>
                </div>

                <div className="flex flex-col gap-1 items-start w-full md:w-auto relative">
                    <label className="text-[10px] uppercase text-emerald-600/60 ml-2 block font-bold flex items-center gap-2">
                      <Layers className="w-3 h-3" />
                      Filtrar por Categoría
                    </label>
                    
                    <div className="relative w-full md:w-[220px]">
                       <button 
                         onClick={() => setShowCatSelector(!showCatSelector)}
                         className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-left flex justify-between items-center group hover:border-emerald-500 transition-all"
                       >
                          <span className="text-[10px] md:text-xs font-bold text-slate-700 truncate">
                            {selectedCategories.length === 0 ? 'TODAS LAS CATEGORÍAS' : `${selectedCategories.length} seleccionado(s)`}
                          </span>
                          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showCatSelector ? 'rotate-180' : ''}`} />
                       </button>

                       <AnimatePresence>
                         {showCatSelector && (
                           <>
                             <div className="fixed inset-0 z-[100]" onClick={() => setShowCatSelector(false)} />
                             <motion.div 
                               initial={{ opacity: 0, y: 10, scale: 0.95 }}
                               animate={{ opacity: 1, y: 0, scale: 1 }}
                               exit={{ opacity: 0, y: 10, scale: 0.95 }}
                               className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[101] overflow-hidden"
                             >
                                <div className="max-h-[250px] overflow-y-auto p-2 custom-scrollbar">
                                   <button 
                                     onClick={() => setSelectedCategories([])}
                                     className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-black uppercase mb-1 transition-colors ${selectedCategories.length === 0 ? 'bg-emerald-600 text-white' : 'hover:bg-slate-50 text-slate-600'}`}
                                   >
                                     TODAS
                                   </button>
                                   {['Planta', 'CTA', 'APS', 'Rural', 'Disponibilidad'].map(cat => (
                                     <button
                                       key={cat}
                                       onClick={() => {
                                         if (selectedCategories.includes(cat)) {
                                           setSelectedCategories(selectedCategories.filter(sc => sc !== cat));
                                         } else {
                                           setSelectedCategories([...selectedCategories, cat]);
                                         }
                                       }}
                                       className={`
                                         w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold uppercase mb-0.5 transition-all flex items-center justify-between
                                         ${selectedCategories.includes(cat) ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-slate-50 text-slate-600'}
                                       `}
                                     >
                                       {cat}
                                       {selectedCategories.includes(cat) && <CheckCircle className="w-3 h-3 text-emerald-600" />}
                                     </button>
                                   ))}
                                </div>
                                {selectedCategories.length > 0 && (
                                  <div className="p-2 border-t border-slate-100 bg-stone-50">
                                     <button 
                                       onClick={() => setSelectedCategories([])}
                                       className="w-full py-2 text-[9px] font-black text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                     >
                                       LIMPIAR SELECCIÓN
                                     </button>
                                  </div>
                                )}
                             </motion.div>
                           </>
                         )}
                       </AnimatePresence>
                    </div>
                 </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex gap-2">
                    <button onClick={() => setShowGridHours(!showGridHours)} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase text-slate-500 border border-slate-200 transition-colors ${showGridHours ? 'bg-sky-100 text-sky-700' : 'bg-white hover:bg-slate-50' }`}>
                      {showGridHours ? "Ocultar Horas" : "Ver en horas"}
                    </button>
                    <button onClick={downloadTemplateExcel} className="px-3 py-2 text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-100 rounded-xl hover:bg-blue-100">PLANTILLA</button>
                    <button onClick={exportTurneroExcel} className="px-3 py-2 text-[10px] font-black bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100">EXCEL</button>
                    <button onClick={exportTurneroPDF} className="px-3 py-2 text-[10px] font-black bg-rose-50 text-rose-700 rounded-xl hover:bg-rose-100">PDF</button>
                  </div>
                  {isAdminUser && (
                    <div className="flex items-center gap-2 bg-stone-100 p-1 rounded-xl border border-slate-200">
                      <button 
                        onClick={handleManualPaste}
                        className="bg-sky-600 text-white px-3 py-2 rounded-lg font-black text-[10px] uppercase flex items-center gap-2 hover:scale-105 transition-transform shadow-sm"
                        title="Pegar datos de Excel"
                      >
                        <ClipboardPaste className="w-4 h-4" /> Pegar Malla
                      </button>
                      <label className="cursor-pointer bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-all shadow-sm" title="Importar Excel de Turnos">
                        <FileSpreadsheet className="w-4 h-4" />
                        <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportExcel} />
                      </label>
                      <button 
                        onClick={publishTurnos}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-black text-[10px] uppercase flex items-center gap-2 hover:scale-105 transition-transform shadow-md shadow-emerald-500/20"
                      >
                        <CheckCircle className="w-4 h-4" /> Publicar Turnos ({daysInMonth} dias)
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 px-4 py-3 bg-white rounded-xl border border-slate-200 text-emerald-600 font-black shadow-sm">
                     <span className="text-[10px] text-slate-400">TOTAL CAPTURA:</span>
                     {globalTotalHours}h
                  </div>
                </div>
              </div>

              {/* Table Platform */}
              <div className="relative">
                {/* Mobile Scroll Indicator */}
                <div className="md:hidden flex items-center justify-between px-4 pb-2 text-[9px] text-slate-400 font-bold italic">
                   <span>← Desliza para ver más días</span>
                   <span>Días del Mes →</span>
                </div>
                
                <div className="overflow-auto border border-slate-200 rounded-[18px] bg-white shadow-xl max-h-[calc(100vh-250px)] custom-scrollbar">
                  <table 
                    className="w-full text-[10px] text-center border-collapse relative"
                  >
                    <thead className="sticky top-0 z-40 bg-slate-50 shadow-[0_2px_5px_rgba(0,0,0,0.05)]">
                      <tr>
                        <th className="sticky left-0 top-0 bg-slate-50 z-50 min-w-[100px] md:min-w-[140px] text-left px-2 md:px-4 py-4 text-sky-700 border-r-2 border-sky-500 border-b border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                          TALENTO HUMANO
                        </th>
                      <th className="w-8 border border-slate-200 text-slate-400 font-black border-b sticky top-0 bg-slate-50 z-40">J.</th>
                      {Array.from({ length: daysInMonth }, (_, i) => {
                        const day = i + 1;
                        const dow = new Date(selectedYear, selectedMonth, day).getDay();
                        return (
                          <th key={day} className={`px-2 py-2 border border-slate-200 border-b sticky top-0 bg-slate-50 z-40 ${dow === 0 ? 'border-r-2 border-r-sky-500' : ''}`}>
                            <div className="text-slate-800 text-[11px] font-bold">{day}</div>
                            <div className="text-[8px] text-emerald-600 uppercase font-bold">{DAY_NAMES[dow]}</div>
                          </th>
                        );
                      })}
                      {sundays.map((_, i) => (
                        <th key={i} className="min-w-[40px] px-2 bg-slate-100 border border-slate-200 border-b text-[8px] text-sky-600 font-bold sticky top-0 z-40">
                          S{i + 1}
                        </th>
                      ))}
                      <th className="sticky right-0 top-0 z-50 bg-sky-500 text-white font-black px-4 min-w-[60px] border-b border-slate-200 shadow-[-2px_0_5px_rgba(0,0,0,0.1)]">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doctors.filter(d => 
                      (selectedRoles.length === 0 || selectedRoles.includes(d.rol || 'Médico General')) &&
                      (selectedCategories.length === 0 || selectedCategories.includes(d.cat)) &&
                      (doctorFilter.length === 0 || doctorFilter.includes(d.id)) && 
                      (d.st === 'activo')
                    )
                    .sort(sortDoctors)
                    .map(med => {
                      // Calculate Doctor Totals
                      let medTotalMonth = 0;
                      let weeklyAcc = Array(sundays.length).fill(0);

                      for (let d = 1; d <= daysInMonth; d++) {
                        (['m', 't', 'n'] as SlotType[]).forEach(slot => {
                          const sigla = currentMonthData[med.id]?.[slot]?.[d] || 'X';
                          const peso = getVarHours(slot, sigla);
                          medTotalMonth += peso;
                          const wIdx = sundays.findIndex(sunD => d <= sunD);
                          if (wIdx !== -1) weeklyAcc[wIdx] += peso;
                        });
                      }
                      
                      const names = med.nombre.split(' ');
                      const firstName = names[0];
                      let firstLastName = '';
                      if (med.apellidos) {
                        firstLastName = med.apellidos.split(' ')[0];
                      } else if (names.length > 1) {
                        firstLastName = names[1];
                      }
                      
                      let predictedGender = med.genero;
                      if (!predictedGender) {
                        const lowFirst = firstName.toLowerCase();
                        predictedGender = (lowFirst.endsWith('a') && lowFirst !== 'andrea' && lowFirst !== 'luca' && lowFirst !== 'josua') ? 'F' : 'M';
                      }
                      if (firstName.toLowerCase() === 'andrea') predictedGender = 'F';

                      const prefix = predictedGender === 'F' ? 'Dra.' : 'Dr.';
                      const displayName = `${prefix} ${firstName} ${firstLastName}`.toUpperCase();

                      return (['m', 't', 'n'] as SlotType[]).map((slot, sIdx) => (
                        <tr key={`${med.id}-${slot}`} className={`group hover:bg-slate-50 transition-colors ${sIdx === 2 ? 'border-b-4 border-slate-200' : ''}`}>
                          {sIdx === 0 && (
                            <td rowSpan={3} className="sticky left-0 bg-white z-20 text-left px-2 md:px-4 border-r-2 border-sky-500 border-b border-slate-200 shadow-xl group-hover:bg-slate-50 max-w-[100px] md:max-w-none">
                              <div className="font-bold text-slate-800 text-[9px] md:text-xs truncate" title={displayName}>{displayName}</div>
                            </td>
                          )}
                          <td className="sticky left-[100px] md:left-[140px] z-20 slot-label bg-slate-50 text-slate-400 font-black text-[8px] py-2 border-r border-slate-200 uppercase shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                            {slot === 'm' ? 'Mañana' : slot === 't' ? 'Tarde' : 'Noche'}
                          </td>
                          {Array.from({ length: daysInMonth }, (_, i) => {
                            const d = i + 1;
                            const dow = new Date(selectedYear, selectedMonth, d).getDay();
                            const val = currentMonthData[med.id]?.[slot]?.[d] || 'X';
                            const isPT = val.toUpperCase() === 'PT';
                            const isShift = val.toUpperCase() !== 'X';
                            
                            const cellConflicts = conflicts.personal[`${med.id}-${d}-${slot}`] || [];
                            const hasConflict = cellConflicts.length > 0;
                            const isSelected = selectedCells.has(`${med.id}-${slot}-${d}`);
                            const isEditing = editingCell?.id === med.id && editingCell?.d === d && editingCell?.slot === slot;
                            
                            return (
                              <td 
                                key={d}
                                tabIndex={0}
                                data-ref={`${med.id}-${slot}-${d}`}
                                onDoubleClick={() => {
                                  if (!isAdminUser) return;
                                  setEditingCell({ id: med.id, d, slot, val: val === 'X' ? '' : val });
                                }}
                                onClick={(e) => {
                                  if (!isAdminUser) return;
                                  if (isEditing) return;
                                  const cellKey = `${med.id}-${slot}-${d}`;
                                  
                                  if (e.shiftKey && selectionStart) {
                                      e.preventDefault();
                                      const newSel = new Set<string>();
                                      const visibleDocs = doctors.filter(dd => 
                                        (selectedRoles.length === 0 || selectedRoles.includes(dd.rol || 'Médico General')) &&
                                        (selectedCategories.length === 0 || selectedCategories.includes(dd.cat)) &&
                                        (doctorFilter.length === 0 || doctorFilter.includes(dd.id)) && 
                                        (dd.st === 'activo')
                                      ).sort(sortDoctors);

                                      const rowsLayout: {docId: number, slot: SlotType}[] = [];
                                      visibleDocs.forEach(dd => {
                                        rowsLayout.push({docId: dd.id, slot: 'm'});
                                        rowsLayout.push({docId: dd.id, slot: 't'});
                                        rowsLayout.push({docId: dd.id, slot: 'n'});
                                      });
                                      
                                      const startIdx = rowsLayout.findIndex(r => r.docId === selectionStart.doctorId && r.slot === selectionStart.slot);
                                      const endIdx = rowsLayout.findIndex(r => r.docId === med.id && r.slot === slot);
                                      
                                      if (startIdx !== -1 && endIdx !== -1) {
                                          const minIdx = Math.min(startIdx, endIdx);
                                          const maxIdx = Math.max(startIdx, endIdx);
                                          const minDay = Math.min(selectionStart.day, d);
                                          const maxDay = Math.max(selectionStart.day, d);
                                          for (let i = minIdx; i <= maxIdx; i++) {
                                              for (let day = minDay; day <= maxDay; day++) {
                                                  newSel.add(`${rowsLayout[i].docId}-${rowsLayout[i].slot}-${day}`);
                                              }
                                          }
                                      }
                                      setSelectedCells(newSel);
                                  } else if (e.ctrlKey || e.metaKey) {
                                      e.preventDefault();
                                      const newSel = new Set(selectedCells);
                                      if (newSel.has(cellKey)) newSel.delete(cellKey);
                                      else newSel.add(cellKey);
                                      setSelectedCells(newSel);
                                      setSelectionStart({doctorId: med.id, day: d, slot});
                                  } else {
                                      if (selectedCells.size > 0) {
                                          setSelectedCells(new Set());
                                          setSelectionStart(null);
                                      } else {
                                          cycleShift(med.id, d, slot);
                                      }
                                  }
                                  
                                  const cell = document.querySelector(`[data-ref="${cellKey}"]`) as HTMLElement;
                                  if (cell) cell.focus();
                                }}
                                onKeyDown={(e) => {
                                  if (!isAdminUser || isEditing) return;
                                  // Backspace or Delete to clear
                                  if (e.key === 'Backspace' || e.key === 'Delete') {
                                    if (selectedCells.size > 0) {
                                      selectedCells.forEach(cellKey => {
                                        const [docId, s, day] = cellKey.split('-');
                                        setDocShift(parseInt(docId), parseInt(day), s as SlotType, 'X');
                                      });
                                    } else {
                                      setDocShift(med.id, d, slot, 'X');
                                    }
                                  } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                                    e.preventDefault();
                                    setEditingCell({ id: med.id, d, slot, val: e.key });
                                  }
                                }}
                                onPaste={(e) => {
                                  if (!isAdminUser) return;
                                  handleGridPaste(e, med.id, slot, d);
                                }}
                                title={cellConflicts.map(c => c.message).join('\n')}
                                className={`
                                  border border-slate-200 py-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500 focus:z-10
                                  transition-all duration-150 relative h-full min-h-[30px]
                                  ${dow === 0 ? 'border-r-2 border-r-sky-500' : ''}
                                  ${isSelected ? 'bg-sky-100 ring-2 ring-sky-500 ring-inset z-10' :
                                    hasConflict ? 'bg-rose-50 border-rose-200 text-rose-600' :
                                    isPT ? 'bg-stone-100 text-amber-600 font-black' :
                                    isShift ? 'bg-slate-50 text-slate-800' : 'bg-white hover:bg-slate-50 opacity-50 scale-90 text-slate-400'
                                  }
                                `}
                              >
                                {isEditing ? (
                                  <input 
                                    autoFocus
                                    className="w-full h-full min-h-[30px] max-w-[40px] text-center text-[10px] outline-none focus:ring-0 bg-yellow-50 z-50 text-slate-800"
                                    value={editingCell.val}
                                    onChange={e => setEditingCell({ ...editingCell, val: e.target.value })}
                                    onBlur={() => {
                                       setDocShift(med.id, d, slot, editingCell.val || 'X');
                                       setEditingCell(null);
                                    }}
                                    onKeyDown={e => {
                                       if (e.key === 'Enter') {
                                         setDocShift(med.id, d, slot, editingCell.val || 'X');
                                         setEditingCell(null);
                                         setTimeout(() => {
                                          const cell = document.querySelector(`[data-ref="${med.id}-${slot}-${d}"]`) as HTMLElement;
                                          if (cell) cell.focus();
                                         }, 50);
                                       }
                                       if (e.key === 'Escape') setEditingCell(null);
                                    }}
                                  />
                                ) : (
                                  <>
                                    <span className={`block w-full h-full min-h-[16px] text-[10px] tracking-tight flex items-center justify-center ${isPT || hasConflict || isShift ? 'font-black' : 'font-medium'} ${hasConflict ? 'text-rose-600' : ''}`}>
                                      {val !== 'X' ? (showGridHours ? `${val} (${getVarHours(slot, val)})` : val) : ''}
                                    </span>
                                  </>
                                )}
                              </td>
                            );
                          })}
                          {sIdx === 0 && (
                            <>
                              {weeklyAcc.map((wv, wi) => {
                                let colorClass = 'bg-emerald-100 text-emerald-800'; // Low
                                if (wv >= 42) colorClass = 'bg-emerald-500 text-white'; // OK
                                if (wv >= 66) colorClass = 'bg-rose-500 text-white shadow-inner'; // Over

                                return (
                                  <td key={wi} rowSpan={3} className={`border border-slate-200 font-black text-xs ${colorClass}`}>
                                    {wv}h
                                  </td>
                                );
                              })}
                              <td rowSpan={3} className="sticky right-0 z-20 bg-sky-500 text-white font-black text-xs border border-slate-200 shadow-[-2px_0_5px_rgba(0,0,0,0.1)]">
                                {medTotalMonth}h
                              </td>
                            </>
                          )}
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>
            </div>

              {/* Legends */}
              <div className="flex flex-wrap gap-4 text-[9px] text-[#7aa8c8] font-mono no-print">
                 <div className="flex items-center gap-1"><span className="w-2 h-2 bg-[#4ade80] rounded-full"></span> Baja Carga (&lt;42h)</div>
                 <div className="flex items-center gap-1"><span className="w-2 h-2 bg-[#16a34a] rounded-full"></span> Meta Ideal (42h-66h)</div>
                 <div className="flex items-center gap-1"><span className="w-2 h-2 bg-[#ff7d33] rounded-full"></span> Sobrecarga (&gt;66h)</div>
              </div>
              
              {/* Custom Legends Display */}
              {customLegends.length > 0 && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {customLegends.map((leg, idx) => (
                    <div key={idx} className="bg-slate-50 border border-slate-100 p-4 rounded-2xl print:border-none print:bg-white print:p-0">
                      <h4 className="font-black text-slate-800 text-xs uppercase mb-1">{leg.role}</h4>
                      <p className="font-mono text-[9px] text-slate-500 whitespace-pre-wrap">{leg.legend}</p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'pic' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-[40px] shadow-xl p-8 border border-amber-100"
            >
              <div className="mb-8 flex flex-col md:flex-row md:items-center gap-4">
                <div className="p-4 bg-amber-50 rounded-3xl text-amber-600 w-fit">
                   <Calendar className="w-8 h-8" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight">PIC - Programa Institucional de Capacitaciones</h2>
                  <p className="text-[10px] text-amber-600 font-bold uppercase tracking-widest tracking-tighter">Plan de Capacitación HDSAR - {MONTH_NAMES[selectedMonth]} {selectedYear}</p>
                </div>
                <div className="flex gap-2">
                   <button 
                     onClick={() => exportPICExcel()}
                     className="px-4 py-2 text-[10px] font-black bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 transition-colors uppercase border border-emerald-100 h-fit"
                   >
                     Excel
                   </button>
                   <button 
                     onClick={() => exportPICPDF()}
                     className="px-4 py-2 text-[10px] font-black bg-rose-50 text-rose-700 rounded-xl hover:bg-rose-100 transition-colors uppercase border border-rose-100 h-fit"
                   >
                     PDF
                   </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
                <div className="space-y-6">
                   <div className="bg-amber-50/30 p-6 rounded-[32px] border border-amber-100">
                      <h4 className="text-xs font-black text-amber-700 uppercase mb-4 tracking-widest">Información de la Actividad</h4>
                      <div className="space-y-4">
                         <div>
                            <label className="text-[10px] uppercase font-black text-slate-400 mb-1 ml-2 block">Nombre de la Actividad</label>
                            <input 
                              placeholder="Nombre de la capacitación" 
                              className="w-full bg-white border border-slate-100 p-4 rounded-xl font-bold"
                              value={newActivity.activityName || ''}
                              onChange={e => setNewActivity({...newActivity, activityName: e.target.value})}
                            />
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                            <div>
                               <label className="text-[10px] uppercase font-black text-slate-400 mb-1 ml-2 block">Día</label>
                               <input type="number" min={1} max={31} value={newActivity.day || ''} onChange={e => setNewActivity({...newActivity, day: Number(e.target.value)})} className="w-full bg-white border border-slate-100 p-4 rounded-xl font-bold" />
                            </div>
                            <div>
                               <label className="text-[10px] uppercase font-black text-slate-400 mb-1 ml-2 block">Horas</label>
                               <input type="number" value={newActivity.hours || ''} onChange={e => setNewActivity({...newActivity, hours: Number(e.target.value)})} className="w-full bg-white border border-slate-100 p-4 rounded-xl font-bold" />
                            </div>
                         </div>
                         <div>
                            <label className="text-[10px] uppercase font-black text-slate-400 mb-1 ml-2 block">Lugar / Ubicación</label>
                            <input placeholder="Ej: Auditorio HSE" className="w-full bg-white border border-slate-100 p-4 rounded-xl font-bold" value={newActivity.place || ''} onChange={e => setNewActivity({...newActivity, place: e.target.value})} />
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                            <div>
                               <label className="text-[10px] uppercase font-black text-slate-400 mb-1 ml-2 block">Modalidad</label>
                               <select value={newActivity.modality} onChange={e => setNewActivity({...newActivity, modality: e.target.value as any})} className="w-full bg-white border border-slate-100 p-4 rounded-xl font-bold">
                                 <option value="presencial">Presencial</option>
                                 <option value="virtual">Virtual</option>
                                 <option value="mixta">Mixta</option>
                               </select>
                            </div>
                            <div>
                               <label className="text-[10px] uppercase font-black text-slate-400 mb-1 ml-2 block">Dirigida a</label>
                               <input placeholder="Personal" className="w-full bg-white border border-slate-100 p-4 rounded-xl font-bold" value={newActivity.targetGroup || ''} onChange={e => setNewActivity({...newActivity, targetGroup: e.target.value})} />
                            </div>
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                            <div>
                               <label className="text-[10px] uppercase font-black text-slate-400 mb-1 ml-2 block">Responsable</label>
                               <input placeholder="Nombre" className="w-full bg-white border border-slate-100 p-4 rounded-xl font-bold" value={newActivity.responsible || ''} onChange={e => setNewActivity({...newActivity, responsible: e.target.value})} />
                            </div>
                            <div>
                               <label className="text-[10px] uppercase font-black text-slate-400 mb-1 ml-2 block">Población Objetivo</label>
                               <input placeholder="Ej: Médicos" className="w-full bg-white border border-slate-100 p-4 rounded-xl font-bold" value={newActivity.targetPopulation || ''} onChange={e => setNewActivity({...newActivity, targetPopulation: e.target.value})} />
                            </div>
                         </div>
                      </div>
                   </div>

                   <button 
                     onClick={addActivity}
                     className="w-full bg-amber-600 text-white font-black py-5 rounded-[24px] hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-amber-600/20 uppercase tracking-widest text-sm"
                   >
                     CONFIRMAR Y GUARDAR ACTIVIDAD
                   </button>
                </div>

                <div className="space-y-6">
                   <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-200 h-full flex flex-col">
                      <h4 className="text-xs font-black text-slate-400 uppercase mb-4 tracking-widest">Documentación y Soportes</h4>
                      <div className="space-y-3 flex-1 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                         {[
                           { key: 'preTest', label: 'Base de datos / Pre-test', icon: Database },
                           { key: 'training', label: 'Capacitación (Lectura)', icon: BrainCircuit },
                           { key: 'attendance', label: 'Asistencia Digital Firmada', icon: ClipboardList },
                           { key: 'postTest', label: 'Post-test / Evaluación', icon: FileText }
                         ].map((item) => (
                           <div key={item.key} className="bg-white p-4 rounded-[20px] border border-slate-100 group shadow-sm">
                              <p className="text-[9px] uppercase font-black text-slate-400 mb-2">{item.label}</p>
                              <div className="flex items-center gap-3">
                                <label className="flex-1 flex items-center justify-between px-4 py-3 bg-stone-50 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-amber-50 hover:border-amber-500 transition-all">
                                   <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                                      <item.icon className="w-4 h-4 text-slate-400" />
                                      <span className="truncate max-w-[150px]">
                                        {newActivity.files?.[item.key as keyof typeof newActivity.files] || 'Subir Archivo'}
                                      </span>
                                   </div>
                                   <Plus className="w-4 h-4 text-slate-300 group-hover:text-amber-600 transition-colors" />
                                   <input type="file" className="hidden" onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                         setNewActivity(prev => ({
                                           ...prev,
                                           files: { ...prev.files, [item.key]: file.name }
                                         }));
                                      }
                                   }} />
                                </label>
                              </div>
                           </div>
                         ))}
                      </div>
                   </div>
                </div>
              </div>

              <div className="space-y-4">
                 <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Cronograma del Mes</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {activities.filter(a => a.month === selectedMonth && a.year === selectedYear).length === 0 ? (
                      <div className="col-span-full py-12 text-center bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200">
                        <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">No hay actividades programadas para este mes</p>
                      </div>
                    ) : (
                      activities.filter(a => a.month === selectedMonth && a.year === selectedYear).map(a => (
                        <div key={a.id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm relative group overflow-hidden">
                           <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={async () => {
                                   if(confirm('¿Deseas eliminar esta actividad?')) {
                                      try {
                                         await deleteDoc(doc(db, 'activities', a.id));
                                      } catch (e) {
                                         handleFirestoreError(e, 'delete' as any, 'activities');
                                      }
                                   }
                                }}
                                className="p-2 text-rose-500 hover:bg-rose-50 rounded-full transition-colors"
                              >
                                 <Trash2 className="w-4 h-4" />
                              </button>
                           </div>
                           <div className="flex items-center gap-3 mb-4">
                              <div className="w-10 h-10 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 font-black text-sm">
                                 {a.day}
                              </div>
                              <div className="flex-1">
                                 <h5 className="font-black text-slate-800 uppercase text-xs truncate">{a.activityName}</h5>
                                 <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase">
                                    <Clock className="w-3 h-3" /> {a.hours}h • {a.modality}
                                 </div>
                              </div>
                           </div>
                           <div className="space-y-2">
                              <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl">
                                 <span className="text-[9px] uppercase font-black text-slate-400">Progreso</span>
                                 <span className="text-[9px] uppercase font-black text-emerald-600">
                                   {Object.values(a.files || {}).filter(Boolean).length}/4 Soportes
                                 </span>
                              </div>
                              <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                                 <div 
                                   className="h-full bg-emerald-500 transition-all" 
                                   style={{ width: `${(Object.values(a.files || {}).filter(Boolean).length / 4) * 100}%` }}
                                 />
                              </div>
                           </div>
                        </div>
                      ))
                    )}
                 </div>
              </div>
            </motion.div>
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
            <motion.div 
              key="solicitudes"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-4xl mx-auto space-y-6"
            >
              {session.r === 'doctor' && (
                <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-xl">
                  <h3 className="text-xl font-bold text-sky-600 mb-6 flex items-center gap-2">
                    <Plus className="w-6 h-6" /> Nueva Solicitud de Cambio
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase ml-2 mb-1 block font-bold">Día del Cambio</label>
                      <select 
                        className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none text-slate-800"
                        value={reqDay}
                        onChange={(e) => setReqDay(parseInt(e.target.value))}
                      >
                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
                          <option key={d} value={d}>Día {d}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase ml-2 mb-1 block font-bold">Jornada</label>
                      <select 
                        className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none text-slate-800"
                        value={reqSlot}
                        onChange={(e) => setReqSlot(e.target.value as SlotType)}
                      >
                        <option value="m">Mañana</option>
                        <option value="t">Tarde</option>
                        <option value="n">Noche</option>
                      </select>
                    </div>
                    <div className="sm:col-span-3">
                      <label className="text-[10px] text-slate-400 uppercase ml-2 mb-1 block font-bold">Motivo / Detalle del cambio</label>
                      <textarea 
                        className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:border-sky-500 min-h-[100px] text-slate-800"
                        placeholder="Describa el cambio solicitado..."
                        value={reqReason}
                        onChange={(e) => setReqReason(e.target.value)}
                      />
                    </div>
                  </div>
                  <button 
                    onClick={submitShiftRequest}
                    className="w-full mt-4 bg-sky-500 text-white font-black h-16 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-lg shadow-sky-500/20"
                  >
                    <Send className="w-6 h-6" /> ENVIAR SOLICITUD A COORDINACIÓN
                  </button>
                </div>
              )}

              <div className="bg-white rounded-[32px] p-8 border border-emerald-100 shadow-xl">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-xl font-bold text-emerald-700 flex items-center gap-2">
                    <Clock className="w-6 h-6 text-emerald-600" /> Historial de Solicitudes
                  </h3>
                  {session.r === 'admin' && (
                    <button 
                      onClick={exportShiftRequests}
                      className="bg-emerald-50 hover:bg-emerald-100 text-emerald-600 px-4 py-2 rounded-xl text-xs font-bold border border-emerald-200 flex items-center gap-2 shadow-sm transition-all"
                    >
                      <Save className="w-4 h-4" /> EXPORTAR TXT
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  {shiftRequests.filter(r => (session.r === 'doctor' ? r.doctorId === session.doctorId : true) && r.targetMonth === selectedMonth && r.targetYear === selectedYear).length === 0 ? (
                    <p className="text-center py-20 text-slate-300 uppercase font-black text-sm tracking-widest italic">No hay solicitudes registradas</p>
                  ) : (
                    shiftRequests
                      .filter(r => (session.r === 'doctor' ? r.doctorId === session.doctorId : true) && r.targetMonth === selectedMonth && r.targetYear === selectedYear)
                      .map(req => (
                      <div key={req.id} className="bg-stone-50 p-6 rounded-2xl border border-emerald-100 flex flex-wrap items-center justify-between gap-4 shadow-sm hover:border-emerald-500/30 transition-colors">
                        <div className="flex-1 min-w-[200px]">
                          <div className="flex items-center gap-2 mb-1">
                            {session.r === 'admin' && <span className="text-emerald-600 font-bold">Dr. {req.doctorName} - </span>}
                            <span className="text-slate-800 font-bold uppercase">Día {req.day} ({req.slot.toUpperCase()})</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${
                              req.status === 'pending' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                              req.status === 'approved' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                              'bg-rose-100 text-rose-700 border border-rose-200'
                            }`}>
                              {req.status === 'pending' ? 'Pendiente' : req.status === 'approved' ? 'Aprobado' : 'Rechazado'}
                            </span>
                          </div>
                          <p className="text-slate-500 text-sm italic">"{req.reason}"</p>
                          <div className="text-[10px] text-slate-400 mt-2">{new Date(req.timestamp).toLocaleString()}</div>
                        </div>

                        {session.r === 'admin' && req.status === 'pending' && (
                          <div className="flex gap-2">
                             <button 
                              onClick={() => updateRequestStatus(req.id, 'approved')}
                              className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white p-3 rounded-xl border border-emerald-500/30 transition-all"
                             >
                                <CheckCircle className="w-5 h-5" />
                             </button>
                             <button 
                              onClick={() => updateRequestStatus(req.id, 'rejected')}
                              className="bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white p-3 rounded-xl border border-rose-500/30 transition-all"
                             >
                                <XCircle className="w-5 h-5" />
                             </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'rural' && (
            <motion.div 
               key="rural" 
               initial={{ opacity: 0, y: 10 }} 
               animate={{ opacity: 1, y: 0 }}
               className="max-w-6xl mx-auto space-y-6 pb-20"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm">
                <div>
                  <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                    <MapPin className="w-8 h-8 text-rose-500" />
                    Disponibilidades Médicos Rurales
                  </h2>
                  <p className="text-xs text-slate-500 font-mono">Reporte de traslados, remisiones y actividades de personal rural</p>
                </div>
                {isAdminUser && (
                  <button 
                    onClick={() => {
                        const filtered = ruralAvailabilities.filter(r => r.targetMonth === selectedMonth && r.targetYear === selectedYear);
                        if(filtered.length === 0) return alert("No hay datos para exportar.");
                        
                        let csv = "\uFEFF"; // BOM for Excel
                        csv += "ID,Médico,Fecha Llamado,Hora Llamado,Llegada Hospital,Actividad,Paciente,ID Paciente,Diagnostico,Lugar Aceptacion,Llamado Por,Fecha Termino,Hora Termino,Total Horas\n";
                        filtered.forEach(r => {
                          const start = new Date(r.callDateTime);
                          const end = new Date(r.terminationDateTime);
                          csv += `${r.id},"${r.doctorName}",${start.toLocaleDateString()},${start.toLocaleTimeString()},"${r.hospitalArrivalTime}","${r.activity.replace(/"/g, '""')}","${r.patientName}","${r.patientId}","${r.diagnosis}","${r.acceptancePlace}","${r.calledBy}",${end.toLocaleDateString()},${end.toLocaleTimeString()},${r.totalHours}\n`;
                        });
                        
                        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `Reporte_Disponibilidades_${selectedMonth + 1}_${selectedYear}.csv`;
                        link.click();
                    }}
                    className="bg-emerald-500 text-white px-6 py-3 rounded-xl font-black flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-emerald-500/20"
                  >
                    <FileSpreadsheet className="w-5 h-5" />
                    EXPORTAR EXCEL (CSV)
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form Section */}
                <div className="lg:col-span-2 space-y-6">
                   <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-xl">
                      <h3 className="text-lg font-bold text-sky-600 mb-6 flex items-center gap-2">
                        <Plus className="w-5 h-5" /> Nuevo Reporte de Disponibilidad
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                           <div>
                              <label className="text-[10px] text-slate-400 uppercase font-black ml-2 mb-1 block">Fecha y Hora del Llamado *</label>
                              <div className="flex gap-2">
                                <input type="date" className="flex-1 bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-800 outline-none" value={ruralCallDate} onChange={e => setRuralCallDate(e.target.value)} />
                                <input type="time" className="w-32 bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-800 outline-none" value={ruralCallTime} onChange={e => setRuralCallTime(e.target.value)} />
                              </div>
                           </div>
                           <div>
                              <label className="text-[10px] text-slate-400 uppercase font-black ml-2 mb-1 block">Hora de Llegada al Hospital</label>
                              <input type="time" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-800 outline-none focus:border-emerald-500" value={ruralHospitalArrival} onChange={e => setRuralHospitalArrival(e.target.value)} />
                           </div>
                           <div>
                              <label className="text-[10px] text-slate-400 uppercase font-black ml-2 mb-1 block">Nombre del Paciente *</label>
                              <input type="text" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-800 outline-none focus:border-emerald-500" value={ruralPatientName} onChange={e => setRuralPatientName(e.target.value)} />
                           </div>
                           <div>
                              <label className="text-[10px] text-slate-400 uppercase font-black ml-2 mb-1 block">ID / Cédula del Paciente</label>
                              <input type="text" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-800 outline-none focus:border-emerald-500" value={ruralPatientId} onChange={e => setRuralPatientId(e.target.value)} />
                           </div>
                        </div>

                        <div className="space-y-4">
                           <div>
                              <label className="text-[10px] text-slate-400 uppercase font-black ml-2 mb-1 block">Diagnóstico</label>
                              <input type="text" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-800 outline-none focus:border-emerald-500" value={ruralDiagnosis} onChange={e => setRuralDiagnosis(e.target.value)} />
                           </div>
                           <div>
                              <label className="text-[10px] text-slate-400 uppercase font-black ml-2 mb-1 block">Lugar de Aceptación / Remisión</label>
                              <input type="text" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-800 outline-none focus:border-emerald-500" value={ruralAcceptancePlace} onChange={e => setRuralAcceptancePlace(e.target.value)} />
                           </div>
                           <div>
                              <label className="text-[10px] text-slate-400 uppercase font-black ml-2 mb-1 block">¿Quién lo llamó?</label>
                              <input type="text" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-800 outline-none focus:border-emerald-500" value={ruralCalledBy} onChange={e => setRuralCalledBy(e.target.value)} />
                           </div>
                           <div>
                              <label className="text-[10px] text-slate-400 uppercase font-black ml-2 mb-1 block">Fecha y Hora de Término *</label>
                              <div className="flex gap-2">
                                <input type="date" className="flex-1 bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-800 outline-none focus:border-emerald-500" value={ruralEndDate} onChange={e => setRuralEndDate(e.target.value)} />
                                <input type="time" className="w-32 bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-800 outline-none focus:border-emerald-500" value={ruralEndTime} onChange={e => setRuralEndTime(e.target.value)} />
                              </div>
                           </div>
                        </div>
                        
                        <div className="md:col-span-2">
                           <label className="text-[10px] text-slate-400 uppercase font-black ml-2 mb-1 block font-bold">Tipo de Actividad *</label>
                           <select 
                             className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-slate-800 outline-none mb-4 focus:border-emerald-500"
                             value={ruralActivityType}
                             onChange={e => setRuralActivityType(e.target.value)}
                           >
                              {ruralActivityOptions.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                           </select>

                           <label className="text-[10px] text-slate-400 uppercase font-black ml-2 mb-1 block font-bold">Actividad (Texto Libre)</label>
                           <textarea className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-slate-800 outline-none min-h-[100px] focus:border-emerald-500" value={ruralActivity} onChange={e => setRuralActivity(e.target.value)} placeholder="Describa detalles adicionales de la actividad realizada..." />
                        </div>
                      </div>

                      <button 
                        onClick={submitRuralAvailability}
                        className="w-full mt-8 bg-emerald-600 text-white font-black h-16 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/20"
                      >
                        <Send className="w-6 h-6" /> GUARDAR REPORTE DE DISPONIBILIDAD
                      </button>
                   </div>

                   {/* History List */}
                   <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-xl">
                      <h3 className="text-lg font-bold text-emerald-600 mb-6 flex items-center gap-2">
                        <Clock className="w-5 h-5" /> Mi Historial de Disponibilidades
                      </h3>
                      <div className="space-y-4">
                        {ruralAvailabilities
                          .filter(r => (isAdminUser ? true : r.doctorId === session.doctorId))
                          .sort((a,b) => b.callDateTime - a.callDateTime)
                          .map(r => (
                          <div key={r.id} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex flex-wrap justify-between items-center gap-4 group hover:border-emerald-500/40 transition-all">
                             <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-bold text-slate-800 uppercase text-sm"> paciente: {r.patientName}</span>
                                  <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-black border border-emerald-200">{r.totalHours} HORAS</span>
                                </div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-3">
                                   <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(r.callDateTime).toLocaleDateString()}</span>
                                   <span className="flex items-center gap-1"><Info className="w-3 h-3" /> {r.acceptancePlace || 'Sin destino'}</span>
                                </div>
                                <p className="text-[11px] text-slate-400 mt-2 line-clamp-1 italic">"{r.activity}"</p>
                                {isAdminUser && <div className="text-[9px] text-slate-400 mt-1">Médico: {r.doctorName}</div>}
                             </div>
                             {isAdminUser && (
                               <button 
                                onClick={async () => {
                                  if(confirm("¿Eliminar este registro?")) {
                                    await deleteDoc(doc(db, 'ruralAvailability', r.id));
                                  }
                                }}
                                className="p-3 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                               >
                                 <Trash2 className="w-5 h-5" />
                               </button>
                             )}
                          </div>
                        ))}
                      </div>
                   </div>
                </div>

                {/* Dashboard / Stats Section */}
                <div className="space-y-6">
                   <div className="bg-white p-8 rounded-[32px] border border-emerald-100 shadow-xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-8 opacity-5">
                         <BrainIcon className="w-32 h-32 text-emerald-600" />
                      </div>
                      <div className="space-y-6 relative z-10">
                        <div>
                           <p className="text-[10px] text-emerald-600 uppercase font-black mb-2 flex justify-between">Horas Totales (Mes) <Clock className="w-3 h-3" /></p>
                           <div className="text-4xl font-black text-slate-800">
                              {ruralAvailabilities
                                .filter(r => r.targetMonth === selectedMonth && r.targetYear === selectedYear)
                                .reduce((acc, curr) => acc + curr.totalHours, 0).toFixed(1)}h
                           </div>
                        </div>

                        <div className="pt-6 border-t border-slate-100">
                           <p className="text-[10px] text-emerald-600 uppercase font-black mb-4">Top Lugares de Aceptación</p>
                           <div className="space-y-2">
                              {Object.entries(
                                ruralAvailabilities
                                  .filter(r => r.targetMonth === selectedMonth && r.targetYear === selectedYear)
                                  .reduce((acc, curr) => {
                                    if(!curr.acceptancePlace) return acc;
                                    acc[curr.acceptancePlace] = (acc[curr.acceptancePlace] || 0) + 1;
                                    return acc;
                                  } , {} as Record<string, number>)
                              ).sort((a,b) => b[1] - a[1]).slice(0, 3).map(([place, count]) => (
                                <div key={place} className="flex justify-between items-center text-xs bg-slate-50 p-2 rounded-lg border border-slate-100">
                                   <span className="text-slate-700">{place}</span>
                                   <span className="bg-emerald-500 text-white font-black px-2 py-0.5 rounded shadow-sm">{count}</span>
                                </div>
                              ))}
                           </div>
                        </div>

                        <div className="pt-6 border-t border-slate-100">
                           <p className="text-[10px] text-emerald-600 uppercase font-black mb-4">Top Diagnósticos</p>
                           <div className="space-y-2">
                              {Object.entries(
                                ruralAvailabilities
                                  .filter(r => r.targetMonth === selectedMonth && r.targetYear === selectedYear)
                                  .reduce((acc, curr) => {
                                    if(!curr.diagnosis) return acc;
                                    acc[curr.diagnosis] = (acc[curr.diagnosis] || 0) + 1;
                                    return acc;
                                  } , {} as Record<string, number>)
                              ).sort((a,b) => b[1] - a[1]).slice(0, 3).map(([diag, count]) => (
                                <div key={diag} className="flex justify-between items-center text-xs bg-slate-50 p-2 rounded-lg border border-slate-100">
                                   <span className="text-slate-700 line-clamp-1">{diag}</span>
                                   <span className="bg-rose-500 text-white font-black px-2 py-0.5 rounded shadow-sm">{count}</span>
                                </div>
                              ))}
                           </div>
                        </div>
                      </div>
                   </div>

                   <div className="bg-white p-6 rounded-3xl border border-emerald-100 shadow-sm">
                      <h4 className="text-xs font-black text-emerald-600 uppercase mb-4">Información de Períodos</h4>
                      <p className="text-[10px] text-slate-400 leading-relaxed italic">
                        Los reportes se consolidan mensualmente. Como administrador, puede filtrar por mes arriba para ver estadísticas de períodos anteriores. Para reportes trimestrales o semestrales, el sistema analiza el acumulado del año actual.
                      </p>
                      
                      {isAdminUser && (
                        <div className="mt-6 space-y-2">
                           <button 
                            onClick={() => {
                                const qStartMonth = Math.floor(selectedMonth / 3) * 3;
                                const filtered = ruralAvailabilities.filter(r => r.targetMonth >= qStartMonth && r.targetMonth <= qStartMonth + 2 && r.targetYear === selectedYear);
                                alert(`Horas totales en el Trimestre: ${filtered.reduce((a,c) => a + c.totalHours, 0).toFixed(1)}h`);
                            }}
                            className="w-full bg-slate-50 border border-slate-200 text-emerald-600 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-50 transition-colors"
                           >
                             Cálculo Trimestral Actual
                           </button>
                           <button 
                            onClick={() => {
                                const sStartMonth = Math.floor(selectedMonth / 6) * 6;
                                const filtered = ruralAvailabilities.filter(r => r.targetMonth >= sStartMonth && r.targetMonth <= sStartMonth + 5 && r.targetYear === selectedYear);
                                alert(`Horas totales en el Semestre: ${filtered.reduce((a,c) => a + c.totalHours, 0).toFixed(1)}h`);
                            }}
                            className="w-full bg-slate-50 border border-slate-200 text-emerald-600 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-50 transition-colors"
                           >
                               Cálculo Semestral Actual
                           </button>
                        </div>
                      )}
                    </div>
                 </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'novedades' && (
            <motion.div 
              key="novedades"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-4xl mx-auto space-y-6"
            >
              <div className="flex justify-between items-center bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm">
                <div>
                  <h2 className="text-2xl font-black text-slate-800">Novedades de {MONTH_NAMES[selectedMonth]} {selectedYear}</h2>
                  <p className="text-xs text-slate-500 font-mono">Registro oficial de cambios en el turnero</p>
                </div>
                <div className="flex gap-3 no-print">
                   <button 
                     onClick={exportNovedadesExcel}
                     className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl border border-emerald-200 font-bold text-[10px] uppercase flex items-center gap-2 hover:bg-emerald-100 transition-all"
                   >
                     <FileSpreadsheet className="w-4 h-4" /> Excel
                   </button>
                   <button 
                     onClick={exportNovedadesPDF}
                     className="bg-rose-50 text-rose-700 px-4 py-2 rounded-xl border border-rose-200 font-bold text-[10px] uppercase flex items-center gap-2 hover:bg-rose-100 transition-all"
                   >
                     <Printer className="w-4 h-4" /> PDF
                   </button>
                   <button 
                    onClick={generateAIStatsReport}
                    className="bg-violet-600 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 hover:bg-violet-700 shadow-lg shadow-violet-500/20 animate-pulse"
                   >
                     <Sparkles className="w-4 h-4" /> Análisis IA
                   </button>
                </div>
              </div>

              {isGeneratingAI && (
                <div className="bg-white p-12 rounded-[32px] border border-violet-100 text-center space-y-4">
                  <div className="flex justify-center">
                    <Sparkles className="w-12 h-12 text-violet-500 animate-spin" />
                  </div>
                  <p className="text-violet-600 font-black animate-pulse uppercase tracking-widest text-xs">Analizando indicadores con IA...</p>
                </div>
              )}

              {aiReport && !isGeneratingAI && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-slate-900 border-l-4 border-violet-500 p-8 rounded-3xl text-white shadow-2xl relative overflow-hidden"
                >
                   <div className="absolute top-0 right-0 p-8 opacity-10">
                      <Sparkles className="w-32 h-32" />
                   </div>
                   <div className="flex justify-between items-start mb-6 border-b border-white/10 pb-4">
                      <h3 className="text-xl font-bold flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-violet-400" /> Dashboard Estadístico IA
                      </h3>
                      <button 
                        onClick={() => setAiReport(null)}
                        className="text-white/40 hover:text-white transition-colors"
                      >
                         <XCircle className="w-5 h-5" />
                      </button>
                   </div>
                   <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-li:my-1">
                      <Markdown>{aiReport}</Markdown>
                   </div>
                   <div className="mt-8 pt-4 border-t border-white/10 flex justify-between items-center">
                      <p className="text-[9px] text-white/40 uppercase font-mono italic">Generado el {new Date().toLocaleString()}</p>
                      <button 
                        onClick={() => {
                          const win = window.open('', '_blank');
                          win?.document.write(`<html><head><title>Informe Estadístico IA</title><style>body{font-family:sans-serif;padding:40px;line-height:1.6;color:#333}h2{color:#7c3aed}pre{white-space:pre-wrap;background:#f4f4f4;padding:20px;border-radius:10px}</style></head><body><h2>Informe Estadístico Gerencial - IA</h2><div style="font-size:14px">${aiReport.replace(/\n/g, '<br>')}</div></body></html>`);
                        }}
                        className="text-[10px] font-black underline underline-offset-4 hover:text-violet-400"
                      >
                        ABRIR PARA IMPRIMIR
                      </button>
                   </div>
                </motion.div>
              )}

              <div className="space-y-3">
                {auditLogs.filter(log => log.targetMonth === selectedMonth && log.targetYear === selectedYear).length === 0 ? (
                  <div className="bg-stone-100/50 border border-emerald-100 p-12 rounded-3xl text-center">
                    <Info className="w-12 h-12 text-emerald-200 mx-auto mb-4" />
                    <p className="text-slate-400 uppercase font-black tracking-widest text-xs italic">No hay movimientos registrados para este mes</p>
                  </div>
                ) : (
                  auditLogs
                    .filter(log => log.targetMonth === selectedMonth && log.targetYear === selectedYear)
                    .map(log => (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      key={log.id} 
                      className="bg-white border border-slate-200 p-5 rounded-2xl flex flex-wrap gap-4 items-center justify-between group hover:border-emerald-500/40 transition-colors shadow-sm"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 font-black border border-emerald-100">
                           {log.doctorName.charAt(0)}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-800">Dr. {log.doctorName}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-2">
                             <Calendar className="w-3 h-3" /> Día {log.day} | Jornada: {log.slot.toUpperCase()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 bg-stone-50 px-3 py-2 rounded-xl border border-slate-100">
                        <span className="text-xs text-rose-400 line-through opacity-50 px-2">{log.oldSigla}</span>
                        <ChevronRight className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-md">{log.newSigla}</span>
                      </div>

                      <div className="flex items-center gap-3">
                         {session.r === 'admin' && (
                           <>
                             {log.doctorContact && !log.doctorContact.includes('@') && (
                               <button 
                                 onClick={() => {
                                   const cleanPhone = log.doctorContact.replace(/\D/g, '');
                                   if (cleanPhone.length >= 10) {
                                     const text = encodeURIComponent(`Hola Dr. ${log.doctorName},\nSe ha registrado un cambio en su turnero para el día ${log.day} (Jornada: ${log.slot.toUpperCase()}).\nEl turno ha cambiado de [${log.oldSigla}] a [${log.newSigla}].\n\nPor favor revise el sistema HDSAR.`);
                                     window.open(`https://wa.me/57${cleanPhone}?text=${text}`, '_blank');
                                   } else {
                                     alert("Número telefónico inválido para WhatsApp.");
                                   }
                                 }}
                                 className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all group/note"
                                 title="Notificar cambio por WhatsApp"
                               >
                                 <Phone className="w-4 h-4 group-hover/note:scale-110 transition-transform" />
                               </button>
                             )}
                             <button 
                               onClick={() => pushNotification(log.doctorId, `🔔 NOVEDAD INDIVIDUAL: Día ${log.day} (${log.slot.toUpperCase()}) cambio a ${log.newSigla}. Por favor verifique.`)}
                               className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all group/note"
                               title="Notificar inmediatamente a este médico mediante PUSH del sistema"
                             >
                               <Send className="w-4 h-4 group-hover/note:translate-x-1 transition-transform" />
                             </button>
                           </>
                         )}
                         <div className="text-right">
                           <div className="text-[10px] text-slate-400">{new Date(log.timestamp).toLocaleString()}</div>
                           <div className="text-[9px] uppercase font-bold text-emerald-700/60 transition-colors">Por: {log.adminName}</div>
                         </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'census' && (
            <motion.div
              key="census"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="h-full"
            >
              <CensusView 
                currentUser={currentUserProfile} 
                isAdmin={session?.r === 'admin'} 
                isAuthenticated={!!fbUser}
              />
            </motion.div>
          )}

          {activeTab === 'committee' && (
            <motion.div
              key="committee"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="h-full"
            >
              <CommitteeView />
            </motion.div>
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
                onReorderDoctors={handleReorderDoctors}
                onDeleteDoctor={deleteDoctor}
                onUpdateDoctorStatus={async (id, st) => {
                  if(!confirm(`¿Desea cambiar el estado a ${st.toUpperCase()}?`)) return;
                  try {
                    await updateDoc(doc(db, 'doctors', id.toString()), { st });
                  } catch (e) {
                    handleFirestoreError(e, OperationType.WRITE, `doctors/${id}`);
                  }
                }}
                onEditDoctor={(docData) => {
                  setEditingDoc(docData);
                }}
                onResetPassword={resetDoctorPass}
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
                onAssignFreeDays={assignFreeDaysToPlanta}
                onImportDoctors={handleBatchImportDoctors}
              />

              {/* Variable Management moved from Admin */}
              <div className="mt-8 bg-white rounded-[32px] p-8 border border-emerald-100 shadow-xl">
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <h3 className="text-xl font-bold text-emerald-700 flex items-center gap-2">
                       <Settings className="w-6 h-6" /> Gestión de Siglas Horarias (Turnos)
                    </h3>
                    <div className="flex items-center gap-2">
                       <label className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl cursor-pointer hover:bg-emerald-100 transition-all font-black text-xs uppercase tracking-widest border border-emerald-200">
                         <Upload className="w-4 h-4" /> Importar Excel
                         <input type="file" className="hidden" accept=".xlsx,.xls" onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setNotification({ message: "Actualizando configuración de siglas...", type: 'info' });
                            const reader = new FileReader();
                            reader.onload = async (evt) => {
                              try {
                                const bstr = evt.target?.result;
                                const wb = XLSX.read(bstr, { type: 'binary' });
                                const newVars = { m: { ...variables.m }, t: { ...variables.t }, n: { ...variables.n } };
                                
                                let updatedCount = 0;
                                for (let sIdx = 0; sIdx < wb.SheetNames.length; sIdx++) {
                                  const sName = wb.SheetNames[sIdx].toLowerCase();
                                  const sheet = wb.Sheets[wb.SheetNames[sIdx]];
                                  const sData = XLSX.utils.sheet_to_json(sheet, { defval: "" });

                                  let defaultSlot: SlotType | null = null;
                                  if (sName.includes('mañana') || sName.includes('manana') || sName.includes('mañ')) defaultSlot = 'm';
                                  if (sName.includes('tarde') || sName.includes('tar')) defaultSlot = 't';
                                  if (sName.includes('noche') || sName.includes('noc')) defaultSlot = 'n';

                                  for (const row of sData as any) {
                                    const sigla = String(row.Sigla || row.sigla || '').trim();
                                    if (!sigla) continue;

                                    const jornadaRaw = String(row.Jornada_m_t_n || row.jornada || row.Jornada || '').toLowerCase();
                                    let jornada: SlotType;
                                    if (jornadaRaw.includes('m') || jornadaRaw === 'm') jornada = 'm';
                                    else if (jornadaRaw.includes('t') || jornadaRaw === 't') jornada = 't';
                                    else if (jornadaRaw.includes('n') || jornadaRaw === 'n') jornada = 'n';
                                    else if (defaultSlot) jornada = defaultSlot;
                                    else jornada = 'm';

                                    const horas = Number(row.Horas_Carga || row.horas || row.horas_carga || 6);
                                    newVars[jornada][sigla] = horas;
                                    updatedCount++;
                                  }
                                }
                                await setDoc(doc(db, 'settings', 'variables'), newVars);
                                setNotification({ message: `Configuración de siglas actualizada (${updatedCount} procesadas)`, type: 'success' });
                              } catch (err) {
                                console.error(err);
                                setNotification({ message: "Error al leer el archivo", type: 'error' });
                              }
                            };
                            reader.readAsBinaryString(file);
                         }} />
                       </label>
                    </div>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 bg-emerald-50 rounded-2xl mb-8 border border-emerald-100">
                    <input 
                      className="bg-white border border-emerald-100 p-4 rounded-xl outline-none focus:border-emerald-500 font-bold" 
                      placeholder="Sigla (Eje: N, M, T)"
                      value={newVarCode}
                      onChange={(e) => setNewVarCode(e.target.value)}
                    />
                    <input 
                      type="number" 
                      step="0.1"
                      min="0"
                      className="bg-white border border-emerald-100 p-4 rounded-xl outline-none focus:border-emerald-500 font-bold" 
                      placeholder="Horas" 
                      value={newVarHour}
                      onChange={(e) => setNewVarHour(e.target.value)}
                    />
                    <select 
                      className="bg-white border border-emerald-100 p-4 rounded-xl outline-none font-bold"
                      value={newVarSlot}
                      onChange={(e) => setNewVarSlot(e.target.value as SlotType)}
                    >
                      <option value="m">Mañana</option>
                      <option value="t">Tarde</option>
                      <option value="n">Noche</option>
                    </select>
                    <button 
                      onClick={addVariable}
                      className="bg-emerald-600 text-white font-black rounded-xl hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-emerald-500/20"
                    >
                      {editingVar ? 'ACTUALIZAR' : 'GUARDAR SIGLA'}
                    </button>
                    {editingVar && (
                      <button onClick={() => {setEditingVar(null); setNewVarCode(''); setNewVarHour('');}} className="text-[10px] text-rose-500 mt-1 font-bold underline text-center">Cancelar</button>
                    )}
                 </div>
                 
                 <div className="space-y-6">
                    {(['m', 't', 'n'] as SlotType[]).map(slot => (
                      <div key={slot} className="border-t border-emerald-50 pt-4">
                        <p className="text-[10px] text-emerald-600 uppercase font-bold mb-3">{slot === 'm' ? 'Jornada Mañana' : slot === 't' ? 'Jornada Tarde' : 'Jornada Noche'}</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(variables[slot])
                            .sort(([k1], [k2]) => {
                              const isK1Num = /^\d/.test(k1);
                              const isK2Num = /^\d/.test(k2);
                              if (isK1Num && !isK2Num) return -1;
                              if (!isK1Num && isK2Num) return 1;
                              return k1.localeCompare(k2, undefined, { numeric: true });
                            })
                            .map(([k, v]) => (
                            <div key={k} className="group relative bg-stone-50 pl-3 pr-8 py-2 rounded-lg border border-emerald-100 text-[10px] flex gap-2 hover:border-emerald-500 transition-all cursor-pointer shadow-sm" onClick={() => {
                              setEditingVar({slot, code: k});
                              setNewVarCode(k);
                              setNewVarHour(v.toString());
                              setNewVarSlot(slot);
                            }}>
                              <span className="font-black text-emerald-600">{k}</span>
                              <span className="text-slate-400">{v}h</span>
                              <button 
                                onClick={(e) => { e.stopPropagation(); removeVariable(slot, k); }}
                                className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 text-rose-400 hover:text-rose-600 transition-all rounded"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                 </div>
              </div>

              {/* Paneles de Leyendas (Por Rol) */}
              <div className="mt-8 bg-white rounded-[32px] p-8 border border-emerald-100 shadow-xl">
                 <h3 className="text-xl font-bold text-emerald-700 flex items-center gap-2 mb-6">
                    <FileText className="w-6 h-6" /> Paneles de Siglas (Leyendas por Rol)
                 </h3>
                 <p className="text-sm text-slate-500 mb-6 font-medium">Cree descripciones personalizadas de siglas para diferentes roles (Ej: Enfermería, Especialistas) que se mostrarán en la malla.</p>
                 <div className="flex flex-col sm:flex-row gap-4 p-4 bg-emerald-50 rounded-2xl mb-8 border border-emerald-100 items-start">
                    <input 
                      className="w-full sm:w-[200px] bg-white border border-emerald-100 p-4 rounded-xl outline-none focus:border-emerald-500 font-bold" 
                      placeholder="Rol (Ej: Enfermería)"
                      value={newLegendRole}
                      onChange={(e) => setNewLegendRole(e.target.value)}
                    />
                    <textarea 
                      className="w-full sm:flex-1 bg-white border border-emerald-100 p-4 rounded-xl outline-none focus:border-emerald-500 text-sm resize-none" 
                      placeholder="Descripción. Ej: M (6h), N (12h)..." 
                      rows={2}
                      value={newLegendContent}
                      onChange={(e) => setNewLegendContent(e.target.value)}
                    />
                    <button 
                      onClick={addLegend}
                      className="w-full sm:w-auto bg-emerald-600 text-white font-black px-6 py-4 rounded-xl hover:scale-105 active:scale-95 transition-transform"
                    >
                      AÑADIR
                    </button>
                 </div>
                 
                 <div className="space-y-4">
                    {customLegends.map((leg, idx) => (
                      <div key={idx} className="bg-stone-50 p-4 rounded-xl border border-emerald-100 flex flex-col sm:flex-row sm:justify-between items-start sm:items-center group gap-4">
                        <div>
                          <p className="text-sm font-black text-emerald-800 uppercase">{leg.role}</p>
                          <p className="text-xs text-slate-500 font-mono mt-1">{leg.legend}</p>
                        </div>
                        <button 
                          onClick={() => removeLegend(idx)}
                          className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-2 text-rose-400 hover:bg-rose-100 hover:text-rose-600 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {customLegends.length === 0 && (
                      <div className="text-center py-6 text-slate-400 italic text-sm border-dashed border-2 border-emerald-100 rounded-xl">No hay paneles personalizados para otros roles.</div>
                    )}
                 </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'docs' && (
            <motion.div 
               key="docs" 
               initial={{ opacity: 0, y: 10 }} 
               animate={{ opacity: 1, y: 0 }}
               className="h-full space-y-4"
            >
              <div className="flex gap-4">
                 <button 
                  className="flex-1 p-6 bg-emerald-50 rounded-2xl border border-emerald-100 hover:border-emerald-500 transition-all flex items-center justify-center gap-3 font-bold text-emerald-800 shadow-sm"
                  onClick={() => setShowAntibioticManual(true)}
                 >
                    <FileText className="text-emerald-600" /> Manual Antibióticos
                 </button>
                 <button 
                  className="flex-1 p-6 bg-rose-50 rounded-2xl border border-rose-100 hover:border-rose-500 transition-all flex items-center justify-center gap-3 font-bold text-rose-800 shadow-sm"
                  onClick={() => setShowInductionManual(true)}
                 >
                    <Users className="text-rose-500" /> Inducción General
                 </button>
              </div>
              <div className="bg-white rounded-3xl h-[60vh] flex items-center justify-center text-slate-300 overflow-hidden">
                 <p className="text-slate-400 italic">Pre-visualización de PDF bloqueada por políticas de iframe.</p>
              </div>
            </motion.div>
          )}

          {activeTab === 'admin' && session.r === 'admin' && (
            <motion.div 
              key="admin" 
              initial={{ opacity: 0, scale: 0.98 }} 
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-8 max-w-5xl mx-auto"
            >
              {/* Theme Settings */}
              <div className="bg-white rounded-[32px] p-8 border border-emerald-100 shadow-xl">
                 <h3 className="text-xl font-bold text-emerald-700 mb-6 flex items-center gap-2">
                    <Palette className="w-6 h-6 text-emerald-600" /> Personalización Visual
                 </h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                       <label className="text-xs text-emerald-600 uppercase font-black block mb-4">Color Principal</label>
                       <div className="grid grid-cols-5 gap-3">
                          {['#00c8f0', '#00e5a0', '#ff7d33', '#f43f5e', '#a855f7', '#eab308', '#22c55e', '#3b82f6', '#ec4899', '#f97316'].map(c => (
                            <button
                              key={c}
                              onClick={() => updateTheme({...theme, primary: c})}
                              className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 ${theme.primary === c ? 'border-white' : 'border-transparent'}`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                       </div>
                    </div>
                    <div>
                       <label className="text-xs text-emerald-600 uppercase font-black block mb-4">Fuente del Sistema</label>
                       <div className="flex flex-col gap-2">
                          {(['sans', 'serif', 'mono'] as const).map(f => (
                            <button
                              key={f}
                              onClick={() => updateTheme({...theme, font: f})}
                              className={`px-4 py-3 rounded-xl border text-left flex justify-between items-center transition-all ${theme.font === f ? 'bg-emerald-600 text-white border-white' : 'bg-stone-50 border-emerald-100 text-slate-600'}`}
                              style={f === 'serif' ? {fontFamily: 'serif'} : f === 'mono' ? {fontFamily: 'monospace'} : {fontFamily: 'sans-serif'}}
                            >
                               <span>
                                 {f === 'sans' ? 'Inter (Moderna)' : f === 'serif' ? 'Playfair (Elegante)' : 'JetBrains (Técnica)'}
                               </span>
                               {theme.font === f && <CheckCircle className="w-5 h-5" />}
                            </button>
                          ))}
                       </div>
                    </div>
                 </div>
              </div>

              {/* Productividad - Gestión de Mapeos */}
              <div className="bg-white rounded-[32px] p-8 border border-emerald-100 shadow-xl">
                 <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2">
                       <Database className="w-6 h-6 text-emerald-700" />
                       <h3 className="text-xl font-bold text-emerald-700">Mapeo de Servicios (Productividad)</h3>
                    </div>
                    <button 
                      onClick={addServiceMapping}
                      className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl border border-emerald-200 font-bold text-[10px] uppercase flex items-center gap-2 hover:bg-emerald-100 transition-all"
                    >
                       <Plus className="w-4 h-4" /> Añadir Servicio
                    </button>
                 </div>
                 <p className="text-[10px] text-slate-400 mb-6 uppercase font-bold">Asigne las siglas que corresponden a cada servicio hospitalario para el cálculo de productividad.</p>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {serviceMappings.map((m, idx) => (
                      <div key={m.id} className="bg-stone-50 p-6 rounded-2xl border border-emerald-100 flex flex-col gap-2 relative group">
                         <button 
                           onClick={() => deleteServiceMapping(m.id)}
                           className="absolute top-4 right-4 text-slate-300 hover:text-rose-500 transition-colors"
                         >
                            <Trash2 className="w-4 h-4" />
                         </button>
                         <div className="space-y-1">
                            <span className="text-[10px] text-emerald-600 font-black uppercase">Nombre del Servicio</span>
                            <input 
                              className="w-full bg-white border border-emerald-100 p-2 rounded-lg text-xs font-bold outline-none focus:border-emerald-500"
                              value={m.name}
                              onChange={(e) => {
                                const newMappings = [...serviceMappings];
                                newMappings[idx].name = e.target.value;
                                setServiceMappings(newMappings);
                              }}
                            />
                         </div>
                         <div className="space-y-1 mt-2">
                            <span className="text-[9px] text-slate-400 uppercase font-bold">Siglas Asociadas (separadas por coma)</span>
                            <input 
                              className="w-full bg-white border border-emerald-100 p-2 rounded-lg text-xs font-bold outline-none focus:border-emerald-500"
                              placeholder="Ej: 13, 13A, 13B"
                              value={m.siglas.join(', ')}
                              onChange={(e) => {
                                const newMappings = [...serviceMappings];
                                // We don't filter empty strings while typing to allow users to add commas
                                newMappings[idx].siglas = e.target.value.split(',').map(s => s.trim().toUpperCase());
                                setServiceMappings(newMappings);
                              }}
                            />
                         </div>
                      </div>
                    ))}
                    {serviceMappings.length === 0 && (
                      <div className="col-span-1 md:col-span-2 text-center py-10 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                         <p className="text-sm text-slate-400 italic">No hay servicios configurados</p>
                      </div>
                    )}
                    <button 
                      onClick={() => saveServiceMappings(serviceMappings)}
                      className="col-span-1 md:col-span-2 bg-emerald-700 text-white font-black py-4 rounded-2xl hover:bg-emerald-800 transition-all shadow-lg flex items-center justify-center gap-2 mt-4"
                    >
                      <Save className="w-5 h-5" /> GUARDAR MAPEOS DE PRODUCTIVIDAD
                    </button>
                 </div>
              </div>

              {/* AI Capacity Report */}
              <div className="bg-white rounded-[32px] p-8 border border-emerald-100 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                   <BrainCircuit className="w-24 h-24 text-emerald-600" />
                </div>
                <h3 className="text-xl font-bold text-emerald-700 mb-6 flex items-center gap-2">
                   <Sparkles className="w-6 h-6 text-emerald-500" /> Reporte de Capacidad IA
                </h3>
                
                <div className="flex flex-wrap gap-4 mb-8">
                  <button 
                    onClick={() => generateAICapacityReport('semanal')}
                    disabled={isGeneratingAI}
                    className="flex-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 p-6 rounded-2xl flex flex-col items-center gap-2 transition-all disabled:opacity-50 shadow-sm"
                  >
                    <span className="text-emerald-700 font-black text-sm uppercase tracking-tight">SEMANAL</span>
                    <span className="text-[10px] text-slate-400">Días 1 a 7</span>
                  </button>
                  <button 
                    onClick={() => generateAICapacityReport('quincenal')}
                    disabled={isGeneratingAI}
                    className="flex-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 p-6 rounded-2xl flex flex-col items-center gap-2 transition-all disabled:opacity-50 shadow-sm"
                  >
                    <span className="text-emerald-700 font-black text-sm uppercase tracking-tight">QUINCENAL</span>
                    <span className="text-[10px] text-slate-400">Días 1 a 15</span>
                  </button>
                  <button 
                    onClick={() => generateAICapacityReport('mensual')}
                    disabled={isGeneratingAI}
                    className="flex-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 p-6 rounded-2xl flex flex-col items-center gap-2 transition-all disabled:opacity-50 shadow-sm"
                  >
                    <span className="text-emerald-700 font-black text-sm uppercase tracking-tight">MENSUAL</span>
                    <span className="text-[10px] text-slate-400">Mes completo</span>
                  </button>
                </div>

                {isGeneratingAI && (
                  <div className="flex flex-col items-center gap-4 py-8 bg-emerald-50/50 rounded-2xl border border-emerald-100 animate-pulse mb-8">
                    <BrainCircuit className="w-12 h-12 text-emerald-500 animate-spin" />
                    <p className="text-sm font-black text-emerald-800 uppercase italic">Gemini está analizando la cobertura...</p>
                  </div>
                )}

                {aiReport && (
                  <div className="bg-slate-900 text-emerald-400 p-8 rounded-3xl border-4 border-emerald-500/20 shadow-2xl overflow-x-auto text-xs font-mono mb-8">
                    <pre className="whitespace-pre-wrap">{aiReport}</pre>
                  </div>
                )}
              </div>

              {/* Session Security Settings */}
              <div className="bg-white rounded-[32px] p-8 border border-emerald-100 shadow-xl">
                 <h3 className="text-xl font-bold text-emerald-700 mb-6 flex items-center gap-2">
                    <ShieldCheck className="w-6 h-6 text-emerald-600" /> Seguridad de Sesión
                 </h3>
                 <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 flex flex-wrap justify-between items-center gap-4">
                    <div className="flex-1">
                       <h4 className="font-black text-emerald-900 uppercase text-sm mb-1 tracking-tight">Auto-Cierre por Inactividad</h4>
                       <p className="text-[10px] text-slate-500 font-bold uppercase opacity-60">Cierra la sesión automáticamente tras el tiempo seleccionado sin actividad del mouse o teclado.</p>
                    </div>
                    <div className="flex items-center gap-3">
                       <select 
                         value={idleTimeout}
                         onChange={(e) => {
                           const val = Number(e.target.value);
                           setIdleTimeout(val);
                           localStorage.setItem('idleTimeout', val.toString());
                           setNotification({ message: `Cierre automático actualizado: ${val} minutos`, type: 'success' });
                         }}
                         className="bg-white border-2 border-emerald-200 text-emerald-800 font-black p-3 rounded-xl outline-none focus:border-emerald-500 text-sm shadow-sm"
                       >
                         {[5, 10, 15, 20, 30].map(t => (
                           <option key={t} value={t}>{t} Minutos</option>
                         ))}
                       </select>
                    </div>
                 </div>
              </div>

                <div className="mb-8">
                   <button 
                     onClick={generateAIServiceReport}
                     disabled={isGeneratingAI}
                     className="w-full bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-5 rounded-2xl flex items-center justify-center gap-3 transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                   >
                     <div className="bg-white/20 p-2 rounded-xl">
                        <Activity className="w-5 h-5 text-white" />
                     </div>
                     <div className="text-left">
                        <span className="block font-black text-sm uppercase tracking-wider">Análisis Profundo de Servicios (Gerencia IA)</span>
                        <span className="block text-[10px] text-white/70">Ocupación, patrones de uso y capacidad instalada</span>
                     </div>
                     <Sparkles className="w-5 h-5 ml-auto text-emerald-200 animate-pulse" />
                   </button>
                </div>

                {isGeneratingAI ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-4">
                     <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                     >
                        <Wand2 className="w-12 h-12 text-emerald-600" />
                     </motion.div>
                     <p className="text-emerald-700/40 text-sm font-black animate-pulse">GENERANDO ANÁLISIS ESTRATÉGICO...</p>
                  </div>
                ) : aiReport ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-stone-50 p-8 rounded-3xl border border-emerald-100"
                  >
                     <div className="flex justify-between items-center mb-6">
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-black uppercase tracking-widest">Resultados de Inteligencia Artificial</span>
                        <button 
                          onClick={() => setAiReport(null)}
                          className="text-slate-400 hover:text-rose-500 transition-colors"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                     </div>
                     <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap font-sans">
                        {aiReport}
                     </div>
                     <div className="mt-8 pt-6 border-t border-emerald-100 flex justify-between items-center">
                        <p className="text-[9px] text-slate-400 italic">Este reporte es generado automáticamente por el motor Gemini IA de Google.</p>
                        <button 
                          onClick={() => {
                            const blob = new Blob([aiReport], { type: 'text/plain' });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = `Reporte_IA_Capacidad_${MONTH_NAMES[selectedMonth]}.txt`;
                            link.click();
                          }}
                          className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-black shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all"
                        >
                          DESCARGAR REPORTE
                        </button>
                     </div>
                  </motion.div>
                ) : (
                  <div className="py-12 text-center">
                    <p className="text-slate-300 text-sm uppercase font-black opacity-60">Selecciona un periodo para generar el reporte estratégico</p>
                  </div>
                )}

              {/* Audit Logs */}
              <div className="bg-white rounded-[32px] p-8 border border-emerald-100 shadow-xl">
                 <h3 className="text-xl font-bold text-emerald-700 mb-6 flex items-center gap-2">
                    <Bell className="w-6 h-6 text-emerald-500" /> Registro de Auditoría ({MONTH_NAMES[selectedMonth]} {selectedYear})
                 </h3>
                 <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {auditLogs.filter(log => log.targetMonth === selectedMonth && log.targetYear === selectedYear).length === 0 && (
                      <div className="text-center py-10 text-slate-300 font-mono text-sm italic">
                        No hay registros para este período.
                      </div>
                    )}
                    {auditLogs
                      .filter(log => log.targetMonth === selectedMonth && log.targetYear === selectedYear)
                      .map(log => (
                      <div key={log.id} className="bg-stone-50 p-4 rounded-xl border border-emerald-100 flex justify-between items-center text-xs group hover:border-emerald-500/30 transition-colors shadow-sm">
                        <div>
                          <div className="text-slate-800 font-bold mb-1">
                            Dr. {log.doctorName} <span className="text-emerald-600 ml-2 font-black">Día {log.day} ({log.slot.toUpperCase()})</span>
                            {log.doctorContact && <span className="ml-2 text-[8px] px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-md border border-emerald-100 font-bold">{log.doctorContact}</span>}
                          </div>
                          <div className="text-slate-400 flex items-center gap-2">
                            Cambio: <span className="text-rose-400 line-through opacity-50">{log.oldSigla}</span> 
                            <ChevronRight className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-600 font-black px-1.5 py-0.5 bg-emerald-50 rounded">{log.newSigla}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-slate-400 mb-1">{new Date(log.timestamp).toLocaleTimeString()}</div>
                          <div className="text-[9px] uppercase font-black text-emerald-700/50">Sincronizado</div>
                        </div>
                      </div>
                    ))}
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-emerald-100 p-1 md:p-2 flex justify-around z-50 no-print max-w-7xl mx-auto rounded-t-3xl sm:mb-2 sm:px-4 shadow-2xl safe-area-bottom">
        {[
          { id: 'home', icon: ChevronRight, label: 'Home' },
          { id: 'turnos', icon: Calendar, label: 'Turnos' },
          { id: 'committee', icon: FileCheck, label: 'Comité' },
          { id: 'pic', icon: BookOpen, label: 'PIC' },
          { id: 'solicitudes', icon: Send, label: 'Solicitudes' },
          { id: 'rural', icon: MapPin, label: 'Rural' },
          { id: 'novedades', icon: ClipboardList, label: 'Novedades' },
          { id: 'whatsapp', icon: MessageCircle, label: 'WhatsApp', isExternal: true, url: 'https://wa.me/573173683886?mode=gi_t' },
          ...(session?.r === 'admin' ? [{ id: 'admin', icon: Settings, label: 'Admin' }] : [])
        ].map(btn => (
          <button
            key={btn.id}
            onClick={() => {
              if (btn.isExternal && btn.url) {
                window.open(btn.url, '_blank');
              } else {
                setActiveTab(btn.id as any);
              }
            }}
            className={`flex flex-col items-center justify-center p-2 md:p-3 rounded-2xl flex-1 md:w-24 transition-all ${
              activeTab === btn.id ? 'text-white bg-emerald-600 shadow-lg' : 'text-slate-400 hover:text-emerald-600'
            }`}
          >
            <btn.icon className={`w-5 h-5 md:w-6 md:h-6 mb-0.5 md:mb-1 ${btn.id === 'whatsapp' ? 'text-emerald-500' : ''}`} />
            <span className="text-[8px] md:text-[10px] font-black uppercase tracking-tight md:tracking-widest">{btn.label}</span>
          </button>
        ))}
      </nav>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .turns-table { font-size: 8px !important; color: black !important; width: 100% !important; border: 1px solid #ccc !important; }
          td, th { border: 1px solid #ccc !important; padding: 2px !important; color: black !important; background: transparent !important; }
          .sticky-col { position: relative !important; background: white !important; border-right: 1px solid #ccc !important; box-shadow: none !important; }
          .h-low, .h-ok, .h-over { color: black !important; border: 1px solid #ccc !important; }
        }
        
        /* Custom scrollbars */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #fafaf9; }
        ::-webkit-scrollbar-thumb { background: #10b981; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #059669; }

        .slot-label {
          writing-mode: vertical-rl;
          text-orientation: mixed;
          transform: rotate(180deg);
        }
      `}</style>

      {editingDoc && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-6">
          <motion.div initial={{scale:0.9, opacity:0}} animate={{scale:1, opacity:1}} className="bg-white w-full max-w-lg p-8 rounded-[32px] border border-emerald-100 shadow-2xl">
            <h2 className="text-2xl font-black text-slate-800 mb-2 uppercase tracking-tight">Editar Médico</h2>
            <div className="text-[10px] text-slate-400 font-bold uppercase mb-6 flex items-center gap-2">
              UID / NÚMERO DE MÉDICO: <span className="text-emerald-600 font-black">{editingDoc.id}</span>
            </div>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto px-2 custom-scrollbar">
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-black ml-2 mb-1 block underline underline-offset-4 decoration-emerald-500 text-emerald-600">ID / Código de Acceso (UID)</label>
                <input 
                  type="number"
                  className="w-full bg-stone-50 border border-emerald-200 p-4 rounded-xl text-slate-800 outline-none focus:border-emerald-500 font-black"
                  value={editingDoc.id}
                  onChange={e => setEditingDoc({...editingDoc, id: parseInt(e.target.value) || 0})}
                  placeholder="Número de Nómina / UID"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-black ml-2 mb-1 block">Nombres</label>
                  <input 
                    className="w-full bg-stone-50 border border-emerald-100 p-4 rounded-xl text-slate-800 outline-none focus:border-emerald-500 font-bold"
                    value={editingDoc.nombre}
                    onChange={e => setEditingDoc({...editingDoc, nombre: e.target.value})}
                    placeholder="Nombres"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-black ml-2 mb-1 block">Apellidos</label>
                  <input 
                    className="w-full bg-stone-50 border border-emerald-100 p-4 rounded-xl text-slate-800 outline-none focus:border-emerald-500 font-bold"
                    value={editingDoc.apellidos || ''}
                    onChange={e => setEditingDoc({...editingDoc, apellidos: e.target.value})}
                    placeholder="Apellidos"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-black ml-2 mb-1 block">Cédula</label>
                  <input 
                    className="w-full bg-stone-50 border border-emerald-100 p-4 rounded-xl text-slate-800 outline-none focus:border-emerald-500 font-bold"
                    value={editingDoc.cedula || ''}
                    onChange={e => setEditingDoc({...editingDoc, cedula: e.target.value})}
                    placeholder="Documento de Identidad"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-black ml-2 mb-1 block">Registro Médico</label>
                  <input 
                    className="w-full bg-stone-50 border border-emerald-100 p-4 rounded-xl text-slate-800 outline-none focus:border-emerald-500 font-bold"
                    value={editingDoc.registroMedico || ''}
                    onChange={e => setEditingDoc({...editingDoc, registroMedico: e.target.value})}
                    placeholder="Registro Médico"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-black ml-2 mb-1 block">Email</label>
                  <input 
                    className="w-full bg-stone-50 border border-emerald-100 p-4 rounded-xl text-slate-800 outline-none focus:border-emerald-500 font-bold"
                    value={editingDoc.email || ''}
                    onChange={e => setEditingDoc({...editingDoc, email: e.target.value})}
                    placeholder="Email"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-black ml-2 mb-1 block">Teléfono</label>
                  <input 
                    className="w-full bg-stone-50 border border-emerald-100 p-4 rounded-xl text-slate-800 outline-none focus:border-emerald-500 font-bold"
                    value={editingDoc.telefono || ''}
                    onChange={e => setEditingDoc({...editingDoc, telefono: e.target.value})}
                    placeholder="WhatsApp"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-black ml-2 mb-1 block">Usuario Login</label>
                  <input 
                    className="w-full bg-stone-50 border border-emerald-100 p-4 rounded-xl text-slate-800 outline-none focus:border-emerald-500 font-bold"
                    value={editingDoc.username || ''}
                    onChange={e => setEditingDoc({...editingDoc, username: e.target.value})}
                    placeholder="Usuario"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-black ml-2 mb-1 block">Contraseña</label>
                  <input 
                    className="w-full bg-stone-50 border border-emerald-100 p-4 rounded-xl text-slate-800 outline-none focus:border-emerald-500 font-bold"
                    value={editingDoc.password || ''}
                    onChange={e => setEditingDoc({...editingDoc, password: e.target.value})}
                    placeholder="Contraseña"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-black ml-2 mb-1 block">Categoría</label>
                  <select 
                    className="w-full bg-stone-50 border border-emerald-100 p-4 rounded-xl text-slate-800 outline-none focus:border-emerald-500 font-bold"
                    value={editingDoc.cat}
                    onChange={e => setEditingDoc({...editingDoc, cat: e.target.value as any})}
                  >
                    <option value="Planta">PLANTA</option>
                    <option value="CTA">CTA</option>
                    <option value="APS">APS</option>
                    <option value="Rural">RURAL</option>
                    <option value="Disponibilidad">DISPONIBILIDAD</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-black ml-2 mb-1 block">Rol</label>
                  <select 
                    className="w-full bg-stone-50 border border-emerald-100 p-4 rounded-xl text-slate-800 outline-none focus:border-emerald-500 font-bold"
                    value={editingDoc.rol}
                    onChange={e => setEditingDoc({...editingDoc, rol: e.target.value as any})}
                  >
                    <option value="Médico General">Médico General</option>
                    <option value="Médico Especialista">Médico Especialista</option>
                    <option value="Médico Rural">Médico Rural</option>
                    <option value="Enfermero Jefe">Enfermero Jefe</option>
                    <option value="Auxiliar Enfermería">Auxiliar Enfermería</option>
                    <option value="Interno">Interno</option>
                    <option value="Triage">Triage</option>
                    <option value="Laboratorio">Laboratorio</option>
                    <option value="Odontólogo">Odontólogo</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setEditingDoc(null)} 
                  className="flex-1 py-4 border border-slate-200 text-slate-400 font-bold rounded-xl hover:bg-slate-50 uppercase text-xs"
                >
                  CANCELAR
                </button>
                <button 
                  onClick={saveEditedDoctor}
                  className="flex-1 py-4 bg-emerald-600 text-white font-black rounded-xl hover:scale-105 transition-transform shadow-lg shadow-emerald-500/20 uppercase text-xs"
                >
                  GUARDAR CAMBIOS
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
      {showAuthInbox && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-6">
          <motion.div initial={{scale:0.9, opacity:0}} animate={{scale:1, opacity:1}} className="bg-white w-full max-w-2xl p-8 rounded-[32px] border border-emerald-100 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <ShieldCheck className="w-48 h-48 text-emerald-600" />
            </div>
            
            <div className="flex justify-between items-center mb-6 relative z-10">
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-emerald-600" />
                Bandeja de Autorización
              </h2>
              <button onClick={() => setShowAuthInbox(false)} className="bg-slate-50 p-2 rounded-xl text-slate-400 hover:text-rose-500 transition-colors border border-slate-200">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 relative z-10">
              {shiftRequests.filter(r => r.status === 'pending').length === 0 ? (
                <div className="text-center py-20">
                  <div className="text-emerald-500/30 font-black uppercase tracking-widest italic">No hay solicitudes pendientes</div>
                </div>
              ) : (
                shiftRequests.filter(r => r.status === 'pending').map(req => {
                  const docName = doctors.find(d => d.id === req.doctorId)?.nombre || 'Médico Desconocido';
                  return (
                    <div key={req.id} className="bg-slate-50 border border-emerald-100 p-5 rounded-2xl flex justify-between items-center group hover:border-emerald-500/50 transition-all shadow-sm">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-black text-slate-800 uppercase text-sm">{docName}</span>
                          <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold uppercase">Solicitud</span>
                        </div>
                        <div className="text-xs text-emerald-600">
                          Día {req.day} - Jornada: <span className="font-bold uppercase">{req.slot}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-2 italic bg-white p-3 rounded-xl border border-emerald-50 border-dashed">
                          "{req.reason || 'Sin motivo especificado'}"
                        </p>
                      </div>
                      <div className="flex gap-2 ml-4">
                         <button 
                           onClick={() => updateRequestStatus(req.id, 'approved')}
                           className="w-12 h-12 flex items-center justify-center bg-emerald-600 text-white rounded-xl hover:scale-110 active:scale-95 transition-all shadow-lg shadow-emerald-500/20"
                           title="Autorizar"
                         >
                            <CheckCircle className="w-6 h-6" />
                         </button>
                         <button 
                           onClick={() => updateRequestStatus(req.id, 'rejected')}
                           className="w-12 h-12 flex items-center justify-center bg-rose-500 text-white rounded-xl hover:scale-110 active:scale-95 transition-all shadow-lg shadow-rose-500/20"
                           title="Rechazar"
                         >
                            <XCircle className="w-6 h-6" />
                         </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-8 pt-6 border-t border-emerald-100 text-[10px] text-slate-400 italic text-center">
              Las solicitudes autorizadas se verán reflejadas automáticamente en el turnero.
            </div>
          </motion.div>
        </div>
      )}
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
      <AnimatePresence>
        {showCallModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl p-8 border border-rose-100 relative"
            >
              <button onClick={() => setShowCallModal(false)} className="absolute top-6 right-6 p-2 bg-stone-50 rounded-full text-slate-400 hover:text-rose-500 transition-colors z-30">
                <XCircle className="w-6 h-6" />
              </button>

              <div className="mb-8 flex items-center gap-4">
                <div className="p-4 bg-rose-50 rounded-3xl text-rose-600">
                   <PhoneIncoming className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-800">Llamado a Disponibilidad</h2>
                  <p className="text-[10px] text-rose-500 font-bold uppercase tracking-widest">Protocolo de Asistencia Institucional</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="text-[10px] uppercase font-black text-slate-400 mb-1 ml-2 block">Día</label>
                      <input type="number" min={1} max={daysInMonth} value={callDay} onChange={e => { setCallDay(Number(e.target.value)); setCallTargetId(null); }} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl font-bold" />
                   </div>
                   <div>
                      <label className="text-[10px] uppercase font-black text-slate-400 mb-1 ml-2 block">Jornada</label>
                      <select value={callSlot} onChange={e => { setCallSlot(e.target.value as SlotType); setCallTargetId(null); }} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl font-bold">
                        <option value="m">Mañana</option>
                        <option value="t">Tarde</option>
                        <option value="n">Noche</option>
                      </select>
                   </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-black text-slate-400 mb-1 ml-2 block">Asistencial a Llamar</label>
                  <select 
                    value={callTargetId || ''} 
                    onChange={e => setCallTargetId(Number(e.target.value))} 
                    className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl font-bold"
                  >
                    <option value="">Selección Automática (Primer Disponible)</option>
                    {Object.keys(currentMonthData).reduce((acc: any[], idStr) => {
                      const id = Number(idStr);
                      const sigla = currentMonthData[id]?.[callSlot]?.[callDay] || 'X';
                      if (sigla.startsWith('D')) {
                        const doc = doctors.find(d => d.id === id);
                        if (doc) acc.push({ id: doc.id, name: doc.nombre, sigla });
                      }
                      return acc;
                    }, []).map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.name} ({opt.sigla})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="text-[10px] uppercase font-black text-slate-400 mb-1 ml-2 block">Servicio o Labor Administrativa</label>
                    <select 
                      value={callService}
                      onChange={e => setCallService(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl font-bold"
                    >
                      <option value="Traslado Médico">TRASLADO MÉDICO</option>
                      <option value="Apoyo Urgencias">APOYO URGENCIAS</option>
                      <option value="Apoyo Hospitalización">APOYO HOSPITALIZACIÓN</option>
                      <option value="Apoyo Observación">APOYO OBSERVACIÓN</option>
                      <option value="Apoyo al Triage">APOYO AL TRIAGE</option>
                      <option value="Cubrir Incapacidad">CUBRIR INCAPACIDAD</option>
                      <option value="Ayudantía Quirúrgica">AYUDANTÍA QUIRÚRGICA</option>
                      <option value="Brigadas">BRIGADAS</option>
                      <option value="Consulta Externa">CONSULTA EXTERNA</option>
                      <option value="Administrativo">ADMINISTRATIVO</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-black text-slate-400 mb-1 ml-2 block">Administrador / Enfermero que llama</label>
                    <input 
                      type="text" 
                      placeholder={session?.n || "Nombre del responsable"}
                      value={callCaller}
                      onChange={e => setCallCaller(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl font-bold font-mono"
                    />
                  </div>
                </div>

                <button 
                  onClick={handleCallAvailability}
                  className="w-full bg-rose-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-rose-500/20 hover:bg-rose-700 transition-all flex items-center justify-center gap-3"
                >
                  <Send className="w-5 h-5" /> GENERAR ALERTA DE LLAMADO
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showActivitiesModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-4xl rounded-[40px] shadow-2xl p-8 border border-amber-100 relative max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <button onClick={() => setShowActivitiesModal(false)} className="absolute top-6 right-6 p-2 bg-stone-50 rounded-full text-slate-400 hover:text-rose-500 transition-colors z-30">
                <XCircle className="w-6 h-6" />
              </button>

              <div className="mb-8 flex items-center gap-4">
                <div className="p-4 bg-amber-50 rounded-3xl text-amber-600">
                   <Calendar className="w-8 h-8" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight">PIC - Programa Institucional de Capacitaciones</h2>
                  <p className="text-[10px] text-amber-600 font-bold uppercase tracking-widest tracking-tighter">Plan de Capacitación HDSAR - {MONTH_NAMES[selectedMonth]} {selectedYear}</p>
                </div>
                <div className="flex gap-2">
                   <button 
                     onClick={() => exportPICExcel()}
                     className="px-3 py-2 text-[10px] font-black bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 transition-colors uppercase border border-emerald-100"
                   >
                     Excel
                   </button>
                   <button 
                     onClick={() => exportPICPDF()}
                     className="px-3 py-2 text-[10px] font-black bg-rose-50 text-rose-700 rounded-xl hover:bg-rose-100 transition-colors uppercase border border-rose-100"
                   >
                     PDF
                   </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                   <div className="bg-amber-50/30 p-6 rounded-[32px] border border-amber-100">
                      <h4 className="text-xs font-black text-amber-700 uppercase mb-4 tracking-widest">Información de la Actividad</h4>
                      <div className="space-y-4">
                         <div>
                            <label className="text-[10px] uppercase font-black text-slate-400 mb-1 ml-2 block">Nombre de la Actividad</label>
                            <input 
                              placeholder="Nombre de la capacitación" 
                              className="w-full bg-white border border-slate-100 p-4 rounded-xl font-bold"
                              value={newActivity.activityName || ''}
                              onChange={e => setNewActivity({...newActivity, activityName: e.target.value})}
                            />
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                            <div>
                               <label className="text-[10px] uppercase font-black text-slate-400 mb-1 ml-2 block">Día</label>
                               <input type="number" min={1} max={31} value={newActivity.day || ''} onChange={e => setNewActivity({...newActivity, day: Number(e.target.value)})} className="w-full bg-white border border-slate-100 p-4 rounded-xl font-bold" />
                            </div>
                            <div>
                               <label className="text-[10px] uppercase font-black text-slate-400 mb-1 ml-2 block">Horas</label>
                               <input type="number" value={newActivity.hours || ''} onChange={e => setNewActivity({...newActivity, hours: Number(e.target.value)})} className="w-full bg-white border border-slate-100 p-4 rounded-xl font-bold" />
                            </div>
                         </div>
                         <div>
                            <label className="text-[10px] uppercase font-black text-slate-400 mb-1 ml-2 block">Lugar / Ubicación</label>
                            <input placeholder="Ej: Auditorio HSE" className="w-full bg-white border border-slate-100 p-4 rounded-xl font-bold" value={newActivity.place || ''} onChange={e => setNewActivity({...newActivity, place: e.target.value})} />
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                            <div>
                               <label className="text-[10px] uppercase font-black text-slate-400 mb-1 ml-2 block">Modalidad</label>
                               <select value={newActivity.modality} onChange={e => setNewActivity({...newActivity, modality: e.target.value as any})} className="w-full bg-white border border-slate-100 p-4 rounded-xl font-bold">
                                 <option value="presencial">Presencial</option>
                                 <option value="virtual">Virtual</option>
                                 <option value="mixta">Mixta</option>
                               </select>
                            </div>
                            <div>
                               <label className="text-[10px] uppercase font-black text-slate-400 mb-1 ml-2 block">Dirigida a</label>
                               <input placeholder="Personal" className="w-full bg-white border border-slate-100 p-4 rounded-xl font-bold" value={newActivity.targetGroup || ''} onChange={e => setNewActivity({...newActivity, targetGroup: e.target.value})} />
                            </div>
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                            <div>
                               <label className="text-[10px] uppercase font-black text-slate-400 mb-1 ml-2 block">Responsable</label>
                               <input placeholder="Nombre" className="w-full bg-white border border-slate-100 p-4 rounded-xl font-bold" value={newActivity.responsible || ''} onChange={e => setNewActivity({...newActivity, responsible: e.target.value})} />
                            </div>
                            <div>
                               <label className="text-[10px] uppercase font-black text-slate-400 mb-1 ml-2 block">Población Objetivo</label>
                               <input placeholder="Ej: Médicos" className="w-full bg-white border border-slate-100 p-4 rounded-xl font-bold" value={newActivity.targetPopulation || ''} onChange={e => setNewActivity({...newActivity, targetPopulation: e.target.value})} />
                            </div>
                         </div>
                      </div>
                   </div>

                   <button 
                     onClick={addActivity}
                     className="w-full bg-amber-600 text-white font-black py-5 rounded-[24px] hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-amber-600/20 uppercase tracking-widest text-sm"
                   >
                     CONFIRMAR Y GUARDAR ACTIVIDAD
                   </button>
                </div>

                <div className="space-y-6">
                   <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-200 h-full flex flex-col">
                      <h4 className="text-xs font-black text-slate-400 uppercase mb-4 tracking-widest">Documentación y Soportes</h4>
                      <div className="space-y-3 flex-1 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                         {[
                           { key: 'preTest', label: 'Base de datos / Pre-test', icon: Database },
                           { key: 'training', label: 'Capacitación (Lectura)', icon: BrainCircuit },
                           { key: 'attendance', label: 'Asistencia Digital Firmada', icon: ClipboardList },
                           { key: 'postTest', label: 'Post-test / Evaluación', icon: FileText }
                         ].map((item) => (
                           <div key={item.key} className="bg-white p-4 rounded-[20px] border border-slate-100 group">
                              <p className="text-[9px] uppercase font-black text-slate-400 mb-2">{item.label}</p>
                              <div className="flex items-center gap-3">
                                <label className="flex-1 flex items-center justify-between px-4 py-3 bg-stone-50 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-amber-50 hover:border-amber-500 transition-all">
                                   <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                                      <item.icon className="w-4 h-4 text-slate-400" />
                                      <span className="truncate max-w-[150px]">
                                        {newActivity.files?.[item.key as keyof typeof newActivity.files] || 'Subir Archivo'}
                                      </span>
                                   </div>
                                   <Plus className="w-4 h-4 text-slate-300 group-hover:text-amber-600 transition-colors" />
                                   <input type="file" className="hidden" onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                         setNewActivity(prev => ({
                                           ...prev,
                                           files: { ...prev.files, [item.key]: file.name }
                                         }));
                                      }
                                   }} />
                                </label>
                              </div>
                           </div>
                         ))}
                      </div>

                      <div className="mt-8 pt-6 border-t border-slate-200">
                         <h5 className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest text-center italic">Actividades del Mes Actual</h5>
                         <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                           {activities.filter(a => a.month === selectedMonth && a.year === selectedYear).map(a => (
                             <div key={a.id} className="bg-white p-3 rounded-xl border border-slate-100 flex justify-between items-center group shadow-sm transition-all hover:border-amber-200">
                                <div>
                                   <p className="text-xs font-bold text-slate-800 leading-tight">{a.activityName}</p>
                                   <p className="text-[9px] text-amber-600 font-bold uppercase">Día {a.day} • {a.modality} • {a.hours}h</p>
                                </div>
                                <button onClick={() => deleteActivity(a.id)} className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                                   <Trash2 className="w-3.5 h-3.5" />
                                </button>
                             </div>
                           ))}
                           {activities.filter(a => a.month === selectedMonth && a.year === selectedYear).length === 0 && (
                             <p className="text-[10px] text-slate-300 text-center italic py-4">No hay actividades para {MONTH_NAMES[selectedMonth]}.</p>
                           )}
                         </div>
                      </div>
                   </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCodigoRojo && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[300] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-4xl rounded-[40px] shadow-2xl p-8 border border-rose-100 relative"
            >

              <button onClick={() => setShowCodigoRojo(false)} className="absolute top-6 right-6 p-2 bg-rose-50 rounded-full text-rose-400 hover:text-rose-600 transition-colors z-50">
                <XCircle className="w-6 h-6" />
              </button>

              <div className="mb-8 flex items-center gap-6">
                <div className="p-5 bg-rose-100 rounded-3xl text-rose-600 animate-pulse shadow-lg shadow-rose-200">
                   <Flame className="w-10 h-10" />
                </div>
                <div>
                  <h2 className="text-4xl font-black text-slate-800 tracking-tighter">CÓDIGO ROJO</h2>
                  <p className="text-sm text-rose-600 font-black uppercase tracking-[0.2em] mt-1">Hemorragia Obstétrica • Protocolo HDSAR</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* ALERTA TEMPRANA - NEW SECTION */}
                <div className="col-span-1 md:col-span-3 bg-rose-600 p-6 rounded-3xl text-white shadow-lg">
                   <h3 className="font-black text-xs mb-4 uppercase flex items-center gap-2">
                      <AlertCircle className="w-5 h-5" /> PANEL DE ALERTA TEMPRANA (GRADOS DE CHOQUE)
                   </h3>
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-white/10 p-3 rounded-2xl border border-white/20">
                         <div className="text-[10px] uppercase opacity-70 font-bold mb-1">Sensorio</div>
                         <div className="text-xs font-black">Normal / Agitado / Letárgico</div>
                      </div>
                      <div className="bg-white/10 p-3 rounded-2xl border border-white/20">
                         <div className="text-[10px] uppercase opacity-70 font-bold mb-1">Perfusión</div>
                         <div className="text-xs font-black">Normal / Pálida / Fría / Sudorosa</div>
                      </div>
                      <div className="bg-white/10 p-3 rounded-2xl border border-white/20">
                         <div className="text-[10px] uppercase opacity-70 font-bold mb-1">Pulso (LPM)</div>
                         <div className="text-xs font-black">60-90 / 91-100 / 101-120 / &gt;120</div>
                      </div>
                      <div className="bg-white/10 p-3 rounded-2xl border border-white/20">
                         <div className="text-[10px] uppercase opacity-70 font-bold mb-1">Presión Sistólica</div>
                         <div className="text-xs font-black">&gt;90 / 80-90 / 70-79 / &lt;70 mmHg</div>
                      </div>
                   </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-rose-50 p-6 rounded-3xl border border-rose-100">
                    <h3 className="font-black text-rose-700 text-xs mb-4 uppercase flex items-center gap-2">
                       <Timer className="w-4 h-4" /> MINUTO 0: ACTIVACIÓN
                    </h3>
                    <ul className="space-y-2 text-xs font-bold text-slate-600">
                      <li className="flex gap-2"><span>1.</span> Identificar choque o hemorragia &gt;500ml</li>
                      <li className="flex gap-2"><span>2.</span> Alertar al equipo y activar alarma</li>
                      <li className="flex gap-2"><span>3.</span> Oxígeno por cánula (3L) o máscara</li>
                      <li className="flex gap-2"><span>4.</span> Posición Decúbito Lateral Izq.</li>
                    </ul>
                  </div>
                  <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100">
                    <h3 className="font-black text-amber-700 text-xs mb-4 uppercase">DISTRIBUCIÓN DEL EQUIPO</h3>
                    <div className="space-y-3">
                       <div className="flex items-center gap-2 text-xs">
                         <div className="w-2 h-2 bg-amber-500 rounded-full" />
                         <span className="font-black">Coordinador:</span> Dirige y ordena
                       </div>
                       <div className="flex items-center gap-2 text-xs">
                         <div className="w-2 h-2 bg-blue-500 rounded-full" />
                         <span className="font-black">Asistente 1:</span> Vía Aérea (Cabeza)
                       </div>
                       <div className="flex items-center gap-2 text-xs">
                         <div className="w-2 h-2 bg-green-500 rounded-full" />
                         <span className="font-black">Asistente 2:</span> Circulación (Brazos)
                       </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                   <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
                      <h3 className="font-black text-emerald-700 text-xs mb-4 uppercase flex items-center gap-2">
                         <Syringe className="w-4 h-4" /> MINUTO 1-20: REANIMACIÓN
                      </h3>
                      <ul className="space-y-2 text-xs font-bold text-slate-600">
                        <li className="flex gap-2"><span>•</span> 2 Catéteres gruesos (#14 o #16)</li>
                        <li className="flex gap-2"><span>•</span> Muestras: Hemoclasif, Hemograma, Pruebas Coag.</li>
                        <li className="flex gap-2"><span>•</span> Cristaloides calientes (2 Litros)</li>
                        <li className="flex gap-2"><span>•</span> Sonda Foley para control de diuresis</li>
                      </ul>
                   </div>
                   <div className="bg-white p-6 rounded-3xl border border-slate-200">
                      <h3 className="font-black text-slate-800 text-xs mb-4 uppercase flex items-center gap-2">
                         <HeartPulse className="w-4 h-4" /> MINUTO 20-60: HEMOSTASIA
                      </h3>
                      <div className="space-y-2 text-[10px] font-bold text-slate-500">
                        <div className="p-2 bg-slate-100 rounded-lg">Masaje Uterino Bimanual Permanente</div>
                        <div className="grid grid-cols-2 gap-2">
                           <div className="p-2 bg-rose-50 text-rose-700 rounded-lg">Oxitocina: 40 UI IV</div>
                           <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">Misoprostol: 800mcg</div>
                        </div>
                        <div className="p-2 bg-amber-50 text-amber-700 rounded-lg">Tranexámico: 1g IV lento</div>
                      </div>
                   </div>
                </div>

                <div className="space-y-4">
                   <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl">
                      <h3 className="font-black text-rose-500 text-xs mb-4 uppercase flex items-center gap-2">
                         <AlertCircle className="w-4 h-4" /> MANEJO AVANZADO
                      </h3>
                      <p className="text-[10px] opacity-70 mb-4 italic leading-relaxed">Si la hemorragia persiste tras 60 minutos o el choque es grave:</p>
                      <ul className="space-y-3 text-xs font-black">
                        <li className="flex gap-3 items-center text-rose-400">
                           <div className="w-4 h-4 rounded-full border border-rose-500 flex items-center justify-center text-[8px]">1</div>
                           INICIAR TRANSFUSIÓN (PAQUETE 1)
                        </li>
                        <li className="flex gap-3 items-center">
                           <div className="w-4 h-4 rounded-full border border-slate-500 flex items-center justify-center text-[8px]">2</div>
                           DECISIÓN QUIRÚRGICA
                        </li>
                        <li className="flex gap-3 items-center">
                           <div className="w-4 h-4 rounded-full border border-slate-500 flex items-center justify-center text-[8px]">3</div>
                           DETERMINAR REMISIÓN NIVEL III
                        </li>
                      </ul>
                   </div>
                   <div className="p-4 rounded-2xl border-2 border-dashed border-rose-200 text-center">
                      <p className="text-[9px] font-black text-rose-400 uppercase">🚨 LLAMADO PRIORITARIO: GINECO-OBSTETRICIA</p>
                   </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCodigoAzul && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[300] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-4xl rounded-[40px] shadow-2xl p-8 border border-blue-100 relative"
            >

              <button onClick={() => setShowCodigoAzul(false)} className="absolute top-6 right-6 p-2 bg-blue-50 rounded-full text-blue-400 hover:text-blue-600 transition-colors z-50">
                <XCircle className="w-6 h-6" />
              </button>

              <div className="mb-8 flex items-center gap-6">
                <div className="p-5 bg-blue-100 rounded-3xl text-blue-600 shadow-lg shadow-blue-200">
                   <Activity className="w-10 h-10" />
                </div>
                <div>
                  <h2 className="text-4xl font-black text-slate-800 tracking-tighter">CÓDIGO AZUL</h2>
                  <p className="text-sm text-blue-600 font-black uppercase tracking-[0.2em] mt-1">RCP Avanzado • Soporte Vital HDSAR</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
                    <h3 className="font-black text-blue-700 text-xs mb-4 uppercase">1. RECONOCIMIENTO</h3>
                    <div className="space-y-2 text-xs font-bold text-slate-600">
                       <div className="p-2 bg-white rounded-lg">• Verificar escena segura</div>
                       <div className="p-2 bg-white rounded-lg font-black text-blue-600">• ¿No responde? Pedir apoyo</div>
                       <div className="p-2 bg-white rounded-lg">• Pulso y Resp (&lt; 10s)</div>
                    </div>
                  </div>
                  <div className="bg-slate-900 text-white p-6 rounded-3xl">
                     <h3 className="font-black text-blue-400 text-xs mb-4 uppercase">2. COMPRESIONES (CAB)</h3>
                     <div className="space-y-3">
                        <div className="flex items-center gap-3">
                           <div className="text-xl font-black text-blue-500">30:2</div>
                           <div className="text-[10px] leading-tight">Ciclo de compresiones y ventilaciones</div>
                        </div>
                        <p className="text-[10px] opacity-60">Frecuencia: 100-120 lpm. Profundidad: 5-6 cm. Permitir descompresión total.</p>
                     </div>
                  </div>
                </div>

                <div className="space-y-4">
                   <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100">
                      <h3 className="font-black text-amber-700 text-xs mb-4 uppercase">3. RITMOS DESFIBRILABLES</h3>
                      <p className="text-[9px] font-black text-slate-400 mb-3 uppercase">TVSP / FV</p>
                      <div className="space-y-3 text-xs font-bold">
                         <div className="p-3 bg-white rounded-xl border border-amber-200 text-amber-600 text-center">DESCARGA (200J Bifásico)</div>
                         <div className="p-3 bg-white rounded-xl border border-slate-100">Adrenalina 1mg (3-5 min)</div>
                         <div className="p-3 bg-white rounded-xl border border-slate-100">Amiodarona 300mg / 150mg</div>
                      </div>
                   </div>
                   <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                      <h3 className="font-black text-slate-400 text-xs mb-4 uppercase">4. RITMOS NO DESFIBRILABLES</h3>
                      <p className="text-[9px] font-black text-slate-400 mb-3 uppercase">Asistolia / AESP</p>
                      <div className="space-y-3 text-xs font-bold">
                         <div className="p-3 bg-blue-600 text-white rounded-xl text-center shadow-lg">ADRENALINA LO ANTES POSIBLE</div>
                         <div className="p-3 bg-white rounded-xl border border-slate-200">RCP Continuo (2 min)</div>
                         <div className="p-3 bg-white rounded-xl border border-slate-200">Tratar causas (5H / 5T)</div>
                      </div>
                   </div>
                </div>

                <div className="space-y-4">
                   <div className="bg-white p-6 rounded-3xl border-2 border-blue-100 h-full">
                      <h3 className="font-black text-slate-800 text-xs mb-4 uppercase flex items-center gap-2">
                         <Search className="w-4 h-4 text-blue-500" /> CAUSAS REVERSIBLES
                      </h3>
                      <div className="grid grid-cols-2 gap-4 text-[9px] font-bold">
                         <div className="space-y-1">
                            <p className="text-blue-600">5 H's</p>
                            <p>• Hipovolemia</p>
                            <p>• Hipoxia</p>
                            <p>• Hidrogeniones</p>
                            <p>• Hipo/Hiper K</p>
                            <p>• Hipotermia</p>
                         </div>
                         <div className="space-y-1">
                            <p className="text-rose-600">5 T's</p>
                            <p>• Tensión Neum.</p>
                            <p>• Taponamiento</p>
                            <p>• Tóxicos</p>
                            <p>• Tromb Pulm.</p>
                            <p>• Tromb Coro.</p>
                         </div>
                      </div>
                      <div className="mt-8 p-4 bg-blue-50 rounded-2xl">
                         <p className="text-[9px] font-black text-blue-600 uppercase text-center">🚨 VÍA AÉREA AVANZADA Y CAPNOGRAFÍA</p>
                      </div>
                   </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
