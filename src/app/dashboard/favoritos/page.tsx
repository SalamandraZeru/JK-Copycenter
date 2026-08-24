import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { FavoritosList } from '@/components/dashboard/FavoritosList';

export default async function FavoritosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: favorites } = await supabase
    .from('favorite_orders')
    .select(`
      id, name, order_id, created_at,
      orders ( order_number, total, created_at )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Pedidos Favoritos</h1>
        <p className="mt-1 text-slate-500">Salve configurações de pedidos que você faz com frequência.</p>
      </div>

      <FavoritosList favorites={favorites || []} />
    </div>
  );
}
