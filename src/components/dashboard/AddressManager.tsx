'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { MapPin, Check, Trash2, Edit2, Plus, Loader2 } from 'lucide-react';

const addressSchema = z.object({
  label: z.string().min(2, 'Identificação é obrigatória (Ex: Casa, Trabalho)'),
  zip_code: z.string().min(8, 'CEP inválido'),
  street: z.string().min(3, 'Logradouro é obrigatório'),
  number: z.string().min(1, 'Número é obrigatório'),
  complement: z.string().optional(),
  neighborhood: z.string().min(2, 'Bairro é obrigatório'),
  city: z.string().min(2, 'Cidade é obrigatória'),
  state: z.string().length(2, 'UF inválida (ex: SP)'),
  is_default: z.boolean(),
});

export interface AddressFormData {
  label: string;
  zip_code: string;
  street: string;
  number: string;
  complement?: string | undefined;
  neighborhood: string;
  city: string;
  state: string;
  is_default: boolean;
}

export interface Address {
  id: string;
  user_id: string;
  label: string;
  zip_code: string;
  street: string;
  number: string;
  complement?: string | null;
  neighborhood: string;
  city: string;
  state: string;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
}

export function AddressManager({ addresses }: { addresses: Address[] }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState<string | null>(null); // 'new' or address id
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors }, setValue } = useForm<AddressFormData>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      label: '',
      zip_code: '',
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      is_default: false,
    },
  });

  const openNewForm = () => {
    reset({
      label: '', 
      zip_code: '', 
      street: '', 
      number: '', 
      complement: '',
      neighborhood: '', 
      city: '', 
      state: '', 
      is_default: addresses.length === 0
    });
    setIsEditing('new');
    setErrorMsg(null);
  };

  const openEditForm = (addr: Address) => {
    reset({
      label: addr.label, 
      zip_code: addr.zip_code, 
      street: addr.street, 
      number: addr.number,
      complement: addr.complement || '', 
      neighborhood: addr.neighborhood, 
      city: addr.city,
      state: addr.state, 
      is_default: addr.is_default
    });
    setIsEditing(addr.id);
    setErrorMsg(null);
  };

  const onSubmit = async (data: AddressFormData) => {
    setIsSaving(true);
    setErrorMsg(null);
    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData.session) {
        // Fallback for preview mode
        setIsEditing(null);
        router.refresh();
        return;
      }

      if (data.is_default) {
        await supabase
          .from('addresses')
          .update({ is_default: false })
          .eq('user_id', sessionData.session.user.id)
          .eq('is_default', true);
      }

      if (isEditing === 'new') {
        const { error } = await supabase.from('addresses').insert({
          user_id: sessionData.session.user.id,
          ...data,
          complement: data.complement || null
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('addresses').update({
          ...data,
          complement: data.complement || null,
          updated_at: new Date().toISOString()
        }).eq('id', isEditing as string);
        if (error) throw error;
      }

      setIsEditing(null);
      router.refresh();
    } catch {
      setErrorMsg('Erro ao salvar endereço.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteAddress = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este endereço?')) return;
    try {
      const supabase = createClient();
      await supabase.from('addresses').delete().eq('id', id);
      router.refresh();
    } catch {
      alert('Erro ao excluir endereço.');
    }
  };

  const setAsDefault = async (id: string) => {
    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;
      
      // Unset all
      await supabase.from('addresses').update({ is_default: false }).eq('user_id', sessionData.session.user.id);
      // Set one
      await supabase.from('addresses').update({ is_default: true }).eq('id', id);
      
      router.refresh();
    } catch {
      alert('Erro ao definir endereço padrão.');
    }
  };

  // ViaCEP integration
  const handleZipCodeBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const cep = e.target.value.replace(/\D/g, '');
    if (cep.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = (await res.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
        if (!data.erro) {
          if (data.logradouro) setValue('street', data.logradouro);
          if (data.bairro) setValue('neighborhood', data.bairro);
          if (data.localidade) setValue('city', data.localidade);
          if (data.uf) setValue('state', data.uf);
        }
      } catch {
        // ignore
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* List */}
      {!isEditing && (
        <>
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-900 font-serif">Endereços Cadastrados</h3>
            <button
              onClick={openNewForm}
              className="inline-flex items-center gap-2 bg-[#0F2040] hover:bg-[#CC1A1A] text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md transition"
            >
              <Plus className="w-4 h-4" /> Adicionar Endereço
            </button>
          </div>

          {addresses.length === 0 ? (
            <div className="text-center p-12 bg-white border border-slate-200 rounded-3xl text-slate-600 shadow-sm">
              <MapPin className="w-12 h-12 mx-auto mb-3 text-slate-400" />
              <p className="font-bold text-slate-800">Você ainda não tem endereços cadastrados.</p>
              <p className="text-xs text-slate-500 mt-1">Cadastre um endereço para agilizar suas entregas.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {addresses.map(addr => (
                <div 
                  key={addr.id} 
                  className={`p-5 rounded-2xl border shadow-sm transition ${
                    addr.is_default 
                      ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500' 
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <MapPin className={`w-5 h-5 ${addr.is_default ? 'text-blue-600' : 'text-slate-500'}`} />
                      <h4 className="font-extrabold text-slate-900 text-base">{addr.label}</h4>
                      {addr.is_default && (
                        <span className="px-2.5 py-0.5 text-xs font-extrabold bg-blue-100 text-blue-800 rounded-full uppercase">
                          Padrão
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => openEditForm(addr)} 
                        className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition" 
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => deleteAddress(addr.id)} 
                        className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition" 
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="text-sm text-slate-700 font-medium ml-7 space-y-0.5">
                    <p>{addr.street}, {addr.number} {addr.complement ? `· ${addr.complement}` : ''}</p>
                    <p>{addr.neighborhood}</p>
                    <p>{addr.city} - {addr.state}, CEP {addr.zip_code}</p>
                  </div>
                  {!addr.is_default && (
                    <button 
                      onClick={() => setAsDefault(addr.id)}
                      className="mt-3 ml-7 text-xs font-bold text-blue-700 hover:text-blue-900 underline"
                    >
                      Definir como endereço padrão
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Form */}
      {isEditing && (
        <div className="bg-white border-2 border-blue-500 shadow-xl rounded-3xl p-6 sm:p-8 max-w-2xl animate-in fade-in duration-200">
          <div className="flex justify-between items-center border-b border-slate-200 pb-4 mb-6">
            <h3 className="text-lg font-bold text-slate-900 font-serif">
              {isEditing === 'new' ? 'Cadastrar Novo Endereço' : 'Editar Endereço'}
            </h3>
            <button
              onClick={() => setIsEditing(null)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-sm transition"
            >
              Cancelar
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">
                  Identificação * (Ex: Casa, Trabalho)
                </label>
                <input 
                  {...register('label')} 
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium text-sm shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition" 
                  placeholder="Casa, Escritório, etc."
                />
                {errors.label && <span className="text-xs font-medium text-red-600 mt-1 block">{errors.label.message}</span>}
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">
                  CEP *
                </label>
                <input 
                  {...register('zip_code')} 
                  onBlur={handleZipCodeBlur} 
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium text-sm shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition" 
                  placeholder="00000-000"
                />
                {errors.zip_code && <span className="text-xs font-medium text-red-600 mt-1 block">{errors.zip_code.message}</span>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">
                  Logradouro *
                </label>
                <input 
                  {...register('street')} 
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium text-sm shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition" 
                  placeholder="Rua, Avenida, etc."
                />
                {errors.street && <span className="text-xs font-medium text-red-600 mt-1 block">{errors.street.message}</span>}
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">
                  Número *
                </label>
                <input 
                  {...register('number')} 
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium text-sm shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition" 
                  placeholder="123"
                />
                {errors.number && <span className="text-xs font-medium text-red-600 mt-1 block">{errors.number.message}</span>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">
                  Complemento (Opcional)
                </label>
                <input 
                  {...register('complement')} 
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium text-sm shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition" 
                  placeholder="Apto 42, Bloco B"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">
                  Bairro *
                </label>
                <input 
                  {...register('neighborhood')} 
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium text-sm shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition" 
                  placeholder="Centro"
                />
                {errors.neighborhood && <span className="text-xs font-medium text-red-600 mt-1 block">{errors.neighborhood.message}</span>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">
                  Cidade *
                </label>
                <input 
                  {...register('city')} 
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium text-sm shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition" 
                  placeholder="São Paulo"
                />
                {errors.city && <span className="text-xs font-medium text-red-600 mt-1 block">{errors.city.message}</span>}
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">
                  Estado (UF) *
                </label>
                <input 
                  {...register('state')} 
                  maxLength={2} 
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium text-sm uppercase shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition" 
                  placeholder="SP"
                />
                {errors.state && <span className="text-xs font-medium text-red-600 mt-1 block">{errors.state.message}</span>}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input 
                type="checkbox" 
                id="is_default" 
                {...register('is_default')} 
                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-600/20" 
              />
              <label htmlFor="is_default" className="text-sm font-semibold text-slate-800 cursor-pointer">
                Tornar este meu endereço padrão de entrega
              </label>
            </div>

            {errorMsg && <p className="text-sm font-medium text-red-600">{errorMsg}</p>}

            <div className="pt-4 flex justify-end gap-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsEditing(null)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-sm transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#0F2040] hover:bg-[#CC1A1A] text-white rounded-xl font-bold text-sm shadow-md transition disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Salvar Endereço
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
