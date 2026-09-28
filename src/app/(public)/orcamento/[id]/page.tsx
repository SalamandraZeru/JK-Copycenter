import type { Metadata } from 'next';
import { GuestQuoteAccess } from '@/components/orders/GuestQuoteAccess';

export const metadata: Metadata = {
  title: 'Revisar orçamento | JK Copycenter',
  description: 'Área segura para revisar e responder uma proposta da JK Copycenter.',
  robots: { index: false, follow: false, noarchive: true },
  referrer: 'no-referrer',
};

export default async function GuestQuotePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return <main className="mx-auto min-h-[70vh] w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14"><GuestQuoteAccess orderId={id} /></main>;
}
