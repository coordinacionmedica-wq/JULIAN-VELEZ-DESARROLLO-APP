import { useAppContext } from '../context/AppContext';
import { SlotType, AuditEntry } from '../types';
import { MONTH_NAMES } from '../constants';
import { setDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

export function useShiftActions() {
  const {
    session, doctors, currentMonthData, setCurrentMonthData, variables,
    selectedMonth, selectedYear, daysInMonth, isMonthPublished,
    notify, pushNotification, updateDoctorMonth, updateMonthlyData,
  } = useAppContext();

  const setShift = async (doctorId: number, day: number, slot: SlotType, rawSigla: string) => {
    if (session?.r !== 'admin' && session?.r !== 'root') return;
    let trimmed = rawSigla.trim() || 'X';
    
    // Special mapping: '0' maps to 'L' (libre)
    if (trimmed === '0') trimmed = 'L';
    
    // Extended reserved list including P and Compensa
    const reservedUpper = ['X', 'PT', 'L', 'CAP', 'P', 'COMPENSA'];
    const varKeys = Object.keys(variables[slot]);
    // Case-insensitive match: find the canonical key from variables or reserved list
    const matchedVar = varKeys.find(k => k.toUpperCase() === trimmed.toUpperCase());
    const matchedReserved = reservedUpper.find(k => k.toUpperCase() === trimmed.toUpperCase());
    const sigla = matchedVar || matchedReserved || null;
    if (!sigla) {
      const validSiglas = [...varKeys, ...reservedUpper].join(', ');
      notify(`Sigla "${trimmed}" no válida para ${slot === 'm' ? 'Mañana' : slot === 't' ? 'Tarde' : 'Noche'}. Válidas: ${validSiglas}`, 'error');
      return;
    }
    
    // Normalize to lowercase for display in grid, but keep canonical form in storage
    const displaySigla = sigla === 'X' ? 'X' : sigla.toLowerCase();
    const docShifts = currentMonthData[doctorId]
      ? { m: { ...currentMonthData[doctorId].m }, t: { ...currentMonthData[doctorId].t }, n: { ...currentMonthData[doctorId].n } }
      : { m: {}, t: {}, n: {} };
    const oldSigla = docShifts[slot][day] || 'X';
    if (oldSigla === sigla) return;
    docShifts[slot][day] = sigla;
    if (sigla === 'CAP') {
      const docData = doctors.find(d => d.id === doctorId);
      if (docData) await pushNotification(doctorId, `CAPACITACIÓN: Día ${day}. Credenciales: ${docData.username}/${docData.password}.`);
    }
    const docData = doctors.find(d => d.id === doctorId);
    const isNovedad = isMonthPublished || new Date().getDate() >= 29;
    try {
      if (isNovedad) {
        const logId = Date.now();
        const newLog: AuditEntry = {
          id: logId, timestamp: Date.now(),
          targetMonth: selectedMonth, targetYear: selectedYear,
          doctorId, doctorName: docData?.nombre || 'Desconocido',
          doctorContact: (docData?.email || docData?.telefono) ?? '',
          day, slot, oldSigla, newSigla: sigla,
          adminName: session?.n || 'Admin',
        };
        await setDoc(doc(db, 'auditLogs', logId.toString()), newLog);
      }
      if (slot === 'n' && sigla !== 'X' && sigla !== 'PT') {
        const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
        if (day < lastDay) docShifts.m[day + 1] = 'PT';
      }
      // Optimistic local update for immediate UI feedback
      setCurrentMonthData(prev => ({ ...prev, [doctorId]: docShifts }));
      await updateDoctorMonth(doctorId, docShifts);
    } catch (err: any) {
      console.error('setShift failed:', err);
      notify('Error al guardar el turno. Intente de nuevo.', 'error');
    }
  };

  const cycleShift = async (doctorId: number, day: number, slot: SlotType) => {
    if (session?.r !== 'admin' && session?.r !== 'root') return;

    const docShifts = currentMonthData[doctorId]
      ? { m: { ...currentMonthData[doctorId].m }, t: { ...currentMonthData[doctorId].t }, n: { ...currentMonthData[doctorId].n } }
      : { m: {}, t: {}, n: {} };

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
    if (nextSigla !== 'X' && nextSigla !== 'PT' && activeOnDay.length > 1) {
      notify(`Nota: El médico ya tiene turno este día (${activeOnDay.join(', ')}).`, 'info');
    }

    const docData = doctors.find(d => d.id === doctorId);
    const today = new Date();
    const isLateInMonth = today.getDate() >= 29;
    const isNovedad = isMonthPublished || isLateInMonth;

    try {
      if (isNovedad) {
        const logId = Date.now();
        const newLog: AuditEntry = {
          id: logId, timestamp: Date.now(),
          targetMonth: selectedMonth, targetYear: selectedYear,
          doctorId, doctorName: docData?.nombre || 'Desconocido',
          doctorContact: (docData?.email || docData?.telefono) ?? '',
          day, slot, oldSigla, newSigla: nextSigla,
          adminName: session?.n || 'Admin',
        };
        await setDoc(doc(db, 'auditLogs', logId.toString()), newLog);
      }

      if (slot === 'n' && nextSigla !== 'X' && nextSigla !== 'PT') {
        const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
        if (day < lastDay) docShifts.m[day + 1] = 'PT';
      }

      setCurrentMonthData(prev => ({ ...prev, [doctorId]: docShifts }));
      await updateDoctorMonth(doctorId, docShifts);
    } catch (err: any) {
      console.error('CycleShift operation failed:', err);
      notify('Error al cambiar el turno.', 'error');
    }
  };

  const publishTurnos = async () => {
    const monthName = MONTH_NAMES[selectedMonth];
    if (!confirm(`¿Desea publicar los turnos y notificar al talento humano para el mes de ${monthName} (${daysInMonth} días)?`)) return;

    const docIdsWithShifts = Object.keys(currentMonthData);
    if (docIdsWithShifts.length === 0) {
      notify('No hay turnos programados para publicar.', 'info');
      return;
    }

    const monthKey = `${selectedYear}_${selectedMonth}`;
    try {
      await setDoc(doc(db, 'monthlyData', monthKey), { published: true }, { merge: true });
      for (const idStr of docIdsWithShifts) {
        await pushNotification(Number(idStr), `📅 TURNERO PUBLICADO: Se ha publicado la programación de ${monthName} ${selectedYear}. Por favor revisa el turnero.`);
      }
      notify(`¡Turnero publicado! Notificados ${docIdsWithShifts.length} funcionarios.`, 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `monthlyData/${monthKey}`);
    }
  };

  const assignFreeDaysToPlanta = async () => {
    if (!confirm("¿Desea asignar automáticamente un día libre ('L') a la semana para todo el personal de PLANTA?")) return;

    const newData = { ...currentMonthData };
    let changesCount = 0;

    doctors.filter(d => d.cat === 'Planta' && d.st === 'activo').forEach(doctor => {
      if (!newData[doctor.id]) newData[doctor.id] = { m: {}, t: {}, n: {} };
      const weeks = [[1, 7], [8, 14], [15, 21], [22, 28], [29, daysInMonth]];

      weeks.forEach(([start, end]) => {
        let hasFree = false;
        for (let d = start; d <= end; d++) {
          if (newData[doctor.id].m[d] === 'L' || newData[doctor.id].t[d] === 'L' || newData[doctor.id].n[d] === 'L') {
            hasFree = true; break;
          }
        }
        if (!hasFree) {
          const available = [];
          for (let d = start; d <= end; d++) {
            if (!newData[doctor.id].m[d] && !newData[doctor.id].t[d] && !newData[doctor.id].n[d]) available.push(d);
          }
          if (available.length > 0) {
            const chosen = available[Math.floor(Math.random() * available.length)];
            newData[doctor.id].m[chosen] = 'L';
            changesCount++;
          }
        }
      });
    });

    try {
      await updateMonthlyData(newData);
      notify(`Días libres asignados: ${changesCount}`, 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'monthlyData');
    }
  };

  const approveRequest = async (reqId: string, doctorId: number, day: number, slot: SlotType) => {
    try {
      await updateDoc(doc(db, 'shiftRequests', reqId), { status: 'approved' });
      await pushNotification(doctorId, `✅ SOLICITUD APROBADA: Tu cambio para el día ${day} (${slot.toUpperCase()}) ha sido autorizado.`);
      notify('Solicitud autorizada y médico notificado', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `shiftRequests/${reqId}`);
    }
  };

  const rejectRequest = async (reqId: string, doctorId: number, day: number, slot: SlotType) => {
    try {
      await updateDoc(doc(db, 'shiftRequests', reqId), { status: 'rejected' });
      await pushNotification(doctorId, `❌ SOLICITUD RECHAZADA: Tu solicitud para el día ${day} (${slot.toUpperCase()}) no pudo ser procesada.`);
      notify('Solicitud rechazada', 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `shiftRequests/${reqId}`);
    }
  };

  const conflictsForDoctor = (doctorId: number): number => {
    let count = 0;
    const shifts = currentMonthData[doctorId];
    if (!shifts) return 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const active = (['m', 't', 'n'] as SlotType[]).filter(s => {
        const v = shifts[s][day] || 'X';
        return v !== 'X' && v !== 'PT';
      });
      if (active.length > 2) count++;
    }
    return count;
  };

  return {
    setShift,
    cycleShift,
    publishTurnos,
    assignFreeDaysToPlanta,
    approveRequest,
    rejectRequest,
    conflictsForDoctor,
  };
}
