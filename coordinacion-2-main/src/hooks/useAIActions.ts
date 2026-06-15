import { GoogleGenerativeAI } from '@google/generative-ai';
import { useAppContext } from '../context/AppContext';
import { AIEngineSettings, MonthlyData, AuditEntry, SlotType } from '../types';
import { MONTH_NAMES } from '../constants';

const FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-3-flash',
];
const API_KEY = (process as any).env?.GEMINI_API_KEY || '';

export function useAIActions() {
  const {
    session, doctors, variables, currentMonthData, setCurrentMonthData,
    selectedMonth, selectedYear, daysInMonth, shiftRequests, activities,
    auditLogs, ruralAvailabilities, serviceMappings,
    setIsGeneratingAI, setAiReport, notify, updateMonthlyData,
  } = useAppContext();

  const getModel = (modelName: string) => {
    const genAI = new GoogleGenerativeAI(API_KEY);
    return genAI.getGenerativeModel({ model: modelName });
  };

  const generateWithFallback = async (prompt: string, config?: any) => {
    let lastError = '';
    for (const modelName of FALLBACK_MODELS) {
      try {
        const model = getModel(modelName);
        const result = config
          ? await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: config })
          : await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        if (text) return text;
      } catch (err: any) {
        lastError = err?.message || String(err);
        console.warn(`[AI Fallback] ${modelName} failed:`, lastError);
        continue;
      }
    }
    throw new Error(`Todos los modelos fallaron. Último error: ${lastError}`);
  };

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
      SIGLAS DISPONIBLES: ${siglaStats}
      SOLICITUDES / RESTRICCIONES:
      ${monthRequests.map(r => `- Dr. ${r.doctorName} (ID ${r.doctorId}) pidió ${r.slot.toUpperCase()} el día ${r.day}: ${r.reason}`).join('\n')}
      REGLAS INSTITUCIONALES (SHIFT ENGINE V3):
      1. Máximo noches consecutivas: ${settings.maxConsecutiveNights}
      2. Descanso mínimo entre turnos: ${settings.minRestHoursBetweenShifts}h
      3. Máximo turnos por mes: ${settings.maxShiftsPerMonth}
      4. Espaciado fines de semana: ${settings.weekendSpacingWeeks} semanas
      5. Fines de semana libres mínimos: ${settings.mandatoryFreeWeekends}
      6. Priorizar Rurales para Disponibilidad (D1/D2/D3): ${settings.priorityRuralD1 ? 'SÍ' : 'NO'}
      7. Bloquear Tripletes: ${settings.blockTriplets ? 'SÍ' : 'NO'}
      8. Descanso Post-Turno (PT): ${settings.enablePostShiftRest ? 'SÍ' : 'NO'}
      ${settings.customRules ? `OTRAS REGLAS:\n${settings.customRules}` : ''}
      TAREA: Genera una PROPUESTA DE PROGRAMACIÓN lógica y optimizada en Markdown profesional con tablas y secciones de "Razonamiento del Algoritmo".`;

      const text = await generateWithFallback(prompt);
      setAiReport(text || 'No se pudo generar la propuesta.');
    } catch (err) {
      console.error(err);
      setAiReport('Error al generar propuesta con el Engine V3. Verifica el API Key de Gemini.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const generateAIStatsReport = async () => {
    setIsGeneratingAI(true);
    setAiReport(null);
    try {
      const daysCount = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      const activeDoctors = doctors.filter(d => d.st === 'activo');
      const totalPossibleSlots = activeDoctors.length * daysCount * 3;
      let usedSlots = 0, totalHours = 0;
      const areaStats: Record<string, number> = { 'Urgencias': 0, 'Hospitalización': 0, 'Cirugía': 0, 'Consulta Externa': 0, 'Triage': 0, 'Otros': 0 };

      activeDoctors.forEach(d => {
        ['m', 't', 'n'].forEach(slot => {
          for (let day = 1; day <= daysCount; day++) {
            const sigla = currentMonthData[d.id]?.[slot as SlotType]?.[day];
            if (sigla && sigla !== 'X' && sigla !== 'DESC' && sigla !== 'PT') {
              usedSlots++;
              totalHours += variables[slot as SlotType]?.[sigla] || 0;
              const s = sigla.toUpperCase();
              if (s.includes('CX')) areaStats['Cirugía']++;
              else if (s === 'EXT' || s.startsWith('CE')) areaStats['Consulta Externa']++;
              else if (s === 'TR' || d.rol === 'Triage') areaStats['Triage']++;
              else if (s.startsWith('12')) areaStats['Hospitalización']++;
              else if (['M','T','N','10','11','13','14','15','16'].some(x => s.startsWith(x))) areaStats['Urgencias']++;
              else areaStats['Otros']++;
            }
          }
        });
      });

      const monthActivities = activities.filter(a => a.month === selectedMonth && a.year === selectedYear);
      const monthLogs = auditLogs.filter(l => l.targetMonth === selectedMonth && l.targetYear === selectedYear);
      const ruralReports = ruralAvailabilities.filter(r => r.targetMonth === selectedMonth && r.targetYear === selectedYear);

      const prompt = `Actúa como un experto en analítica hospitalaria. Analiza los siguientes indicadores del mes de ${MONTH_NAMES[selectedMonth]} ${selectedYear}:
      ESTADÍSTICAS OPERATIVAS:
      - Capacidad Instalada: ${usedSlots} / ${totalPossibleSlots} (${((usedSlots / totalPossibleSlots) * 100).toFixed(1)}%)
      - Horas totales asistenciales: ${totalHours}h
      DISTRIBUCIÓN POR ÁREAS:
      ${Object.entries(areaStats).map(([k, v]) => `- ${k}: ${v} turnos`).join('\n')}
      CALIDAD Y CAPACITACIÓN (PIC):
      - Actividades Programadas: ${monthActivities.length}
      - Realizadas: ${monthActivities.filter(a => a.status === 'realizada').length}
      - Canceladas: ${monthActivities.filter(a => a.status === 'cancelada').length}
      INDICADORES DE USO:
      - Cambios/Novedades registrados: ${monthLogs.length}
      - Reportes de disponibilidad rural: ${ruralReports.length}
      - Médicos activos: ${activeDoctors.length}
      Genera un análisis estadístico gerencial estructurado. Usa solo negritas y viñetas en Markdown.`;

      const text = await generateWithFallback(prompt);
      setAiReport(text || 'No se pudo generar el reporte.');
    } catch (err) {
      console.error(err);
      setAiReport('Error al generar reporte IA.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const generateAISuggestions = async (): Promise<MonthlyData | null> => {
    if (!session) return null;
    try {
      const activeDoctors = doctors.filter(d => d.st === 'activo');
      const daysCount = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      const doctorsList = activeDoctors.map((d, i) => ({ id: d.id, nombre: d.nombre, cat: d.cat, rol: d.rol, index: i + 1 }));

      const prompt = `Eres un experto en gestión de turnos hospitalarios. Genera una propuesta de turnos para ${MONTH_NAMES[selectedMonth]} ${selectedYear}.
