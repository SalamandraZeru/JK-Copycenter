'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, Trash2, ArrowRight } from 'lucide-react';

export function FavoritosList({ favorites }: { favorites: any[] }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja remover este pedido dos favoritos?')) return;
    
    setIsDeleting(id);
    try {
      const res = await fetch(`/api/dashboard/favoritos?id=${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        router.refresh();
      }
    } catch {
      alert('Erro ao excluir favorito.');
    } finally {
      setIsDeleting(null);
    }
  };

  if (favorites.length === 0) {
    return (
      <div className="text-center p-12 bg-slate-50 border border-slate-200 rounded-lg text-slate-500">
        <Heart className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <p>Você ainda não favoritou nenhum pedido.</p>
        <p className="text-sm mt-1">Quando quiser repetir rapidamente uma compra, marque-a como favorita!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {favorites.map(fav => (
        <div key={fav.id} className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold text-slate-900 truncate pr-4">{fav.name || `Pedido #${fav.orders.order_number}`}</h3>
              <button 
                onClick={() => handleDelete(fav.id)}
                disabled={isDeleting === fav.id}
                className="text-slate-400 hover:text-red-600 disabled:opacity-50 transition-colors"
                title="Remover dos Favoritos"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-500">Pedido Original: #{fav.orders.order_number}</p>
          </div>
          
          <div className="mt-6 flex justify-end">
            <form action={`/api/dashboard/pedidos/${fav.order_id}/repetir`} method="POST">
              <button 
                type="submit"
                className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors"
              >
                Pedir Novamente <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </form>
          </div>
        </div>
      ))}
    </div>
  );
}
