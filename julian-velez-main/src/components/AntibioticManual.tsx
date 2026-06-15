import React from 'react';

export function AntibioticManual({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold">Manual de Antibióticos</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">Cerrar</button>
        </div>
        <div className="p-6 overflow-y-auto">
          <p>Contenido del manual de antibióticos...</p>
        </div>
      </div>
    </div>
  );
}
