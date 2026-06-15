import React, { useState } from 'react';
import { motion } from 'motion/react';
import { FileCheck, ClipboardEdit, FileText, Plus, ShieldCheck, Download, Search, CheckCircle2, AlertCircle } from 'lucide-react';

export function CommitteeView() {
  const [activeTab, setActiveTab] = useState<'protocols' | 'records'>('protocols');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <FileCheck className="w-8 h-8 text-emerald-600" />
            Comité de Historias Clínicas
          </h2>
          <p className="text-sm text-slate-500 font-mono mt-1">Evaluación, métricas y seguimiento institucional</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('protocols')}
            className={`px-4 py-2 rounded-lg font-bold text-xs uppercase transition-all ${
              activeTab === 'protocols' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Evaluación de Protocolos
          </button>
          <button
            onClick={() => setActiveTab('records')}
            className={`px-4 py-2 rounded-lg font-bold text-xs uppercase transition-all ${
              activeTab === 'records' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Diligenciamiento H.C.
          </button>
        </div>
      </div>

      {/* Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === 'protocols' ? <ProtocolsEvaluation /> : <ClinicalRecords />}
      </motion.div>
    </div>
  );
}

function ProtocolsEvaluation() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard title="Protocolos Activos" value="24" icon={<FileText className="w-6 h-6" />} trend="+2" />
        <MetricCard title="Adherencia General" value="89%" icon={<CheckCircle2 className="w-6 h-6" />} trend="+5%" />
        <MetricCard title="Alertas de Desviación" value="3" icon={<AlertCircle className="w-6 h-6" />} trend="-1" alert />
      </div>
      
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
          <h3 className="text-lg font-black text-slate-800">Protocolos Institucionales</h3>
          <button className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase hover:bg-emerald-700 transition-all flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nuevo Protocolo
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                <th className="p-4 font-bold">Nombre del Protocolo</th>
                <th className="p-4 font-bold">Área</th>
                <th className="p-4 font-bold">Adherencia</th>
                <th className="p-4 font-bold">Última Revisión</th>
                <th className="p-4 font-bold">Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="p-4 font-bold text-slate-700">Manejo de Sepsis</td>
                <td className="p-4 text-sm text-slate-600">Urgencias</td>
                <td className="p-4 text-sm font-bold text-emerald-600">92%</td>
                <td className="p-4 text-sm text-slate-600">01/05/2026</td>
                <td className="p-4"><span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md text-xs font-bold">Vigente</span></td>
              </tr>
              <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="p-4 font-bold text-slate-700">Código IAM</td>
                <td className="p-4 text-sm text-slate-600">Cardiología</td>
                <td className="p-4 text-sm font-bold text-amber-600">78%</td>
                <td className="p-4 text-sm text-slate-600">15/04/2026</td>
                <td className="p-4"><span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-md text-xs font-bold">En Revisión</span></td>
              </tr>
              <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="p-4 font-bold text-slate-700">Código Azul</td>
                <td className="p-4 text-sm text-slate-600">Institucional</td>
                <td className="p-4 text-sm font-bold text-emerald-600">98%</td>
                <td className="p-4 text-sm text-slate-600">10/01/2026</td>
                <td className="p-4"><span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md text-xs font-bold">Vigente</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ClinicalRecords() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard title="H.C. Evaluadas" value="156" icon={<ClipboardEdit className="w-6 h-6" />} />
        <MetricCard title="Oportunidad" value="94%" icon={<CheckCircle2 className="w-6 h-6" />} trend="+2%" />
        <MetricCard title="Pertinencia" value="91%" icon={<ShieldCheck className="w-6 h-6" />} />
        <MetricCard title="Hallazgos" value="12" icon={<AlertCircle className="w-6 h-6" />} alert />
      </div>
      
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
         <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
          <h3 className="text-lg font-black text-slate-800">Monitor de Calidad en Historias Clínicas</h3>
          <div className="flex gap-2">
            <button className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl font-bold text-xs uppercase hover:bg-slate-200 transition-all flex items-center gap-2">
              <Download className="w-4 h-4" /> Exportar
            </button>
            <button className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase hover:bg-emerald-700 transition-all flex items-center gap-2">
              <Plus className="w-4 h-4" /> Nueva Auditoría
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                <th className="p-4 font-bold">Fecha Evaluación</th>
                <th className="p-4 font-bold">Servicio</th>
                <th className="p-4 font-bold">Médico Evaluado</th>
                <th className="p-4 font-bold">Puntaje Global</th>
                <th className="p-4 font-bold">Métrica Baja</th>
                <th className="p-4 font-bold">Acción</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="p-4 font-bold text-slate-700">05/06/2026</td>
                <td className="p-4 text-sm text-slate-600">Hospitalización</td>
                <td className="p-4 text-sm text-slate-600">Dr. Juan Pérez</td>
                <td className="p-4 text-sm font-bold text-emerald-600">95/100</td>
                <td className="p-4 text-sm text-slate-500">-</td>
                <td className="p-4">
                  <button className="text-blue-600 font-bold text-xs uppercase hover:text-blue-800 transition-colors">Detalle</button>
                </td>
              </tr>
              <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="p-4 font-bold text-slate-700">04/06/2026</td>
                <td className="p-4 text-sm text-slate-600">Urgencias</td>
                <td className="p-4 text-sm text-slate-600">Dra. María Gómez</td>
                <td className="p-4 text-sm font-bold text-amber-600">76/100</td>
                <td className="p-4 text-sm text-red-500">Nota Evolución</td>
                <td className="p-4">
                  <button className="text-blue-600 font-bold text-xs uppercase hover:text-blue-800 transition-colors">Detalle</button>
                </td>
              </tr>
              <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="p-4 font-bold text-slate-700">02/06/2026</td>
                <td className="p-4 text-sm text-slate-600">Consulta Externa</td>
                <td className="p-4 text-sm text-slate-600">Dr. Carlos Ruíz</td>
                <td className="p-4 text-sm font-bold text-emerald-600">100/100</td>
                <td className="p-4 text-sm text-slate-500">-</td>
                <td className="p-4">
                  <button className="text-blue-600 font-bold text-xs uppercase hover:text-blue-800 transition-colors">Detalle</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon, trend, alert }: { title: string, value: string | number, icon: React.ReactNode, trend?: string, alert?: boolean }) {
  return (
    <div className={`p-6 rounded-3xl border shadow-sm flex items-center justify-between ${alert ? 'bg-red-50 border-red-100' : 'bg-white border-slate-200'}`}>
      <div>
        <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${alert ? 'text-red-500' : 'text-slate-500'}`}>{title}</p>
        <div className="flex items-end gap-3">
          <h4 className={`text-3xl font-black ${alert ? 'text-red-700' : 'text-slate-800'}`}>{value}</h4>
          {trend && (
            <span className={`text-xs font-bold mb-1 ${trend.startsWith('+') && !alert ? 'text-emerald-500' : 'text-red-500'}`}>
              {trend}
            </span>
          )}
        </div>
      </div>
      <div className={`p-4 rounded-full ${alert ? 'bg-red-100 text-red-600' : 'bg-slate-50 border border-slate-100 text-slate-400'}`}>
        {icon}
      </div>
    </div>
  );
}
