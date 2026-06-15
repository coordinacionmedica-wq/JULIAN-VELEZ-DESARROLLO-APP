import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Clock, KeyRound, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { collection, query, where, getDocs, getDoc, setDoc, doc, updateDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { auth, db } from '../firebase';

export function LoginPage() {
  const { handleLogin, handleGoogleLogin, fbUser } = useAppContext();

  const [loginU, setLoginU] = useState('');
  const [loginP, setLoginP] = useState('');  
  const [showRegModal, setShowRegModal] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Forced password change state
  const [showForceChange, setShowForceChange] = useState(false);
  const [forceDoctorId, setForceDoctorId] = useState<number | null>(null);
  const [forceOldPass, setForceOldPass] = useState('');
  const [forceNewPass, setForceNewPass] = useState('');
  const [forceConfirm, setForceConfirm] = useState('');
  const [forceError, setForceError] = useState('');
  const [forceLoading, setForceLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Registration form state
  const [regNombre, setRegNombre] = useState('');
  const [regApellidos, setRegApellidos] = useState('');
  const [regCedula, setRegCedula] = useState('');
  const [regRegistroMedico, setRegRegistroMedico] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regTelefono, setRegTelefono] = useState('');
  const [regRol, setRegRol] = useState('Médico General');
  const [regGenero, setRegGenero] = useState<'M' | 'F'>('M');
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Invitation state
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteData, setInviteData] = useState<any>(null);
  const [checkingInvite, setCheckingInvite] = useState(true);
  
  // Check for invitation token in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('invite');
    if (token) {
      setInviteToken(token);
      verifyInvitation(token);
    } else {
      setCheckingInvite(false);
    }
  }, []);
  
  const verifyInvitation = async (token: string) => {
    try {
      // Find invitation by token
      const invitesRef = collection(db, 'registrationInvitations');
      const q = query(invitesRef, where('token', '==', token), where('status', '==', 'pending'));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const invite = snapshot.docs[0].data();
        setInviteData({ ...invite, id: snapshot.docs[0].id });
        setRegRol(invite.suggestedRol || 'Médico General');
        setRegEmail(invite.email || '');
        setShowRegModal(true);
      } else {
        alert('El enlace de invitación no es válido o ya fue utilizado.');
      }
    } catch (err) {
      console.error('Error verifying invitation:', err);
    } finally {
      setCheckingInvite(false);
    }
  };

  const handleSelfRegister = async () => {
    if (!regNombre.trim() || !regApellidos.trim() || !regCedula.trim() || !regEmail.trim()) {
      return alert("Por favor complete los campos obligatorios: Nombres, Apellidos, Correo y Cédula.");
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(regEmail.trim())) {
      return alert("El formato del correo electrónico no es válido.");
    }
    const cleanCedula = regCedula.trim();
    if (!/^\d+$/.test(cleanCedula) || cleanCedula.length < 5 || cleanCedula.length > 12) {
      return alert("La cédula debe ser un número válido (entre 5 y 12 dígitos).");
    }

    setIsRegistering(true);
    try {
      // Check if doctor already has an active account
      const dupDoctor = await getDocs(query(collection(db, 'doctors'), where('cedula', '==', cleanCedula)));
      if (!dupDoctor.empty && dupDoctor.docs[0].data().username) {
        throw new Error(`Ya existe una cuenta para esta cédula. Usuario: ${dupDoctor.docs[0].data().username}`);
      }

      // Check if there is already a pending request
      const dupReq = await getDocs(query(
        collection(db, 'registrationRequests'),
        where('cedula', '==', cleanCedula),
        where('status', '==', 'pending')
      ));
      if (!dupReq.empty) {
        throw new Error("Ya existe una solicitud pendiente para esta cédula. Un administrador la revisará pronto.");
      }

      // Create the registration request directly in Firestore
      const id = Date.now().toString();
      // Create the registration request
      await setDoc(doc(db, 'registrationRequests', id), {
        id,
        nombre: regNombre.trim(),
        apellidos: regApellidos.trim(),
        cedula: cleanCedula,
        registroMedico: regRegistroMedico.trim(),
        email: regEmail.trim(),
        telefono: regTelefono.trim(),
        genero: regGenero,
        requestedRol: regRol,
        status: 'pending',
        createdAt: Date.now(),
        inviteToken: inviteToken || null
      });
      
      // If this was from an invitation, mark it as completed
      if (inviteData) {
        await updateDoc(doc(db, 'registrationInvitations', inviteData.id), {
          status: 'completed',
          completedAt: Date.now(),
          registrationRequestId: id
        });
      }

      setSubmitted(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Error: ${msg}`);
    } finally {
      setIsRegistering(false);
    }
  };

  const doLogin = async () => {
    // Check if doctor must change password before granting full session
    const trimU = loginU.trim();
    const trimP = loginP.trim();
    if (trimU && trimP) {
      try {
        // Ensure auth is established
        if (!auth.currentUser) {
          await signInAnonymously(auth);
          // Small delay to let auth propagate
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        const q = query(collection(db, 'doctors'), where('username', '==', trimU));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const d = snap.docs[0].data();
          if (d.password === trimP && d.mustChangePassword) {
            setForceDoctorId(d.id);
            setForceOldPass(trimP);
            setShowForceChange(true);
            return;
          }
        }
      } catch (err) {
        console.error('Pre-login check failed:', err);
        // If it's an auth error, alert the user
        if (err instanceof Error && err.message.includes('auth')) {
          alert('Error de autenticación. Por favor recargue la página e intente de nuevo.');
          return;
        }
        // Otherwise continue to normal login
      }
    }
    handleLogin(trimU, trimP);
  };

  const handleForceChangePassword = async () => {
    setForceError('');
    if (forceNewPass.length < 6) { setForceError('La contraseña debe tener al menos 6 caracteres.'); return; }
    if (forceNewPass !== forceConfirm) { setForceError('Las contraseñas no coinciden.'); return; }
    if (forceNewPass === forceOldPass) { setForceError('La nueva contraseña no puede ser igual a la temporal.'); return; }
    if (!forceDoctorId) return;
    setForceLoading(true);
    try {
      if (!auth.currentUser) { await signInAnonymously(auth); }
      await updateDoc(doc(db, 'doctors', forceDoctorId.toString()), {
        password: forceNewPass,
        passwordLastChanged: Date.now(),
        mustChangePassword: false
      });
      // Now log in normally
      await handleLogin(loginU.trim(), forceNewPass);
      setShowForceChange(false);
    } catch (err) {
      setForceError('Error al guardar la contraseña. Intente de nuevo.');
    } finally {
      setForceLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-6 md:p-10 rounded-[32px] border border-emerald-100 w-full max-w-md text-center shadow-2xl relative my-4 md:my-8"
      >
        <div className="flex justify-center mb-6">
          <img
            src="/Logo_HDSA.jpg"
            alt="Logo HDSA"
            className="h-32 w-auto object-contain rounded-2xl shadow-lg border-2 border-emerald-100"
          />
        </div>
        <h2 className="text-2xl font-bold text-emerald-700 mb-8 uppercase tracking-widest">COORDINACION MEDICA HDSAR</h2>
        
        {fbUser && (
          <div className="mb-6 flex items-center justify-center gap-2 bg-emerald-50/50 py-2 px-4 rounded-full border border-emerald-100/50">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs uppercase font-black text-emerald-600/70 tracking-widest">
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
            onKeyDown={(e) => e.key === 'Enter' && doLogin()}
          />
          <button 
            onClick={doLogin}
            className="w-full bg-emerald-600 text-white p-4 rounded-xl font-black text-lg shadow-xl shadow-emerald-500/20 active:scale-95 transition-transform"
          >
            ACCEDER AL SISTEMA
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
              <span className="block text-xs uppercase text-emerald-600/70">Contacto Coordinador</span>
              <span>+57 317 3683886</span>
            </div>
          </a>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
            <div className="relative flex justify-center text-xs uppercase tracking-widest"><span className="bg-white px-4 text-slate-400">O acceder con</span></div>
          </div>

          <button 
            onClick={handleGoogleLogin}
            className="w-full bg-white border border-slate-200 text-slate-800 p-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
            CONTINUAR CON GOOGLE
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-8 tracking-widest uppercase font-mono">Consolidado 2026</p>
      </motion.div>

      {/* Registration Modal */}
      <AnimatePresence>
        {showRegModal && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[200] flex items-center justify-center p-0 sm:p-4 overflow-y-auto">
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="bg-white w-full h-full sm:h-auto sm:max-w-2xl sm:rounded-[40px] shadow-2xl p-6 sm:p-10 border-0 sm:border sm:border-emerald-100 relative flex flex-col pt-20 sm:pt-10"
            >
              <button 
                onClick={() => { setShowRegModal(false); setSubmitted(false); }}
                className="absolute top-6 right-6 p-3 bg-slate-100/50 hover:bg-rose-50 rounded-full text-slate-400 hover:text-rose-600 transition-all active:scale-90 z-[210] flex items-center gap-2 group"
              >
                <span className="text-xs uppercase font-black tracking-widest hidden sm:inline group-hover:inline">Cancelar</span>
                <X className="w-6 h-6" />
              </button>

              {submitted ? (
                <div className="text-center py-10 space-y-6">
                  <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Clock className="w-10 h-10 text-amber-600" />
                  </div>
                  <h2 className="text-3xl font-black text-slate-800">¡Solicitud Enviada!</h2>
                  <p className="text-slate-500 max-w-xs mx-auto">Su solicitud fue recibida. Un <span className="font-bold text-emerald-600">administrador</span> revisará sus datos y activará su cuenta.</p>

                  <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 text-left space-y-2">
                    <p className="text-xs uppercase font-black text-amber-600/60 mb-3">Sus datos registrados</p>
                    <div className="flex justify-between text-sm"><span className="text-slate-500">Nombre</span><span className="font-bold text-slate-700">{regNombre} {regApellidos}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-slate-500">Cédula</span><span className="font-bold text-slate-700">{regCedula}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-slate-500">Correo</span><span className="font-bold text-slate-700 text-right max-w-[60%] break-all">{regEmail}</span></div>
                  </div>

                  <p className="text-xs text-slate-400 italic">Recibirá sus credenciales de acceso por correo electrónico una vez sea aprobado.</p>

                  <button
                    onClick={() => { setShowRegModal(false); setSubmitted(false); }}
                    className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-emerald-500/20 active:scale-95 transition-transform"
                  >
                    ENTENDIDO
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
                        <label className="text-xs uppercase font-black text-emerald-600 ml-2 mb-1 block">Nombres *</label>
                        <input className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:border-emerald-500 font-bold" value={regNombre} onChange={e => setRegNombre(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs uppercase font-black text-emerald-600 ml-2 mb-1 block">Apellidos *</label>
                        <input className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:border-emerald-500 font-bold" value={regApellidos} onChange={e => setRegApellidos(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs uppercase font-black text-emerald-600 ml-2 mb-1 block">Cédula de Ciudadanía *</label>
                        <input className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:border-emerald-500 font-bold" value={regCedula} onChange={e => setRegCedula(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs uppercase font-black text-emerald-600 ml-2 mb-1 block">Registro Médico / Tarjeta Prof.</label>
                        <input className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:border-emerald-500 font-bold" value={regRegistroMedico} onChange={e => setRegRegistroMedico(e.target.value)} />
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs uppercase font-black text-emerald-600 ml-2 mb-1 block">Correo Electrónico *</label>
                        <input type="email" className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:border-emerald-500 font-bold" value={regEmail} onChange={e => setRegEmail(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs uppercase font-black text-emerald-600 ml-2 mb-1 block">Teléfono / WhatsApp</label>
                        <input className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:border-emerald-500 font-bold" value={regTelefono} onChange={e => setRegTelefono(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs uppercase font-black text-emerald-600 ml-2 mb-1 block">Cargo / Rol *</label>
                        <select className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:border-emerald-500 font-bold" value={regRol} onChange={e => setRegRol(e.target.value)}>
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
                      <div>
                        <label className="text-xs uppercase font-black text-emerald-600 ml-2 mb-1 block">Sexo *</label>
                        <select className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:border-emerald-500 font-bold" value={regGenero} onChange={e => setRegGenero(e.target.value as 'M' | 'F')}>
                          <option value="M">Masculino (Dr.)</option>
                          <option value="F">Femenino (Dra.)</option>
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

      {/* Forced Password Change Modal */}
      <AnimatePresence>
        {showForceChange && (
          <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[300] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl border border-emerald-100 p-8 text-center"
            >
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <KeyRound className="w-8 h-8 text-amber-600" />
              </div>
              <h2 className="text-xl font-black text-slate-800 mb-1">Cambio de contraseña requerido</h2>
              <p className="text-sm text-slate-400 mb-6">Es su primer acceso. Debe establecer una contraseña personal antes de continuar.</p>

              {forceError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold p-3 rounded-xl mb-4 text-left">
                  {forceError}
                </div>
              )}

              <div className="space-y-3 text-left mb-6">
                <div>
                  <label className="text-xs uppercase font-black text-emerald-600 mb-1 block">Nueva contraseña</label>
                  <div className="relative">
                    <input
                      type={showNew ? 'text' : 'password'}
                      className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl outline-none focus:border-emerald-500 font-bold pr-10"
                      placeholder="Mínimo 6 caracteres"
                      value={forceNewPass}
                      onChange={e => setForceNewPass(e.target.value)}
                    />
                    <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs uppercase font-black text-emerald-600 mb-1 block">Confirmar contraseña</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl outline-none focus:border-emerald-500 font-bold pr-10"
                      placeholder="Repita la contraseña"
                      value={forceConfirm}
                      onChange={e => setForceConfirm(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleForceChangePassword()}
                    />
                    <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={handleForceChangePassword}
                disabled={forceLoading}
                className="w-full bg-emerald-600 text-white py-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/20"
              >
                {forceLoading
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> GUARDANDO...</>
                  : <><ShieldCheck className="w-4 h-4" /> GUARDAR Y ACCEDER</>
                }
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
