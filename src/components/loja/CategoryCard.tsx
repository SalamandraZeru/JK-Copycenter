/* eslint-disable @next/next/no-img-element */
import React from 'react';
import Link from 'next/link';
import { Layers, PenTool, Archive, Printer, Package, Laptop, ShoppingBag } from 'lucide-react';

interface CategoryCardProps {
  category: {
    id: string;
    name: string;
    slug: string;
    image_url: string | null;
  };
}

function getCategoryIcon(slug: string) {
  if (slug.includes('papel') || slug.includes('envelope')) return Layers;
  if (slug.includes('escrita') || slug.includes('caneta')) return PenTool;
  if (slug.includes('arquivo') || slug.includes('organizacao')) return Archive;
  if (slug.includes('grafica') || slug.includes('impresso')) return Printer;
  if (slug.includes('embalage') || slug.includes('envio')) return Package;
  if (slug.includes('informatica') || slug.includes('cabo')) return Laptop;
  return ShoppingBag;
}

export function CategoryCard({ category }: CategoryCardProps) {
  const Icon = getCategoryIcon(category.slug || category.name.toLowerCase());

  return (
    <Link href={`/papelaria?categoria=${category.slug}`} className="group block text-center">
      <div className="relative aspect-square rounded-xl overflow-hidden bg-white border border-slate-200 group-hover:border-[#b4232d]/40 group-hover:shadow-lg transition-all duration-200 mb-3 flex items-center justify-center p-4">
        {category.image_url ? (
          <img 
            src={category.image_url} 
            alt={category.name} 
            className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-[#0d2b5c]/5 group-hover:bg-[#b4232d]/10 text-[#0d2b5c] group-hover:text-[#b4232d] flex items-center justify-center transition-colors duration-200">
            <Icon className="w-7 h-7" />
          </div>
        )}
      </div>
      <h3 className="text-sm font-bold text-[#13233b] group-hover:text-[#b4232d] transition-colors leading-tight">
        {category.name}
      </h3>
    </Link>
  );
}
