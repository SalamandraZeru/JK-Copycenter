'use client';
/* eslint-disable @next/next/no-img-element */

import React, { useState } from 'react';
import { ShoppingCart, Check, BookOpen, PenTool, Layers, Package, ShoppingBag } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';
import { useCartStore } from '@/lib/cart/store';

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

function getProductIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('papel') || lower.includes('resma')) return Layers;
  if (lower.includes('caneta') || lower.includes('lapis') || lower.includes('grampeador')) return PenTool;
  if (lower.includes('caderno') || lower.includes('pasta')) return BookOpen;
  if (lower.includes('fita') || lower.includes('caixa')) return Package;
  return ShoppingBag;
}

export function ProductCard({ product }: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem);
  const [added, setAdded] = useState(false);
  const Icon = getProductIcon(product.name);

  const handleAddToCart = () => {
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
      quantity: 1,
      fileIds: [],
    });
    
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="group bg-white rounded-3xl overflow-hidden border border-slate-200 hover:border-slate-300 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col h-full">
      <div className="aspect-square bg-slate-50 overflow-hidden relative flex items-center justify-center p-6 border-b border-slate-100">
        {product.image_url ? (
          <img 
            src={product.image_url} 
            alt={product.name} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 rounded-2xl"
          />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-[#0F2040]/5 group-hover:bg-[#CC1A1A]/10 text-[#0F2040] group-hover:text-[#CC1A1A] flex items-center justify-center transition-colors duration-300">
            <Icon className="w-8 h-8" />
          </div>
        )}
      </div>
      
      <div className="p-6 flex flex-col flex-1">
        <h3 className="text-base font-bold text-[#1A1A2E] mb-1 font-serif group-hover:text-[#CC1A1A] transition-colors">
          {product.name}
        </h3>
        <p className="text-slate-500 text-xs mb-4 flex-1 line-clamp-2 leading-relaxed">
          {product.description || 'Produto de alta durabilidade e pronta entrega na JK Copycenter.'}
        </p>
        
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100">
          <span className="text-lg font-extrabold text-[#0F2040]">
            {formatCurrency(product.price)}
          </span>
          <button 
            onClick={handleAddToCart}
            disabled={product.stock_quantity !== null && product.stock_quantity <= 0}
            className={`w-11 h-11 flex items-center justify-center rounded-2xl transition-all duration-300 ${
              added 
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30' 
                : (product.stock_quantity !== null && product.stock_quantity <= 0)
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-[#0F2040] text-white hover:bg-[#CC1A1A] shadow-md hover:shadow-lg'
            }`}
            title={product.stock_quantity !== null && product.stock_quantity <= 0 ? 'Fora de estoque' : 'Adicionar ao carrinho'}
          >
            {added ? <Check className="w-5 h-5" /> : <ShoppingCart className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
