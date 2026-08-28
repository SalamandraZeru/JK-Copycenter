'use client';
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  cartConfigurationFingerprint,
  type CartDisplaySnapshot,
  type CartItem,
  useCartStore,
} from '@/lib/cart/store';
import type { PricingCalculationResult } from '@/types/pricing';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Minus,
  Plus,
  RefreshCw,
  ShoppingBag,
  Trash2,
} from 'lucide-react';

interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string | { message?: string };
}

interface PublicProduct {
  id: string;
  name: string;
  image_url: string | null;
  price: number | string;
}

function formatCurrencyFromCents(value: number | null): string {
  if (value === null) return 'A confirmar';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100);
}

function messageFromError(error: ApiResult<unknown>['error']): string {
  if (typeof error === 'string') return error;
  return error?.message || 'Não foi possível atualizar este item.';
}

function responseToStatus(message: string): 'configuration_needs_review' | 'unavailable' | 'quote_unavailable' {
  const normalized = message.toLocaleLowerCase('pt-BR');
  if (normalized.includes('não encontrado') || normalized.includes('inexistente') || normalized.includes('inativo')) {
    return 'unavailable';
  }
  if (normalized.includes('configura') || normalized.includes('opção') || normalized.includes('opcao')) {
    return 'configuration_needs_review';
  }
  return 'quote_unavailable';
}

function snapshotFromService(item: CartItem, quote: PricingCalculationResult): CartDisplaySnapshot {
  return {
    title: quote.serviceSnapshot.name,
    imageUrl: item.displaySnapshot.imageUrl,
    summary: [
      ...quote.fieldsSnapshot.map((field) => `${field.fieldLabel}: ${field.valueLabel}`),
      ...(quote.bindingSelections.length > 0
        ? [`Encadernação: ${quote.bindingSelections.length} arquivo(s) selecionado(s)`]
        : []),
    ],
    fileNames: item.displaySnapshot.fileNames,
    estimatedTotalCents: quote.totalCents,
    estimatedUnitCents: quote.unitPriceCents,
    calculatedAt: new Date().toISOString(),
    pricingVersion: quote.serviceSnapshot.pricingVersion,
    catalogVersion: quote.serviceSnapshot.catalogVersion,
    isEstimate: quote.isEstimate,
    configurationFingerprint: cartConfigurationFingerprint(item),
  };
}

function revalidationMessage(item: CartItem): string | null {
  switch (item.revalidationStatus) {
    case 'pending': return 'Atualizando catálogo e cotação…';
    case 'requires_file_reupload': return 'Reenvie o arquivo para concluir a validação de segurança.';
    case 'configuration_needs_review': return 'Uma opção deste serviço mudou. Revise a configuração antes de finalizar.';
    case 'unavailable': return 'Este item não está mais disponível no catálogo.';
    case 'quote_unavailable': return 'Não foi possível obter uma cotação atual. Tente novamente.';
    default: return null;
  }
}

