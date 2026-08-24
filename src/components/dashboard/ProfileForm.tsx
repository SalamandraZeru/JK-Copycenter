'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Loader2, Check } from 'lucide-react';

const profileSchema = z.object({
  full_name: z.string().min(3, 'Nome completo é obrigatório'),
  phone: z.string().min(10, 'Telefone inválido').max(15).optional().or(z.literal('')),
});

export interface ProfileFormData {
  full_name: string;
  phone?: string | undefined;
}

export function ProfileForm({ initialData }: { initialData: { full_name: string | null; phone: string | null } }) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: initialData.full_name || '',
      phone: initialData.phone || '',
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    setIsSaving(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData.session) {
        setMessage({ type: 'error', text: 'Sua sessão expirou. Entre novamente para atualizar o perfil.' });
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: data.full_name,
          phone: data.phone || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionData.session.user.id);

      if (error) throw error;
      
      setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
      router.refresh();
    } catch {
      setMessage({ type: 'error', text: 'Erro ao atualizar o perfil. Tente novamente.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-lg">
      <div>
        <label htmlFor="full_name" className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">
          Nome Completo *
        </label>
        <input
          {...register('full_name')}
          type="text"
          id="full_name"
          placeholder="Seu nome completo"
          className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium text-sm shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
        />
        {errors.full_name && <span className="text-xs font-medium text-red-600 mt-1 block">{errors.full_name.message}</span>}
      </div>

      <div>
        <label htmlFor="phone" className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">
          Telefone / WhatsApp
        </label>
        <input
          {...register('phone')}
          type="tel"
          id="phone"
          placeholder="(11) 99999-9999"
          className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium text-sm shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
        />
        {errors.phone && <span className="text-xs font-medium text-red-600 mt-1 block">{errors.phone.message}</span>}
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-sm font-semibold border ${
          message.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <button
        type="submit"
        disabled={isSaving}
        className="w-full inline-flex items-center justify-center gap-2 bg-[#0F2040] hover:bg-[#CC1A1A] text-white px-6 py-3 rounded-xl font-bold text-sm shadow-md transition disabled:opacity-50"
      >
        {isSaving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Salvando...
          </>
        ) : (
          <>
            <Check className="w-4 h-4" /> Salvar Alterações
          </>
        )}
      </button>
    </form>
  );
}
