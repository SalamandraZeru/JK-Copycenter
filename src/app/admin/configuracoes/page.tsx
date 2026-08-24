'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Loader2, Save, Store, Truck, Bell } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface StoreConfig {
  store_name?: string;
  whatsapp_number?: string;
  store_address?: string;
  delivery_city?: string;
  delivery_state?: string;
  delivery_fee_cents?: number;
  delivery_enabled?: boolean;
  pickup_enabled?: boolean;
  home_banner_text?: string;
  [key: string]: string | number | boolean | undefined;
}

export default function ConfiguracoesPage() {
  const { data: config, error, isLoading, mutate } = useSWR<StoreConfig>('/api/admin/config', fetcher);
  
  const [formData, setFormData] = useState<StoreConfig>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setFormData(config);
    }
  }, [config]);

  const handleChange = (key: string, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (!res.ok) throw new Error('Erro ao salvar');
      await mutate();
      alert('Configurações salvas com sucesso!');
    } catch {
      alert('Erro ao salvar configurações.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading && !config) return <div className="p-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" /></div>;
  if (error) return <div className="p-20 text-center text-red-600 font-bold">Erro ao carregar configurações.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-serif">Configurações do Sistema</h1>
          <p className="text-sm font-medium text-slate-600">Configure dados da loja, taxas e termos.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 bg-[#0F2040] hover:bg-[#CC1A1A] text-white px-6 py-2.5 rounded-xl font-bold transition disabled:opacity-50 shadow-md text-sm"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Configurações
        </button>
      </div>

      <div className="space-y-6">
        {/* Informações da Loja */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
            <Store className="w-5 h-5 text-blue-600" />
            <h2 className="font-extrabold text-slate-900">Informações da Loja</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">
                Nome da Loja
              </label>
              <input 
                type="text" 
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition" 
                value={formData.store_name || ''} 
                onChange={e => handleChange('store_name', e.target.value)} 
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">
                Telefone (WhatsApp)
              </label>
              <input 
                type="text" 
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition" 
                value={formData.whatsapp_number || ''} 
                onChange={e => handleChange('whatsapp_number', e.target.value.replace(/\D/g, ''))} 
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">
                Endereço Físico (Retirada)
              </label>
              <input 
                type="text" 
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition" 
                value={formData.store_address || ''} 
                onChange={e => handleChange('store_address', e.target.value)} 
              />
            </div>
          </div>
        </div>

        {/* Frete e Entregas */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-600" />
            <h2 className="font-extrabold text-slate-900">Taxas e Entregas</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">
                Taxa Base Motoboy (R$)
              </label>
              <input 
                type="number" 
                step="0.5" 
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition" 
                value={(formData.delivery_fee_cents ?? 0) / 100} 
                onChange={e => handleChange('delivery_fee_cents', Math.round(Number(e.target.value) * 100))} 
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">
                Cidade atendida
              </label>
              <input 
                type="text" 
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition" 
                value={formData.delivery_city ?? ''} 
                onChange={e => handleChange('delivery_city', e.target.value)} 
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">
                UF atendida
              </label>
              <input
                type="text"
                maxLength={2}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition uppercase"
                value={formData.delivery_state ?? ''}
                onChange={e => handleChange('delivery_state', e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2))}
              />
            </div>
            <div className="md:col-span-2 flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <input 
                type="checkbox" 
                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-600/20" 
                id="enable_delivery" 
                checked={formData.delivery_enabled === true} 
                onChange={e => handleChange('delivery_enabled', e.target.checked)} 
              />
              <label htmlFor="enable_delivery" className="font-bold text-slate-800 cursor-pointer text-sm">
                Ativar módulo de entregas (Motoboy / Correios)
              </label>
            </div>
            <div className="md:col-span-2 flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <input
                type="checkbox"
                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-600/20"
                id="pickup_enabled"
                checked={formData.pickup_enabled === true}
                onChange={e => handleChange('pickup_enabled', e.target.checked)}
              />
              <label htmlFor="pickup_enabled" className="font-bold text-slate-800 cursor-pointer text-sm">
                Permitir retirada na loja
              </label>
            </div>
          </div>
        </div>

        {/* Avisos */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-600" />
            <h2 className="font-extrabold text-slate-900">Aviso da Home Page</h2>
          </div>
          <div className="p-6">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">
              Texto do Banner Superior (Opcional)
            </label>
            <input 
              type="text" 
              className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition" 
              placeholder="Ex: Estamos em recesso até o dia 10."
              value={formData.home_banner_text || ''} 
              onChange={e => handleChange('home_banner_text', e.target.value)} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}
