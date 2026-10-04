'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight, BookOpen, Camera, Check, CreditCard, FileText, Flag, Layers, Mail, Map as MapIcon, NotebookPen,
  Package, Plus, Printer, ShoppingBag, Sticker, type LucideIcon,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';
import { useCartStore } from '@/lib/cart/store';
import { productCartItem } from '@/lib/cart/product-item';

// Cartões compactos: trilhos que rolam para o lado no celular e viram grade no
// desktop (ou grade fluida com `fluid`). Sempre com a foto cadastrada no admin.

// Enquanto o serviço não tem foto, um ícone do tipo de trabalho ocupa o lugar.
const SERVICE_ICONS: Array<[RegExp, LucideIcon]> = [
  [/encaderna|livreto|apostila/, BookOpen],
  [/cart(ao|oes)/, CreditCard],
  [/banner|faixa|lona/, Flag],
  [/adesivo|etiqueta/, Sticker],
  [/convite/, Mail],
  [/foto/, Camera],
  [/bloco|talao|taloes/, NotebookPen],
  [/plotagem|projeto/, MapIcon],
  [/folder|panfleto|flyer/, Layers],
  [/impress/, Printer],
];

export function serviceIcon(slug: string): LucideIcon {
  return SERVICE_ICONS.find(([pattern]) => pattern.test(slug))?.[1] ?? FileText;
}

export function CategoryBubble({ category, href, active = false }: {
  category: { id: string; name: string; slug: string; image_url: string | null };
  href?: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href ?? `/papelaria?categoria=${category.slug}`}
      aria-current={active ? 'page' : undefined}
      className="group flex w-[4.75rem] flex-none snap-start flex-col items-center gap-2 text-center sm:w-24"
    >
      <span className={`relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[#e8f1fa] transition sm:h-20 sm:w-20 ${
        active ? 'ring-[3px] ring-[#b4232d]' : 'ring-2 ring-[#092653]/10 group-hover:ring-[#b4232d]'
      }`}>
        {category.image_url ? (
          <Image src={category.image_url} alt="" fill sizes="80px" className="object-cover" />
        ) : (
          <ShoppingBag className="h-6 w-6 text-[#092653]" aria-hidden="true" />
        )}
      </span>
      <span className={`text-xs font-bold leading-tight group-hover:text-[#b4232d] sm:text-sm ${active ? 'text-[#b4232d]' : 'text-[#13233b]'}`}>{category.name}</span>
    </Link>
  );
}

export function ServiceRailCard({ service, fluid = false }: {
  service: { id: string; name: string; slug: string; image_url: string | null };
  /** Ocupa a célula da grade em vez da largura fixa do trilho. */
  fluid?: boolean;
}) {
  const Icon = serviceIcon(service.slug);
  return (
    <Link
      href={`/servico/${service.slug}`}
      className={`group flex flex-col overflow-hidden rounded-xl border border-[#092653]/10 bg-[#fffdf8] transition hover:border-[#092653]/30 ${
        fluid ? 'w-full' : 'w-40 flex-none snap-start sm:w-48 md:w-auto'
      }`}
    >
      <span className="relative block aspect-[4/3] bg-[#061a3b]">
        {service.image_url ? (
          <Image
            src={service.image_url}
            alt=""
            fill
            sizes="(min-width: 1024px) 22vw, (min-width: 768px) 30vw, 192px"
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <Icon className="absolute inset-0 m-auto h-10 w-10 text-[#9ed0ff]" strokeWidth={1.5} aria-hidden="true" />
        )}
      </span>
      <span className="flex flex-1 flex-col p-3">
        <span className="line-clamp-2 text-sm font-black leading-snug text-[#092653]">{service.name}</span>
        <span className="mt-auto inline-flex items-center gap-1 pt-2 text-xs font-bold text-[#b4232d]">
          Pedir orçamento <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </span>
      </span>
    </Link>
  );
}

export function ProductRailCard({ product, fluid = false }: {
  product: { id: string; name: string; slug: string; image_url: string | null; price: number; stock_quantity: number | null };
  fluid?: boolean;
}) {
  const addItem = useCartStore((state) => state.addItem);
  const [added, setAdded] = useState(false);
  const outOfStock = product.stock_quantity !== null && product.stock_quantity <= 0;

  const handleAdd = () => {
    if (outOfStock) return;
    addItem(productCartItem(product));
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    <div className={`relative flex flex-col overflow-hidden rounded-xl border border-[#092653]/10 bg-white ${
      fluid ? 'w-full' : 'w-36 flex-none snap-start sm:w-44 md:w-auto'
    }`}>
      <span className="relative block aspect-square bg-white">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt=""
            fill
            sizes="(min-width: 1024px) 18vw, (min-width: 768px) 24vw, 176px"
            className={`object-contain p-2 ${outOfStock ? 'opacity-50 grayscale' : ''}`}
          />
        ) : (
          <Package className="absolute inset-0 m-auto h-8 w-8 text-[#092653]/30" aria-hidden="true" />
        )}
        {outOfStock && (
          <span className="absolute left-2 top-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">Esgotado</span>
        )}
      </span>
      <div className="flex flex-1 flex-col border-t border-slate-100 p-2.5">
        <h3 className="line-clamp-2 text-[13px] font-bold leading-snug text-[#13233b]">
          <Link
            href={`/produto/${product.slug}`}
            className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-xl focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-[#b4232d]"
          >
            {product.name}
          </Link>
        </h3>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="text-sm font-black text-[#092653]">{formatCurrency(product.price)}</span>
          <button
            type="button"
            onClick={handleAdd}
            disabled={outOfStock}
            aria-label={outOfStock ? `${product.name} esgotado` : `Adicionar ${product.name} ao carrinho`}
            className={`relative z-10 flex h-8 w-8 flex-none items-center justify-center rounded-full transition-colors ${
              added ? 'bg-emerald-600 text-white' : outOfStock ? 'cursor-not-allowed bg-slate-100 text-slate-400' : 'bg-[#092653] text-white hover:bg-[#b4232d]'
            }`}
          >
            {added ? <Check className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      </div>
    </div>
  );
}
