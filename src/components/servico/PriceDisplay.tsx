import React from 'react';

interface PriceDisplayProps {
  estimatedPrice: number | null;
  isLoading: boolean;
  hasEstimate: boolean;
  error: string | null;
}

export function PriceDisplay({ estimatedPrice, isLoading, hasEstimate, error }: PriceDisplayProps) {
  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-md">
        <p className="font-semibold">Erro no cálculo de preço</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-50 border border-slate-200 rounded-lg flex flex-col gap-2">
      <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Estimado</h3>
      <div className="flex items-center gap-3">
        {isLoading ? (
          <div className="h-10 bg-slate-200 rounded animate-pulse w-32"></div>
        ) : (
          <span className="text-4xl font-bold text-slate-900">
            {estimatedPrice !== null 
              ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(estimatedPrice)
              : 'R$ 0,00'}
          </span>
        )}
        {hasEstimate && !isLoading && (
          <span 
            className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full cursor-help"
            title="O valor final pode variar após a análise dos arquivos anexados (ex: DOCX, ZIP)."
          >
            Estimativa
          </span>
        )}
      </div>
      <p className="text-sm text-slate-500">
        Preço final será confirmado pelo atendente.
      </p>
    </div>
  );
}
