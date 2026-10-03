import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

interface CategoryCardProps {
  category: {
    id: string;
    name: string;
    slug: string;
    image_url: string | null;
  };
}

// Cartão editorial: a foto ocupa o cartão inteiro e o título em serifa fica
// sobre ela. Sem foto cadastrada, o nome vira o elemento visual sobre papel.
export function CategoryCard({ category }: CategoryCardProps) {
  return (
    <Link
      href={`/papelaria?categoria=${category.slug}`}
      className="group relative block aspect-[4/5] overflow-hidden rounded-xl bg-[#092653] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#b4232d]"
    >
      {category.image_url ? (
        <>
          <Image
            src={category.image_url}
            alt=""
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 45vw, 90vw"
            className="object-cover transition duration-700 ease-out group-hover:scale-[1.04]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#061a3b]/85 via-[#061a3b]/15 to-transparent" />
        </>
      ) : (
        <div className="jk-paper-grid absolute inset-0" />
      )}

      <span
        className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full transition duration-300 group-hover:rotate-45 sm:right-4 sm:top-4 sm:h-10 sm:w-10 ${
          category.image_url ? 'bg-white/90 text-[#092653]' : 'bg-[#092653] text-white'
        }`}
        aria-hidden="true"
      >
        <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5" />
      </span>

      <h3
        className={`jk-display absolute inset-x-0 bottom-0 p-4 text-2xl font-black leading-none [overflow-wrap:anywhere] sm:p-6 sm:text-4xl ${
          category.image_url ? 'text-white' : 'text-[#092653]'
        }`}
      >
        {category.name}
      </h3>
    </Link>
  );
}
