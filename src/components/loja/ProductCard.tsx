'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Check, Package, Plus } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';
import { useCartStore } from '@/lib/cart/store';
import { productCartItem } from '@/lib/cart/product-item';

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    image_url: string | null;
    price: number;
    stock_quantity: number | null;
  };
}

// Cartão editorial de produto: foto quadrada sangrada, nome em serifa, preço
// em destaque. O cartão inteiro leva ao detalhe; o botão do carrinho fica por
// cima do link "esticado".
export function ProductCard({ product }: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem);
  const [added, setAdded] = useState(false);
  const outOfStock = product.stock_quantity !== null && product.stock_quantity <= 0;

  const handleAddToCart = () => {
    addItem(productCartItem(product));

    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="group relative flex h-full flex-col">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-[#f4f0e8]">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt=""
            fill
            sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 50vw"
            className={`object-cover transition duration-700 ease-out group-hover:scale-[1.04] ${outOfStock ? 'opacity-60 grayscale' : ''}`}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[#092653]/30">
            <Package className="h-12 w-12" aria-hidden="true" />
          </div>
        )}
        {outOfStock && (
          <span className="absolute left-3 top-3 rounded-full bg-[#fffdf8] px-3 py-1 text-xs font-bold text-slate-700">
            Esgotado
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col pt-4">
        <h3 className="jk-display text-xl font-black leading-snug text-[#092653]">
          <Link
            href={`/produto/${product.slug}`}
            className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-xl focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-[#b4232d]"
          >
            {product.name}
          </Link>
        </h3>
        {product.description && (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-500">{product.description}</p>
        )}

        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          <span className="text-lg font-black text-[#092653]">{formatCurrency(product.price)}</span>
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={outOfStock}
            aria-label={outOfStock ? `${product.name} esgotado` : `Adicionar ${product.name} ao carrinho`}
            className={`relative z-10 inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-bold transition-colors duration-200 ${
              added
                ? 'bg-emerald-600 text-white'
                : outOfStock
                  ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                  : 'bg-[#092653] text-white hover:bg-[#b4232d]'
            }`}
          >
            {added ? (
              <>
                <Check className="h-4 w-4" aria-hidden="true" /> Adicionado
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" aria-hidden="true" /> Carrinho
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