export default function CarrinhoPage() {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const restoreSessionFiles = useCartStore((state) => state.restoreSessionFiles);
  const applyRevalidation = useCartStore((state) => state.applyRevalidation);
  const [mounted, setMounted] = useState(false);
  const [cartReady, setCartReady] = useState(false);

  useEffect(() => {
    restoreSessionFiles();
    setMounted(true);
    setCartReady(true);
  }, [restoreSessionFiles]);

  const revalidationFingerprint = useMemo(() => items
    .map((item) => `${item.id}:${cartConfigurationFingerprint(item)}:${item.fileIds.join(',')}`)
    .join('|'), [items]);
  // Updating the visual snapshot must not recursively schedule another network
  // quote. This memo changes only when the authoritative cart intent changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const itemsToRevalidate = useMemo(() => items, [revalidationFingerprint]);

  useEffect(() => {
    if (!cartReady || itemsToRevalidate.length === 0) return;
    let cancelled = false;

    async function revalidateServiceItem(item: CartItem): Promise<void> {
      const configurationFingerprint = cartConfigurationFingerprint(item);
      const hasSameConfiguration = item.displaySnapshot.configurationFingerprint === configurationFingerprint;
      if (item.displaySnapshot.fileNames.length > 0 && item.fileIds.length === 0) {
        applyRevalidation(item.id, { revalidationStatus: 'requires_file_reupload', requiresFileReupload: true, priceChanged: false });
        return;
      }
      try {
        const response = await fetch('/api/pricing/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serviceId: item.serviceId,
            attributeIds: item.attributeIds,
            fieldValues: item.fieldValues.map(({ fieldKey, value }) => ({ fieldKey, value })),
            fileIds: item.fileIds,
            bindingFileIds: item.bindingFileIds ?? [],
            dimensions: item.dimensions ?? {},
            bookletPaddingApproved: Boolean(item.bookletPaddingApproved),
            pageCount: item.pageCount,
            isFrontAndBack: item.isFrontAndBack,
            quantity: item.quantity,
          }),
        });
        const body = await response.json() as ApiResult<PricingCalculationResult>;
        if (!response.ok || !body.success || !body.data) throw new Error(messageFromError(body.error));
        if (cancelled) return;
        const nextSnapshot = snapshotFromService(item, body.data);
        const priceChanged = hasSameConfiguration
          && (item.displaySnapshot.estimatedTotalCents !== nextSnapshot.estimatedTotalCents
            || item.displaySnapshot.pricingVersion !== nextSnapshot.pricingVersion
            || item.displaySnapshot.catalogVersion !== nextSnapshot.catalogVersion);
        applyRevalidation(item.id, { displaySnapshot: nextSnapshot, revalidationStatus: 'ready', requiresFileReupload: false, priceChanged });
      } catch (error) {
        if (cancelled) return;
        applyRevalidation(item.id, {
          revalidationStatus: responseToStatus(error instanceof Error ? error.message : ''),
          requiresFileReupload: false,
          priceChanged: false,
        });
      }
    }

    async function revalidateProductItem(item: CartItem): Promise<void> {
      const configurationFingerprint = cartConfigurationFingerprint(item);
      const hasSameConfiguration = item.displaySnapshot.configurationFingerprint === configurationFingerprint;
      try {
        const response = await fetch(`/api/catalogo/produtos/${item.productId}`);
        const body = await response.json() as ApiResult<PublicProduct>;
        if (!response.ok || !body.success || !body.data) throw new Error(messageFromError(body.error));
        if (cancelled) return;
        const unitCents = Math.round(Number(body.data.price) * 100);
        if (!Number.isSafeInteger(unitCents) || unitCents < 0) throw new Error('Preço inválido no catálogo.');
        const nextSnapshot: CartDisplaySnapshot = {
          ...item.displaySnapshot,
          title: body.data.name,
          imageUrl: body.data.image_url,
          estimatedUnitCents: unitCents,
          estimatedTotalCents: unitCents * item.quantity,
          calculatedAt: new Date().toISOString(),
          pricingVersion: null,
          isEstimate: false,
          configurationFingerprint,
        };
        applyRevalidation(item.id, {
          displaySnapshot: nextSnapshot,
          revalidationStatus: 'ready',
          requiresFileReupload: false,
          priceChanged: hasSameConfiguration && item.displaySnapshot.estimatedTotalCents !== nextSnapshot.estimatedTotalCents,
        });
      } catch (error) {
        if (cancelled) return;
        applyRevalidation(item.id, {
          revalidationStatus: responseToStatus(error instanceof Error ? error.message : ''),
          requiresFileReupload: false,
          priceChanged: false,
        });
      }
    }

    for (const item of itemsToRevalidate) {
      if (item.serviceId) void revalidateServiceItem(item);
      else if (item.productId) void revalidateProductItem(item);
      else applyRevalidation(item.id, { revalidationStatus: 'unavailable', requiresFileReupload: false, priceChanged: false });
    }
    return () => { cancelled = true; };
  }, [applyRevalidation, cartReady, itemsToRevalidate]);

  if (!mounted) return null;
  if (items.length === 0) {
    return <div className="mx-auto max-w-4xl px-4 py-20 text-center"><div className="flex flex-col items-center rounded-3xl border border-slate-200 bg-white p-12 shadow-sm"><div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-slate-100"><ShoppingBag className="h-10 w-10 text-slate-400" /></div><h2 className="mb-4 text-3xl font-bold text-slate-900">Seu carrinho está vazio</h2><p className="mb-8 max-w-md text-lg text-slate-600">Adicione serviços gráficos ou produtos de papelaria para continuar.</p><div className="flex gap-4"><Link href="/grafica" className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700">Ver Gráfica</Link><Link href="/papelaria" className="rounded-xl bg-slate-100 px-6 py-3 font-semibold text-slate-900 transition-colors hover:bg-slate-200">Ver Papelaria</Link></div></div></div>;
  }

  const subtotalCents = items.reduce((total, item) => total + (item.displaySnapshot.estimatedTotalCents ?? 0), 0);
  const hasUnquotedItems = items.some((item) => item.displaySnapshot.estimatedTotalCents === null);
  const checkoutBlocked = items.some((item) => item.revalidationStatus !== 'ready');

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold text-slate-900">Meu Carrinho</h1>
      <p className="mb-8 text-slate-600">A cotação exibida é atualizada com o catálogo. O pedido sempre é recalculado no servidor antes da confirmação.</p>
      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="flex-1 space-y-6">
          {items.map((item) => {
            const statusMessage = revalidationMessage(item);
            const snapshot = item.displaySnapshot;
            return <article key={item.id} className="flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row">
              <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100">{snapshot.imageUrl ? <img src={snapshot.imageUrl} alt={snapshot.title} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><ShoppingBag className="h-8 w-8 text-slate-300" /></div>}</div>
              <div className="min-w-0 flex-1"><div className="mb-2 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-slate-900">{snapshot.title}</h2><p className="mt-1 text-sm text-slate-500">{item.serviceId ? `${item.pageCount} página(s) por cópia` : 'Produto de papelaria'}</p></div><button onClick={() => removeItem(item.id)} className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50" title="Remover item" aria-label={`Remover ${snapshot.title}`}><Trash2 className="h-5 w-5" /></button></div>
                {snapshot.summary.length > 0 && <ul className="mb-3 space-y-1 text-sm text-slate-600">{snapshot.summary.map((line) => <li key={line}>• {line}</li>)}</ul>}
                {snapshot.fileNames.length > 0 && <p className="mb-3 text-sm text-slate-600"><strong>Arquivos:</strong> {snapshot.fileNames.join(', ')}</p>}
                {statusMessage && <div className={`mb-4 flex gap-2 rounded-lg border p-3 text-sm ${item.revalidationStatus === 'pending' ? 'border-blue-200 bg-blue-50 text-blue-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>{item.revalidationStatus === 'pending' ? <RefreshCw className="mt-0.5 h-4 w-4 animate-spin" /> : <AlertCircle className="mt-0.5 h-4 w-4" />}<div><p>{statusMessage}</p>{item.serviceId && item.revalidationStatus !== 'pending' && <Link href={`/servico/${item.serviceId}`} className="mt-1 inline-block font-semibold text-blue-700 underline">Reconfigurar este serviço</Link>}</div></div>}
                {item.priceChanged && <div className="mb-4 flex gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950"><CheckCircle2 className="mt-0.5 h-4 w-4" />A cotação foi atualizada porque o preço ou a regra do catálogo mudou.</div>}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-4"><div className="flex items-center overflow-hidden rounded-lg border border-slate-200"><button onClick={() => updateQuantity(item.id, item.quantity - 1)} disabled={item.quantity <= 1} className="bg-slate-50 px-3 py-2 text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Diminuir quantidade"><Minus className="h-4 w-4" /></button><span className="bg-white px-4 py-2 font-medium text-slate-900">{item.quantity}</span><button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="bg-slate-50 px-3 py-2 text-slate-600 transition-colors hover:bg-slate-100" aria-label="Aumentar quantidade"><Plus className="h-4 w-4" /></button></div><div className="text-right"><p className="text-lg font-bold text-slate-900">{formatCurrencyFromCents(snapshot.estimatedTotalCents)}</p><p className="text-xs text-slate-500">{snapshot.isEstimate ? 'Estimativa' : 'Cotação atual'}{snapshot.calculatedAt ? ` • atualizada ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(snapshot.calculatedAt))}` : ''}</p></div></div>
              </div>
            </article>;
          })}
        </div>
        <aside className="w-full flex-shrink-0 lg:w-96"><div className="sticky top-24 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="mb-6 text-xl font-bold text-slate-900">Resumo do Pedido</h2><div className="mb-6 space-y-4"><div className="flex justify-between gap-4 text-slate-600"><span>Subtotal ({items.length} item(ns))</span><span className="font-medium text-slate-900">{hasUnquotedItems ? 'Aguardando cotação' : formatCurrencyFromCents(subtotalCents)}</span></div><div className="flex justify-between gap-4 text-slate-600"><span>Taxa de entrega</span><span className="text-sm">Definida no checkout</span></div></div><div className="mb-6 border-t border-slate-200 pt-4"><div className="flex justify-between gap-4"><span className="text-lg font-bold text-slate-900">Total estimado</span><span className="text-right text-lg font-bold text-slate-900">{hasUnquotedItems ? 'A confirmar' : formatCurrencyFromCents(subtotalCents)}</span></div></div>{checkoutBlocked && <div className="mb-6 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><Clock3 className="mt-0.5 h-4 w-4 flex-shrink-0" />Conclua a atualização ou a revisão dos itens indicados para avançar ao checkout.</div>}<button onClick={() => router.push('/carrinho/checkout')} disabled={checkoutBlocked} className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-4 text-lg font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">Finalizar Pedido <ArrowRight className="h-5 w-5" /></button><Link href="/grafica" className="block w-full rounded-xl py-3 text-center font-medium text-slate-600 transition-colors hover:bg-slate-50">Continuar Comprando</Link></div></aside>
      </div>
    </div>
  );
}
