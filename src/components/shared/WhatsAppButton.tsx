'use client';

import React from 'react';
import { MessageCircle } from 'lucide-react';

export function WhatsAppButton({ number = '5511999999999' }: { number?: string }) {
  const url = `https://wa.me/${number}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 bg-green-500 text-white rounded-full shadow-lg hover:bg-green-600 transition-colors hover:scale-105 active:scale-95"
      aria-label="Fale conosco no WhatsApp"
    >
      <MessageCircle className="w-7 h-7" />
    </a>
  );
}
