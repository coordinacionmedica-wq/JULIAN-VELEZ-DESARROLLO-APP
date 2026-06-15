import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAppContext } from '../context/AppContext';
import { SlotType } from '../types';
import { MONTH_NAMES } from '../constants';

interface TurneroFilterOptions {
  showGridHours: boolean;
  doctorFilter: number[];
  selectedRoles: string[];
  selectedCategories: string[];
}

export function useExportActions(filters: TurneroFilterOptions) {
  const {
    doctors, currentMonthData, variables, selectedMonth, selectedYear,
    daysInMonth, auditLogs, shiftRequests, activities, ruralAvailabilities,
  } = useAppContext();

  const { showGridHours, doctorFilter, selectedRoles, selectedCategories } = filters;

  const getFilteredTurneroData = () => {
    return doctors.filter(d =>
      (selectedRoles.length === 0 || selectedRoles.includes(d.rol || 'Médico General')) &&
      (selectedCategories.length === 0 || selectedCategories.includes(d.cat)) &&
      (doctorFilter.length === 0 || doctorFilter.includes(d.id)) &&
      (d.st === 'activo' || (currentMonthData[d.id] && Object.values(currentMonthData[d.id]).some(f => Object.keys(f).length > 0)))
    ).map(med => {
      let medTotalMonth = 0;
      for (let day = 1; day <= daysInMonth; day++) {
        (['m', 't', 'n'] as SlotType[]).forEach(slot => {
          const sigla = currentMonthData[med.id]?.[slot]?.[day] || 'X';
          medTotalMonth += variables[slot][sigla] || 0;
        });
      }
      return { med, medTotalMonth };
    });
  };

  const exportTurneroExcel = () => {
    const data = getFilteredTurneroData();
    const rows: any[] = [];

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
        if (sIdx === 0) rowData['TOTAL HORAS'] = medTotalMonth;
        rows.push(rowData);
      });
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const totalColIdx = 2 + daysInMonth;
    const totalColLetter = XLSX.utils.encode_col(totalColIdx);

    data.forEach((_, idx) => {
      const rowNum = (idx * 3) + 2;
      for (let j = 0; j < 3; j++) {
        const r = rowNum + j;
        const cellRef = `${totalColLetter}${r}`;
        if (showGridHours) {
          const startCell = XLSX.utils.encode_cell({ r: r - 1, c: 2 });
          const endCell = XLSX.utils.encode_cell({ r: r - 1, c: 1 + daysInMonth });
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
    doc.setFont('helvetica', 'bold');
    doc.text(`Turnero Médico - ${MONTH_NAMES[selectedMonth]} ${selectedYear}`, 14, 15);

    const data = getFilteredTurneroData();
    const daysArr = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
    const tableColumn = ['MÉDICO', 'JORNADA', ...daysArr, 'TOTAL'];
    const tableRows: any[] = [];

    data.forEach(({ med, medTotalMonth }) => {
      (['m', 't', 'n'] as SlotType[]).forEach((slot, sIdx) => {
        const row: any[] = [
          sIdx === 0 ? med.nombre : '',
          slot === 'm' ? 'M' : slot === 't' ? 'T' : 'N',
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
      head: [tableColumn], body: tableRows, startY: 20, theme: 'grid',
      styles: { fontSize: 6, cellPadding: 1, halign: 'center' },
      columnStyles: { 0: { halign: 'left', cellWidth: 30 } },
      headStyles: { fillColor: [5, 150, 105], textColor: 255 },
    });

    doc.save(`Turnero_${MONTH_NAMES[selectedMonth]}_${selectedYear}.pdf`);
  };

  const exportNovedadesExcel = () => {
    const filteredLogs = auditLogs.filter(l => l.targetMonth === selectedMonth && l.targetYear === selectedYear);
    if (filteredLogs.length === 0) return alert('No hay novedades para este mes.');

    const wb = XLSX.utils.book_new();
    const mes = MONTH_NAMES[selectedMonth];

    // ── Hoja 1: Detalle completo ──
    const detail = filteredLogs.map(l => ({
      'Fecha': new Date(l.timestamp).toLocaleDateString('es-CO'),
      'Hora': new Date(l.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      'Día': l.day,
      'Jornada': l.slot === 'm' ? 'Mañana' : l.slot === 't' ? 'Tarde' : 'Noche',
      'Médico': l.doctorName,
      'Cambio': `${l.oldSigla || 'X'} → ${l.newSigla}`,
      'Sigla Anterior': l.oldSigla || 'X',
      'Sigla Nueva': l.newSigla,
      'Realizado por': l.adminName,
    }));
    const ws1 = XLSX.utils.json_to_sheet(detail);
    ws1['!cols'] = [{ wch: 12 }, { wch: 7 }, { wch: 5 }, { wch: 10 }, { wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Detalle Completo');

    // ── Hoja 2: Resumen por médico ──
    const byDoc: Record<number, { name: string; total: number; m: number; t: number; n: number }> = {};
    filteredLogs.forEach(l => {
      if (!byDoc[l.doctorId]) byDoc[l.doctorId] = { name: l.doctorName, total: 0, m: 0, t: 0, n: 0 };
      byDoc[l.doctorId].total++;
      (byDoc[l.doctorId] as any)[l.slot]++;
    });
    const summaryDoc = Object.values(byDoc)
      .sort((a, b) => b.total - a.total)
      .map(d => ({ 'Médico': d.name, 'Total Cambios': d.total, 'Mañana': d.m, 'Tarde': d.t, 'Noche': d.n }));
    summaryDoc.push({ 'Médico': '── TOTAL ──', 'Total Cambios': filteredLogs.length, 'Mañana': filteredLogs.filter(l => l.slot === 'm').length, 'Tarde': filteredLogs.filter(l => l.slot === 't').length, 'Noche': filteredLogs.filter(l => l.slot === 'n').length });
    const ws2 = XLSX.utils.json_to_sheet(summaryDoc);
    ws2['!cols'] = [{ wch: 32 }, { wch: 14 }, { wch: 10 }, { wch: 8 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, ws2, `Por Médico`);

    // ── Hoja 3: Resumen por día ──
    const byDay: Record<number, { day: number; total: number; m: number; t: number; n: number }> = {};
    filteredLogs.forEach(l => {
      if (!byDay[l.day]) byDay[l.day] = { day: l.day, total: 0, m: 0, t: 0, n: 0 };
      byDay[l.day].total++;
      (byDay[l.day] as any)[l.slot]++;
    });
    const summaryDay = Object.values(byDay)
      .sort((a, b) => a.day - b.day)
      .map(d => ({ [`Día de ${mes}`]: d.day, 'Total Cambios': d.total, 'Mañana': d.m, 'Tarde': d.t, 'Noche': d.n }));
    const ws3 = XLSX.utils.json_to_sheet(summaryDay);
    ws3['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 8 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, ws3, 'Por Día');

    XLSX.writeFile(wb, `Novedades_${mes}_${selectedYear}.xlsx`);
  };

  const exportNovedadesPDF = () => {
    const filteredLogs = auditLogs.filter(l => l.targetMonth === selectedMonth && l.targetYear === selectedYear);
    if (filteredLogs.length === 0) return alert('No hay novedades para este mes.');

    const doc = new jsPDF('p', 'pt', 'a4');
    const W = doc.internal.pageSize.width;
    const mes = MONTH_NAMES[selectedMonth];
    const totalM = filteredLogs.filter(l => l.slot === 'm').length;
    const totalT = filteredLogs.filter(l => l.slot === 't').length;
    const totalN = filteredLogs.filter(l => l.slot === 'n').length;

    // Header
    doc.setFillColor(15, 118, 110);
    doc.rect(0, 0, W, 72, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text('REPORTE DE NOVEDADES — TURNERO', 36, 28);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`ESE Hospital Departamental San Rafael de Roldanillo  ·  ${mes.toUpperCase()} ${selectedYear}`, 36, 43);
    doc.text(`Generado: ${new Date().toLocaleString('es-CO')}`, 36, 56);

    // Stats bar
    doc.setFillColor(240, 253, 250);
    doc.rect(30, 82, W - 60, 36, 'F');
    doc.setDrawColor(209, 250, 229);
    doc.rect(30, 82, W - 60, 36, 'S');
    [
      { label: 'Total cambios', value: filteredLogs.length },
      { label: 'Mañana', value: totalM },
      { label: 'Tarde', value: totalT },
      { label: 'Noche', value: totalN },
    ].forEach((s, i) => {
      const x = 70 + i * 120;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(15, 118, 110);
      doc.text(String(s.value), x, 104);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(s.label.toUpperCase(), x, 114);
    });

    // Table
    autoTable(doc, {
      startY: 130,
      head: [['FECHA', 'MÉDICO', 'DÍA', 'JORNADA', 'ANTERIOR', 'NUEVO', 'REALIZADO POR']],
      body: filteredLogs.map(l => [
        new Date(l.timestamp).toLocaleDateString('es-CO'),
        l.doctorName,
        l.day,
        l.slot === 'm' ? 'Mañana' : l.slot === 't' ? 'Tarde' : 'Noche',
        l.oldSigla || 'X',
        l.newSigla,
        l.adminName,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [15, 118, 110], textColor: 255, fontSize: 7.5, fontStyle: 'bold', halign: 'center' },
      bodyStyles: { fontSize: 7.5 },
      alternateRowStyles: { fillColor: [240, 253, 250] },
      columnStyles: {
        0: { cellWidth: 62 }, 1: { cellWidth: 118 }, 2: { cellWidth: 26, halign: 'center' },
        3: { cellWidth: 56, halign: 'center' }, 4: { cellWidth: 44, halign: 'center' },
        5: { cellWidth: 44, halign: 'center' }, 6: { cellWidth: 80 },
      },
      margin: { left: 30, right: 30 },
      didDrawPage: (data: any) => {
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(`Página ${data.pageNumber}  ·  Novedades ${mes} ${selectedYear}  ·  ESE HDSAR`, W / 2, doc.internal.pageSize.height - 14, { align: 'center' });
      },
    });
    doc.save(`Novedades_${mes}_${selectedYear}.pdf`);
  };

  const exportPICExcel = () => {
    const current = activities.filter(a => a.month === selectedMonth && a.year === selectedYear);
    if (current.length === 0) return alert('No hay actividades para exportar.');

    const rows = current.map(a => ({
      'Día': a.day, 'Actividad': a.activityName, 'Lugar': a.place,
      'Modalidad': a.modality, 'Horas': a.hours, 'Responsable': a.responsible,
      'Dirigida a': a.targetGroup, 'Población': a.targetPopulation, 'Estado': a.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `PIC_${MONTH_NAMES[selectedMonth]}`);
    XLSX.writeFile(wb, `PIC_Capacitaciones_${MONTH_NAMES[selectedMonth]}_${selectedYear}.xlsx`);
  };

  const exportPICPDF = () => {
    const current = activities.filter(a => a.month === selectedMonth && a.year === selectedYear);
    if (current.length === 0) return alert('No hay actividades para exportar.');

    const doc = new jsPDF('l', 'pt', 'a4');
    doc.setFillColor(245, 158, 11);
    doc.rect(0, 0, 842, 60, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('PIC - PROGRAMA INSTITUCIONAL DE CAPACITACIONES', 40, 38);
    doc.setFontSize(10);
    doc.text(`PLAN DE CAPACITACIÓN HDSAR - ${MONTH_NAMES[selectedMonth].toUpperCase()} ${selectedYear}`, 40, 52);

    autoTable(doc, {
      startY: 80,
      head: [['DÍA', 'ACTIVIDAD', 'LUGAR', 'MODALIDAD', 'H', 'RESPONSABLE', 'DIRIGIDA A', 'POBLACIÓN']],
      body: current.sort((a, b) => a.day - b.day).map(a => [a.day, a.activityName, a.place, a.modality.toUpperCase(), a.hours, a.responsible, a.targetGroup, a.targetPopulation]),
      theme: 'grid',
      headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 150 }, 2: { cellWidth: 80 }, 3: { cellWidth: 70 }, 4: { cellWidth: 20 }, 5: { cellWidth: 100 }, 6: { cellWidth: 100 }, 7: { cellWidth: 100 } },
      margin: { top: 80 },
    });
    doc.save(`PIC_${MONTH_NAMES[selectedMonth]}_${selectedYear}.pdf`);
  };

  const exportShiftRequests = () => {
    const filtered = shiftRequests.filter(r => r.targetMonth === selectedMonth && r.targetYear === selectedYear);
    if (filtered.length === 0) return alert('No hay solicitudes para exportar.');

    const wb = XLSX.utils.book_new();
    const mes = MONTH_NAMES[selectedMonth];

    // ── Hoja 1: Detalle ──
    const rows = filtered.sort((a, b) => b.timestamp - a.timestamp).map(r => ({
      'Estado': r.status === 'approved' ? 'APROBADA' : r.status === 'rejected' ? 'RECHAZADA' : 'PENDIENTE',
      'Médico': r.doctorName,
      'Día': r.day,
      'Jornada': r.slot === 'm' ? 'Mañana' : r.slot === 't' ? 'Tarde' : 'Noche',
      'Motivo': r.reason,
      'Fecha Solicitud': new Date(r.timestamp).toLocaleString('es-CO'),
    }));
    const ws1 = XLSX.utils.json_to_sheet(rows);
    ws1['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 6 }, { wch: 10 }, { wch: 42 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Solicitudes');

    // ── Hoja 2: Resumen ──
    const pend = filtered.filter(r => r.status === 'pending').length;
    const appr = filtered.filter(r => r.status === 'approved').length;
    const rej  = filtered.filter(r => r.status === 'rejected').length;
    const ws2 = XLSX.utils.json_to_sheet([
      { 'Estado': 'Pendientes', 'Cantidad': pend },
      { 'Estado': 'Aprobadas',  'Cantidad': appr },
      { 'Estado': 'Rechazadas', 'Cantidad': rej  },
      { 'Estado': '── TOTAL ──','Cantidad': filtered.length },
    ]);
    ws2['!cols'] = [{ wch: 14 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Resumen');

    XLSX.writeFile(wb, `Solicitudes_${mes}_${selectedYear}.xlsx`);
  };

  const exportRuralPDF = () => {
    const filtered = ruralAvailabilities.filter(r => r.targetMonth === selectedMonth && r.targetYear === selectedYear);
    if (filtered.length === 0) return alert('No hay registros de disponibilidad rural para exportar.');

    const doc = new jsPDF('l', 'pt', 'a4');
    const W = doc.internal.pageSize.width;
    const mes = MONTH_NAMES[selectedMonth];
    const totalHours = filtered.reduce((sum, r) => sum + (r.totalHours || 0), 0);

    // Header
    doc.setFillColor(2, 132, 199);
    doc.rect(0, 0, W, 72, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text('REGISTRO DE DISPONIBILIDAD RURAL', 36, 28);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`ESE Hospital Departamental San Rafael de Roldanillo  ·  ${mes.toUpperCase()} ${selectedYear}`, 36, 43);
    doc.text(`Total registros: ${filtered.length}  ·  Total horas: ${totalHours.toFixed(1)}h  ·  Generado: ${new Date().toLocaleDateString('es-CO')}`, 36, 57);

    // Stats bar
    doc.setFillColor(240, 249, 255);
    doc.rect(30, 82, W - 60, 34, 'F');
    doc.setDrawColor(186, 230, 253);
    doc.rect(30, 82, W - 60, 34, 'S');
    [
      { label: 'Registros', value: String(filtered.length) },
      { label: 'Horas totales', value: `${totalHours.toFixed(1)}h` },
      { label: 'Médicos involucrados', value: String(new Set(filtered.map(r => r.doctorId)).size) },
    ].forEach((s, i) => {
      const x = 80 + i * 180;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(2, 132, 199);
      doc.text(s.value, x, 103);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(100, 116, 139);
      doc.text(s.label.toUpperCase(), x, 112);
    });

    // Table
    autoTable(doc, {
      startY: 128,
      head: [['MÉDICO', 'FECHA LLAMADO', 'ACTIVIDAD', 'PACIENTE', 'DIAGNÓSTICO', 'LUGAR ACEPT.', 'LLAMADO POR', 'HORAS']],
      body: filtered.sort((a, b) => a.callDateTime - b.callDateTime).map(r => [
        r.doctorName,
        new Date(r.callDateTime).toLocaleDateString('es-CO'),
        r.activity,
        r.patientName,
        r.diagnosis,
        r.acceptancePlace,
        r.calledBy,
        r.totalHours?.toFixed(1) || '0',
      ]),
      theme: 'striped',
      headStyles: { fillColor: [2, 132, 199], textColor: 255, fontSize: 7, fontStyle: 'bold', halign: 'center' },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [240, 249, 255] },
      columnStyles: {
        0: { cellWidth: 100 }, 1: { cellWidth: 72, halign: 'center' }, 2: { cellWidth: 90 },
        3: { cellWidth: 90 }, 4: { cellWidth: 110 }, 5: { cellWidth: 88 },
        6: { cellWidth: 88 }, 7: { cellWidth: 38, halign: 'center' },
      },
      margin: { left: 30, right: 30 },
      didDrawPage: (data: any) => {
        doc.setFontSize(7); doc.setTextColor(148, 163, 184);
        doc.text(`Página ${data.pageNumber}  ·  Disponibilidad Rural ${mes} ${selectedYear}  ·  ESE HDSAR`, W / 2, doc.internal.pageSize.height - 14, { align: 'center' });
      },
    });
    doc.save(`Disponibilidad_Rural_${mes}_${selectedYear}.pdf`);
  };

  const exportRuralExcel = () => {
    const filtered = ruralAvailabilities.filter(r => r.targetMonth === selectedMonth && r.targetYear === selectedYear);
    if (filtered.length === 0) return alert('No hay registros de disponibilidad rural para exportar.');

    const rows = filtered.map(r => ({
      'Médico': r.doctorName,
      'Fecha Llamado': new Date(r.callDateTime).toLocaleString(),
      'Llegada Hospital': r.hospitalArrivalTime,
      'Actividad': r.activity,
      'Paciente': r.patientName,
      'ID Paciente': r.patientId,
      'Diagnóstico': r.diagnosis,
      'Lugar Aceptación': r.acceptancePlace,
      'Llamado por': r.calledBy,
      'Fin': new Date(r.terminationDateTime).toLocaleString(),
      'Horas': r.totalHours,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Rural_${MONTH_NAMES[selectedMonth]}`);
    XLSX.writeFile(wb, `Disponibilidad_Rural_${MONTH_NAMES[selectedMonth]}_${selectedYear}.xlsx`);
  };

  const downloadTemplateExcel = () => {
    const filename = `Plantilla_Turnos_${MONTH_NAMES[selectedMonth]}_${selectedYear}.xlsx`;
    const header = ['ID_MEDICO', 'NOMBRE_MEDICO', 'JORNADA'];
    for (let i = 1; i <= 31; i++) header.push(`DIA_${i}`);

    const templateRows = doctors.filter(d => d.st === 'activo').flatMap(d =>
      (['m', 't', 'n'] as SlotType[]).map(slot => {
        const row: any = { ID_MEDICO: d.id, NOMBRE_MEDICO: d.nombre, JORNADA: slot };
        for (let i = 1; i <= 31; i++) row[`DIA_${i}`] = '';
        return row;
      })
    );

    const ws = XLSX.utils.json_to_sheet(templateRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Turnero');
    XLSX.writeFile(wb, filename);
  };

  return {
    getFilteredTurneroData,
    exportTurneroExcel,
    exportTurneroPDF,
    exportNovedadesExcel,
    exportNovedadesPDF,
    exportPICExcel,
    exportPICPDF,
    exportShiftRequests,
    exportRuralExcel,
    exportRuralPDF,
    downloadTemplateExcel,
  };
}
