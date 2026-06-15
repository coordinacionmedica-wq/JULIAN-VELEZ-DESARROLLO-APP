import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  MapPin,
  Plus,
  Send,
  Clock,
  Calendar,
  Info,
  Trash2,
  FileSpreadsheet,
  Download,
  Brain as BrainIcon,
} from 'lucide-react';
import { RuralAvailability } from '../types';
import { setDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAppContext } from '../context/AppContext';
import { useExportActions } from '../hooks/useExportActions';

export function RuralView() {
  const exports = useExportActions({ showGridHours: false, doctorFilter: [], selectedRoles: [], selectedCategories: [] });
  const {
    session, ruralAvailabilities,
    selectedMonth, selectedYear,
    setNotification,
  } = useAppContext();

  const isAdminUser = session?.r === 'admin';

  // Form State
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

  const submitRuralAvailability = async () => {
    if (!session?.doctorId) return;
    if (!ruralCallDate || !ruralCallTime || !ruralActivity) return alert("La fecha, hora y actividad son obligatorias.");
    const callDateTime = new Date(`${ruralCallDate}T${ruralCallTime}`).getTime();
    const terminationDateTime = ruralEndDate && ruralEndTime
      ? new Date(`${ruralEndDate}T${ruralEndTime}`).getTime()
      : Date.now();
    const totalHours = Math.max(0, (terminationDateTime - callDateTime) / 3600000);
    const id = Date.now().toString();
    const newEntry: RuralAvailability = {
      id,
      doctorId: session.doctorId,
      doctorName: session.n,
      callDateTime,
      hospitalArrivalTime: ruralHospitalArrival,
      activity: ruralActivity,
      patientName: ruralPatientName,
      patientId: ruralPatientId,
      diagnosis: ruralDiagnosis,
      acceptancePlace: ruralAcceptancePlace,
      calledBy: ruralCalledBy,
      terminationDateTime,
      totalHours,
      timestamp: Date.now(),
      targetMonth: selectedMonth,
      targetYear: selectedYear
    };
    try {
      await setDoc(doc(db, 'ruralAvailability', id), newEntry);
      setRuralCallDate(''); setRuralCallTime(''); setRuralHospitalArrival('');
      setRuralActivity(''); setRuralPatientName(''); setRuralPatientId('');
      setRuralDiagnosis(''); setRuralAcceptancePlace(''); setRuralCalledBy('');
      setRuralEndDate(''); setRuralEndTime('');
      setNotification({ message: "Reporte guardado correctamente", type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `ruralAvailability/${id}`);
    }
  };

  const exportCSV = () => {
    const filtered = ruralAvailabilities.filter(r => r.targetMonth === selectedMonth && r.targetYear === selectedYear);
    if (filtered.length === 0) return alert("No hay datos para exportar.");

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
  };

  if (!session) return null;

  return (
    <motion.div
      key="rural"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto space-y-6 pb-20"
    >
      <div className="flex flex-wrap justify-between items-center gap-2 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-rose-500" />
            Disponibilidades Médicos Rurales
          </h2>
          <p className="text-xs text-slate-500 font-mono">Reporte de traslados, remisiones y actividades de personal rural</p>
        </div>
        {isAdminUser && (
          <div className="flex gap-2">
            <button
              onClick={exportCSV}
              className="bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-black text-xs flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Excel
            </button>
            <button
              onClick={exports.exportRuralPDF}
              className="bg-rose-600 text-white px-3 py-1.5 rounded-lg font-black text-xs flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all shadow-sm"
            >
              <Download className="w-4 h-4" />
              PDF
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-black text-sky-600 mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Nuevo Reporte de Disponibilidad
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400 uppercase font-black ml-2 mb-1 block">Fecha y Hora del Llamado *</label>
                  <div className="flex gap-2">
                    <input type="date" className="flex-1 bg-slate-50 border border-slate-200 px-2 py-1.5 rounded-lg text-sm text-slate-800 outline-none" value={ruralCallDate} onChange={e => setRuralCallDate(e.target.value)} />
                    <input type="time" className="w-28 bg-slate-50 border border-slate-200 px-2 py-1.5 rounded-lg text-sm text-slate-800 outline-none" value={ruralCallTime} onChange={e => setRuralCallTime(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 uppercase font-black ml-2 mb-1 block">Hora de Llegada al Hospital</label>
                  <input type="time" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-800 outline-none focus:border-emerald-500" value={ruralHospitalArrival} onChange={e => setRuralHospitalArrival(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-slate-400 uppercase font-black ml-2 mb-1 block">Nombre del Paciente *</label>
                  <input type="text" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-800 outline-none focus:border-emerald-500" value={ruralPatientName} onChange={e => setRuralPatientName(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-slate-400 uppercase font-black ml-2 mb-1 block">ID / Cédula del Paciente</label>
                  <input type="text" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-800 outline-none focus:border-emerald-500" value={ruralPatientId} onChange={e => setRuralPatientId(e.target.value)} />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400 uppercase font-black ml-2 mb-1 block">Diagnóstico</label>
                  <input type="text" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-800 outline-none focus:border-emerald-500" value={ruralDiagnosis} onChange={e => setRuralDiagnosis(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-slate-400 uppercase font-black ml-2 mb-1 block">Lugar de Aceptación / Remisión</label>
                  <input type="text" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-800 outline-none focus:border-emerald-500" value={ruralAcceptancePlace} onChange={e => setRuralAcceptancePlace(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-slate-400 uppercase font-black ml-2 mb-1 block">¿Quién lo llamó?</label>
                  <input type="text" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-800 outline-none focus:border-emerald-500" value={ruralCalledBy} onChange={e => setRuralCalledBy(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-slate-400 uppercase font-black ml-2 mb-1 block">Fecha y Hora de Término *</label>
                  <div className="flex gap-2">
                    <input type="date" className="flex-1 bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-800 outline-none focus:border-emerald-500" value={ruralEndDate} onChange={e => setRuralEndDate(e.target.value)} />
                    <input type="time" className="w-32 bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-800 outline-none focus:border-emerald-500" value={ruralEndTime} onChange={e => setRuralEndTime(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="text-xs text-slate-400 uppercase font-black ml-2 mb-1 block font-bold">Tipo de Actividad *</label>
                <select
                  className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-slate-800 outline-none mb-4 focus:border-emerald-500"
                  value={ruralActivityType}
                  onChange={e => setRuralActivityType(e.target.value)}
                >
                  {ruralActivityOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>

                <label className="text-xs text-slate-400 uppercase font-black ml-2 mb-1 block font-bold">Actividad (Texto Libre)</label>
                <textarea className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-slate-800 outline-none min-h-[100px] focus:border-emerald-500" value={ruralActivity} onChange={e => setRuralActivity(e.target.value)} placeholder="Describa detalles adicionales de la actividad realizada..." />
              </div>
            </div>

            <button
              onClick={submitRuralAvailability}
              className="w-full mt-4 bg-emerald-600 text-white font-black py-2.5 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-xs shadow-md shadow-emerald-500/20"
            >
              <Send className="w-4 h-4" /> Guardar Reporte
            </button>
          </div>

          {/* History List */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-black text-emerald-600 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Mi Historial de Disponibilidades
            </h3>
            <div className="space-y-4">
              {ruralAvailabilities
                .filter(r => (isAdminUser ? true : r.doctorId === session.doctorId))
                .sort((a, b) => b.callDateTime - a.callDateTime)
                .map(r => (
                  <div key={r.id} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex flex-wrap justify-between items-center gap-4 group hover:border-emerald-500/40 transition-all">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-slate-800 uppercase text-sm"> paciente: {r.patientName}</span>
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-black border border-emerald-200">{r.totalHours} HORAS</span>
                      </div>
                      <div className="text-sm text-slate-500 flex items-center gap-3">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(r.callDateTime).toLocaleDateString()}</span>
                        <span className="flex items-center gap-1"><Info className="w-3 h-3" /> {r.acceptancePlace || 'Sin destino'}</span>
                      </div>
                      <p className="text-sm text-slate-400 mt-2 line-clamp-1 italic">"{r.activity}"</p>
                      {isAdminUser && <div className="text-xs text-slate-400 mt-1">Médico: {r.doctorName}</div>}
                    </div>
                    {isAdminUser && (
                      <button
                        onClick={async () => {
                          if (confirm("¿Eliminar este registro?")) {
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
          <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm">
            <div className="space-y-4">
              <div>
                <p className="text-xs text-emerald-600 uppercase font-black mb-2 flex justify-between">Horas Totales (Mes) <Clock className="w-3 h-3" /></p>
                <div className="text-4xl font-black text-slate-800">
                  {ruralAvailabilities
                    .filter(r => r.targetMonth === selectedMonth && r.targetYear === selectedYear)
                    .reduce((acc, curr) => acc + curr.totalHours, 0).toFixed(1)}h
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100">
                <p className="text-xs text-emerald-600 uppercase font-black mb-4">Top Lugares de Aceptación</p>
                <div className="space-y-2">
                  {Object.entries(
                    ruralAvailabilities
                      .filter(r => r.targetMonth === selectedMonth && r.targetYear === selectedYear)
                      .reduce((acc, curr) => {
                        if (!curr.acceptancePlace) return acc;
                        acc[curr.acceptancePlace] = (acc[curr.acceptancePlace] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>)
                  ).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([place, count]) => (
                    <div key={place} className="flex justify-between items-center text-xs bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <span className="text-slate-700">{place}</span>
                      <span className="bg-emerald-500 text-white font-black px-2 py-0.5 rounded shadow-sm">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100">
                <p className="text-xs text-emerald-600 uppercase font-black mb-4">Top Diagnósticos</p>
                <div className="space-y-2">
                  {Object.entries(
                    ruralAvailabilities
                      .filter(r => r.targetMonth === selectedMonth && r.targetYear === selectedYear)
                      .reduce((acc, curr) => {
                        if (!curr.diagnosis) return acc;
                        acc[curr.diagnosis] = (acc[curr.diagnosis] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>)
                  ).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([diag, count]) => (
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
            <p className="text-xs text-slate-400 leading-relaxed italic">
              Los reportes se consolidan mensualmente. Como administrador, puede filtrar por mes arriba para ver estadísticas de períodos anteriores. Para reportes trimestrales o semestrales, el sistema analiza el acumulado del año actual.
            </p>

            {isAdminUser && (
              <div className="mt-6 space-y-2">
                <button
                  onClick={() => {
                    const qStartMonth = Math.floor(selectedMonth / 3) * 3;
                    const filtered = ruralAvailabilities.filter(r => r.targetMonth >= qStartMonth && r.targetMonth <= qStartMonth + 2 && r.targetYear === selectedYear);
                    alert(`Horas totales en el Trimestre: ${filtered.reduce((a, c) => a + c.totalHours, 0).toFixed(1)}h`);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 text-emerald-600 py-3 rounded-xl text-xs font-black uppercase hover:bg-emerald-50 transition-colors"
                >
                  Cálculo Trimestral Actual
                </button>
                <button
                  onClick={() => {
                    const sStartMonth = Math.floor(selectedMonth / 6) * 6;
                    const filtered = ruralAvailabilities.filter(r => r.targetMonth >= sStartMonth && r.targetMonth <= sStartMonth + 5 && r.targetYear === selectedYear);
                    alert(`Horas totales en el Semestre: ${filtered.reduce((a, c) => a + c.totalHours, 0).toFixed(1)}h`);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 text-emerald-600 py-3 rounded-xl text-xs font-black uppercase hover:bg-emerald-50 transition-colors"
                >
                  Cálculo Semestral Actual
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
