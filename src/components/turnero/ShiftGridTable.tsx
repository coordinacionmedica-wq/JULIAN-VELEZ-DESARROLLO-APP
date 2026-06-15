import React, { useState, useMemo } from 'react';
import { useDragScroll } from '../../hooks/useDragScroll';
import { Eye, EyeOff, CheckSquare } from 'lucide-react';
import { SlotType, MonthlyData, VarSlotConfig, Doctor } from '../../types';
import { DAY_NAMES } from '../../constants';

interface ShiftGridTableProps {
  doctors: Doctor[];
  currentMonthData: MonthlyData;
  variables: VarSlotConfig;
  selectedMonth: number;
  selectedYear: number;
  daysInMonth: number;
  showGridHours: boolean;
  isAdmin: boolean;
  onSetShift: (doctorId: number, day: number, slot: SlotType, sigla: string) => Promise<void>;
  updateDoctorMonth: (doctorId: number, shifts: any) => Promise<void>;
  conflicts: {
    personal: Record<string, { type: string; message: string }[]>;
    coverage: Record<string, string[]>;
  };
  sundays: number[];
  compactView?: boolean;
}

// Hour limits per category
const HOUR_LIMITS: Record<string, { min: number; max: number }> = {
  'Planta': { min: 150, max: 200 },
  'CTA': { min: 150, max: 200 },
  'APS': { min: 100, max: 160 },
  'Rural': { min: 120, max: 180 },
  'Disponibilidad': { min: 0, max: 48 },
};

