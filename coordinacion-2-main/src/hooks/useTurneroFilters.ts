import { useState, useMemo } from 'react';
import { SlotType, MonthlyData, Doctor, VarSlotConfig } from '../types';

const ROLES = [
  'Médico Rural', 'Médico General', 'Médico Especialista', 'Enfermero Jefe',
  'Auxiliar Enfermería', 'Interno', 'Triage', 'Laboratorio', 'Odontólogo',
  'Especialista', 'Fisioterapeuta', 'Rayos X'
];

export function useTurneroFilters(doctors: Doctor[], currentMonthData: MonthlyData, variables: VarSlotConfig, daysInMonth: number) {
  const [doctorFilter, setDoctorFilter] = useState<number[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [roleSearch, setRoleSearch] = useState('');
  const [showRoleSelector, setShowRoleSelector] = useState(false);
  const [showCatSelector, setShowCatSelector] = useState(false);
  const [showGridHours, setShowGridHours] = useState(false);

  const filteredRolesList = useMemo(
    () => ROLES.filter(r => r.toLowerCase().includes(roleSearch.toLowerCase())),
    [roleSearch]
  );

  const filteredDoctors = useMemo(() => {
    return doctors.filter(d =>
      d.st === 'activo' && // SOLO médicos activos
      (selectedRoles.length === 0 || selectedRoles.includes(d.rol || 'Médico General')) &&
      (selectedCategories.length === 0 || selectedCategories.includes(d.cat)) &&
      (doctorFilter.length === 0 || doctorFilter.includes(d.id))
    );
  }, [doctors, selectedRoles, selectedCategories, doctorFilter]);

  const addDoctorFilter = (id: number) => {
    if (id && !doctorFilter.includes(id)) setDoctorFilter([...doctorFilter, id]);
  };

  const removeDoctorFilter = (id: number) => {
    setDoctorFilter(doctorFilter.filter(fid => fid !== id));
  };

  const clearDoctorFilter = () => setDoctorFilter([]);

  const toggleRole = (role: string) => {
    if (selectedRoles.includes(role)) setSelectedRoles(selectedRoles.filter(r => r !== role));
    else setSelectedRoles([...selectedRoles, role]);
  };

  const clearRoles = () => setSelectedRoles([]);

  const toggleCategory = (cat: string) => {
    if (selectedCategories.includes(cat)) setSelectedCategories(selectedCategories.filter(c => c !== cat));
    else setSelectedCategories([...selectedCategories, cat]);
  };

  const clearCategories = () => setSelectedCategories([]);

  return {
    doctorFilter, selectedRoles, selectedCategories,
    roleSearch, setRoleSearch,
    showRoleSelector, setShowRoleSelector,
    showCatSelector, setShowCatSelector,
    showGridHours, setShowGridHours,
    filteredRolesList, filteredDoctors,
    addDoctorFilter, removeDoctorFilter, clearDoctorFilter,
    toggleRole, clearRoles,
    toggleCategory, clearCategories,
  };
}
