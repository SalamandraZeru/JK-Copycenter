'use client';

import { useState } from 'react';
import { Loader2, MessageCircle } from 'lucide-react';

export function OrderStatusWhatsAppButton({ orderId, status }: { orderId: string; status: string }) {
  const [opening, setOpening] = useState(false);

  const openConversation = async () => {
    // Abrir no gesto do usuário reduz o bloqueio de pop-up em navegadores móveis.
    const popup = window.open('about:blank', '_blank', 'noopener,noreferrer');
    setOpening(true);
    try {
      const response = await fetch(`/api/admin/pedidos/${orderId}/notificacoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, idempotencyKey: crypto.randomUUID() }),
      });
      const payload = await response.json().catch(() => null) as { error?: string; url?: string } | null;
      if (!response.ok || !payload?.url) throw new Error(payload?.error || 'Não foi possível preparar a mensagem.');
      if (popup) popup.location.href = payload.url;
      else window.location.href = payload.url;
    } catch (caught) {
      popup?.close();
      window.alert(caught instanceof Error ? caught.message : 'Não foi possível preparar a mensagem.');
    } finally {
      setOpening(false);
    }
  };

  return (
    <button type="button" onClick={openConversation} disabled={opening} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-60 transition-colors shadow-xs">
      {opening ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
      Atualizar WhatsApp
    </button>
  );
}
