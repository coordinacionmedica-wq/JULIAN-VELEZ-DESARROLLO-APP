import React from 'react';

interface Props {
  className?: string;
}

export function HospitalLogo({ className = "w-24 h-24" }: Props) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 100 120" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Oval background */}
      <ellipse cx="50" cy="58" rx="42" ry="52" stroke="#0f5132" strokeWidth="2" fill="#ffffff" />
      <ellipse cx="50" cy="58" rx="39" ry="49" stroke="#0f5132" strokeWidth="0.5" />
      
      {/* Side Pillars/Columns */}
      {/* Left Column */}
      <path d="M19 45 L19 65" stroke="#0f5132" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M17 45 L21 45" stroke="#0f5132" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M17 65 L21 65" stroke="#0f5132" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M16 43 L22 43" stroke="#0f5132" strokeWidth="0.8" strokeLinecap="round" />
      <path d="M16 67 L22 67" stroke="#0f5132" strokeWidth="0.8" strokeLinecap="round" />
      
      {/* Right Column */}
      <path d="M81 45 L81 65" stroke="#0f5132" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M79 45 L83 45" stroke="#0f5132" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M79 65 L83 65" stroke="#0f5132" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M78 43 L84 43" stroke="#0f5132" strokeWidth="0.8" strokeLinecap="round" />
      <path d="M78 67 L84 67" stroke="#0f5132" strokeWidth="0.8" strokeLinecap="round" />

      {/* Inner arch */}
      <path d="M28 82 A 22 26 0 0 1 50 30 A 22 26 0 0 1 72 82 Z" stroke="#0f5132" strokeWidth="1.2" fill="none" />
      <path d="M30 82 A 20 24 0 0 1 50 32 A 20 24 0 0 1 70 82 Z" stroke="#0f5132" strokeWidth="0.5" fill="none" />

      {/* Lillies / Flowers in the center */}
      {/* Center lily bloom */}
      <path d="M50 50 C45 44, 46 34, 50 25 C54 34, 55 44, 50 50 Z" fill="#0f5132" fillOpacity="0.08" />
      <path d="M50 50 C45 44, 46 34, 50 25 C54 34, 55 44, 50 50" stroke="#0f5132" strokeWidth="1" strokeLinecap="round" />
      <path d="M50 25 Q50 48 50 50" stroke="#0f5132" strokeWidth="0.5" strokeLinecap="round" />
      
      {/* Left side bloom */}
      <path d="M48 64 C39 58, 33 48, 42 41 C44 46, 46 54, 48 64" stroke="#0f5132" strokeWidth="1" strokeLinecap="round" />
      <path d="M48 64 Q45 52 42 41" stroke="#0f5132" strokeWidth="0.5" strokeLinecap="round" />
      
      {/* Right side bloom */}
      <path d="M52 58 C61 54, 67 46, 61 36 C59 41, 56 50, 52 58" stroke="#0f5132" strokeWidth="1" strokeLinecap="round" />
      <path d="M52 58 Q57 47 61 36" stroke="#0f5132" strokeWidth="0.5" strokeLinecap="round" />
      
      {/* Stem */}
      <path d="M50 50 Q51 72, 49 84" stroke="#0f5132" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M38 78 Q47 72, 49 55" stroke="#0f5132" strokeWidth="0.8" strokeLinecap="round" />
      <path d="M62 74 Q53 71, 50 56" stroke="#0f5132" strokeWidth="0.8" strokeLinecap="round" />

      {/* Leaves */}
      <path d="M49 76 C41 74, 43 66, 49 70 C49 70, 49 76, 49 76 Z" fill="#0f5132" fillOpacity="0.08" />
      <path d="M49 76 Q41 74, 43 66" stroke="#0f5132" strokeWidth="0.8" />
      <path d="M49 79 C57 75, 54 68, 49 73 C49 73, 49 79, 49 79 Z" fill="#0f5132" fillOpacity="0.08" />
      <path d="M49 79 Q57 75, 54 68" stroke="#0f5132" strokeWidth="0.8" />

      {/* Elegant curved text labels */}
      {/* Top curved label: HOSPITAL DEPARTAMENTAL */}
      <path id="topTextCurve" d="M12 55 A 38 48 0 0 1 88 55" fill="none" />
      <text fill="#0f5132" fontSize="3.5" fontWeight="900" fontFamily="-apple-system, sans-serif" letterSpacing="0.45">
        <textPath href="#topTextCurve" startOffset="50%" textAnchor="middle">
          HOSPITAL DEPARTAMENTAL
        </textPath>
      </text>

      {/* Middle curved label: SAN ANTONIO */}
      <path id="midTextCurve" d="M18 69 A 32 42 0 0 0 82 69" fill="none" />
      <text fill="#0f5132" fontSize="6.5" fontWeight="900" fontFamily="-apple-system, sans-serif" letterSpacing="0.5">
        <textPath href="#midTextCurve" startOffset="50%" textAnchor="middle">
          SAN ANTONIO
        </textPath>
      </text>

      {/* Bottom curved label: ROLDANILLO - VALLE */}
      <path id="botTextCurve" d="M14 74 A 36 46 0 0 0 86 74" fill="none" />
      <text fill="#0f5132" fontSize="4.5" fontWeight="900" fontFamily="-apple-system, sans-serif" letterSpacing="0.3">
        <textPath href="#botTextCurve" startOffset="50%" textAnchor="middle">
          ROLDANILLO - VALLE
        </textPath>
      </text>
    </svg>
  );
}