Médicos disponibles: ${JSON.stringify(doctorsList)}
REGLAS:
1. Médicos Rurales (Índices 1-5): ÚNICOS para 'D1', 'D2', 'D3'.
2. Índices 6-8: solo 'D2' o 'D3'. NUNCA 'D1'.
3. CTA/Contrato: fin de semana libre cada 15 días.
4. Planta: misma cantidad de noches entre sí.
5. Si turno Noche ('n'), el siguiente día mañana debe ser 'PT'.
SIGLAS: Mañana: M,10m,11m,12m,13m,14m,15m,16m,D1,PT | Tarde: T,10t,11t,12t,13t,14t,15t,16t,CX2,D2,PT | Noche: N,11-10n,13n,14n,16n,D3,PT
Responde ÚNICAMENTE con JSON (sin markdown):
{"doctorId":{"m":{"1":"SIGLA","2":"SIGLA"},"t":{},"n":{}}}
Donde los días son del 1 al ${daysCount}.`;

      const text = await generateWithFallback(prompt, { responseMimeType: 'application/json' });
      return JSON.parse(text) as MonthlyData;
    } catch (error) {
      console.error('AI Error:', error);
      notify('Error al generar sugerencias con IA.', 'error');
      return null;
    }
  };

  const applyAISuggestions = async (suggestions: MonthlyData) => {
    const now = Date.now();
    const entries: AuditEntry[] = [];

    // Helper: normalize a sigla to match canonical case from variables
    const normalizeSigla = (rawSigla: string, slot: SlotType): string => {
      const trimmed = (rawSigla || '').toString().trim();
      if (!trimmed || trimmed.toUpperCase() === 'X') return 'X';
      const reserved = ['PT', 'L', 'CAP'];
      const matchReserved = reserved.find(r => r === trimmed.toUpperCase());
      if (matchReserved) return matchReserved;
      const varKeys = Object.keys(variables[slot]);
      const matchVar = varKeys.find(k => k.toUpperCase() === trimmed.toUpperCase());
      return matchVar || trimmed;
    };

    // Build a merged dataset: deep-merge AI suggestions into existing currentMonthData
    const merged: MonthlyData = { ...currentMonthData };

    Object.entries(suggestions).forEach(([docIdStr, shifts]) => {
      const docId = parseInt(docIdStr);
      const doctor = doctors.find(d => d.id === docId);
      if (!doctor) return;

      // Normalize AI shift data: ensure day keys are integers and siglas match canonical case
      const normalizedShifts: Record<string, Record<number, string>> = { m: {}, t: {}, n: {} };
      (['m', 't', 'n'] as SlotType[]).forEach(slot => {
        Object.entries((shifts as any)[slot] || {}).forEach(([dayStr, rawSigla]) => {
          const day = parseInt(dayStr);
          if (isNaN(day) || day < 1 || day > 31) return;
          const sigla = normalizeSigla(rawSigla as string, slot);
          if (sigla !== 'X') normalizedShifts[slot][day] = sigla;
        });
      });

      // Deep merge per doctor: keep existing days not overridden by AI
      const existing = currentMonthData[docId] || { m: {}, t: {}, n: {} };
      const mergedShifts = {
        m: { ...existing.m, ...normalizedShifts.m },
        t: { ...existing.t, ...normalizedShifts.t },
        n: { ...existing.n, ...normalizedShifts.n },
      };
      merged[docId] = mergedShifts;

      ['m', 't', 'n'].forEach(slot => {
        Object.entries(normalizedShifts[slot] || {}).forEach(([dayStr, sigla]) => {
          const day = parseInt(dayStr);
          const oldSigla = currentMonthData[docId]?.[slot as SlotType]?.[day] || '';
          if (oldSigla !== sigla) {
            entries.push({
              id: Math.floor(Math.random() * 1000000), timestamp: now,
              targetMonth: selectedMonth, targetYear: selectedYear,
              doctorId: docId, doctorName: doctor.nombre,
              day, slot: slot as SlotType, oldSigla, newSigla: sigla as string,
              adminName: session?.n || 'AI Suggestion',
            });
          }
        });
      });
    });

    // Update local state immediately (optimistic)
    setCurrentMonthData(merged);

    // Persist to Firebase so Firestore listener doesn't overwrite the AI data
    try {
      await updateMonthlyData(merged);
      notify('Malla IA aplicada y guardada correctamente.', 'success');
    } catch (err) {
      console.error('Error saving AI malla to Firebase:', err);
      notify('Malla aplicada localmente. Reconectar para guardar en la nube.', 'info');
    }

    return entries;
  };

  const generateAICapacityReport = async (period: 'semanal' | 'quincenal' | 'mensual') => {
    setIsGeneratingAI(true);
    setAiReport(null);
    try {
      const days = period === 'semanal' ? Array.from({length: 7}, (_, i) => i + 1) :
                   period === 'quincenal' ? Array.from({length: 15}, (_, i) => i + 1) :
                   Array.from({length: daysInMonth}, (_, i) => i + 1);
      let totalHours = 0;
      const hoursByCat: Record<string, number> = { Planta: 0, CTA: 0, APS: 0 };
      const workload: Record<string, number> = {};
      let usedSlots = 0;
      days.forEach(day => {
        doctors.forEach(doc => {
          if (doc.st !== 'activo') return;
          ['m', 't', 'n'].forEach(slot => {
            const sigla = currentMonthData[doc.id]?.[slot as SlotType]?.[day];
            if (sigla && sigla !== 'X' && sigla !== 'DESC') {
              const h = variables[slot as SlotType]?.[sigla] || 0;
              totalHours += h;
              hoursByCat[doc.cat] = (hoursByCat[doc.cat] || 0) + h;
              workload[doc.nombre] = (workload[doc.nombre] || 0) + h;
              usedSlots++;
            }
          });
        });
      });
      const topWorkload = Object.entries(workload).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, h]) => `${n}: ${h}h`).join(', ');
      const prompt = `Analiza la capacidad instalada y el talento humano de un hospital para el periodo ${period} de ${MONTH_NAMES[selectedMonth]} ${selectedYear}.
      Datos:
      - Horas totales programadas: ${totalHours}h
      - Distribución por categoría: Planta (${hoursByCat.Planta || 0}h), CTA (${hoursByCat.CTA || 0}h), APS (${hoursByCat.APS || 0}h)
      - Cobertura de turnos asignados: ${((usedSlots / (days.length * 3)) * 100).toFixed(1)}%
      - Médicos con mayor carga: ${topWorkload}
      - Total médicos activos: ${doctors.filter(d => d.st === 'activo').length}
      Genera un reporte gerencial conciso en español: 1. Resumen de capacidad 2. Análisis de riesgos 3. Recomendaciones estratégicas. Tono profesional y directo.`;
      const text = await generateWithFallback(prompt);
      setAiReport(text || 'No se pudo generar el reporte.');
    } catch (err) {
      console.error(err);
      setAiReport('Error al contactar con la IA. Verifica tu conexión.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const generateAIServiceReport = async () => {
    setIsGeneratingAI(true);
    setAiReport(null);
    try {
      const activeDoctors = doctors.filter(d => d.st === 'activo');
      const serviceStats: Record<string, { hours: number; shifts: number; slotsByDay: number[] }> = {};
      serviceMappings.forEach(m => {
        serviceStats[m.name] = { hours: 0, shifts: 0, slotsByDay: new Array(daysInMonth).fill(0) };
      });
      serviceStats['Otros'] = { hours: 0, shifts: 0, slotsByDay: new Array(daysInMonth).fill(0) };
      let globalTotalHours = 0, globalUsedSlots = 0;
      activeDoctors.forEach(doc => {
        (['m', 't', 'n'] as SlotType[]).forEach(slot => {
          for (let d = 1; d <= daysInMonth; d++) {
            const sigla = currentMonthData[doc.id]?.[slot]?.[d];
            if (sigla && sigla !== 'X' && sigla !== 'DESC' && sigla !== 'PT') {
              const h = variables[slot][sigla] || 0;
              globalTotalHours += h;
              globalUsedSlots++;
              const mapping = serviceMappings.find(m => m.siglas.some(s => s.trim().toUpperCase() === sigla.trim().toUpperCase()));
              const target = mapping ? serviceStats[mapping.name] : serviceStats['Otros'];
              target.hours += h;
              target.shifts++;
              target.slotsByDay[d - 1]++;
            }
          }
        });
      });
      const serviceDetails = Object.entries(serviceStats).map(([name, stats]) => {
        const peakDay = stats.slotsByDay.indexOf(Math.max(...stats.slotsByDay)) + 1;
        const avgShiftsPerDay = (stats.shifts / daysInMonth).toFixed(2);
        return `- **${name}**: ${stats.hours}h totales, ${stats.shifts} turnos. (Promedio diario: ${avgShiftsPerDay}. Pico: Día ${peakDay})`;
      }).join('\n');
      const totalCapacityPossible = activeDoctors.length * daysInMonth * 3;
      const prompt = `Actúa como un Consultor de Gerencia Hospitalaria. Analiza los datos de servicios del mes de ${MONTH_NAMES[selectedMonth]} ${selectedYear}:
ESTADÍSTICAS POR SERVICIO:\n${serviceDetails}
DATOS GLOBALES:
- Total Médicos Activos: ${activeDoctors.length}
- Horas Totales Ejecutadas: ${globalTotalHours}h
- Slots Utilizados: ${globalUsedSlots} de ${totalCapacityPossible} (${((globalUsedSlots/totalCapacityPossible)*100).toFixed(1)}%)
- Novedades/Cambios: ${auditLogs.filter(l => l.targetMonth === selectedMonth).length}
Genera un INFORME GERENCIAL que incluya: 1. ANÁLISIS DE OCUPACIÓN 2. PATRONES DE USO 3. CAPACIDAD INSTALADA 4. RECOMENDACIONES ESTRATÉGICAS. Tono directivo, formal y conciso en español.`;
      const text = await generateWithFallback(prompt);
      setAiReport(text || 'No se pudo generar el reporte.');
    } catch (err) {
      console.error(err);
      setAiReport('Error al generar análisis de servicios. Intente nuevamente.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  return {
    generateAISchedulingProposal,
    generateAIStatsReport,
    generateAICapacityReport,
    generateAIServiceReport,
    generateAISuggestions,
    applyAISuggestions,
  };
}
