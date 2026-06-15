import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { collection, query, where, getDocs, setDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

type Step = 'loading' | 'invalid' | 'form' | 'submitted';

export function RegisterPage() {
  const [step, setStep] = useState<Step>('loading');
  const [inviteData, setInviteData] = useState<any>(null);
  const [inviteToken, setInviteToken] = useState<string>('');

  // Form
  const [regNombre, setRegNombre] = useState('');
  const [regApellidos, setRegApellidos] = useState('');
  const [regCedula, setRegCedula] = useState('');
  const [regRegistroMedico, setRegRegistroMedico] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regTelefono, setRegTelefono] = useState('');
  const [regRol, setRegRol] = useState('Médico General');
  const [regGenero, setRegGenero] = useState<'M' | 'F'>('M');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('invite');
    if (!token) {
      setStep('invalid');
      return;
    }
    setInviteToken(token);
    verifyInvitation(token);
  }, []);

  const verifyInvitation = async (token: string) => {
    try {
      const q = query(
        collection(db, 'registrationInvitations'),
        where('token', '==', token),
        where('status', '==', 'pending')
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const invite = snapshot.docs[0].data();
        setInviteData({ ...invite, id: snapshot.docs[0].id });
        setRegRol(invite.suggestedRol || 'Médico General');
        setRegEmail(invite.email || '');
        setStep('form');
      } else {
        setStep('invalid');
      }
    } catch (err) {
      console.error('Error verifying invitation:', err);
      setStep('invalid');
    }
  };

  const handleRegister = async () => {
    setError(null);
    if (!regNombre.trim() || !regApellidos.trim() || !regCedula.trim() || !regEmail.trim()) {
      setError('Por favor complete los campos obligatorios: Nombres, Apellidos, Correo y Cédula.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(regEmail.trim())) {
      setError('El formato del correo electrónico no es válido.');
      return;
    }
    const cleanCedula = regCedula.trim();
    if (!/^\d+$/.test(cleanCedula) || cleanCedula.length < 5 || cleanCedula.length > 12) {
      setError('La cédula debe ser un número válido (entre 5 y 12 dígitos).');
      return;
    }

    setIsRegistering(true);
    try {
      const dupDoctor = await getDocs(query(collection(db, 'doctors'), where('cedula', '==', cleanCedula)));
      if (!dupDoctor.empty && dupDoctor.docs[0].data().username) {
        throw new Error(`Ya existe una cuenta para esta cédula: ${dupDoctor.docs[0].data().username}`);
      }

      const id = Date.now().toString();
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

      if (inviteData) {
        await updateDoc(doc(db, 'registrationInvitations', inviteData.id), {
          status: 'completed',
          completedAt: Date.now(),
          registrationRequestId: id
        });
      }

      setStep('submitted');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRegistering(false);
    }
  };

  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-500 font-medium">Verificando invitación...</p>
        </div>
      </div>
    );
  }

  if (step === 'invalid') {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[32px] border border-rose-100 p-10 max-w-md w-full text-center shadow-2xl"
        >
          <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-10 h-10 text-rose-500" />
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-3">Enlace no válido</h2>
          <p className="text-slate-500">Este enlace de invitación no es válido, ya fue utilizado, o ha expirado.</p>
          <p className="text-slate-400 text-sm mt-4">Contacte al administrador para recibir una nueva invitación.</p>
        </motion.div>
      </div>
    );
  }

  if (step === 'submitted') {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-[32px] border border-emerald-100 p-10 max-w-md w-full text-center shadow-2xl space-y-6"
        >
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-3xl font-black text-slate-800">¡Solicitud Enviada!</h2>
          <p className="text-slate-500 max-w-xs mx-auto">
            Su solicitud fue recibida. Un <span className="font-bold text-emerald-600">administrador</span> revisará sus datos y le enviará sus credenciales de acceso al correo registrado.
          </p>
          <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 text-left space-y-2">
            <p className="text-xs uppercase font-black text-amber-600/60 mb-3">Sus datos registrados</p>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Nombre</span><span className="font-bold text-slate-700">{regNombre} {regApellidos}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Cédula</span><span className="font-bold text-slate-700">{regCedula}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Correo</span><span className="font-bold text-slate-700 text-right max-w-[60%] break-all">{regEmail}</span></div>
          </div>
          <div className="flex items-center gap-2 justify-center text-amber-600 bg-amber-50 py-3 px-6 rounded-2xl border border-amber-100">
            <Clock className="w-5 h-5" />
            <span className="text-sm font-bold">Espere la activación de su cuenta</span>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-start justify-center p-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white w-full max-w-2xl rounded-[32px] border border-emerald-100 shadow-2xl p-6 sm:p-10"
      >
        <div className="flex justify-center mb-6">
          <img src="/Logo_HDSA.jpg" alt="Logo HDSA" className="h-24 w-auto object-contain rounded-2xl shadow-lg border-2 border-emerald-100" />
        </div>
        <h2 className="text-2xl font-black text-emerald-700 text-center mb-1 uppercase tracking-widest">Registro de Talento Humano</h2>
        <p className="text-center text-slate-400 text-sm mb-2">COORDINACIÓN MÉDICA — HOSPITAL DEPARTAMENTAL SAN ANTONIO DE ROLDANILLO</p>

        {inviteData?.message && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mb-6 text-sm text-emerald-700">
            <span className="font-black text-xs uppercase block mb-1 text-emerald-500">Mensaje del administrador</span>
            {inviteData.message}
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 mb-4 text-sm text-rose-700 font-medium">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
          onClick={handleRegister}
          disabled={isRegistering}
          className={`w-full ${isRegistering ? 'bg-slate-300 cursor-not-allowed' : 'bg-emerald-600 hover:scale-[1.02] active:scale-[0.98]'} text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-3`}
        >
          {isRegistering ? (
            <>
              <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
              PROCESANDO...
            </>
          ) : (
            'ENVIAR SOLICITUD DE REGISTRO'
          )}
        </button>

        <p className="text-center text-xs text-slate-400 mt-6 uppercase tracking-widest font-mono">
          Sus datos serán revisados por el administrador antes de activar su acceso
        </p>
      </motion.div>
    </div>
  );
}
