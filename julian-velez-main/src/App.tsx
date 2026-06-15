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
  Layers
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
  ServiceMapping
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
  limit
} from 'firebase/firestore';
import { 
  auth, 
  db, 
  handleFirestoreError, 
  OperationType 
} from './firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  signInAnonymously,
  signInWithCustomToken,
  User
} from 'firebase/auth';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import Markdown from 'react-markdown';
import { InductionManual } from './components/InductionManual';
import { AntibioticManual } from './components/AntibioticManual';
import { HumanResourcesView } from './components/HumanResourcesView';
import { ProductivityStatsView } from './components/ProductivityStatsView';

export default function App() {
  // View States
  const [isBooting, setIsBooting] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [session, setSession] = useState<UserSession | null>(null);
  
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
  const [activeTab, setActiveTab] = useState<'home' | 'turnos' | 'solicitudes' | 'novedades' | 'rural' | 'bd' | 'docs' | 'admin' | 'ayuda' | 'stats'>('turnos');
  
  // Date Selection
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [doctorFilter, setDoctorFilter] = useState<number[]>([]); 
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [roleSearch, setRoleSearch] = useState('');
  const [showRoleSelector, setShowRoleSelector] = useState(false);
  const [showCatSelector, setShowCatSelector] = useState(false);
  const [showGridHours, setShowGridHours] = useState(false);

  // Data States
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [variables, setVariables] = useState<VarSlotConfig>(DEFAULT_VARS);
  const [currentMonthData, setCurrentMonthData] = useState<MonthlyData>({});
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [shiftRequests, setShiftRequests] = useState<ShiftRequest[]>([]);
  const [ruralAvailabilities, setRuralAvailabilities] = useState<RuralAvailability[]>([]);
  const [availabilityCalls, setAvailabilityCalls] = useState<AvailabilityCall[]>([]);
  const [userNotifications, setUserNotifications] = useState<any[]>([]);
  const [notification, setNotification] = useState<{message: string, type: 'info' | 'success' | 'error'} | null>(null);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
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

  // -- Initialization & Firestore Sync --
  useEffect(() => {
    const savedSess = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (savedSess) setSession(JSON.parse(savedSess));

    // Test Connection
    const testConnection = async () => {
      try {
        const { doc, getDocFromCache, getDocFromServer } = await import('firebase/firestore');
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
        // If we want to bootstrap admin role for specific emails
        if (user.email === 'julive17@gmail.com' || user.email === 'coordinacionmedica@correohdsa.gov.co') {
           try {
             await setDoc(doc(db, 'admins', user.uid), { email: user.email, name: user.displayName || 'Coordinador Médico' });
             const sess: UserSession = { r: 'admin', n: user.displayName || 'Administrador' };
             setSession(sess);
             localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sess));
           } catch(e) {
             console.error("Error setting admin doc:", e);
           }
        } else {
          // Check if admin doc exists for this user
          try {
            const adminSnap = await getDocs(query(collection(db, 'admins'), where('email', '==', user.email)));
            if (!adminSnap.empty) {
              const sess: UserSession = { r: 'admin', n: user.displayName || 'Admin' };
              setSession(sess);
              localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sess));
            }
          } catch (err) {
            console.error("Admin check failed:", err);
          }
        }
      } else {
        // If no user, sign in anonymously to allow DB access without Google account
        // Note: This requires "Anonymous" to be enabled in the Firebase Console
        try {
          await signInAnonymously(auth);
        } catch (err: any) {
          if (err.code === 'auth/admin-restricted-operation') {
            console.warn("Anonymous auth is disabled in the console. Using read-only/offline mode if session exists.");
          } else {
            console.error("Anonymous auth error:", err);
          }
        }
      }
    });

    // Real-time Doctors (Public read allowed by rules)
    const unsubDocs = onSnapshot(collection(db, 'doctors'), (snap) => {
      const list = snap.docs.map(d => d.data() as Doctor);
      setDoctors(list);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'doctors'));

    // Audit Logs (Public read allowed)
    const qLogs = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(100));
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      const list = snap.docs.map(d => d.data() as AuditEntry);
      setAuditLogs(list);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'auditLogs'));

    // Shift Requests (Public read allowed)
    const unsubReqs = onSnapshot(collection(db, 'shiftRequests'), (snap) => {
      const list = snap.docs.map(d => d.data() as ShiftRequest);
      setShiftRequests(list);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'shiftRequests'));

    // Rural Availabilities (Public read allowed)
    const unsubRural = onSnapshot(collection(db, 'ruralAvailability'), (snap) => {
      const list = snap.docs.map(d => d.data() as RuralAvailability);
      setRuralAvailabilities(list);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'ruralAvailability'));

    // Availability Calls (Public read allowed)
    const qCalls = query(collection(db, 'availabilityCalls'), orderBy('timestamp', 'desc'), limit(50));
    const unsubCalls = onSnapshot(qCalls, (snap) => {
      const list = snap.docs.map(d => d.data() as AvailabilityCall);
      setAvailabilityCalls(list);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'availabilityCalls'));

    // Training Activities (Public read allowed)
    const unsubActivities = onSnapshot(collection(db, 'trainingActivities'), (snap) => {
      const list = snap.docs.map(d => d.data() as TrainingActivity);
      setActivities(list);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'trainingActivities'));

    // Global Settings (Published Status)
    const unsubPublished = onSnapshot(collection(db, 'monthlyData'), (snap) => {
      // Small metadata metadata
    }, (err) => {
       // Only log if it's NOT a permission denied during startup
       if (err.code !== 'permission-denied') {
          handleFirestoreError(err, OperationType.LIST, 'monthlyData');
       }
    });

    // Global Settings (Variables)
    const unsubVars = onSnapshot(doc(db, 'settings', 'variables'), (snap) => {
      let data: VarSlotConfig = { ...DEFAULT_VARS };
      if (snap.exists()) {
        const cloudData = snap.data() as VarSlotConfig;
        (['m', 't', 'n'] as SlotType[]).forEach(slot => {
          if (cloudData[slot]) {
            data[slot] = { ...data[slot], ...cloudData[slot] };
          }
        });
      }
      // Ensure L and CAP are always present with 0h (libre/training)
      (['m', 't', 'n'] as SlotType[]).forEach(slot => {
        if (!data[slot]) data[slot] = {};
        if (data[slot]['L'] === undefined) data[slot]['L'] = 0;
        if (data[slot]['CAP'] === undefined) data[slot]['CAP'] = 0;
      });
      setVariables(data);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'settings/variables'));

    // Theme
    const unsubTheme = onSnapshot(doc(db, 'settings', 'theme'), (snap) => {
      if (snap.exists()) {
        setTheme(snap.data() as any);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'settings/theme'));
    
    // Service Mappings (Public read)
    const unsubMappings = onSnapshot(doc(db, 'settings', 'serviceMappings'), (snap) => {
      if (snap.exists()) {
        setServiceMappings(snap.data().mappings || []);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'settings/serviceMappings'));

    setTimeout(() => setIsBooting(false), 1500);

    return () => {
      unsubAuth();
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
  }, []);

  // -- Monthly Data Sync --
  const [isMonthPublished, setIsMonthPublished] = useState(false);
  useEffect(() => {
    const monthKey = `${selectedYear}-${selectedMonth}`;
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
  }, [selectedMonth, selectedYear]);

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

  const updateMonthlyData = async (newData: MonthlyData) => {
    const monthKey = `${selectedYear}-${selectedMonth}`;
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
    const monthKey = `${selectedYear}-${selectedMonth}`;
    try {
      await setDoc(doc(db, 'monthlyData', monthKey, 'doctors', doctorId.toString()), data);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `monthlyData/${monthKey}/doctors/${doctorId}`);
    }
  };

  // -- Auth --
  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      setNotification({ message: "Sesión de Google iniciada", type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    } catch (err: any) {
      console.error("Google Login error:", err);
      if (err.code === 'auth/unauthorized-domain') {
        const currentDomain = window.location.hostname;
        setNotification({ 
          message: `⚠️ ERROR DE DOMINIO: ${currentDomain} no está autorizado en Firebase. Agrégalo en la Consola de Firebase.`, 
          type: 'error' 
        });
        alert(`⚠️ ERROR DE DOMINIO: \n\nEl dominio "${currentDomain}" no está en la lista blanca de Firebase.\n\nPara solucionar esto:\n1. Ve a la Consola de Firebase.\n2. Ve a Authentication > Settings > Authorized domains.\n3. Añade "${currentDomain}" a la lista.\n4. Recarga la página.`);
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
              alert(`⚠️ ERROR DE DOMINIO (Auth):\n\nEl dominio "${currentDomain}" debe ser autorizado en Firebase Console para habilitar la persistencia de sesión. \nSin esto, algunas funciones de la base de datos podrían fallar.`);
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

  const handleLogout = () => {
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
    const code = newVarCode.trim().toUpperCase(); // Normalize to uppercase
    
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
    
    // Ensure 'L' and 'CAP' are available
    ['m', 't', 'n'].forEach(s => {
      const slot = s as SlotType;
      if (!updated[slot]) updated[slot] = {};
      if (updated[slot]['L'] === undefined) updated[slot]['L'] = 0;
      if (updated[slot]['CAP'] === undefined) updated[slot]['CAP'] = 0;
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
    if (code === 'L' || code === 'CAP' || code === 'X') return alert("Esta sigla es reservada del sistema.");
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

  const downloadTemplateExcel = () => {
    const rows: any[] = [];
    const templateData = getFilteredTurneroData();
    
    templateData.forEach(({ med }) => {
      (['m', 't', 'n'] as SlotType[]).forEach((slot, sIdx) => {
        const rowData: any = {
          'MÉDICO': sIdx === 0 ? med.nombre : '',
          'JORNADA': slot === 'm' ? 'Mañana' : slot === 't' ? 'Tarde' : 'Noche',
        };
        for (let d = 1; d <= daysInMonth; d++) {
          const val = currentMonthData[med.id]?.[slot]?.[d] || 'X';
          rowData[d.toString()] = val !== 'X' ? val : '';
        }
        rowData['TOTAL HORAS'] = 0;
        rows.push(rowData);
      });
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Plantilla_${MONTH_NAMES[selectedMonth]}`);
    XLSX.writeFile(wb, `Plantilla_Turnos_${MONTH_NAMES[selectedMonth]}_${selectedYear}.xlsx`);
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const mainWs = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(mainWs) as any[];
      
      const newData = { ...currentMonthData };
      let lastDoctorId: number | null = null;
      let shiftsImported = 0;

      data.forEach(row => {
        const medNameRaw = row['MÉDICO'] || row['Medico'] || row['Médico'] || row['Nombre'] || row['Doctor'];
        const jornadaRaw = (row['JORNADA'] || row['Jornada'] || row['Slot'] || '').toString().trim().toLowerCase();

        if (medNameRaw) {
          const docMatch = doctors.find(d => d.nombre.toLowerCase().trim() === medNameRaw.toString().toLowerCase().trim());
          if (docMatch) {
            lastDoctorId = docMatch.id;
          } else {
            lastDoctorId = null;
          }
        }

        if (lastDoctorId !== null) {
          const slotMap: Record<string, SlotType> = {
            'mañana': 'm', 'm': 'm', 'jornada mañana': 'm',
            'tarde': 't', 't': 't', 'jornada tarde': 't',
            'noche': 'n', 'n': 'n', 'jornada noche': 'n'
          };
          const slot = slotMap[jornadaRaw] || (jornadaRaw.includes('mañ') ? 'm' : jornadaRaw.includes('tar') ? 't' : jornadaRaw.includes('noc') ? 'n' : null);
          
          if (slot) {
            if (!newData[lastDoctorId]) newData[lastDoctorId] = { m: {}, t: {}, n: {} };
            
            Object.keys(row).forEach(key => {
              const dayNum = parseInt(key);
              if (!isNaN(dayNum) && dayNum >= 1 && dayNum <= 31) {
                const siglaRaw = row[key];
                const sigla = siglaRaw ? siglaRaw.toString().toUpperCase().trim() : '';
                
                if (sigla && sigla !== 'X' && sigla !== '') {
                  newData[lastDoctorId!][slot][dayNum] = sigla;
                  shiftsImported++;
                } else if (sigla === '' || sigla === 'X') {
                  if (newData[lastDoctorId!][slot]) {
                    delete newData[lastDoctorId!][slot][dayNum];
                  }
                }
              }
            });

            // Fallback list format
            const listDay = parseInt(row['Día'] || row['Dia'] || row['DÍA'] || row['Day']);
            const listSigla = (row['Sigla'] || row['SIGLA'] || '').toString().trim().toUpperCase();
            if (!isNaN(listDay) && listSigla && listSigla !== 'X') {
               if (!newData[lastDoctorId]) newData[lastDoctorId] = { m: {}, t: {}, n: {} };
               newData[lastDoctorId][slot][listDay] = listSigla;
               shiftsImported++;
            }
          }
        }
      });

      const monthKey = `${selectedYear}-${selectedMonth}`;
      const savePromises = Object.keys(newData).map(drId => {
        const id = parseInt(drId);
        return setDoc(doc(db, 'monthlyData', monthKey, 'doctors', drId), newData[id]);
      });
      await Promise.all(savePromises);

      setCurrentMonthData(newData);
      setNotification({ message: `${shiftsImported} turnos importados satisfactoriamente`, type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      console.error(err);
      alert("Error al importar Excel. Use el formato de plantilla.");
    }
    e.target.value = '';
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

    const monthKey = `${selectedYear}-${selectedMonth}`;
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

  const getFilteredTurneroData = () => {
    return doctors.filter(d => 
      (selectedRoles.length === 0 || selectedRoles.includes(d.rol || 'Médico General')) &&
      (selectedCategories.length === 0 || selectedCategories.includes(d.cat)) &&
      (doctorFilter.length === 0 || doctorFilter.includes(d.id)) && 
      (d.st === 'activo' || (currentMonthData[d.id] && Object.values(currentMonthData[d.id]).some(f => Object.keys(f).length > 0)))
    ).map(med => {
      let medTotalMonth = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        (['m', 't', 'n'] as SlotType[]).forEach(slot => {
          const sigla = currentMonthData[med.id]?.[slot]?.[d] || 'X';
          medTotalMonth += variables[slot][sigla] || 0;
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
          rowData[d.toString()] = val !== 'X' ? (showGridHours ? (variables[slot][val] || 0) : val) : '';
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
          row.push(val !== 'X' ? (showGridHours ? `${variables[slot][val] || 0}` : val) : '');
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
  const cycleShift = async (doctorId: number, day: number, slot: SlotType) => {
    if (session?.r !== 'admin') return;

    // Use specific doctor data to prevent global overwrite collision
    const docShifts = currentMonthData[doctorId] ? { 
      m: { ...currentMonthData[doctorId].m }, 
      t: { ...currentMonthData[doctorId].t }, 
      n: { ...currentMonthData[doctorId].n } 
    } : { m: {}, t: {}, n: {} };
    
    // Cycle through available variables for that slot
    const slotVars = ['X', ...Object.keys(variables[slot])];
    const currentSigla = docShifts[slot][day] || 'X';
    const nextIdx = (slotVars.indexOf(currentSigla) + 1) % slotVars.length;
    const nextSigla = slotVars[nextIdx];

    const oldSigla = docShifts[slot][day] || 'X';
    docShifts[slot][day] = nextSigla;
    
    if (nextSigla === 'CAP') {
      const docData = doctors.find(d => d.id === doctorId);
      if (docData) {
        await pushNotification(doctorId, `CAPACITACIÓN: Día ${day}. Credenciales: ${docData.username}/${docData.password}.`);
      }
    }

    const m = docShifts.m[day] || 'X';
    const t = docShifts.t[day] || 'X';
    const n = docShifts.n[day] || 'X';
    const activeOnDay = [m, t, n].filter(v => v !== 'X' && v !== 'PT');
    
    if (nextSigla !== 'X' && nextSigla !== 'PT') {
      if (activeOnDay.length > 1) {
        setNotification({ message: `Nota: El médico ya tiene turno este día (${activeOnDay.join(', ')}).`, type: 'info' });
      }
    }

    const docData = doctors.find(d => d.id === doctorId);
    
    // Novelty logic: only active if month is published OR if we are in days 29, 30, 31 of any month
    const today = new Date();
    const currentDay = today.getDate();
    const isLateInMonth = currentDay >= 29;
    
    // If the month is already published, any change is a novelty.
    // If NOT published, it's only a novelty if it's the 29th, 30th or 31st.
    const isNovedad = isMonthPublished || isLateInMonth;

    try {
      if (isNovedad) {
        const logId = Date.now();
        const newLog: AuditEntry = {
          id: logId,
          timestamp: Date.now(),
          targetMonth: selectedMonth,
          targetYear: selectedYear,
          doctorId,
          doctorName: docData?.nombre || 'Desconocido',
          doctorContact: (docData?.email || docData?.telefono) ?? '',
          day,
          slot,
          oldSigla,
          newSigla: nextSigla,
          adminName: session?.n || 'Admin'
        };
        await setDoc(doc(db, 'auditLogs', logId.toString()), newLog);
      }
      
      // Automation
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
      // Error is likely already handled and reported by updateDoctorMonth or pushNotification
      console.error("CycleShift operation failed:", err);
    }
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
            if (sigla && sigla !== 'X' && sigla !== 'DESC' && sigla !== 'PT') {
              usedSlots++;
              const h = variables[slot as SlotType]?.[sigla] || 0;
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
        model: "gemini-3-flash-preview",
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
          if (sigla && sigla !== 'X' && sigla !== 'DESC' && sigla !== 'PT') {
            const h = variables[slot]?.[sigla] || 0;
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
            if (sigla && sigla !== 'X' && sigla !== 'DESC') {
              const h = variables[slot as SlotType]?.[sigla] || 0;
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
        model: "gemini-3-flash-preview",
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
      const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
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
            if (sigla && sigla !== 'X' && sigla !== 'DESC' && sigla !== 'PT') {
              const h = variables[slot][sigla] || 0;
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
        model: "gemini-3.1-pro-preview", // Use Pro for more complex analysis
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
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

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
        ].filter(x => x.v !== 'X' && x.v !== 'PT');

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
        if (n !== 'X' && n !== 'PT' && d < daysInMonth) {
          const nextM = currentMonthData[doc.id]?.m?.[d + 1] || 'X';
          if (nextM !== 'X' && nextM !== 'PT') {
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
          if (!assigned.includes(sigla)) {
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
            total += variables[slot][sigla] || 0;
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
        <h1 className="font-bold text-3xl text-emerald-700 tracking-widest uppercase">COORDINACION MEDICA HDSAR</h1>
        <p className="text-xs text-emerald-600/60 mt-2 font-mono">CONSOLIDACIÓN TOTAL V27.0 - REACT</p>
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
          <h2 className="text-2xl font-bold text-emerald-700 mb-8 uppercase tracking-widest">COORDINACION MEDICA HDSAR</h2>
          
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
              href="https://chat.whatsapp.com/DnNKSmFF0EJFiOY8tuRvrt?mode=gi_t" 
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
              <h2 className="text-3xl font-black text-slate-800">Bienvenido, {session.n}</h2>
              
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

                  {/* EMERGENCY BUTTONS */}
                  {canSeeCodigoRojo && (
                    <button 
                      onClick={() => setShowCodigoRojo(true)}
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
                      onClick={() => setShowCodigoAzul(true)}
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

              {/* Selectors */}
              <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-2xl border border-slate-200 no-print shadow-sm">
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
                
                <div className="overflow-x-auto border border-slate-200 rounded-[18px] bg-white shadow-xl overflow-y-hidden custom-scrollbar">
                  <table className="w-full text-[10px] text-center border-collapse">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="sticky left-0 bg-slate-50 z-30 min-w-[120px] md:min-w-[160px] text-left px-3 md:px-4 py-4 text-sky-700 border-r-2 border-sky-500 border-b border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                          TALENTO HUMANO
                        </th>
                      <th className="w-8 border border-slate-200 text-slate-400 font-black border-b">J.</th>
                      {Array.from({ length: daysInMonth }, (_, i) => {
                        const day = i + 1;
                        const dow = new Date(selectedYear, selectedMonth, day).getDay();
                        return (
                          <th key={day} className={`px-2 py-2 border border-slate-200 border-b ${dow === 0 ? 'border-r-2 border-r-sky-500' : ''}`}>
                            <div className="text-slate-800 text-[11px] font-bold">{day}</div>
                            <div className="text-[8px] text-emerald-600 uppercase font-bold">{DAY_NAMES[dow]}</div>
                          </th>
                        );
                      })}
                      {sundays.map((_, i) => (
                        <th key={i} className="min-w-[40px] px-2 bg-slate-100 border border-slate-200 border-b text-[8px] text-sky-600 font-bold">
                          S{i + 1}
                        </th>
                      ))}
                      <th className="sticky right-0 z-30 bg-sky-500 text-white font-black px-4 min-w-[60px] border-b border-slate-200 shadow-[-2px_0_5px_rgba(0,0,0,0.1)]">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doctors.filter(d => 
                      (selectedRoles.length === 0 || selectedRoles.includes(d.rol || 'Médico General')) &&
                      (selectedCategories.length === 0 || selectedCategories.includes(d.cat)) &&
                      (doctorFilter.length === 0 || doctorFilter.includes(d.id)) && 
                      (d.st === 'activo' || (currentMonthData[d.id] && Object.values(currentMonthData[d.id]).some(f => Object.keys(f).length > 0)))
                    ).map(med => {
                      // Calculate Doctor Totals
                      let medTotalMonth = 0;
                      let weeklyAcc = Array(sundays.length).fill(0);

                      for (let d = 1; d <= daysInMonth; d++) {
                        (['m', 't', 'n'] as SlotType[]).forEach(slot => {
                          const sigla = currentMonthData[med.id]?.[slot]?.[d] || 'X';
                          const peso = variables[slot][sigla] || 0;
                          medTotalMonth += peso;
                          const wIdx = sundays.findIndex(sunD => d <= sunD);
                          if (wIdx !== -1) weeklyAcc[wIdx] += peso;
                        });
                      }

                      return (['m', 't', 'n'] as SlotType[]).map((slot, sIdx) => (
                        <tr key={`${med.id}-${slot}`} className={`group hover:bg-slate-50 transition-colors ${sIdx === 2 ? 'border-b-4 border-slate-200' : ''}`}>
                          {sIdx === 0 && (
                            <td rowSpan={3} className="sticky left-0 bg-white z-20 text-left px-4 border-r-2 border-sky-500 border-b border-slate-200 shadow-xl group-hover:bg-slate-50">
                              <div className="font-bold text-slate-800 text-xs whitespace-nowrap">{med.nombre}</div>
                              <div className="text-[9px] text-slate-400 font-mono">{med.cat}</div>
                            </td>
                          )}
                          <td className="sticky left-[120px] md:left-[160px] z-20 slot-label bg-slate-50 text-slate-400 font-black text-[8px] py-2 border-r border-slate-200 uppercase shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                            {slot === 'm' ? 'Mañana' : slot === 't' ? 'Tarde' : 'Noche'}
                          </td>
                          {Array.from({ length: daysInMonth }, (_, i) => {
                            const d = i + 1;
                            const dow = new Date(selectedYear, selectedMonth, d).getDay();
                            const val = currentMonthData[med.id]?.[slot]?.[d] || 'X';
                            const isPT = val === 'PT';
                            const isShift = val !== 'X';
                            
                            const cellConflicts = conflicts.personal[`${med.id}-${d}-${slot}`] || [];
                            const hasConflict = cellConflicts.length > 0;
                            
                            return (
                              <td 
                                key={d}
                                onClick={() => isAdminUser && cycleShift(med.id, d, slot)}
                                title={cellConflicts.map(c => c.message).join('\n')}
                                className={`
                                  border border-slate-200 py-2 cursor-pointer
                                  transition-all duration-150 relative
                                  ${dow === 0 ? 'border-r-2 border-r-sky-500' : ''}
                                  ${!isShift ? 'opacity-10 text-slate-400 scale-90' : 'scale-100'}
                                  ${isPT ? 'text-amber-600 font-black' : 'text-slate-800 font-medium'}
                                  ${hasConflict ? 'bg-rose-50 text-rose-600' : ''}
                                `}
                              >
                                {isShift ? (showGridHours ? `${variables[slot][val] || 0}` : val) : ''}
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
                 <div className="flex items-center gap-1 ml-auto text-amber-400"><span className="w-2 h-2 bg-amber-400 rounded-full"></span> PT: Post-Turno Automático</div>
              </div>
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
                           <button 
                             onClick={() => pushNotification(log.doctorId, `🔔 NOVEDAD INDIVIDUAL: Día ${log.day} (${log.slot.toUpperCase()}) cambio a ${log.newSigla}. Por favor verifique.`)}
                             className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all group/note"
                             title="Notificar inmediatamente a este médico"
                           >
                             <Send className="w-4 h-4 group-hover/note:translate-x-1 transition-transform" />
                           </button>
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
              />
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
              {/* Variable Management */}
              <div className="bg-white rounded-[32px] p-8 border border-emerald-100 shadow-xl">
                 <h3 className="text-xl font-bold text-emerald-700 mb-6 flex items-center gap-2">
                    <Settings className="w-6 h-6" /> Gestión de Siglas Horarias
                 </h3>
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
                          {Object.entries(variables[slot]).map(([k, v]) => (
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

              {/* Staff Management */}
              <div className="bg-white rounded-[32px] p-8 border border-emerald-100 shadow-xl">
                 <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                    <h3 className="text-xl font-bold text-emerald-700 flex items-center gap-2">
                        <UserPlus className="w-6 h-6" /> Nómina Médica
                    </h3>
                    <div className="flex gap-2">
                        <button 
                          onClick={downloadTemplateExcel}
                          className="bg-stone-50 text-slate-600 border border-slate-200 px-4 py-2 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 hover:bg-slate-100 transition-all shadow-sm"
                        >
                           <FileDown className="w-4 h-4" /> Plantilla
                        </button>
                        <label className="cursor-pointer bg-blue-50 text-blue-700 border border-blue-200 px-4 py-2 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 hover:bg-blue-600 hover:text-white transition-all shadow-sm">
                           <FileSpreadsheet className="w-4 h-4" /> Importar Turnos
                           <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportExcel} />
                        </label>
                     </div>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    <button 
                      onClick={assignFreeDaysToPlanta}
                      className="bg-emerald-50 text-emerald-700 border border-emerald-100 p-4 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                    >
                      <Clock className="w-4 h-4" /> Asignar Día Libre Semanal (Planta)
                    </button>
                    <button 
                      onClick={() => setShowActivitiesModal(true)}
                      className="bg-amber-50 text-amber-700 border border-amber-100 p-4 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 hover:bg-amber-600 hover:text-white transition-all shadow-sm"
                    >
                      <Calendar className="w-4 h-4" /> PIC (Capacitaciones)
                    </button>
                 </div>
                 
                 <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 mb-8 bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100">
                    <input 
                      className="bg-white border border-emerald-100 p-4 rounded-xl outline-none focus:border-emerald-500 font-bold" 
                      placeholder="Nombre Completo"
                      value={newDocName}
                      onChange={(e) => setNewDocName(e.target.value)}
                    />
                    <input 
                      className="bg-white border border-emerald-100 p-4 rounded-xl outline-none focus:border-emerald-500 font-bold" 
                      placeholder="Email de Notificación"
                      type="email"
                      value={newDocEmail}
                      onChange={(e) => setNewDocEmail(e.target.value)}
                    />
                    <input 
                      className="bg-white border border-emerald-100 p-4 rounded-xl outline-none focus:border-emerald-500 font-bold" 
                      placeholder="WhatsApp / Contacto"
                      value={newDocContact}
                      onChange={(e) => setNewDocContact(e.target.value)}
                    />
                    <select 
                      className="bg-white border border-emerald-100 p-4 rounded-xl outline-none font-bold"
                      value={newDocCat}
                      onChange={(e) => setNewDocCat(e.target.value as any)}
                    >
                      <option value="Planta">PLANTA</option>
                      <option value="CTA">CTA</option>
                      <option value="APS">APS</option>
                      <option value="Rural">RURAL</option>
                      <option value="Disponibilidad">DISPONIBILIDAD</option>
                    </select>
                    <select 
                      className="bg-white border border-emerald-100 p-4 rounded-xl outline-none font-bold"
                      value={newDocRol}
                      onChange={(e) => setNewDocRol(e.target.value as any)}
                    >
                      <option value="Médico General">Médico General</option>
                      <option value="Médico Especialista">Médico Especialista</option>
                      <option value="Médico Rural">Médico Rural</option>
                      <option value="Enfermero Jefe">Enfermera(o) Jefe</option>
                      <option value="Auxiliar Enfermería">Auxiliar de Enf.</option>
                      <option value="Interno">Médico Interno</option>
                      <option value="Triage">Triage / Urgencias</option>
                      <option value="Laboratorio">Laboratorio</option>
                      <option value="Odontólogo">Odontólogo</option>
                      <option value="Fisioterapeuta">Fisioterapeuta</option>
                      <option value="Rayos X">Rayos X</option>
                    </select>
                    <button 
                      onClick={addDoctor}
                      className="bg-emerald-700 text-white font-black rounded-xl hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-emerald-700/20 col-span-1 sm:col-span-5 py-4"
                    >
                      AÑADIR AL EQUIPO MÉDICO
                    </button>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                   {doctors.map(doc => (
                     <div key={doc.id} className={`p-4 rounded-2xl border transition-all ${doc.st === 'activo' ? 'bg-stone-50 border-emerald-100 shadow-sm' : 'bg-rose-50 border-rose-100 opacity-50'}`}>
                        <div className="flex justify-between items-start mb-2">
                           <div>
                              <div className="font-bold text-slate-800 leading-tight">{doc.nombre}</div>
                              <div className="flex items-center gap-2">
                                <div className="text-[10px] text-emerald-600 uppercase font-black">{doc.cat}</div>
                                <div className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 rounded uppercase font-bold">{doc.rol || 'Médico'}</div>
                                {doc.email && <div className="text-[9px] text-slate-400 italic">({doc.email})</div>}
                              </div>
                              <div className="text-[9px] text-slate-400 font-mono mt-1">
                                Cédula: <span className="font-bold">{doc.cedula || 'N/A'}</span> | RM: <span className="font-bold">{doc.registroMedico || 'N/A'}</span>
                              </div>
                              <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                                User: <span className="text-emerald-700 font-bold">{doc.username}</span> | Pass: <span className="text-emerald-700 font-bold">{doc.password}</span>
                              </div>
                           </div>
                           <div className="flex gap-2">
                              <button 
                                onClick={() => setEditingDoc(doc)}
                                className="p-2 rounded-lg border bg-white border-emerald-100 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                title="Editar Médico"
                              >
                                <Wand2 className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => resetDoctorPass(doc.id)}
                                className="p-2 rounded-lg border bg-white border-amber-100 text-amber-600 hover:bg-amber-500 hover:text-white transition-all shadow-sm"
                                title="Restablecer Contraseña"
                              >
                                <Save className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => toggleDoctorStatus(doc.id)}
                                className={`p-2 rounded-lg border transition-all shadow-sm ${doc.st === 'activo' ? 'bg-white border-emerald-500 text-emerald-600 hover:bg-emerald-500 hover:text-white' : 'bg-white border-amber-500 text-amber-600 hover:bg-amber-500 hover:text-white'}`}
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => deleteDoctor(doc.id)}
                                className="p-2 rounded-lg border bg-white border-rose-100 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                           </div>
                        </div>
                        <div className="text-[9px] font-mono text-slate-300">UID: {doc.id}</div>
                     </div>
                   ))}
                 </div>
              </div>

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
              </div>

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
          { id: 'solicitudes', icon: Send, label: 'Solicitudes' },
          { id: 'rural', icon: MapPin, label: 'Rural' },
          { id: 'novedades', icon: ClipboardList, label: 'Novedades' },
          ...(session.r === 'admin' ? [{ id: 'admin', icon: Settings, label: 'Admin' }] : [])
        ].map(btn => (
          <button
            key={btn.id}
            onClick={() => setActiveTab(btn.id as any)}
            className={`flex flex-col items-center justify-center p-2 md:p-3 rounded-2xl flex-1 md:w-24 transition-all ${
              activeTab === btn.id ? 'text-white bg-emerald-600 shadow-lg' : 'text-slate-400 hover:text-emerald-600'
            }`}
          >
            <btn.icon className="w-5 h-5 md:w-6 md:h-6 mb-0.5 md:mb-1" />
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
            <h2 className="text-2xl font-black text-slate-800 mb-6 uppercase tracking-tight">Editar Médico</h2>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto px-2 custom-scrollbar">
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
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-black ml-2 mb-1 block">Contraseña</label>
                <input 
                  className="w-full bg-stone-50 border border-emerald-100 p-4 rounded-xl text-slate-800 outline-none focus:border-emerald-500 font-bold"
                  value={editingDoc.password}
                  onChange={e => setEditingDoc({...editingDoc, password: e.target.value})}
                  placeholder="Contraseña"
                />
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
              <button onClick={() => setShowCodigoRojo(false)} className="absolute top-6 right-6 p-2 bg-rose-50 rounded-full text-rose-400 hover:text-rose-600 transition-colors z-30">
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
              <button onClick={() => setShowCodigoAzul(false)} className="absolute top-6 right-6 p-2 bg-blue-50 rounded-full text-blue-400 hover:text-blue-600 transition-colors z-30">
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
