import React from 'react';

interface AppStylesProps {
  theme: { primary: string; font: string };
}

export function AppStyles({ theme }: AppStylesProps) {
  return (
    <>
      <style>{`
        :root { 
          --primary: ${theme.primary}; 
          --primary-soft: ${theme.primary}15;
          --primary-mid: ${theme.primary}66;
        }
        .bg-primary { background-color: var(--primary); }
        .text-primary { color: var(--primary); }
        .border-primary { border-color: var(--primary); }
        .hover\\:bg-primary:hover { background-color: var(--primary); }
        .hover\\:text-primary:hover { color: var(--primary); }
        
        .font-sans { font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
        .font-serif { font-family: ui-serif, Georgia, serif; }
        .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }

        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: var(--primary-mid);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: var(--primary);
        }
        .safe-area-bottom {
          padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 0.25rem);
        }
      `}</style>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .turns-table { font-size: 8px !important; color: black !important; width: 100% !important; border: 1px solid #ccc !important; }
          td, th { border: 1px solid #ccc !important; padding: 2px !important; color: black !important; background: transparent !important; }
          .sticky-col { position: relative !important; background: white !important; border-right: 1px solid #ccc !important; box-shadow: none !important; }
          .h-low, .h-ok, .h-over { color: black !important; border: 1px solid #ccc !important; }
        }
        
        /* Mejoras para dispositivos móviles - Inmovilizar Paneles */
        .turns-table-container {
          max-height: 80vh;
          overflow: auto;
          position: relative;
        }

        .turns-table thead th {
          position: sticky;
          top: 0;
          z-index: 30;
          background-color: #f8fafc; /* slate-50 */
        }

        .turns-table .sticky-col {
          position: sticky;
          left: 0;
          z-index: 20;
          background-color: white;
          box-shadow: 2px 0 5px -2px rgba(0,0,0,0.1);
        }

        .turns-table thead th.sticky-col {
          z-index: 40; /* Intersección esquina superior izquierda */
        }

        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #fafaf9; }
        ::-webkit-scrollbar-thumb { background: #10b981; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #059669; }

        .slot-label {
          writing-mode: vertical-rl;
          text-orientation: mixed;
          transform: rotate(180deg);
        }
      `}</style>
    </>
  );
}
