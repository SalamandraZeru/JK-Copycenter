import React from 'react';

export type OrderStatus = 'created' | 'awaiting_payment' | 'confirmed' | 'in_production' | 'ready' | 'completed' | 'cancelled' | string;

interface OrderStatusBadgeProps {
  status: OrderStatus;
  showPulse?: boolean;
}

interface StatusConfig {
  label: string;
  className: string;
  dotColor: string;
  pulseColor?: string;
}

const statusMap: Record<string, StatusConfig> = {
  created: {
    label: 'Criado',
    className: 'bg-blue-50 text-blue-700 border-blue-200/80',
    dotColor: 'bg-blue-500',
    pulseColor: 'bg-blue-400',
  },
  awaiting_payment: {
    label: 'Aguardando pagamento',
    className: 'bg-amber-50 text-amber-800 border-amber-200/80',
    dotColor: 'bg-amber-500',
    pulseColor: 'bg-amber-400',
  },
  confirmed: {
    label: 'Pagamento confirmado',
    className: 'bg-cyan-50 text-cyan-800 border-cyan-200/80',
    dotColor: 'bg-cyan-500',
    pulseColor: 'bg-cyan-400',
  },
  in_production: {
    label: 'Em Produção',
    className: 'bg-amber-50 text-amber-800 border-amber-200/80',
    dotColor: 'bg-amber-500',
    pulseColor: 'bg-amber-400',
  },
  ready: {
    label: 'Pronto',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
    dotColor: 'bg-emerald-500',
    pulseColor: 'bg-emerald-400',
  },
  completed: {
    label: 'Concluído',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
    dotColor: 'bg-slate-400',
  },
  cancelled: {
    label: 'Cancelado',
    className: 'bg-rose-50 text-rose-700 border-rose-200',
    dotColor: 'bg-rose-500',
  },
};

export function OrderStatusBadge({ status, showPulse = true }: OrderStatusBadgeProps) {
  const config = statusMap[status] || {
    label: status,
    className: 'bg-slate-100 text-slate-700 border-slate-200',
    dotColor: 'bg-slate-400',
  };

  const hasPulse = showPulse && Boolean(config.pulseColor);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-all ${config.className}`}
    >
      <span className="relative flex h-2 w-2">
        {hasPulse && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.pulseColor}`}
          />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dotColor}`} />
      </span>
      {config.label}
    </span>
  );
}
