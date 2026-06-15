import React, { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import { Activity, Users, Clock, TrendingUp, Filter } from 'lucide-react';
import { Doctor, MonthlyData, VarSlotConfig, SlotType, ServiceMapping } from '../types';

interface Props {
  doctors: Doctor[];
  currentMonthData: MonthlyData;
  variables: VarSlotConfig;
  serviceMappings: ServiceMapping[];
  selectedMonth: number;
  selectedYear: number;
}

export function ProductivityStatsView({ doctors, currentMonthData, variables, serviceMappings, selectedMonth, selectedYear }: Props) {
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const monthName = new Date(selectedYear, selectedMonth).toLocaleString('es-ES', { month: 'long' });

  const stats = useMemo(() => {
    const serviceHours: Record<string, number> = {};
    const doctorHours: Record<string, { id: number, name: string, hours: number }> = {};
    const dailyHours: Array<{ day: number, hours: number }> = Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, hours: 0 }));

    serviceMappings.forEach(m => serviceHours[m.name] = 0);
    serviceHours['Otros'] = 0;

    doctors.forEach(doc => {
      const surname = doc.apellidos ? doc.apellidos.split(' ')[0] : '';
      doctorHours[doc.id] = { id: doc.id, name: `${doc.nombre} ${surname}`.trim(), hours: 0 };
      
      (['m', 't', 'n'] as SlotType[]).forEach(slot => {
        const slotData = currentMonthData[doc.id]?.[slot];
        if (slotData) {
          Object.entries(slotData).forEach(([day, sigla]) => {
            if (sigla && sigla !== 'X' && sigla !== 'DESC' && sigla !== 'PT') {
              const h = variables[slot][sigla] || 0;
              const d = parseInt(day);

              // Service stats
              const mapping = serviceMappings.find(m => m.siglas.some(s => s.trim().toUpperCase() === sigla.trim().toUpperCase()));
              if (mapping) {
                serviceHours[mapping.name] += h;
              } else {
                serviceHours['Otros'] += h;
              }

              // Doctor stats
              doctorHours[doc.id].hours += h;

              // Daily stats
              if (d > 0 && d <= daysInMonth) {
                dailyHours[d - 1].hours += h;
              }
            }
          });
        }
      });
    });

    const serviceData = Object.entries(serviceHours)
      .map(([name, hours]) => ({ name, hours }))
      .filter(d => d.hours > 0)
      .sort((a, b) => b.hours - a.hours);

    const doctorData = Object.values(doctorHours)
      .filter(d => d.hours > 0)
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 15); // Top 15

    const totalHours = Object.values(serviceHours).reduce((a, b) => a + b, 0);

    return { serviceData, doctorData, dailyHours, totalHours };
  }, [doctors, currentMonthData, variables, serviceMappings, daysInMonth]);

  const COLORS = ['#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#064e3b', '#065f46', '#047857'];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header & Global Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 flex items-center gap-5">
          <div className="bg-emerald-100 p-4 rounded-2xl text-emerald-600">
            <Clock className="w-8 h-8" />
          </div>
          <div>
            <p className="text-xs uppercase font-black text-slate-400 tracking-widest">Horas Totales</p>
            <p className="text-3xl font-black text-slate-800">{stats.totalHours.toLocaleString()}h</p>
            <p className="text-xs text-slate-500">Ejecutadas en {monthName}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 flex items-center gap-5">
          <div className="bg-blue-100 p-4 rounded-2xl text-blue-600">
            <Activity className="w-8 h-8" />
          </div>
          <div>
            <p className="text-xs uppercase font-black text-slate-400 tracking-widest">Promedio Diario</p>
            <p className="text-3xl font-black text-slate-800">{(stats.totalHours / daysInMonth).toFixed(1)}h</p>
            <p className="text-xs text-slate-500">Horas por día</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 flex items-center gap-5">
          <div className="bg-purple-100 p-4 rounded-2xl text-purple-600">
            <Users className="w-8 h-8" />
          </div>
          <div>
            <p className="text-xs uppercase font-black text-slate-400 tracking-widest">Productividad Media</p>
            <p className="text-3xl font-black text-slate-800">{(stats.totalHours / doctors.filter(d => d.st === 'activo').length).toFixed(1)}h</p>
            <p className="text-xs text-slate-500">Por médico activo</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Workload by Service */}
        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-8">
            <Filter className="w-6 h-6 text-emerald-600" />
            <h3 className="text-xl font-black text-slate-800">Carga por Servicio</h3>
          </div>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.serviceData} layout="vertical" margin={{ left: 50, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={150} 
                  tick={{ fontSize: 12, fontWeight: 700, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="hours" radius={[0, 4, 4, 0]} barSize={24}>
                  {stats.serviceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Daily Evolution */}
        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-8">
            <TrendingUp className="w-6 h-6 text-emerald-600" />
            <h3 className="text-xl font-black text-slate-800">Evolución Diaria (Horas)</h3>
          </div>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.dailyHours}>
                <defs>
                  <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="day" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="hours" 
                  stroke="#10b981" 
                  strokeWidth={4} 
                  fillOpacity={1} 
                  fill="url(#colorHours)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top 15 Productive Doctors */}
      <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
        <div className="flex items-center gap-3 mb-8">
          <Users className="w-6 h-6 text-emerald-600" />
          <h3 className="text-xl font-black text-slate-800">Top 15 Médicos por Carga Horaria</h3>
        </div>
        <div className="h-[500px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.doctorData} margin={{ bottom: 100 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                angle={-45} 
                textAnchor="end" 
                height={100}
                interval={0}
                tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#94a3b8' }}
              />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="hours" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
