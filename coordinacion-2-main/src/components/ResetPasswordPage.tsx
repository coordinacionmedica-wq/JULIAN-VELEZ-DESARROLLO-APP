import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { KeyRound, Eye, EyeOff, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

type Step = 'loading' | 'invalid' | 'form' | 'done';

export function ResetPasswordPage() {
  const [step, setStep] = useState<Step>('loading');
  const [tokenDocId, setTokenDocId] = useState<string>('');
  const [doctorId, setDoctorId] = useState<number | null>(null);
  const [doctorName, setDoctorName] = useState('');

  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) { setStep('invalid'); return; }
    verifyToken(token);
  }, []);

  const verifyToken = async (token: string) => {
    try {
      const now = Date.now();
      const q = query(
        collection(db, 'passwordResets'),
        where('token', '==', token),
        where('expiresAt', '>', now)
      );
      const snap = await getDocs(q);
      if (snap.empty) { setStep('invalid'); return; }
      const data = snap.docs[0].data();
      setTokenDocId(snap.docs[0].id);
      setDoctorId(data.doctorId);
      setDoctorName(data.doctorName || '');
      setStep('form');
    } catch {
      setStep('invalid');
    }
  };

  const handleReset = async () => {
    setError('');
    if (newPass.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return; }
    if (newPass !== confirm) { setError('Las contraseñas no coinciden.'); return; }
    if (!doctorId) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'doctors', doctorId.toString()), {
        password: newPass,
        passwordLastChanged: Date.now(),
        mustChangePassword: false,
      });
      await deleteDoc(doc(db, 'passwordResets', tokenDocId));
      setStep('done');
    } catch {
      setError('Error al guardar la contraseña. El enlace puede haber expirado.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 font-medium">Verificando enlace...</p>
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
          <p className="text-slate-500">Este enlace de restablecimiento no es válido o ya expiró (válido por 24 horas).</p>
          <p className="text-slate-400 text-sm mt-4">Solicite al administrador un nuevo enlace desde Talento Humano.</p>
        </motion.div>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-[32px] border border-emerald-100 p-10 max-w-md w-full text-center shadow-2xl space-y-5"
        >
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-3xl font-black text-slate-800">¡Contraseña actualizada!</h2>
          <p className="text-slate-500">Ya puede ingresar al sistema con su nueva contraseña.</p>
          <a
            href="/"
            className="inline-block w-full bg-emerald-600 text-white py-4 rounded-xl font-black text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20"
          >
            IR AL INICIO DE SESIÓN
          </a>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl border border-emerald-100 p-8 text-center"
      >
        <div className="flex justify-center mb-4">
          <img src="/Logo_HDSA.jpg" alt="Logo HDSA" className="h-16 w-auto object-contain rounded-xl border border-emerald-100" />
        </div>
        <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <KeyRound className="w-7 h-7 text-amber-600" />
        </div>
        <h2 className="text-xl font-black text-slate-800 mb-1">Restablecer contraseña</h2>
        {doctorName && <p className="text-sm text-slate-500 mb-5">{doctorName}</p>}

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold p-3 rounded-xl mb-4 text-left">
            {error}
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
                value={newPass}
                onChange={e => setNewPass(e.target.value)}
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
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleReset()}
              />
              <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={handleReset}
          disabled={loading}
          className="w-full bg-emerald-600 text-white py-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/20"
        >
          {loading
            ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> GUARDANDO...</>
            : <><ShieldCheck className="w-4 h-4" /> GUARDAR CONTRASEÑA</>
          }
        </button>
        <p className="text-xs text-slate-400 mt-4 uppercase tracking-widest font-mono">COORDINACIÓN MÉDICA HDSAR</p>
      </motion.div>
    </div>
  );
}