export function ShiftGridTable(props: ShiftGridTableProps) {
  const {
    doctors, currentMonthData, variables,
    selectedMonth, selectedYear, daysInMonth,
    showGridHours, isAdmin, onSetShift, updateDoctorMonth, conflicts, sundays,
    compactView,
  } = props;

  const [editingCell, setEditingCell] = useState<{ doctorId: number; day: number; slot: SlotType } | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [pasteMessage, setPasteMessage] = useState('');
  const [focusedDoctorId, setFocusedDoctorId] = useState<number | null>(null);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ doctorId: number; day: number; slot: SlotType } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleSetShift = async (doctorId: number, day: number, slot: SlotType, value: string) => {
    await onSetShift(doctorId, day, slot, value);
    setEditingCell(null);
  };

  // Multi-cell selection handlers
  const getCellKey = (doctorId: number, day: number, slot: SlotType) => `${doctorId}-${day}-${slot}`;

  const handleCellClick = (doctorId: number, day: number, slot: SlotType, e: React.MouseEvent) => {
    if (!isAdmin) return;

    if (e.shiftKey && selectionStart) {
      // Range selection
      const newSelection = new Set<string>();
      const startIdx = rowOrder.findIndex(r => r.doctorId === selectionStart.doctorId && r.slot === selectionStart.slot);
      const endIdx = rowOrder.findIndex(r => r.doctorId === doctorId && r.slot === slot);
      const minIdx = Math.min(startIdx, endIdx);
      const maxIdx = Math.max(startIdx, endIdx);
      const minDay = Math.min(selectionStart.day, day);
      const maxDay = Math.max(selectionStart.day, day);

      for (let i = minIdx; i <= maxIdx; i++) {
        const { doctorId: dId, slot: s } = rowOrder[i];
        for (let d = minDay; d <= maxDay; d++) {
          newSelection.add(getCellKey(dId, d, s));
        }
      }
      setSelectedCells(newSelection);
    } else if (e.ctrlKey || e.metaKey) {
      // Toggle single cell selection
      const key = getCellKey(doctorId, day, slot);
      const newSelection = new Set(selectedCells);
      if (newSelection.has(key)) {
        newSelection.delete(key);
      } else {
        newSelection.add(key);
      }
      setSelectedCells(newSelection);
      setSelectionStart({ doctorId, day, slot });
    } else {
      // Normal click - start editing or clear selection
      if (selectedCells.size > 0) {
        setSelectedCells(new Set());
        setSelectionStart(null);
      }
      setEditingCell({ doctorId, day, slot });
      setEditingValue((currentMonthData[doctorId]?.[slot]?.[day] || 'X') === 'X' ? '' : currentMonthData[doctorId]?.[slot]?.[day] || '');
    }
  };

  const handleCellMouseDown = (doctorId: number, day: number, slot: SlotType, e: React.MouseEvent) => {
    if (!isAdmin || e.button !== 0) return; // Only left click
    e.preventDefault();
    setIsDragging(true);
    setSelectionStart({ doctorId, day, slot });
    setSelectedCells(new Set([getCellKey(doctorId, day, slot)]));
  };

  const handleCellMouseEnter = (doctorId: number, day: number, slot: SlotType, e: React.MouseEvent) => {
    if (!isAdmin || !isDragging || !selectionStart) return;

    // Calculate range from selectionStart to current cell
    const newSelection = new Set<string>();
    const startIdx = rowOrder.findIndex(r => r.doctorId === selectionStart.doctorId && r.slot === selectionStart.slot);
    const endIdx = rowOrder.findIndex(r => r.doctorId === doctorId && r.slot === slot);
    const minIdx = Math.min(startIdx, endIdx);
    const maxIdx = Math.max(startIdx, endIdx);
    const minDay = Math.min(selectionStart.day, day);
    const maxDay = Math.max(selectionStart.day, day);

    for (let i = minIdx; i <= maxIdx; i++) {
      const { doctorId: dId, slot: s } = rowOrder[i];
      for (let d = minDay; d <= maxDay; d++) {
        newSelection.add(getCellKey(dId, d, s));
      }
    }
    setSelectedCells(newSelection);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDeleteSelected = async () => {
    if (!isAdmin || selectedCells.size === 0) return;

    // Group cells by doctorId for bulk update
    const cellsByDoctor: Record<number, Set<string>> = {};
    for (const cellKey of selectedCells) {
      const [doctorId] = cellKey.split('-');
      if (!cellsByDoctor[Number(doctorId)]) {
        cellsByDoctor[Number(doctorId)] = new Set();
      }
      cellsByDoctor[Number(doctorId)].add(cellKey);
    }

    // Update each doctor's shifts in bulk
    for (const [doctorId, cellKeys] of Object.entries(cellsByDoctor)) {
      const docId = Number(doctorId);
      const shifts: any = { m: {}, t: {}, n: {} };

      // Get current shifts for this doctor
      const currentShifts = currentMonthData[docId] || { m: {}, t: {}, n: {} };
      shifts.m = { ...currentShifts.m };
      shifts.t = { ...currentShifts.t };
      shifts.n = { ...currentShifts.n };

      // Set all selected cells to 'X'
      for (const cellKey of cellKeys) {
        const [, day, slot] = cellKey.split('-');
        shifts[slot as SlotType][Number(day)] = 'X';
      }

      // Use bulk update instead of individual setShift calls
      await onSetShift(docId, 0, 'm', ''); // Dummy call to trigger update
      // Directly update the data
      await updateDoctorMonth(docId, shifts);
    }

    setSelectedCells(new Set());
    setSelectionStart(null);
    setPasteMessage(`✓ ${selectedCells.size} celdas borradas`);
    setTimeout(() => setPasteMessage(''), 3000);
  };

  const handleSelectDoctorCells = (doctorId: number) => {
    if (!isAdmin) return;
    const newSelection = new Set<string>();
    for (let d = 1; d <= daysInMonth; d++) {
      for (const slot of ['m', 't', 'n'] as SlotType[]) {
        newSelection.add(getCellKey(doctorId, d, slot));
      }
    }
    setSelectedCells(newSelection);
    setSelectionStart({ doctorId, day: 1, slot: 'm' });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isAdmin) return;

    // Ctrl+A: Select all cells of first visible doctor or current editing doctor
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault();
      const doctorId = editingCell?.doctorId || doctors[0]?.id;
      if (doctorId) handleSelectDoctorCells(doctorId);
      return;
    }

    // Simple arrow keys: Navigate between cells (when editing)
    if (editingCell && !e.ctrlKey && !e.shiftKey) {
      const { doctorId, day, slot } = editingCell;
      let newDay = day;
      let newSlot = slot;
      let newDoctorId = doctorId;

      if (e.key === 'ArrowRight') {
        newDay = Math.min(day + 1, daysInMonth);
      } else if (e.key === 'ArrowLeft') {
        newDay = Math.max(day - 1, 1);
      } else if (e.key === 'ArrowDown') {
        const slotOrder: SlotType[] = ['m', 't', 'n'];
        const currentIdx = slotOrder.indexOf(slot);
        if (currentIdx < slotOrder.length - 1) {
          newSlot = slotOrder[currentIdx + 1];
        } else {
          // Move to next doctor
          const currentDoctorIdx = doctors.findIndex(d => d.id === doctorId);
          if (currentDoctorIdx < doctors.length - 1) {
            newDoctorId = doctors[currentDoctorIdx + 1].id;
            newSlot = 'm';
          }
        }
      } else if (e.key === 'ArrowUp') {
        const slotOrder: SlotType[] = ['m', 't', 'n'];
        const currentIdx = slotOrder.indexOf(slot);
        if (currentIdx > 0) {
          newSlot = slotOrder[currentIdx - 1];
        } else {
          // Move to previous doctor
          const currentDoctorIdx = doctors.findIndex(d => d.id === doctorId);
          if (currentDoctorIdx > 0) {
            newDoctorId = doctors[currentDoctorIdx - 1].id;
            newSlot = 'n';
          }
        }
      } else {
        return; // Not an arrow key
      }

      e.preventDefault();
      setEditingCell({ doctorId: newDoctorId, day: newDay, slot: newSlot });
      setEditingValue((currentMonthData[newDoctorId]?.[newSlot]?.[newDay] || 'X') === 'X' ? '' : currentMonthData[newDoctorId]?.[newSlot]?.[newDay] || '');
      return;
    }

    // Ctrl+Shift+Arrow keys: Extend selection (works when editing or with selection)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
      e.preventDefault();

      // If no selection start, use current editing cell as start
      if (!selectionStart && editingCell) {
        setSelectionStart({ doctorId: editingCell.doctorId, day: editingCell.day, slot: editingCell.slot });
        setSelectedCells(new Set([getCellKey(editingCell.doctorId, editingCell.day, editingCell.slot)]));
        return;
      }

      if (!selectionStart) return;

      const currentDoctorId = editingCell?.doctorId || selectionStart.doctorId;
      const currentDay = editingCell?.day || selectionStart.day;
      const currentSlot = editingCell?.slot || selectionStart.slot;

      let newDay = currentDay;
      let newSlot = currentSlot;

      if (e.key === 'ArrowRight') {
        newDay = Math.min(currentDay + 1, daysInMonth);
      } else if (e.key === 'ArrowLeft') {
        newDay = Math.max(currentDay - 1, 1);
      } else if (e.key === 'ArrowDown') {
        const slotOrder: SlotType[] = ['m', 't', 'n'];
        const currentIdx = slotOrder.indexOf(currentSlot);
        if (currentIdx < slotOrder.length - 1) {
          newSlot = slotOrder[currentIdx + 1];
        }
      } else if (e.key === 'ArrowUp') {
        const slotOrder: SlotType[] = ['m', 't', 'n'];
        const currentIdx = slotOrder.indexOf(currentSlot);
        if (currentIdx > 0) {
          newSlot = slotOrder[currentIdx - 1];
        }
      }

      // Extend selection from selectionStart to new position
      const newSelection = new Set<string>();
      const startIdx = rowOrder.findIndex(r => r.doctorId === selectionStart.doctorId && r.slot === selectionStart.slot);
      const endIdx = rowOrder.findIndex(r => r.doctorId === currentDoctorId && r.slot === newSlot);
      const minIdx = Math.min(startIdx, endIdx);
      const maxIdx = Math.max(startIdx, endIdx);
      const minDay = Math.min(selectionStart.day, newDay);
      const maxDay = Math.max(selectionStart.day, newDay);

      for (let i = minIdx; i <= maxIdx; i++) {
        const { doctorId: dId, slot: s } = rowOrder[i];
        for (let d = minDay; d <= maxDay; d++) {
          newSelection.add(getCellKey(dId, d, s));
        }
      }
      setSelectedCells(newSelection);
    }

    // Escape: Clear selection
    if (e.key === 'Escape' && selectedCells.size > 0) {
      e.preventDefault();
      setSelectedCells(new Set());
      setSelectionStart(null);
    }
  };

  // Build ordered list of (doctorId, slot) rows for paste navigation
  const rowOrder = useMemo(() => {
    const rows: { doctorId: number; slot: SlotType }[] = [];
    doctors.forEach(med => {
      (['m', 't', 'n'] as SlotType[]).forEach(slot => {
        rows.push({ doctorId: med.id, slot });
      });
    });
    return rows;
  }, [doctors]);

  // Bulk paste handler: parses tab/newline-separated clipboard data from Excel
  const handleBulkPaste = async (e: React.ClipboardEvent) => {
    if (!isAdmin) return;

    const text = e.clipboardData.getData('text/plain');
    if (!text) return;

    // If no editing cell, use first visible doctor/slot as starting point
    const startRowIdx = editingCell
      ? rowOrder.findIndex(r => r.doctorId === editingCell.doctorId && r.slot === editingCell.slot)
      : 0;

    const startDay = editingCell ? editingCell.day : 1;

    // Handle single cell paste (no tabs)
    if (!text.includes('\t')) {
      e.preventDefault();
      const value = text.trim() || 'X';
      // Paste to current editing cell or first visible cell
      if (editingCell) {
        await onSetShift(editingCell.doctorId, editingCell.day, editingCell.slot, value);
        setEditingCell(null);
        setPasteMessage(`✓ 1 celda pegada`);
      } else if (rowOrder.length > 0) {
        // Paste to first visible cell
        const { doctorId, slot } = rowOrder[0];
        await onSetShift(doctorId, startDay, slot, value);
        setPasteMessage(`✓ 1 celda pegada`);
      }
      setTimeout(() => setPasteMessage(''), 3000);
      return;
    }

    // Handle multi-cell paste (with tabs) - use bulk updates to avoid Firestore conflicts
    e.preventDefault();
    const rows = text.split(/\r?\n/).filter(r => r.trim());
    if (rows.length === 0) return;

    // Group updates by doctorId for bulk operations
    const updatesByDoctor: Record<number, any> = {};

    for (let ri = 0; ri < rows.length; ri++) {
      const cells = rows[ri].split('\t');
      const currentRowIdx = startRowIdx + ri;
      if (currentRowIdx >= rowOrder.length) break;
      const { doctorId, slot } = rowOrder[currentRowIdx];

      // Initialize shifts for this doctor if not exists
      if (!updatesByDoctor[doctorId]) {
        const currentShifts = currentMonthData[doctorId] || { m: {}, t: {}, n: {} };
        updatesByDoctor[doctorId] = {
          m: { ...currentShifts.m },
          t: { ...currentShifts.t },
          n: { ...currentShifts.n }
        };
      }

      for (let ci = 0; ci < cells.length; ci++) {
        const day = startDay + ci;
        if (day > daysInMonth) break;
        const value = cells[ci].trim() || 'X';
        updatesByDoctor[doctorId][slot][day] = value;
      }
    }

    // Apply bulk updates for each doctor
    let cellCount = 0;
    for (const [doctorId, shifts] of Object.entries(updatesByDoctor)) {
      await updateDoctorMonth(Number(doctorId), shifts);
      // Count total cells updated
      cellCount += Object.values(shifts.m).length + Object.values(shifts.t).length + Object.values(shifts.n).length;
    }

    if (editingCell) setEditingCell(null);
    setPasteMessage(`✓ ${cellCount} celdas pegadas`);
    setTimeout(() => setPasteMessage(''), 3000);
  };


  return (
    <div className="relative" onPaste={handleBulkPaste}>
      {/* Mobile hint + focus mode badge */}
      <div className="flex items-center justify-between px-2 pb-1">
        {focusedDoctorId !== null && (
          <button
            onClick={() => setFocusedDoctorId(null)}
            className="flex items-center gap-1.5 bg-slate-700 text-white text-xs font-black px-3 py-1.5 rounded-full hover:bg-slate-600  shadow-md"
          >
            <EyeOff className="w-3.5 h-3.5" />
            Ver todos los médicos
          </button>
        )}
        {selectedCells.size > 0 && isAdmin && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600">{selectedCells.size} celdas seleccionadas</span>
            <button
              onClick={handleDeleteSelected}
              className="flex items-center gap-1.5 bg-rose-500 text-white text-xs font-black px-3 py-1.5 rounded-full hover:bg-rose-600 shadow-md"
            >
              Borrar selección
            </button>
          </div>
        )}
      </div>

      {pasteMessage && (
        <div className="absolute top-2 right-4 z-50 bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg animate-pulse">
          {pasteMessage}
        </div>
      )}

      {/* EXCEL-STYLE TABLE - All devices */}
      <div
        ref={useDragScroll<HTMLDivElement>()}
        className="overflow-auto border border-slate-200 rounded-xl md:rounded-[18px] bg-white shadow-xl max-h-[calc(100vh-280px)] custom-scrollbar -mx-1 md:mx-0"
        style={{ WebkitOverflowScrolling: 'touch' }}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <table className="w-full text-xs md:text-xs text-center border-collapse">
          <thead className="sticky top-0 z-40">
            <tr className="bg-slate-50">
              <th className="sticky left-0 top-0 bg-slate-50 z-50 min-w-[110px] md:min-w-[180px] text-left px-2 md:px-4 py-3 md:py-4 text-sky-700 border-r-2 border-sky-500 border-b border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.05)] text-xs font-black">
                MÉDICO
              </th>
              <th className="w-6 md:w-8 border border-slate-200 text-slate-400 font-black border-b text-xs">J.</th>
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const dow = new Date(selectedYear, selectedMonth, day).getDay();
                return (
                  <th key={day} className={`px-0.5 md:px-2 py-1 md:py-2 border border-slate-200 border-b bg-slate-50 ${dow === 0 ? 'border-r-2 border-r-sky-500' : ''} ${dow === 0 || dow === 6 ? 'bg-sky-50/50' : ''}`}>
                    <div className="text-slate-800 text-xs md:text-sm font-bold">{day}</div>
                    <div className="text-[9px] md:text-xs text-emerald-600 uppercase font-bold">{DAY_NAMES[dow]}</div>
                  </th>
                );
              })}
              {sundays.map((_, i) => (
                <th key={i} className="min-w-[30px] md:min-w-[40px] px-1 md:px-2 bg-slate-100 border border-slate-200 border-b text-[7px] md:text-[8px] text-sky-600 font-bold sticky top-0">
                  S{i + 1}
                </th>
              ))}
              <th className="sticky right-0 top-0 z-50 bg-sky-500 text-white font-black px-2 md:px-4 min-w-[40px] md:min-w-[60px] border-b border-slate-200 shadow-[-2px_0_5px_rgba(0,0,0,0.1)] text-[8px] md:text-xs">TOT</th>
            </tr>
          </thead>
          <tbody>
            {(focusedDoctorId !== null ? doctors.filter(d => d.id === focusedDoctorId) : doctors).map(med => {
              let medTotalMonth = 0;
              let weeklyAcc = Array(sundays.length).fill(0);

              for (let d = 1; d <= daysInMonth; d++) {
                (['m', 't', 'n'] as SlotType[]).forEach(slot => {
                  const sigla = currentMonthData[med.id]?.[slot]?.[d] || 'X';
                  // Ensure empty/invalid siglas don't add hours
                  const peso = (sigla && sigla !== 'X' && variables[slot][sigla]) ? variables[slot][sigla] : 0;
                  medTotalMonth += peso;
                  const wIdx = sundays.findIndex(sunD => d <= sunD);
                  if (wIdx !== -1) weeklyAcc[wIdx] += peso;
                });
              }

              const limits = HOUR_LIMITS[med.cat] || { min: 0, max: 999 };
              const hourStatus = medTotalMonth < limits.min ? 'low' : medTotalMonth > limits.max ? 'high' : 'ok';

              // ── Compact View: single row per doctor ──
              if (compactView) {
                return (
                  <tr key={med.id} className="group border-b-2 border-slate-200">
                    <td className="sticky left-0 bg-white z-20 text-left px-2 md:px-4 border-r-2 border-sky-500 border-b border-slate-200 shadow-xl">
                      <div className="flex items-center justify-between gap-1">
                        <div className="font-black text-slate-800 text-xs md:text-sm whitespace-nowrap truncate max-w-[80px] md:max-w-none">
                          {med.genero === 'F' ? 'Dra.' : 'Dr.'} {med.nombre}
                        </div>
                        <div className="flex items-center gap-1">
                          {isAdmin && (
                            <button
                              onClick={() => handleSelectDoctorCells(med.id)}
                              title="Seleccionar todas las celdas de este médico"
                              className="shrink-0 p-1 rounded-md hover:bg-sky-100 text-sky-500"
                            >
                              <CheckSquare className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => setFocusedDoctorId(med.id)}
                            title="Ver solo este médico"
                            className="shrink-0 p-1 rounded-md hover:bg-sky-100 text-sky-500 "
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-xs text-slate-400 font-bold">{med.cat}</span>
                        <span className={`text-xs font-bold ${hourStatus === 'low' ? 'text-amber-600' : hourStatus === 'high' ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {medTotalMonth}h
                        </span>
                      </div>
                    </td>
                    <td className="bg-slate-50 text-slate-400 font-black text-xs py-1 border-r border-slate-200">—</td>
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const d = i + 1;
                      const dow = new Date(selectedYear, selectedMonth, d).getDay();
                      const m = currentMonthData[med.id]?.m?.[d] || 'X';
                      const t = currentMonthData[med.id]?.t?.[d] || 'X';
                      const n = currentMonthData[med.id]?.n?.[d] || 'X';
                      const activeCount = [m, t, n].filter(v => v !== 'X' && v !== 'PT' && v !== 'L' && v !== 'CAP').length;
                      const hasPT = [m, t, n].includes('PT');
                      const bg = activeCount === 0 ? '' : activeCount === 1 ? 'bg-emerald-100' : activeCount >= 2 ? 'bg-sky-200' : '';
                      return (
                        <td
                          key={d}
                          onMouseDown={(e) => {
                            // For compact view, select all 3 slots for this day
                            if (!isAdmin || e.button !== 0) return;
                            e.preventDefault();
                            setIsDragging(true);
                            setSelectionStart({ doctorId: med.id, day: d, slot: 'm' });
                            const newSelection = new Set<string>();
                            for (const slot of ['m', 't', 'n'] as SlotType[]) {
                              newSelection.add(getCellKey(med.id, d, slot));
                            }
                            setSelectedCells(newSelection);
                          }}
                          onMouseEnter={(e) => {
                            if (!isAdmin || !isDragging || !selectionStart) return;
                            const newSelection = new Set<string>();
                            const minDay = Math.min(selectionStart.day, d);
                            const maxDay = Math.max(selectionStart.day, d);
                            for (const slot of ['m', 't', 'n'] as SlotType[]) {
                              for (let day = minDay; day <= maxDay; day++) {
                                newSelection.add(getCellKey(med.id, day, slot));
                              }
                            }
                            setSelectedCells(newSelection);
                          }}
                          className={`border border-slate-200 py-1 text-center text-[7px] md:text-xs font-bold cursor-pointer ${dow === 0 ? 'border-r-2 border-r-sky-500' : ''} ${bg} ${hasPT ? 'text-amber-500' : 'text-slate-600'}`}
                          title={`M:${m} T:${t} N:${n}`}
                        >
                          {activeCount > 0 ? activeCount : hasPT ? 'PT' : ''}
                        </td>
                      );
                    })}
                    {weeklyAcc.map((wv, wi) => {
                      let colorClass = 'bg-emerald-100 text-emerald-800';
                      let weekLabel = 'Semana normal';
                      if (wv >= 42) { colorClass = 'bg-emerald-500 text-white'; weekLabel = 'Semana en límite'; }
                      if (wv >= 66) { colorClass = 'bg-rose-500 text-white shadow-inner'; weekLabel = 'Semana excedida'; }
                      return (
                        <td key={wi} className={`border border-slate-200 font-black text-[8px] md:text-xs ${colorClass}`}
                          title={`Semana ${wi + 1}: ${wv}h — ${weekLabel} (límite normal <42h, máx 66h)`}>
                          {wv}h
                        </td>
                      );
                    })}
                    <td className={`sticky right-0 z-20 font-black text-[8px] md:text-xs border border-slate-200 shadow-[-2px_0_5px_rgba(0,0,0,0.1)] ${
                      hourStatus === 'low' ? 'bg-amber-500 text-white' :
                      hourStatus === 'high' ? 'bg-rose-500 text-white' :
                      'bg-sky-500 text-white'
                    }`} title={`Total mes: ${medTotalMonth}h — Rango aceptado: ${limits.min}h–${limits.max}h | ${
                      hourStatus === 'low' ? '⚠️ Bajo el mínimo requerido' :
                      hourStatus === 'high' ? '🔴 Supera el máximo' :
                      '✅ Dentro del rango'
                    }`}>
                      {medTotalMonth}h
                    </td>
                  </tr>
                );
              }

              // ── Full View: 3 rows per doctor (M/T/N) ──
              return (['m', 't', 'n'] as SlotType[]).map((slot, sIdx) => (
                <tr key={`${med.id}-${slot}`} className={`group hover:bg-slate-50 transition-colors ${sIdx === 2 ? 'border-b-4 border-slate-200' : ''}`}>
                  {sIdx === 0 && (
                    <td rowSpan={3} className="sticky left-0 bg-white z-20 text-left px-2 md:px-4 border-r-2 border-sky-500 border-b border-slate-200 shadow-xl group-hover:bg-slate-50">
                      <div className="flex items-center justify-between gap-1">
                        <div className="font-black text-slate-800 text-xs md:text-sm whitespace-nowrap truncate max-w-[80px] md:max-w-none">
                          {med.genero === 'F' ? 'Dra.' : 'Dr.'} {med.nombre}
                        </div>
                        <div className="flex items-center gap-1">
                          {isAdmin && (
                            <button
                              onClick={() => handleSelectDoctorCells(med.id)}
                              title="Seleccionar todas las celdas de este médico"
                              className="shrink-0 p-1 rounded-md hover:bg-sky-100 text-sky-500"
                            >
                              <CheckSquare className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => setFocusedDoctorId(med.id)}
                            title="Ver solo este médico"
                            className="shrink-0 p-1 rounded-md hover:bg-sky-100 text-sky-500 "
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-xs text-slate-400 font-bold">{med.cat}</span>
                        <span className={`text-xs font-bold ${hourStatus === 'low' ? 'text-amber-600' : hourStatus === 'high' ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {medTotalMonth}h
                        </span>
                      </div>
                    </td>
                  )}
                  <td className="bg-slate-50 text-slate-500 font-black text-xs py-1 md:py-2 border-r border-slate-200 uppercase">
                    {slot === 'm' ? 'M' : slot === 't' ? 'T' : 'N'}
                  </td>
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const d = i + 1;
                    const dow = new Date(selectedYear, selectedMonth, d).getDay();
                    const val = currentMonthData[med.id]?.[slot]?.[d] || 'X';
                    // Display siglas in lowercase (except X which stays uppercase)
                    const displayVal = val === 'X' ? 'X' : val.toLowerCase();
                    const isPT = val.toUpperCase() === 'PT';
                    const isShift = val !== 'X';
                    const cellConflicts = conflicts.personal[`${med.id}-${d}-${slot}`] || [];
                    const hasConflict = cellConflicts.length > 0;
                    const isEditing = editingCell?.doctorId === med.id && editingCell?.day === d && editingCell?.slot === slot;

                    return (
                      <td
                        key={d}
                        onClick={(e) => handleCellClick(med.id, d, slot, e)}
                        onMouseDown={(e) => handleCellMouseDown(med.id, d, slot, e)}
                        onMouseEnter={(e) => handleCellMouseEnter(med.id, d, slot, e)}
                        title={cellConflicts.map(c => c.message).join('\n')}
                        className={`
                          border border-slate-200 py-0.5 md:py-1 cursor-pointer
                           duration-150 relative text-center text-[8px] md:text-xs
                          ${dow === 0 ? 'border-r-2 border-r-sky-500' : ''}
                          ${dow === 0 || dow === 6 ? 'bg-sky-50/30' : ''}
                          ${isEditing ? 'bg-emerald-50 ring-2 ring-emerald-400 ring-inset z-10' : ''}
                          ${!isEditing && !isShift ? 'opacity-10 text-slate-400' : ''}
                          ${!isEditing && isPT ? 'text-amber-600 font-black' : 'text-slate-800 font-medium'}
                          ${!isEditing && hasConflict ? 'bg-rose-50 text-rose-600' : ''}
                          ${selectedCells.has(getCellKey(med.id, d, slot)) ? 'bg-sky-200 ring-2 ring-sky-500' : ''}
                        `}
                      >
                        {isEditing ? (
                          <input
                            autoFocus
                            value={editingValue}
                            onChange={e => setEditingValue(e.target.value)}
                            onKeyDown={e => {
                              handleKeyDown(e);
                              if (e.key === 'Enter') { e.preventDefault(); handleSetShift(med.id, d, slot, editingValue || 'X'); }
                              if (e.key === 'Escape') { setEditingCell(null); }
                              if (e.key === 'Tab') { e.preventDefault(); handleSetShift(med.id, d, slot, editingValue || 'X'); }
                            }}
                            onBlur={() => handleSetShift(med.id, d, slot, editingValue || 'X')}
                            className="w-full text-center bg-transparent outline-none text-emerald-700 text-[8px] md:text-xs"
                            style={{ minWidth: 22 }}
                            maxLength={10}
                          />
                        ) : (
                          isShift ? (showGridHours ? `${variables[slot][val] || 0}` : displayVal) : ''
                        )}
                      </td>
                    );
                  })}
                  {sIdx === 0 && (
                    <>
                      {weeklyAcc.map((wv, wi) => {
                        let colorClass = 'bg-emerald-100 text-emerald-800';
                        let weekLabel = 'Semana normal';
                        if (wv >= 42) { colorClass = 'bg-emerald-500 text-white'; weekLabel = 'Semana en límite'; }
                        if (wv >= 66) { colorClass = 'bg-rose-500 text-white shadow-inner'; weekLabel = 'Semana excedida'; }
                        return (
                          <td key={wi} rowSpan={3} className={`border border-slate-200 font-black text-[8px] md:text-xs ${colorClass}`}
                            title={`Semana ${wi + 1}: ${wv}h — ${weekLabel} (límite normal <42h, máx 66h)`}>
                            {wv}h
                          </td>
                        );
                      })}
                      <td rowSpan={3} className={`sticky right-0 z-20 font-black text-[8px] md:text-xs border border-slate-200 shadow-[-2px_0_5px_rgba(0,0,0,0.1)] ${
                        hourStatus === 'low' ? 'bg-amber-500 text-white' :
                        hourStatus === 'high' ? 'bg-rose-500 text-white' :
                        'bg-sky-500 text-white'
                      }`} title={`Total mes: ${medTotalMonth}h — Rango: ${limits.min}h–${limits.max}h | ${
                        hourStatus === 'low' ? '⚠️ Bajo el mínimo' :
                        hourStatus === 'high' ? '🔴 Supera el máximo' :
                        '✅ Dentro del rango'
                      }`}>
                        {medTotalMonth}h
                      </td>
                    </>
                  )}
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
