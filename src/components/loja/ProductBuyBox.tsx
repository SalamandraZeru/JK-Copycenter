'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ShoppingCart, Check, Minus, Plus } from 'lucide-react';
import { useCartStore } from '@/lib/cart/store';
import { formatCurrency } from '@/lib/utils/format';

interface ProductBuyBoxProps {
  product: {
    id: string;
    name: string;
    image_url: string | null;
    price: number;
    stockControlEnabled: boolean;
    availableStock: number | null;
  };
}

export function ProductBuyBox({ product }: ProductBuyBoxProps) {
  const addItem = useCartStore((state) => state.addItem);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const outOfStock = product.stockControlEnabled && (product.availableStock ?? 0) <= 0;
  const maxQuantity = product.stockControlEnabled && product.availableStock !== null
    ? Math.max(1, product.availableStock)
    : 999;

  const changeQuantity = (delta: number) => {
    setQuantity((current) => Math.min(maxQuantity, Math.max(1, current + delta)));
  };

  const handleAddToCart = () => {
    if (outOfStock) return;
    addItem({
      productId: product.id,
      name: product.name,
      imageUrl: product.image_url,
      type: 'product',
      basePrice: product.price,
      estimatedTotal: product.price,
      attributeIds: [],
      fieldValues: [],
      pageCount: 1,
      isFrontAndBack: false,
      quantity,
      fileIds: [],
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <p className="text-3xl font-black text-[#092653]">{formatCurrency(product.price)}</p>

      <div className="mt-2 text-sm font-semibold">
        {product.stockControlEnabled ? (
          outOfStock ? (
            <span className="text-[#b4232d]">Fora de estoque</span>
          ) : (
            <span className="text-emerald-700">{product.availableStock} disponível(is)</span>
          )
        ) : (
          <span className="text-slate-600">Consulte a disponibilidade na loja</span>
        )}
      </div>

      {!outOfStock && (
        <div className="mt-5">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Quantidade</span>
          <div className="inline-flex items-center rounded-xl border border-slate-300">
            <button type="button" onClick={() => changeQuantity(-1)} disabled={quantity <= 1} aria-label="Diminuir" className="flex h-11 w-11 items-center justify-center rounded-l-xl text-slate-700 hover:bg-slate-100 disabled:opacity-40"><Minus className="h-4 w-4" /></button>
            <span className="w-12 text-center text-base font-black text-[#092653]">{quantity}</span>
            <button type="button" onClick={() => changeQuantity(1)} disabled={quantity >= maxQuantity} aria-label="Aumentar" className="flex h-11 w-11 items-center justify-center rounded-r-xl text-slate-700 hover:bg-slate-100 disabled:opacity-40"><Plus className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleAddToCart}
        disabled={outOfStock}
        className={`mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 font-black text-white transition ${
          added
            ? 'bg-emerald-600'
            : outOfStock
              ? 'cursor-not-allowed bg-slate-300 text-slate-500'
              : 'bg-[#b4232d] hover:bg-[#951c25]'
        }`}
      >
        {added ? <><Check className="h-5 w-5" /> Adicionado</> : <><ShoppingCart className="h-5 w-5" /> Adicionar ao carrinho</>}
      </button>

      <Link href="/carrinho" className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-[#092653]/25 px-6 font-bold text-[#092653] transition hover:border-[#092653]">
        Ir para o carrinho
      </Link>
    </div>
  );
}
