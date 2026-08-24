import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AddressManager, type Address } from '@/components/dashboard/AddressManager';

export default async function EnderecosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });
  const addresses = (data as Address[]) || [];

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 font-serif">Meus Endereços</h1>
        <p className="mt-1 text-sm font-medium text-slate-600">Gerencie seus endereços cadastrados para entregas rápidas.</p>
      </div>

      <AddressManager addresses={addresses} />
    </div>
  );
}
