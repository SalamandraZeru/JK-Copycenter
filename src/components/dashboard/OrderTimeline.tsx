import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface OrderEvent {
  id: string;
  created_at: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
}

interface OrderTimelineProps {
  events: OrderEvent[];
}

const statusMap: Record<string, { label: string; color: string }> = {
  created: { label: 'Pedido Criado', color: 'bg-blue-500' },
  awaiting_payment: { label: 'Aguardando confirmação de pagamento', color: 'bg-amber-500' },
  confirmed: { label: 'Pagamento confirmado', color: 'bg-cyan-500' },
  in_production: { label: 'Em Produção', color: 'bg-yellow-500' },
  ready: { label: 'Pronto para Retirada/Entrega', color: 'bg-green-500' },
  completed: { label: 'Concluído', color: 'bg-slate-500' },
  cancelled: { label: 'Cancelado', color: 'bg-red-500' },
};

export function OrderTimeline({ events }: OrderTimelineProps) {
  // Sort events chronologically if not already
  const sortedEvents = [...events].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return (
    <div className="flow-root">
      <ul role="list" className="-mb-8">
        {sortedEvents.map((event, eventIdx) => {
          const isLast = eventIdx === sortedEvents.length - 1;
          const config = statusMap[event.to_status] || { label: event.to_status, color: 'bg-slate-400' };

          return (
            <li key={event.id}>
              <div className="relative pb-8">
                {!isLast ? (
                  <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-slate-200" aria-hidden="true" />
                ) : null}
                <div className="relative flex space-x-3">
                  <div>
                    <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${config.color}`} />
                  </div>
                  <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                    <div>
                      <p className="text-sm text-slate-900 font-medium">{config.label}</p>
                      {event.note && (
                        <p className="mt-1 text-sm text-slate-500 italic">&quot;{event.note}&quot;</p>
                      )}
                    </div>
                    <div className="whitespace-nowrap text-right text-sm text-slate-500">
                      <time dateTime={event.created_at}>
                        {format(new Date(event.created_at), "d 'de' MMM, HH:mm", { locale: ptBR })}
                      </time>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
