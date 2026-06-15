import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  Doctor,
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
  RegistrationRequest,
  DoctorRole
} from '../types';
import { MASTER_ADMIN, MASTER_READER, DEFAULT_VARS, MONTH_NAMES, STORAGE_KEYS, DEFAULT_ROLE_PERMISSIONS } from '../constants';
import {
  collection,
  onSnapshot,
  setDoc,
  doc,
  query,
  where,
  getDocs,
  getDoc,
  deleteDoc,
  updateDoc,
  orderBy,
  limit
} from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  firebaseConfig
} from '../firebase';
import {
  signInWithPopup,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signOut,
  User
} from 'firebase/auth';

// ─── Notification Type ──────────────────────────────────────
export interface AppNotification {
  message: string;
  type: 'success' | 'error' | 'info';
}

// ─── Context Shape ──────────────────────────────────────────
interface AppContextType {
  // Session
  session: UserSession | null;
  setSession: React.Dispatch<React.SetStateAction<UserSession | null>>;
  fbUser: User | null | undefined;
  isBooting: boolean;
  isOnline: boolean;
  isFirebaseUnauthenticatedAdmin: boolean;

  // Data
  doctors: Doctor[];
  variables: VarSlotConfig;
  setVariables: React.Dispatch<React.SetStateAction<VarSlotConfig>>;
  currentMonthData: MonthlyData;
  setCurrentMonthData: React.Dispatch<React.SetStateAction<MonthlyData>>;
  auditLogs: AuditEntry[];
  shiftRequests: ShiftRequest[];
  ruralAvailabilities: RuralAvailability[];
  availabilityCalls: AvailabilityCall[];
  activities: TrainingActivity[];
  serviceMappings: ServiceMapping[];
  setServiceMappings: React.Dispatch<React.SetStateAction<ServiceMapping[]>>;
  evaluations: Record<string, any>;
  saveEvaluation: (evalData: any) => Promise<void>;
  userNotifications: { id: string; message: string; timestamp: number; read: boolean }[];
  isMonthPublished: boolean;

  // Date
  selectedMonth: number;
  setSelectedMonth: React.Dispatch<React.SetStateAction<number>>;
  selectedYear: number;
  setSelectedYear: React.Dispatch<React.SetStateAction<number>>;
  daysInMonth: number;

  // UI Notification
  notification: AppNotification | null;
  setNotification: React.Dispatch<React.SetStateAction<AppNotification | null>>;
  notify: (message: string, type: AppNotification['type']) => void;

  // Theme
  theme: { primary: string; font: string };
  setTheme: React.Dispatch<React.SetStateAction<{ primary: string; font: string }>>;
  updateTheme: (newTheme: { primary: string; font: string }) => Promise<void>;

  // Tab
  activeTab: string;
  setActiveTab: React.Dispatch<React.SetStateAction<string>>;

  // Auth actions
  handleLogin: (loginU: string, loginP: string) => Promise<void>;
  handleGoogleLogin: () => Promise<void>;
  handleLogout: () => void;

  // Data actions
  pushNotification: (doctorId: number, message: string) => Promise<void>;
  markNotificationRead: (notifId: string) => void;
  updateDoctorMonth: (doctorId: number, shifts: DoctorShifts) => Promise<void>;
  updateMonthlyData: (data: MonthlyData) => Promise<void>;

  // Doctor CRUD
  saveEditedDoctor: (doctor: Doctor) => Promise<void>;
  toggleDoctorStatus: (id: number, status: 'activo' | 'inactivo') => Promise<void>;
  deleteDoctor: (id: number) => Promise<void>;
  resetDoctorPass: (id: number) => Promise<void>;
  changePassword: (doctorId: number, oldPass: string, newPass: string) => Promise<void>;
  saveDoctorOrder: (orderedIds: number[]) => Promise<void>;

  // Variables
  addVariable: (slot: SlotType, code: string, hours: number) => Promise<void>;
  removeVariable: (slot: SlotType, code: string) => Promise<void>;

  // Activities
  addActivity: (activity: Partial<TrainingActivity>) => Promise<void>;
  deleteActivity: (id: string) => Promise<void>;

  // Service Mappings
  saveServiceMappings: (mappings: ServiceMapping[]) => Promise<void>;

  // Registration Requests
  registrationRequests: RegistrationRequest[];
  approveRegistration: (requestId: string, assignedRol: string, assignedCat: string) => Promise<{ username: string; password: string } | undefined>;
  rejectRegistration: (requestId: string, reason: string) => Promise<void>;

