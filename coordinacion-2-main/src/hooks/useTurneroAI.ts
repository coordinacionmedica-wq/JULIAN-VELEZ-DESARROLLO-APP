import { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { SlotType, MonthlyData, AuditEntry, Doctor } from '../types';
import { MONTH_NAMES } from '../constants';
import { AppNotification } from '../context/AppContext';

interface AIParams {
  session: { r: string; n: string; doctorId?: number } | null;
  doctors: Doctor[];
  currentMonthData: MonthlyData;
  selectedMonth: number;
  selectedYear: number;
  setCurrentMonthData: React.Dispatch<React.SetStateAction<MonthlyData>>;
  setNotification: React.Dispatch<React.SetStateAction<AppNotification | null>>;
}

export function useTurneroAI(params: AIParams) {
  const { session, doctors, currentMonthData, selectedMonth, selectedYear, setCurrentMonthData, setNotification } = params;

  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<MonthlyData | null>(null);

  const generate = async () => {
    if (!session) return;
    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const activeDoctors = doctors.filter(d => d.st === 'activo');
      const doctorsList = activeDoctors.map((d, index) => ({
        id: d.id, nombre: d.nombre, cat: d.cat, rol: d.rol, index: index + 1
      }));
      const daysCount = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      const prompt = `Eres un experto en gestión de turnos hospitalarios. Genera una propuesta de turnos para el periodo ${MONTH_NAMES[selectedMonth]} ${selectedYear}.
Médicos disponibles: ${JSON.stringify(doctorsList)}
REGLAS ESTRICTAS DE ASIGNACIÓN:
1. Médicos Rurales (Índices 1 al 5): Son los ÚNICOS encargados de las siglas 'D1', 'D2', 'D3' (disponibilidad). Deben rotar estas siglas preferiblemente.
2. Médicos de índices 6 al 8: Pueden hacer disponibilidad pero SOLAMENTE 'D2' o 'D3'. NUNCA 'D1'.
3. Médicos Categoría 'CTA' o Contrato: Deben tener un fin de semana LIBRE (sábado y domingo completo sin turnos) cada 15 días.
4. Médicos Categoría 'Planta': Deben tener la misma cantidad de turnos de noche ('n') en el mes entre ellos, y similar a los de CTA.
5. Reglas Generales:
   - Evitar turnos dobles consecutivos (ej: tarde y luego noche del mismo día es aceptable, pero no mañana, tarde y noche).
   - Máximo un turno por slot (m, t, n) por día.
   - Si un médico tiene Noche ('n'), el día siguiente en la mañana ('m') debe ser 'PT' (Descanso).
SIGLAS DISPONIBLES:
- Mañana (m): M, 10m, 11m, 12m, 13m, 14m, 15m, 16m, D1, PT
- Tarde (t): T, 10t, 11t, 12t, 13t, 14t, 15t, 16t, CX2, D2, PT
- Noche (n): N, 11-10n, 13n, 14n, 16n, 13-10-11n, 13n-16n, D3, PT
Responde ÚNICAMENTE con un objeto JSON (sin markdown, solo el objeto) con esta estructura:
{
  "doctorId": {
    "m": { "1": "SIGLA", "2": "SIGLA", ... },
    "t": { "1": "SIGLA", "2": "SIGLA", ... },
    "n": { "1": "SIGLA", "2": "SIGLA", ... }
  }
}
Donde doctorId es el ID numérico del médico y las llaves de los días son del 1 al ${daysCount}.`;
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      const text = response.text;
      const parsed = JSON.parse(text);
      setSuggestions(parsed);
      setNotification({ message: "Sugerencias de la IA generadas con éxito.", type: 'success' });
    } catch (error) {
      console.error("AI Error:", error);
      setNotification({ message: "Error al generar sugerencias con IA.", type: 'error' });
    } finally {
      setIsGenerating(false);
    }
  };

  const apply = () => {
    if (!suggestions) return;
    setCurrentMonthData(prev => ({ ...prev, ...suggestions }));
    setSuggestions(null);
    setNotification({ message: "Sugerencias aplicadas. Los cambios se han guardado.", type: 'success' });
  };

  const discard = () => setSuggestions(null);

  return { isGenerating, suggestions, generate, apply, discard };
}
