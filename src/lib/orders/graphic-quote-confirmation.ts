export const GRAPHIC_QUOTE_CONFIRMATION_KEY = 'jk_graphic_quote_confirmation';

export interface GraphicQuoteConfirmation {
  requestId: string;
  protocol: string;
  requestCode: string;
  whatsappUrl: string | null;
  whatsappMessage: string;
  createdAt: string;
}

export function safeWhatsAppUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'wa.me' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function whatsappMessageFromUrl(value: unknown): string | null {
  const safeUrl = safeWhatsAppUrl(value);
  if (!safeUrl) return null;
  const message = new URL(safeUrl).searchParams.get('text')?.trim();
  return message ? message.slice(0, 12_000) : null;
}

export function parseGraphicQuoteConfirmation(value: string | null): GraphicQuoteConfirmation | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const candidate = parsed as Partial<GraphicQuoteConfirmation>;
    const whatsappUrl = safeWhatsAppUrl(candidate.whatsappUrl);
    const whatsappMessage = typeof candidate.whatsappMessage === 'string'
      ? candidate.whatsappMessage.trim().slice(0, 12_000)
      : whatsappMessageFromUrl(whatsappUrl) ?? '';
    if (typeof candidate.requestId !== 'string'
        || typeof candidate.protocol !== 'string'
        || typeof candidate.requestCode !== 'string'
        || typeof candidate.createdAt !== 'string') return null;
    return {
      requestId: candidate.requestId.slice(0, 100),
      protocol: candidate.protocol.slice(0, 100),
      requestCode: candidate.requestCode.slice(0, 200),
      whatsappUrl,
      whatsappMessage,
      createdAt: candidate.createdAt,
    };
  } catch {
    return null;
  }
}
