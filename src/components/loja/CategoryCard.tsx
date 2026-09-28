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
    <Link href={`/papelaria?categoria=${category.slug}`} className="group flex min-h-28 items-center gap-3 rounded-2xl border border-[#092653]/15 bg-[#fffdf8] p-3 transition hover:-translate-y-0.5 hover:border-[#b4232d]/50">
      <div className="relative flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-xl bg-white p-2">
        {category.image_url ? (
          <img 
            src={category.image_url} 
            alt={category.name} 
            className="h-full w-full rounded-lg object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[#0d2b5c]/5 text-[#0d2b5c] transition-colors duration-200 group-hover:bg-[#b4232d]/10 group-hover:text-[#b4232d]">
            <Icon className="w-7 h-7" />
          </div>
        )}
      </div><h3 className="text-left text-sm font-black leading-tight text-[#13233b] transition-colors group-hover:text-[#b4232d]">
        {category.name}
      </h3>
    </Link>
  );
}
