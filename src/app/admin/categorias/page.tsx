'use client';
/* eslint-disable @next/next/no-img-element */

import React, { useState } from 'react';
import useSWR from 'swr';
import { Loader2, Plus, Edit2, Trash2, Check, Tag, Image as ImageIcon } from 'lucide-react';
import { ImageUploader } from '@/components/admin/ImageUploader';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
}

export default function CategoriasPage() {
  const { data: rawData, error, isLoading, mutate } = useSWR<Category[]>('/api/admin/categorias', fetcher);
  const categorias: Category[] = Array.isArray(rawData) ? rawData : [];
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    id?: string;
    name: string;
    slug: string;
    description: string;
    image_url: string | null;
    is_active: boolean;
    sort_order: number;
  }>({
    name: '',
    slug: '',
    description: '',
    image_url: null,
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
      is_active: true,
      sort_order: categorias.length + 1,
    });
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setFormData({
      id: cat.id,
      name: cat.name || '',
      slug: cat.slug || '',
      description: cat.description || '',
      image_url: cat.image_url || null,
      is_active: cat.is_active ?? true,
      sort_order: cat.sort_order ?? 0,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.slug.trim()) {
      alert('Por favor preencha o Nome e o Slug da categoria.');
      return;
    }

    setIsSaving(true);
    const method = editingId === 'new' ? 'POST' : 'PUT';
    try {
      const res = await fetch('/api/admin/categorias', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const resData = (await res.json()) as { error?: string };
      if (!res.ok || resData.error) throw new Error(resData.error || 'Erro ao salvar');

      await mutate();
      cancelEdit();
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : 'Falha de rede';
      alert(`Erro ao salvar categoria: ${errorMsg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente EXCLUIR esta categoria?')) return;
    try {
      const res = await fetch(`/api/admin/categorias?id=${id}`, { method: 'DELETE' });
      const resData = (await res.json()) as { error?: string };
      if (!res.ok || resData.error) throw new Error(resData.error || 'Erro ao excluir');
      await mutate();
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : 'Falha';
      alert(`Erro ao excluir: ${errorMsg}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-serif">Categorias do Catálogo</h1>
          <p className="text-sm font-medium text-slate-600">Organize os serviços e produtos de papelaria por grupos.</p>
        </div>
        <button 
          onClick={startNew}
          disabled={editingId !== null}
          className="inline-flex items-center gap-2 bg-[#0F2040] hover:bg-[#CC1A1A] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Nova Categoria
        </button>
      </div>

      {/* Editor Card */}
      {editingId && (
        <div className="bg-white rounded-3xl border-2 border-blue-500 shadow-xl p-6 sm:p-8 space-y-6 animate-in fade-in duration-200">
          <div className="flex justify-between items-center border-b border-slate-200 pb-4">
            <h2 className="text-lg font-bold text-slate-900 font-serif">
              {editingId === 'new' ? 'Cadastrar Nova Categoria' : 'Editar Categoria'}
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
                Salvar Categoria
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left: Image Uploader */}
            <div className="md:col-span-4">
              <ImageUploader
                imageUrl={formData.image_url}
                onImageUploaded={(url) => setFormData({ ...formData, image_url: url })}
                label="Foto / Ícone da Categoria"
                folder="categories"
                aspectRatio="square"
              />
            </div>

            {/* Right: Form inputs */}
            <div className="md:col-span-8 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">
                    Nome da Categoria *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Papéis Especiais, Impressão Digital"
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
                    placeholder="papeis-especiais"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono font-medium shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">
                  Descrição Curta
                </label>
                <input
                  type="text"
                  placeholder="Breve descrição dos itens agrupados nesta categoria..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">
                    Ordem de Exibição
                  </label>
                  <input
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition"
                  />
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-600/20"
                    />
                    <span className="text-sm font-semibold text-slate-800">Categoria Ativa na Loja</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-16 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : error ? (
          <div className="p-16 text-center text-red-600 font-bold">Erro ao carregar categorias.</div>
        ) : categorias.length === 0 ? (
          <div className="p-16 text-center text-slate-600">
            <Tag className="w-12 h-12 mx-auto mb-3 text-slate-400" />
            <p className="font-bold text-slate-800">Nenhuma categoria cadastrada.</p>
            <p className="text-xs text-slate-500 mt-1">Clique em &ldquo;Nova Categoria&rdquo; para criar a primeira.</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-800 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 w-16">Ordem</th>
                <th className="px-6 py-4 w-20">Foto</th>
                <th className="px-6 py-4">Nome & Slug</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categorias.map((cat) => (
                <tr key={cat.id} className={`hover:bg-slate-50 transition ${!cat.is_active ? 'opacity-60 bg-slate-50/50' : ''}`}>
                  <td className="px-6 py-4 text-slate-800 font-bold font-mono text-sm">{cat.sort_order}</td>
                  <td className="px-6 py-4">
                    {cat.image_url ? (
                      <img src={cat.image_url} alt={cat.name} className="w-10 h-10 object-cover rounded-xl border border-slate-200" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-extrabold text-slate-900">{cat.name}</p>
                    <p className="text-xs text-slate-600 font-mono font-medium">{cat.slug}</p>
                  </td>
                  <td className="px-6 py-4">
                    {cat.is_active ? (
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-extrabold rounded-full uppercase">Ativo</span>
                    ) : (
                      <span className="px-2.5 py-1 bg-slate-200 text-slate-800 text-xs font-extrabold rounded-full uppercase">Inativo</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right space-x-1">
                    <button 
                      onClick={() => startEdit(cat)}
                      disabled={editingId !== null}
                      className="p-2 text-slate-700 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition disabled:opacity-50"
                      title="Editar categoria"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(cat.id)}
                      disabled={editingId !== null}
                      className="p-2 text-slate-700 hover:text-red-600 hover:bg-red-50 rounded-xl transition disabled:opacity-50"
                      title="Excluir categoria"
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