  // Shift Requests
  submitShiftRequest: (day: number, slot: SlotType, reason: string) => Promise<void>;
  updateRequestStatus: (id: number, status: 'approved' | 'rejected') => Promise<void>;

  // AI state
  isGeneratingAI: boolean;
  setIsGeneratingAI: React.Dispatch<React.SetStateAction<boolean>>;
  aiReport: string | null;
  setAiReport: React.Dispatch<React.SetStateAction<string | null>>;

  // Idle
  idleTimeout: number;
  setIdleTimeout: React.Dispatch<React.SetStateAction<number>>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}

// ─── Provider ───────────────────────────────────────────────
export function AppProvider({ children }: { children: React.ReactNode }) {
  // Boot & connectivity
  const [isBooting, setIsBooting] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Session
  const [session, setSession] = useState<UserSession | null>(null);
  const [fbUser, setFbUser] = useState<User | null | undefined>(undefined);

  // Date
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

  // UI
  const [activeTab, setActiveTab] = useState<string>('turnos');
  const [notification, setNotification] = useState<AppNotification | null>(null);
  const [theme, setTheme] = useState({ primary: '#059669', font: 'sans' });

  // Data
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [variables, setVariables] = useState<VarSlotConfig>(DEFAULT_VARS);
  const [currentMonthData, setCurrentMonthData] = useState<MonthlyData>({});
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [shiftRequests, setShiftRequests] = useState<ShiftRequest[]>([]);
  const [ruralAvailabilities, setRuralAvailabilities] = useState<RuralAvailability[]>([]);
  const [availabilityCalls, setAvailabilityCalls] = useState<AvailabilityCall[]>([]);
  const [activities, setActivities] = useState<TrainingActivity[]>([]);
  const [serviceMappings, setServiceMappings] = useState<ServiceMapping[]>([]);
  const [userNotifications, setUserNotifications] = useState<{ id: string; message: string; timestamp: number; read: boolean }[]>([]);
  const [evaluations, setEvaluations] = useState<Record<string, any>>({});
  const [registrationRequests, setRegistrationRequests] = useState<RegistrationRequest[]>([]);
  const [isMonthPublished, setIsMonthPublished] = useState(false);

  // AI
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);

  // Idle
  const [idleTimeout, setIdleTimeout] = useState(() => {
    const stored = localStorage.getItem('idleTimeout');
    return stored ? Number(stored) : 15;
  });

  const isFirebaseUnauthenticatedAdmin = session?.r === 'admin' && (!fbUser || fbUser.isAnonymous);

  // ── Notify helper ──
  const notify = useCallback((message: string, type: AppNotification['type']) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // ── Boot timer ──
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (stored) {
      try { setSession(JSON.parse(stored)); } catch { /* ignore */ }
    }
    const timer = setTimeout(() => setIsBooting(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  // ── Admin email list ──
  const ADMIN_EMAILS = ['julive17@gmail.com', 'coordinacionmedica@correohdsa.gov.co'];

  // ── Firebase Auth listener ──
  const reauthAttempted = React.useRef(false);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user && !reauthAttempted.current) {
        // Re-authenticate if session exists but Firebase has no user (once only)
        reauthAttempted.current = true;
        const stored = localStorage.getItem(STORAGE_KEYS.SESSION);
        if (stored) {
          try {
            const anonResult = await signInAnonymously(auth);
            const storedSession = JSON.parse(stored) as UserSession;
            // If it's an admin session, create the admin doc and wait for it
            if ((storedSession.r === 'admin' || storedSession.r === 'root') && anonResult.user?.uid) {
              await setDoc(doc(db, 'admins', anonResult.user.uid), { role: 'admin', createdAt: Date.now() }, { merge: true });
              // Now safe to set fbUser - admin doc exists
              setFbUser(anonResult.user);
            } else {
              // Not admin, safe to set user
              setFbUser(anonResult.user);
            }
          } catch { 
            setFbUser(null);
          }
        } else {
          setFbUser(null); // No stored session, no user
        }
      } else if (user && user.isAnonymous) {
        // If anonymous user is already signed in and we have an admin session, ensure /admins/ entry exists
        const stored = localStorage.getItem(STORAGE_KEYS.SESSION);
        if (stored) {
          try {
            const storedSession = JSON.parse(stored) as UserSession;
            if (storedSession.r === 'admin' || storedSession.r === 'root') {
              // Check if admin doc exists, if not create it and WAIT for confirmation
              const adminDoc = await getDoc(doc(db, 'admins', user.uid));
              if (!adminDoc.exists()) {
                await setDoc(doc(db, 'admins', user.uid), { role: 'admin', createdAt: Date.now() }, { merge: true });
                // Double-check it was created
                await getDoc(doc(db, 'admins', user.uid));
              }
            }
          } catch (err) {
            console.error('Error ensuring admin doc:', err);
          }
        }
        setFbUser(user);
      } else {
        // User is not anonymous or no special handling needed
        setFbUser(user);
      }
    });
    // Handle Google redirect result — detect admin by email
    getRedirectResult(auth).then((result) => {
      if (result?.user?.email) {
        const email = result.user.email;
        if (ADMIN_EMAILS.includes(email)) {
          const sess: UserSession = { r: 'admin', n: result.user.displayName || email };
          setSession(sess);
          localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sess));
        }
      }
    }).catch((err) => {
      console.error('Google redirect error:', err);
    });
    return unsub;
  }, []);

  // ── Firestore listeners (wait for auth to resolve before subscribing) ──
  useEffect(() => {
    if (!fbUser) return; // Wait for auth to be ready (not undefined, not null)
    
    const unsubs: (() => void)[] = [];
    
    // Helper to check if admin doc exists before subscribing to admin-only collections
    const waitForAdminDoc = async () => {
      if (!fbUser || !session || session.r !== 'admin') return true; // Not admin, no need to wait
      
      // Wait up to 5 seconds for the admin doc to exist
      for (let i = 0; i < 50; i++) {
        const adminDoc = await getDoc(doc(db, 'admins', fbUser.uid));
        if (adminDoc.exists()) return true;
        await new Promise(r => setTimeout(r, 100)); // Wait 100ms
      }
      console.warn('Admin document not found after 5 seconds');
      return false;
    };

    const setupListeners = async () => {
      await waitForAdminDoc();

      // Doctors (any signed-in user)
      unsubs.push(
        onSnapshot(collection(db, 'doctors'), (snap) => {
          const docs = snap.docs.map(d => ({ id: Number(d.id), ...d.data() } as Doctor));
          // Ordenar por sortOrder (si no existe, va al final)
          setDoctors(docs.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999)));
        }, (err) => console.error('Doctors listener error:', err))
      );

      // Variables (any signed-in user)
      unsubs.push(
        onSnapshot(doc(db, 'settings', 'variables'), (snap) => {
          if (snap.exists()) setVariables(snap.data() as VarSlotConfig);
        }, (err) => console.error('Variables listener error:', err))
      );

      // Audit logs (any signed-in user)
      unsubs.push(
        onSnapshot(collection(db, 'auditLogs'), (snap) => {
          setAuditLogs(snap.docs.map(d => d.data() as AuditEntry).sort((a, b) => b.timestamp - a.timestamp));
        }, (err) => console.error('AuditLogs listener error:', err))
      );

      // Shift requests
      unsubs.push(
        onSnapshot(collection(db, 'shiftRequests'), (snap) => {
          setShiftRequests(snap.docs.map(d => d.data() as ShiftRequest).sort((a, b) => b.timestamp - a.timestamp));
        }, (err) => console.error('ShiftRequests listener error:', err))
      );

      // Rural availability
      unsubs.push(
        onSnapshot(collection(db, 'ruralAvailability'), (snap) => {
          setRuralAvailabilities(snap.docs.map(d => d.data() as RuralAvailability));
        }, (err) => console.error('RuralAvailability listener error:', err))
      );

      // Availability calls
      unsubs.push(
        onSnapshot(collection(db, 'availabilityCalls'), (snap) => {
          setAvailabilityCalls(snap.docs.map(d => d.data() as AvailabilityCall).sort((a, b) => b.timestamp - a.timestamp));
        }, (err) => console.error('AvailabilityCalls listener error:', err))
      );

      // Training activities
      unsubs.push(
        onSnapshot(collection(db, 'trainingActivities'), (snap) => {
          setActivities(snap.docs.map(d => d.data() as TrainingActivity));
        }, (err) => console.error('TrainingActivities listener error:', err))
      );

      // Theme
      unsubs.push(
        onSnapshot(doc(db, 'settings', 'theme'), (snap) => {
          if (snap.exists()) setTheme(snap.data() as any);
        }, (err) => console.error('Theme listener error:', err))
      );

      // Service Mappings
      unsubs.push(
        onSnapshot(doc(db, 'settings', 'serviceMappings'), (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data?.mappings) setServiceMappings(data.mappings);
          }
        }, (err) => console.error('ServiceMappings listener error:', err))
      );

      // Evaluations listener
      unsubs.push(
        onSnapshot(collection(db, 'evaluations'), (snap) => {
          const evals: Record<string, any> = {};
          snap.docs.forEach(d => { evals[d.id] = d.data(); });
          setEvaluations(evals);
        }, (err) => console.error('Evaluations listener error:', err))
      );

      // Registration Requests — admin-only (rules reject non-admins)
      if (session?.r === 'admin') {
        unsubs.push(
          onSnapshot(collection(db, 'registrationRequests'), (snap) => {
            setRegistrationRequests(
              snap.docs.map(d => d.data() as RegistrationRequest)
                .sort((a, b) => b.createdAt - a.createdAt)
            );
          }, (err) => {
            if (err?.code === 'permission-denied') return; // Expected for non-admins
            console.error('RegistrationRequests listener error:', err);
          })
        );
      }
    };

    setupListeners();

    return () => unsubs.forEach(u => u());
  }, [fbUser, session]);

  // ── Monthly data listener ──
  useEffect(() => {
    if (fbUser === undefined) return; // auth not resolved yet
    // Reset data immediately on month/year change so counters start at 0
    setCurrentMonthData({});
    setIsMonthPublished(false);

    if (!fbUser) return;

    const monthKey = `${selectedYear}_${selectedMonth}`;

    const unsubMeta = onSnapshot(
      doc(db, 'monthlyData', monthKey),
      (snap) => {
        if (snap.exists()) {
          setIsMonthPublished(!!snap.data()?.published);
        } else {
          setIsMonthPublished(false);
        }
      },
      (err) => console.error('monthlyData meta listener error:', err)
    );

    const unsubDocs = onSnapshot(
      collection(db, 'monthlyData', monthKey, 'doctors'),
      (snap) => {
        const data: MonthlyData = {};
        snap.docs.forEach(d => {
          data[Number(d.id)] = d.data() as DoctorShifts;
        });
        setCurrentMonthData(data);
      },
      (err) => console.error('monthlyData doctors listener error:', err)
    );

    return () => { unsubMeta(); unsubDocs(); };
  }, [selectedMonth, selectedYear, fbUser]);

  // ── Notifications listener ──
  useEffect(() => {
    if (!session?.doctorId || !fbUser) { setUserNotifications([]); return; }
    const q = query(
      collection(db, 'notifications'),
      where('doctorId', '==', session.doctorId),
      where('read', '==', false)
    );
    const unsub = onSnapshot(
      q,
      (snap) => { setUserNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as any))); },
      (err) => console.error('Notifications listener error:', err)
    );
    return unsub;
  }, [session?.doctorId, fbUser]);

  // ── Idle timeout logic ──
  useEffect(() => {
    if (!session) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        handleLogout();
        notify('Sesión cerrada por inactividad', 'info');
      }, idleTimeout * 60 * 1000);
    };
    const events = ['mousemove', 'keydown', 'click', 'touchstart'];
    events.forEach(e => window.addEventListener(e, reset));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [session, idleTimeout]);

  // ── Actions ──
  const handleLogin = useCallback(async (loginU: string, loginP: string) => {
    // Admin login — credentials only, Firebase anonymous auth
    if (loginU === MASTER_ADMIN.u && loginP === MASTER_ADMIN.p) {
      try {
        const anonResult = await signInAnonymously(auth);
        // Register the anonymous UID in /admins/ so Firestore isAdmin() rules pass
        // This MUST succeed before setting session so listeners don't fire without admin doc
        if (anonResult.user?.uid) {
          await setDoc(doc(db, 'admins', anonResult.user.uid), { role: 'admin', createdAt: Date.now() }, { merge: true });
          // Verify the doc was written before proceeding
          const adminDoc = await getDoc(doc(db, 'admins', anonResult.user.uid));
          if (!adminDoc.exists()) throw new Error('Admin doc not created');
        }
      } catch (err) {
        console.error('Error creating admin document:', err);
        alert('Error al iniciar sesión. No se pudo registrar el administrador en Firestore.');
        return;
      }
      const sess: UserSession = { r: 'admin', n: 'Admin General' };
      setSession(sess);
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sess));
      return;
    }
    // Reader login
    if (loginU === MASTER_READER.u) {
      try { await signInAnonymously(auth); } catch { /* optional */ }
      const sess: UserSession = { r: 'read', n: 'Personal Invitado' };
      setSession(sess);
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sess));
      return;
    }
    // Doctor login — client-side validation against Firestore
    try {
      // Ensure anonymous auth is established before querying Firestore
      if (!auth.currentUser) {
        try {
          await signInAnonymously(auth);
        } catch (authErr) {
          console.error('Anonymous auth failed:', authErr);
          alert('Error de autenticación. Por favor recargue la página e intente de nuevo.');
          return;
        }
      }

      // Wait a moment for auth to propagate
      await new Promise(resolve => setTimeout(resolve, 500));

      const q = query(collection(db, 'doctors'), where('username', '==', loginU));
      const snap = await getDocs(q);
      if (snap.empty) { alert('Credenciales inválidas.'); return; }
      const docData = snap.docs[0].data() as Doctor;
      if (docData.password !== loginP) { alert('Contraseña incorrecta.'); return; }
      // Check password expiry
      const expiryDays = 90;
      const lastChanged = docData.passwordLastChanged || 0;
      const daysSince = (Date.now() - lastChanged) / (1000 * 60 * 60 * 24);
      if (daysSince > expiryDays) {
        alert('Su contraseña ha expirado (vence cada 3 meses). Por favor cámbiela.');
      }
      const prefix = docData.genero === 'F' ? 'Dra.' : 'Dr.';
      // Normalizar nombre a formato título (primera letra mayúscula, resto minúsculas)
      const normalizeName = (name: string) => {
        return name
          .toLowerCase()
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      };
      const normalizedNombre = normalizeName(docData.nombre);
      const sess: UserSession = { r: 'doctor', n: `${prefix} ${normalizedNombre}`, doctorId: docData.id };
      setSession(sess);
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sess));
    } catch (err) {
      console.error('Login error:', err);
      alert('Error al iniciar sesión. Verifique su conexión e intente de nuevo.');
    }
  }, []);

  const handleGoogleLogin = useCallback(async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      if (result?.user?.email) {
        const email = result.user.email;
        if (ADMIN_EMAILS.includes(email)) {
          // Normalizar nombre a formato título (primera letra mayúscula, resto minúsculas)
          const normalizeName = (name: string) => {
            return name
              .toLowerCase()
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
          };
          const displayName = result.user.displayName || email;
          const normalizedDisplayName = normalizeName(displayName);
          const sess: UserSession = { r: 'admin', n: normalizedDisplayName };
          setSession(sess);
          localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sess));
        }
      }
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') return; // User cancelled — ignore silently
      if (err?.code === 'auth/cancelled-popup-request') return; // Another popup already open
      console.error('Google login error:', err);
    }
  }, []);

  const handleLogout = useCallback(() => {
    setSession(null);
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    signOut(auth).catch(() => {});
  }, []);

  const pushNotification = useCallback(async (doctorId: number, message: string) => {
    const id = Date.now().toString();
    try {
      await setDoc(doc(db, 'notifications', id), {
        doctorId,
        message,
        timestamp: Date.now(),
        read: false
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `notifications/${id}`);
    }
  }, []);

  const markNotificationRead = useCallback((notifId: string) => {
    updateDoc(doc(db, 'notifications', notifId), { read: true }).catch(() => {});
  }, []);

  const ensureAuth = useCallback(async () => {
    if (auth.currentUser) return;
    // Wait up to 3s for auth to resolve
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 200));
      if (auth.currentUser) return;
    }
    try { await signInAnonymously(auth); } catch { /* ignore */ }
  }, []);

  const updateDoctorMonth = useCallback(async (doctorId: number, shifts: DoctorShifts) => {
    const monthKey = `${selectedYear}_${selectedMonth}`;
    try {
      await ensureAuth();
      await setDoc(doc(db, 'monthlyData', monthKey, 'doctors', String(doctorId)), shifts);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `monthlyData/${monthKey}/doctors/${doctorId}`);
    }
  }, [selectedMonth, selectedYear, ensureAuth]);

  const updateMonthlyData = useCallback(async (data: MonthlyData) => {
    const monthKey = `${selectedYear}_${selectedMonth}`;
    const promises = Object.entries(data).map(([id, shifts]) =>
      setDoc(doc(db, 'monthlyData', monthKey, 'doctors', id), shifts)
    );
    await Promise.all(promises);
  }, [selectedMonth, selectedYear]);

  const saveEvaluation = useCallback(async (evalData: any) => {
    const key = `${evalData.year}_${evalData.month}_${evalData.doctorId}`;
    try {
      await setDoc(doc(db, 'evaluations', key), { ...evalData, id: key, timestamp: Date.now(), adminName: session?.n || 'Admin' });
      notify('Calificación guardada correctamente', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `evaluations/${key}`);
    }
  }, [session, notify]);

  const updateThemeAction = useCallback(async (newTheme: { primary: string; font: string }) => {
    try {
      await setDoc(doc(db, 'settings', 'theme'), newTheme);
      setTheme(newTheme);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/theme');
    }
  }, []);

  // Send email notification helper (fire & forget)
  const sendEmailNotification = useCallback(async (to: string, subject: string, body: string) => {
    try {
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, text: body })
      });
    } catch { /* ignore */ }
  }, []);

  // ── Doctor CRUD ──
  const saveEditedDoctor = useCallback(async (doctor: Doctor) => {
    try {
      await setDoc(doc(db, 'doctors', doctor.id.toString()), doctor);
      notify('Médico actualizado correctamente', 'success');
    } catch (err) {
      notify('Error: No se pudo actualizar el médico', 'error');
      handleFirestoreError(err, OperationType.WRITE, `doctors/${doctor.id}`);
    }
  }, [notify]);

  
  const deleteDoctor = useCallback(async (id: number) => {
    if (!confirm('¿Eliminar permanentemente? Esta acción no se puede deshacer.')) return;
    try {
      await deleteDoc(doc(db, 'doctors', id.toString()));
      notify('Médico eliminado correctamente', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `doctors/${id}`);
    }
  }, [notify]);

  const toggleDoctorStatus = useCallback(async (id: number, status: 'activo' | 'inactivo') => {
    try {
      await updateDoc(doc(db, 'doctors', id.toString()), { st: status, sortOrder: status === 'inactivo' ? 0 : null });
      notify(`Médico ${status === 'activo' ? 'activado' : 'inactivado'} correctamente`, 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `doctors/${id}`);
    }
  }, [notify]);

  const saveDoctorOrder = useCallback(async (orderedIds: number[]) => {
    try {
      await Promise.all(
        orderedIds.map((id, idx) =>
          updateDoc(doc(db, 'doctors', id.toString()), { sortOrder: idx + 1 })
        )
      );
      notify('Orden actualizado correctamente', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'doctors/sortOrder');
    }
  }, [notify]);

  const resetDoctorPass = useCallback(async (id: number) => {
    const defaultPass = `ESE${Math.floor(1000 + Math.random() * 9000)}`;
    try {
      await updateDoc(doc(db, 'doctors', id.toString()), { password: defaultPass, passwordLastChanged: Date.now() });
      notify(`Contraseña reseteada a: ${defaultPass}`, 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `doctors/${id}`);
    }
  }, [notify]);

  const changePassword = useCallback(async (doctorId: number, oldPass: string, newPass: string) => {
    const d = doctors.find(doc => doc.id === doctorId);
    if (!d) return;
    if (d.password !== oldPass) { notify('La contraseña actual es incorrecta', 'error'); return; }
    if (newPass.length < 6) { notify('La nueva contraseña debe tener al menos 6 caracteres', 'error'); return; }
    try {
      await updateDoc(doc(db, 'doctors', doctorId.toString()), { password: newPass, passwordLastChanged: Date.now(), mustChangePassword: false });
      notify('Contraseña actualizada con éxito', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `doctors/${doctorId}`);
    }
  }, [doctors, notify]);

  // ── Variables ──
  const addVariable = useCallback(async (slot: SlotType, code: string, hours: number) => {
    if (!code.trim()) { alert('La sigla no puede estar vacía.'); return; }
    const upper = code.trim().toUpperCase();
    if (['CAP','X','PT'].includes(upper)) { alert('Esta sigla es reservada del sistema.'); return; }
    const updated = { ...variables, [slot]: { ...variables[slot], [upper]: hours } };
    try {
      await setDoc(doc(db, 'settings', 'variables'), updated);
      notify(`Sigla ${upper} agregada`, 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/variables');
    }
  }, [variables, notify]);

  const removeVariable = useCallback(async (slot: SlotType, code: string) => {
    if (['CAP','X'].includes(code)) { alert('Esta sigla es reservada del sistema.'); return; }
    if (!confirm(`¿Eliminar la sigla ${code}?`)) return;
    const newSlot = { ...variables[slot] };
    delete newSlot[code];
    const updated = { ...variables, [slot]: newSlot };
    try {
      await setDoc(doc(db, 'settings', 'variables'), updated);
      notify(`Sigla ${code} eliminada`, 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/variables');
    }
  }, [variables, notify]);

  // ── Activities ──
  const addActivity = useCallback(async (activity: Partial<TrainingActivity>) => {
    if (!activity.activityName || !activity.day) {
      alert('El nombre de la actividad y el día son obligatorios.'); return;
    }
    const id = Date.now().toString();
    const newA: TrainingActivity = {
      id, month: selectedMonth, year: selectedYear,
      activityName: activity.activityName!, day: activity.day!,
      place: activity.place || '', modality: activity.modality || 'presencial',
      hours: activity.hours || 0, targetGroup: activity.targetGroup || '',
      responsible: activity.responsible || '', targetPopulation: activity.targetPopulation || '',
      files: activity.files || {}, attendees: activity.attendees || [],
      status: activity.status || 'programada', timestamp: Date.now(),
    };
    try {
      await setDoc(doc(db, 'trainingActivities', id), newA);
      notify('Actividad registrada correctamente', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `trainingActivities/${id}`);
    }
  }, [selectedMonth, selectedYear, notify]);

  const deleteActivity = useCallback(async (id: string) => {
    if (!confirm('¿Está seguro de eliminar esta actividad?')) return;
    try {
      await deleteDoc(doc(db, 'trainingActivities', id));
      notify('Actividad eliminada', 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `trainingActivities/${id}`);
    }
  }, [notify]);

  // ── Service Mappings ──
  const saveServiceMappings = useCallback(async (newMappings: ServiceMapping[]) => {
    const cleaned = newMappings.map(m => ({ ...m, siglas: m.siglas.map(s => s.trim().toUpperCase()).filter(s => s !== '') }));
    try {
      await setDoc(doc(db, 'settings', 'serviceMappings'), { mappings: cleaned });
      notify('Mapeos de servicios guardados', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/serviceMappings');
    }
  }, [notify]);

  // ── Registration Requests ──
  const approveRegistration = useCallback(async (requestId: string, assignedRol: string, assignedCat: string): Promise<{ username: string; password: string } | undefined> => {
    // Try server-side first — creates doctor + sends credentials email
    try {
      const res = await fetch('/api/approve-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, assignedRol, assignedCat, reviewedBy: session?.n || 'Admin' })
      });
      const data = await res.json();
      if (data.success) {
        notify('✅ Cuenta activada. Se envió el correo con credenciales.', 'success');
        return { username: data.username, password: data.password };
      }
      console.warn('Server approve failed:', data.error, '— using client-side fallback');
    } catch (fetchErr) {
      console.warn('Server not reachable, using client-side:', fetchErr);
    }

    // Fallback: client-side Firestore (no email)
    try {
      const reqDoc = await getDoc(doc(db, 'registrationRequests', requestId));
      if (!reqDoc.exists()) throw new Error('Solicitud no encontrada');
      const reqData = reqDoc.data() as RegistrationRequest;
      if (reqData.status !== 'pending') throw new Error('Esta solicitud ya fue procesada');

      const allDocs = await getDocs(collection(db, 'doctors'));
      const usedIds = new Set(
        allDocs.docs
          .map(d => parseInt(d.id))
          .filter(n => !isNaN(n) && n > 0 && n < 10000000)
      );
      let newId = 1;
      while (usedIds.has(newId)) newId++;

      // Find the lowest available sortOrder (reuse gaps from deleted/inactive doctors)
      const existingSortOrders = allDocs.docs
        .map(d => (d.data() as Doctor).sortOrder)
        .filter((n): n is number => typeof n === 'number' && n > 0);
      const usedSortOrders = new Set(existingSortOrders);
      let newSortOrder = 1;
      while (usedSortOrders.has(newSortOrder)) newSortOrder++;

      const cleanName = reqData.nombre.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '').substring(0, 5);
      const username = `${cleanName}${reqData.cedula.slice(-4)}`;
      const password = `ESE${Math.floor(1000 + Math.random() * 9000)}`;
      const now = Date.now();

      const newDoctor: Doctor = {
        id: newId,
        sortOrder: newSortOrder,
        nombre: `${reqData.nombre} ${reqData.apellidos}`,
        apellidos: reqData.apellidos,
        cedula: reqData.cedula,
        registroMedico: reqData.registroMedico || '',
        email: reqData.email,
        telefono: reqData.telefono || '',
        genero: reqData.genero,
        cat: assignedCat as any,
        rol: assignedRol as any,
        st: 'activo',
        username,
        password,
        passwordLastChanged: now,
        createdAt: now,
        mustChangePassword: true,
        permissions: DEFAULT_ROLE_PERMISSIONS[assignedRol as DoctorRole] || []
      };

      await setDoc(doc(db, 'doctors', newId.toString()), newDoctor);
      await updateDoc(doc(db, 'registrationRequests', requestId), {
        status: 'approved',
        reviewedAt: now,
        reviewedBy: session?.n || 'Admin',
        assignedId: newId
      });

      notify('✅ Cuenta activada. (Correo no enviado — configure SMTP en el servidor)', 'success');
      return { username, password };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      notify(`Error: ${msg}`, 'error');
    }
  }, [session, notify]);

  const rejectRegistration = useCallback(async (requestId: string, reason: string) => {
    try {
      const reqDoc = await getDoc(doc(db, 'registrationRequests', requestId));
      if (!reqDoc.exists()) throw new Error('Solicitud no encontrada');

      await updateDoc(doc(db, 'registrationRequests', requestId), {
        status: 'rejected',
        rejectionReason: reason,
        reviewedAt: Date.now(),
        reviewedBy: session?.n || 'Admin'
      });

      notify('Solicitud rechazada', 'info');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      notify(`Error: ${msg}`, 'error');
    }
  }, [session, notify, db]);

  // ── Shift Requests ──
  const submitShiftRequest = useCallback(async (day: number, slot: SlotType, reason: string) => {
    if (!session?.doctorId || !reason) { alert('Por favor escriba un motivo.'); return; }
    const doctor = doctors.find(d => d.id === session.doctorId);
    if (!doctor) return;
    const id = Date.now();
    const newReq: ShiftRequest = {
      id, timestamp: id, doctorId: session.doctorId, doctorName: doctor.nombre,
      day, slot, reason, status: 'pending', targetMonth: selectedMonth, targetYear: selectedYear,
    };
    try {
      await setDoc(doc(db, 'shiftRequests', id.toString()), newReq);
      notify('Solicitud enviada a coordinación', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `shiftRequests/${id}`);
    }
  }, [session, doctors, selectedMonth, selectedYear, notify]);

  const updateRequestStatus = useCallback(async (id: number, status: 'approved' | 'rejected') => {
    const req = shiftRequests.find(r => r.id === id);
    if (!req) return;
    try {
      await updateDoc(doc(db, 'shiftRequests', id.toString()), { status });
      const msg = status === 'approved'
        ? `✅ SOLICITUD APROBADA: Tu cambio para el día ${req.day} ha sido autorizado.`
        : `❌ SOLICITUD RECHAZADA: Tu solicitud para el día ${req.day} no pudo procesarse.`;
      await pushNotification(req.doctorId, msg);
      // Optional email notification
      const doctor = doctors.find(d => d.id === req.doctorId);
      if (doctor?.email) sendEmailNotification(doctor.email, `Solicitud ${status === 'approved' ? 'Aprobada' : 'Rechazada'}`, msg);
      notify(status === 'approved' ? 'Solicitud autorizada' : 'Solicitud rechazada', status === 'approved' ? 'success' : 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `shiftRequests/${id}`);
    }
  }, [shiftRequests, doctors, pushNotification, sendEmailNotification, notify]);

  const value: AppContextType = {
    session, setSession, fbUser, isBooting, isOnline, isFirebaseUnauthenticatedAdmin,
    doctors, variables, setVariables, currentMonthData, setCurrentMonthData,
    auditLogs, shiftRequests, ruralAvailabilities, availabilityCalls,
    activities, serviceMappings, setServiceMappings, userNotifications, isMonthPublished,
    selectedMonth, setSelectedMonth, selectedYear, setSelectedYear, daysInMonth,
    notification, setNotification, notify,
    theme, setTheme, updateTheme: updateThemeAction,
    activeTab, setActiveTab,
    handleLogin, handleGoogleLogin, handleLogout,
    pushNotification, markNotificationRead, updateDoctorMonth, updateMonthlyData,
    saveEditedDoctor, toggleDoctorStatus, deleteDoctor, saveDoctorOrder, resetDoctorPass, changePassword,
    addVariable, removeVariable,
    addActivity, deleteActivity,
    evaluations, saveEvaluation,
    saveServiceMappings,
    registrationRequests, approveRegistration, rejectRegistration,
    submitShiftRequest, updateRequestStatus,
    isGeneratingAI, setIsGeneratingAI, aiReport, setAiReport,
    idleTimeout, setIdleTimeout
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
