'use client';

import { Printer } from 'lucide-react';

export function PrintServiceOrderButton() {
  return (
    <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800">
      <Printer className="h-4 w-4" /> Imprimir / salvar PDF
    </button>
  );
}
