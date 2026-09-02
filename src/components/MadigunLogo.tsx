import React, { useState, useEffect } from 'react';

interface MadigunLogoProps {
  className?: string;
  showText?: boolean;
}

export default function MadigunLogo({ className = '', showText = true }: MadigunLogoProps) {
  const [customLogo, setCustomLogo] = useState<string | null>(() => localStorage.getItem('madigun_custom_logo'));

  useEffect(() => {
    const handleUpdate = () => {
      setCustomLogo(localStorage.getItem('madigun_custom_logo'));
    };
    window.addEventListener('madigun_logo_updated', handleUpdate);
    return () => {
      window.removeEventListener('madigun_logo_updated', handleUpdate);
    };
  }, []);

  return (
    <div className={`flex items-center gap-3.5 ${className}`}>
      {/* Beautiful Logo Container */}
      <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
        {customLogo ? (
          <img 
            src={customLogo} 
            alt="Madigun Custom Logo" 
            className="w-12 h-12 object-contain"
            referrerPolicy="no-referrer"
          />
        ) : (
          <svg 
            viewBox="0 0 100 100" 
            className="w-full h-full text-zinc-300"
            style={{ color: '#E4DFD8' }}
            fill="currentColor"
          >
            {/* Top Diamond / Spearhead crest */}
            <polygon points="50,15 54,23 50,29 46,23" fill="#C3B5A6" />
            
            {/* Elegant Arching Top Accent */}
            <path d="M50,26 C57,20 68,26 71,36 C64,30 55,30 50,37 C45,30 36,30 29,36 C32,26 43,20 50,26 Z" fill="#D5CBC1" />
            
            {/* Main outer pillars / decorative columns of the 'M' */}
            {/* Left Column */}
            <path d="M22,38 L27,35 C29,48 23,65 24,80 L18,80 C19,65 20,48 22,38 Z" fill="#D5CBC1" />
            {/* Right Column */}
            <path d="M78,38 L73,35 C71,48 77,65 76,80 L82,80 C81,65 80,48 78,38 Z" fill="#D5CBC1" />
            
            {/* Center V columns of the 'M' */}
            <path d="M50,44 L56,38 C54,55 46,72 45,80 L39,80 C40,72 48,55 50,44 Z" fill="#C3B5A6" />
            <path d="M50,44 L44,38 C46,55 54,72 55,80 L61,80 C60,72 52,55 50,44 Z" fill="#C3B5A6" />

            {/* Symmetrical sweeping side wings of the 'M' */}
            <path d="M28,37 C34,45 38,55 41,75 L35,75 C33,59 29,49 26,41 L28,37 Z" fill="#D5CBC1" />
            <path d="M72,37 C66,45 62,55 59,75 L65,75 C67,59 71,49 74,41 L72,37 Z" fill="#D5CBC1" />

            {/* Left and Right Pedestal Bases */}
            <rect x="16" y="80" width="10" height="3" fill="#C3B5A6" rx="0.5" />
            <rect x="74" y="80" width="10" height="3" fill="#C3B5A6" rx="0.5" />
            <rect x="38" y="80" width="8" height="2.5" fill="#B7A898" rx="0.5" />
            <rect x="54" y="80" width="8" height="2.5" fill="#B7A898" rx="0.5" />
          </svg>
        )}
      </div>

      {showText && (
        <div className="flex flex-col">
          <span 
            className="font-display font-light text-zinc-900 tracking-[0.25em] text-sm uppercase leading-none"
            style={{ fontFamily: "'Outfit', 'Inter', sans-serif" }}
          >
            MADIGUN
          </span>
          <span 
            className="text-[8px] font-semibold text-zinc-500 uppercase tracking-[0.18em] leading-none mt-1"
            style={{ color: '#837265' }}
          >
            Hotel & Events
          </span>
        </div>
      )}
    </div>
  );
}
