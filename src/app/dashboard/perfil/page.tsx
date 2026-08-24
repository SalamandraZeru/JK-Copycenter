import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ProfileForm } from '@/components/dashboard/ProfileForm';

export default async function PerfilPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const userEmail = user.email || '';

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 font-serif">Meu Perfil</h1>
        <p className="mt-1 text-sm font-medium text-slate-600">Gerencie seus dados cadastrais e informações de contato.</p>
      </div>

      <div className="bg-white shadow-sm rounded-3xl border border-slate-200 overflow-hidden">
        <div className="p-6 sm:p-8 space-y-8">
          <div>
            <h3 className="text-lg font-bold text-slate-900 font-serif mb-4">Conta de Acesso</h3>
            <div className="flex flex-col gap-1.5 max-w-lg">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">
                E-mail de Acesso
              </label>
              <input
                type="email"
                disabled
                value={userEmail}
                className="px-4 py-2.5 border border-slate-300 rounded-xl shadow-sm bg-slate-100 text-slate-800 font-medium text-sm cursor-not-allowed"
              />
              <p className="text-xs font-medium text-slate-600 mt-1">
                O e-mail é a chave principal da sua conta e não pode ser alterado por aqui.
              </p>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-8">
            <h3 className="text-lg font-bold text-slate-900 font-serif mb-4">Dados Pessoais</h3>
            <ProfileForm initialData={profile || { full_name: '', phone: '' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
