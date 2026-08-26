'use client';
/* eslint-disable @next/next/no-img-element */

import React, { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Loader2, Plus, Edit2, Trash2, Check, Printer, Settings, Image as ImageIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';
import { ImageUploader } from '@/components/admin/ImageUploader';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface Service {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  base_price: number;
  is_active: boolean;
  sort_order: number;
}

export default function ServicosPage() {
  const { data: rawServices, error: servError, isLoading: servLoading, mutate: mutateServices } = useSWR<Service[]>('/api/admin/servicos', fetcher);

  const servicos: Service[] = Array.isArray(rawServices) ? rawServices : [];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    id?: string;
    name: string;
    slug: string;
    description: string;
    image_url: string | null;
    base_price: number;
    is_active: boolean;
    sort_order: number;
  }>({
    name: '',
    slug: '',
    description: '',
    image_url: null,
    base_price: 0,
    is_active: true,
    sort_order: 0,
  });
  const [isSaving, setIsSaving] = useState(false);

  const startNew = () => {
    setEditingId('new');
    setFormData({
      name: '',
      slug: '',
      description: '',
      image_url: null,
      base_price: 0.50,
      is_active: true,
      sort_order: servicos.length + 1,
    });
  };

  const startEdit = (serv: Service) => {
    setEditingId(serv.id);
    setFormData({
      id: serv.id,
      name: serv.name || '',
      slug: serv.slug || '',
      description: serv.description || '',
      image_url: serv.image_url || null,
      base_price: serv.base_price || 0,
      is_active: serv.is_active ?? true,
      sort_order: serv.sort_order ?? 0,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.slug.trim()) {
      alert('Por favor informe o Nome e o Slug do serviço.');
      return;
    }

    setIsSaving(true);
    const method = editingId === 'new' ? 'POST' : 'PUT';
    try {
      const res = await fetch('/api/admin/servicos', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const resData = (await res.json()) as { error?: string };
      if (!res.ok || resData.error) throw new Error(resData.error || 'Erro ao salvar');

      await mutateServices();
      cancelEdit();
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : 'Falha de rede';
      alert(`Erro ao salvar serviço: ${errorMsg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente EXCLUIR este serviço gráfico?')) return;
    try {
      const res = await fetch(`/api/admin/servicos?id=${id}`, { method: 'DELETE' });
      const resData = (await res.json()) as { error?: string };
      if (!res.ok || resData.error) throw new Error(resData.error || 'Erro ao excluir');
      await mutateServices();
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : 'Falha';
      alert(`Erro ao excluir: ${errorMsg}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-serif">Serviços Gráficos</h1>
          <p className="text-sm font-medium text-slate-600">Cadastre serviços de impressão e configure campos dinâmicos de personalização.</p>
        </div>
        <button 
          onClick={startNew}
          disabled={editingId !== null}
          className="inline-flex items-center gap-2 bg-[#0F2040] hover:bg-[#CC1A1A] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Novo Serviço
        </button>
      </div>

      {/* Editor Box */}
      {editingId && (
        <div className="bg-white rounded-3xl border-2 border-blue-500 shadow-xl p-6 sm:p-8 space-y-6 animate-in fade-in duration-200">
          <div className="flex justify-between items-center border-b border-slate-200 pb-4">
            <h2 className="text-lg font-bold text-slate-900 font-serif">
              {editingId === 'new' ? 'Cadastrar Novo Serviço Gráfico' : 'Editar Serviço'}
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={cancelEdit}
                disabled={isSaving}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-sm transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-6 py-2 bg-[#0F2040] hover:bg-[#CC1A1A] text-white font-bold rounded-xl text-sm shadow-md transition"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Salvar Serviço
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left: Image Uploader */}
            <div className="md:col-span-4">
              <ImageUploader
                imageUrl={formData.image_url}
                onImageUploaded={(url) => setFormData({ ...formData, image_url: url })}
                label="Banner / Foto do Serviço"
                folder="services"
                aspectRatio="square"
              />
            </div>

            {/* Right: Inputs */}
            <div className="md:col-span-8 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">
                    Nome do Serviço *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Impressão Preto e Branco A4, Apostilas"
                    value={formData.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      const slug = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '-');
                      setFormData({
                        ...formData,
                        name,
                        slug: editingId === 'new' ? slug : formData.slug,
                      });
                    }}
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">
                    Slug (URL amigável) *
                  </label>
                  <input
                    type="text"
                    placeholder="impressao-pb-a4"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono font-medium shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">
                    Preço Base Inicial (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.50"
                    value={formData.base_price || ''}
                    onChange={(e) => setFormData({ ...formData, base_price: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">
                  Descrição Completa
                </label>
                <textarea
                  rows={2}
                  placeholder="Informações técnicas de impressão, papéis suportados e especificações..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition"
                />
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-600/20"
                  />
                  <span className="text-sm font-semibold text-slate-800">Serviço Ativo no Catálogo</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {servLoading ? (
          <div className="p-16 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : servError ? (
          <div className="p-16 text-center text-red-600 font-bold">Erro ao carregar serviços.</div>
        ) : servicos.length === 0 ? (
          <div className="p-16 text-center text-slate-600">
            <Printer className="w-12 h-12 mx-auto mb-3 text-slate-400" />
            <p className="font-bold text-slate-800">Nenhum serviço gráfico cadastrado.</p>
            <p className="text-xs text-slate-500 mt-1">Clique em &ldquo;Novo Serviço&rdquo; para criar o primeiro.</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-800 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 w-20">Foto</th>
                <th className="px-6 py-4">Nome & Slug</th>
                <th className="px-6 py-4">Preço Base</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {servicos.map((serv) => (
                <tr key={serv.id} className={`hover:bg-slate-50 transition ${!serv.is_active ? 'opacity-60 bg-slate-50/50' : ''}`}>
                  <td className="px-6 py-4">
                    {serv.image_url ? (
                      <img src={serv.image_url} alt={serv.name} className="w-11 h-11 object-cover rounded-xl border border-slate-200" />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-extrabold text-slate-900">{serv.name}</p>
                    <p className="text-xs text-slate-600 font-mono font-medium">{serv.slug}</p>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-900">
                    A partir de {formatCurrency(serv.base_price)}
                  </td>
                  <td className="px-6 py-4">
                    {serv.is_active ? (
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-extrabold rounded-full uppercase">Ativo</span>
                    ) : (
                      <span className="px-2.5 py-1 bg-slate-200 text-slate-800 text-xs font-extrabold rounded-full uppercase">Inativo</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right space-x-1">
                    <Link
                      href={`/admin/servicos/${serv.id}`}
                      className="inline-flex items-center gap-1 p-2 text-blue-700 hover:bg-blue-50 rounded-xl text-xs font-bold transition"
                      title="Configurar campos dinâmicos e opções"
                    >
                      <Settings className="w-4 h-4" /> Personalização
                    </Link>
                    <button 
                      onClick={() => startEdit(serv)}
                      disabled={editingId !== null}
                      className="p-2 text-slate-700 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition disabled:opacity-50"
                      title="Editar serviço"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(serv.id)}
                      disabled={editingId !== null}
                      className="p-2 text-slate-700 hover:text-red-600 hover:bg-red-50 rounded-xl transition disabled:opacity-50"
                      title="Excluir serviço"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
