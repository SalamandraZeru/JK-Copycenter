'use client';

import React, { useState } from 'react';
import { MapPin, Navigation, ExternalLink, Compass, ZoomIn, ZoomOut } from 'lucide-react';

export function StoreLocationMap() {
  const [zoom, setZoom] = useState(16);

  return (
    <div className="rounded-2xl overflow-hidden min-h-[340px] border border-slate-300 flex flex-col shadow-sm bg-slate-900 text-white relative select-none">
      {/* Map Canvas Background (High-tech vector map) */}
      <div className="relative flex-1 min-h-[280px] bg-slate-950 overflow-hidden flex items-center justify-center">
        {/* Vector Street Grid Lines */}
        <div 
          className="absolute inset-0 opacity-20 pointer-events-none transition-all duration-300"
          style={{
            backgroundImage: `
              linear-gradient(to right, #3b82f6 1px, transparent 1px),
              linear-gradient(to bottom, #3b82f6 1px, transparent 1px)
            `,
            backgroundSize: `${zoom * 3}px ${zoom * 3}px`,
            backgroundPosition: 'center center'
          }}
        />

        {/* Main Avenue Accent Road (Av. JK) */}
        <div className="absolute w-full h-8 bg-blue-600/30 transform -rotate-12 blur-xs pointer-events-none" />
        <div className="absolute w-full h-3 bg-blue-400/50 transform -rotate-12 pointer-events-none flex items-center justify-center">
          <span className="text-[10px] font-bold tracking-widest text-blue-100 uppercase opacity-75">
            Av. Pres. Juscelino Kubitschek (Av. JK)
          </span>
        </div>

        {/* Cross Avenue */}
        <div className="absolute h-full w-4 bg-slate-700/60 transform rotate-45 pointer-events-none" />

        {/* Pulse Pin Marker on Store Location */}
        <div className="relative z-10 flex flex-col items-center">
          {/* Pulsing beacon circles */}
          <div className="absolute -top-3 w-16 h-16 bg-blue-500/20 rounded-full animate-ping pointer-events-none" />
          <div className="absolute -top-1 w-10 h-10 bg-red-500/30 rounded-full animate-pulse pointer-events-none" />
          
          {/* Pin Graphic */}
          <div className="relative z-20 w-11 h-11 bg-gradient-to-tr from-red-600 to-rose-500 text-white rounded-2xl flex items-center justify-center shadow-2xl shadow-red-600/50 border-2 border-white transform hover:scale-110 transition-transform">
            <MapPin className="w-6 h-6 fill-white text-red-600" />
          </div>

          {/* Callout Bubble */}
          <div className="mt-2.5 bg-white/95 backdrop-blur-md text-slate-900 px-3.5 py-1.5 rounded-xl shadow-xl border border-slate-200 text-center">
            <div className="text-xs font-black text-slate-900 tracking-tight">JK Copycenter</div>
            <div className="text-[10px] font-semibold text-slate-600">Av. JK, 270 — Passos MG</div>
          </div>
        </div>

        {/* Map Controls */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-20">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(z + 2, 24))}
            className="w-8 h-8 bg-slate-900/90 hover:bg-slate-800 text-slate-200 rounded-lg flex items-center justify-center border border-slate-700 shadow-md transition"
            title="Aproximar"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(z - 2, 10))}
            className="w-8 h-8 bg-slate-900/90 hover:bg-slate-800 text-slate-200 rounded-lg flex items-center justify-center border border-slate-700 shadow-md transition"
            title="Afastar"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>

        {/* Compass & Coordinates Badge */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2 text-[10px] font-mono text-slate-400 bg-slate-950/80 px-2.5 py-1 rounded-md border border-slate-800">
          <Compass className="w-3.5 h-3.5 text-blue-400" />
          <span>{'20°43\'23.3"S 46°36\'44.6"W'}</span>
        </div>
      </div>

      {/* Footer Bar with Location Info and Google Maps Direct Route Button */}
      <div className="p-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-slate-900">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Navigation className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">Unidade Física Passos</div>
            <div className="text-[11px] font-medium text-slate-500">Jardim Colégio de Passos - MG</div>
          </div>
        </div>

        <a
          href="https://share.google/3jStxc1OYvpfH5rJ2"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition shadow-sm shadow-blue-500/20"
        >
          <span>Abrir Rota no Google Maps</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
