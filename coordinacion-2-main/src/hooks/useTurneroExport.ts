import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SlotType, MonthlyData, VarSlotConfig, Doctor } from '../types';
import { MONTH_NAMES } from '../constants';

interface ExportParams {
  doctors: Doctor[];
  currentMonthData: MonthlyData;
  variables: VarSlotConfig;
  selectedMonth: number;
  selectedYear: number;
  daysInMonth: number;
  showGridHours: boolean;
  selectedRoles: string[];
  selectedCategories: string[];
  doctorFilter: number[];
}

export function useTurneroExport(params: ExportParams) {
  const {
    doctors, currentMonthData, variables,
    selectedMonth, selectedYear, daysInMonth,
    showGridHours, selectedRoles, selectedCategories, doctorFilter
  } = params;

  const getFilteredData = () => {
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

  const exportExcel = () => {
    const data = getFilteredData();
    const monthLabel = `${MONTH_NAMES[selectedMonth].toUpperCase()} ${selectedYear}`;
    const totalCol = 2 + daysInMonth;

    // Build rows array-of-arrays for clean Excel generation
    const rows: any[][] = [];

    // ── Title row ──
    rows.push([`COORDINACIÓN MÉDICA — ESE Hospital Departamental San Antonio de Roldanillo`]);
    // ── Period row ──
    rows.push([`Turnero Médico — ${monthLabel}`]);

    // ── Header row ──
    const headerRow = ['MÉDICO', 'J'];
    const dayNames = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(selectedYear, selectedMonth, d).getDay();
      headerRow.push(`${d} ${dayNames[dow]}`);
    }
    headerRow.push('TOTAL HORAS');
    rows.push(headerRow);

    // ── Data rows ──
    data.forEach(({ med, medTotalMonth }) => {
      const slotLabels: Record<string, string> = { m: 'M', t: 'T', n: 'N' };
      (['m', 't', 'n'] as SlotType[]).forEach((slot, sIdx) => {
        const isFirstRow = sIdx === 0;
        const row: any[] = [
          isFirstRow ? `${med.genero === 'F' ? 'Dra.' : 'Dr.'} ${med.nombre}` : '',
          slotLabels[slot],
        ];
        for (let d = 1; d <= daysInMonth; d++) {
          const val = currentMonthData[med.id]?.[slot]?.[d] || 'X';
          row.push(val !== 'X'
            ? (showGridHours ? (variables[slot][val] || 0) : val)
            : '');
        }
        row.push(isFirstRow ? medTotalMonth : '');
        rows.push(row);
      });
      // separator row
      rows.push(Array(totalCol + 1).fill(''));
    });

    // ── Global total row ──
    const globalTotal = data.reduce((acc, { medTotalMonth }) => acc + medTotalMonth, 0);
    const totalRow: any[] = Array(totalCol).fill('');
    totalRow[0] = 'TOTAL GENERAL';
    totalRow[totalCol] = globalTotal;
    rows.push(totalRow);

    // ── Create workbook ──
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();

    // Column widths
    ws['!cols'] = [
      { wch: 28 },
      { wch: 4 },
      ...Array.from({ length: daysInMonth }, (_, i) => {
        const dow = new Date(selectedYear, selectedMonth, i + 1).getDay();
        return { wch: dow === 0 || dow === 6 ? 5 : 4 };
      }),
      { wch: 10 },
    ];

    // Merges for title and period rows
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: totalCol } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: totalCol } },
    ];

    XLSX.utils.book_append_sheet(wb, ws, `Turnero ${MONTH_NAMES[selectedMonth]}`);

    // ── Legend sheet ──
    const legendData = [
      ['LEYENDA DEL TURNERO'],
      [],
      ['SIGLA', 'SIGNIFICADO', 'HORAS'],
      ['M', 'Jornada Mañana (7:00 – 13:00)', '6h'],
      ['T', 'Jornada Tarde (13:00 – 19:00)', '6h'],
      ['N', 'Jornada Noche (19:00 – 7:00)', '12h'],
      ['PT', 'Post-Turno / Descanso compensatorio', '0h'],
      [],
      ['CATEGORÍA', 'DESCRIPCIÓN', 'RANGO HORAS/MES'],
      ['Planta', 'Personal de planta', '150 – 200h'],
      ['CTA', 'Contratista', '150 – 200h'],
      ['APS', 'Atención Primaria en Salud', '100 – 160h'],
      ['Rural', 'Médico rural', 'Variable'],
      ['Disponibilidad', 'Disponibilidad llamada', 'Variable'],
    ];
    const wsLegend = XLSX.utils.aoa_to_sheet(legendData);
    wsLegend['!cols'] = [{ wch: 18 }, { wch: 42 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsLegend, 'Leyenda');

    XLSX.writeFile(wb, `Turnero_${MONTH_NAMES[selectedMonth]}_${selectedYear}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF('landscape');
    doc.setFont("helvetica", "bold");
    doc.text(`Turnero Médico - ${MONTH_NAMES[selectedMonth]} ${selectedYear}`, 14, 15);
    const data = getFilteredData();
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
    autoTable(doc, {
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

  return { exportExcel, exportPDF, getFilteredData };
}
