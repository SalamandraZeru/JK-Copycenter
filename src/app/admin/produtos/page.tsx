'use client';
/* eslint-disable @next/next/no-img-element */

import React, { useState } from 'react';
import useSWR from 'swr';
import { Loader2, Plus, Edit2, Trash2, Check, Package, Image as ImageIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';
import { ImageUploader } from '@/components/admin/ImageUploader';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface ProductCategory {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category_id: string | null;
  image_url: string | null;
  price: number;
  stock_quantity: number | null;
  is_active: boolean;
  sort_order: number;
  categories?: ProductCategory | null;
}

export default function ProdutosPage() {
  const { data: rawProducts, error: prodError, isLoading: prodLoading, mutate: mutateProducts } = useSWR<Product[]>('/api/admin/produtos', fetcher);
  const { data: rawCategories } = useSWR<ProductCategory[]>('/api/admin/categorias', fetcher);

  const produtos: Product[] = Array.isArray(rawProducts) ? rawProducts : [];
  const categorias: ProductCategory[] = Array.isArray(rawCategories) ? rawCategories : [];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    id?: string;
    name: string;
    slug: string;
    description: string;
    category_id: string;
    image_url: string | null;
    price: number;
    stock_quantity: number | '';
    is_active: boolean;
    sort_order: number;
  }>({
    name: '',
    slug: '',
    description: '',
    category_id: '',
    image_url: null,
    price: 0,
    stock_quantity: '',
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
      category_id: categorias[0]?.id || '',
      image_url: null,
      price: 0,
      stock_quantity: '',
      is_active: true,
      sort_order: produtos.length + 1,
    });
  };

  const startEdit = (prod: Product) => {
    setEditingId(prod.id);
    setFormData({
      id: prod.id,
      name: prod.name || '',
      slug: prod.slug || '',
      description: prod.description || '',
      category_id: prod.category_id || '',
      image_url: prod.image_url || null,
      price: prod.price || 0,
      stock_quantity: prod.stock_quantity !== null && prod.stock_quantity !== undefined ? prod.stock_quantity : '',
      is_active: prod.is_active ?? true,
      sort_order: prod.sort_order ?? 0,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.slug.trim()) {
      alert('Por favor informe o Nome e o Slug do produto.');
      return;
    }

    setIsSaving(true);
    const method = editingId === 'new' ? 'POST' : 'PUT';
    try {
      const res = await fetch('/api/admin/produtos', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const resData = (await res.json()) as { error?: string };
      if (!res.ok || resData.error) throw new Error(resData.error || 'Erro ao salvar');

      await mutateProducts();
      cancelEdit();
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : 'Falha de rede';
      alert(`Erro ao salvar produto: ${errorMsg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente EXCLUIR este produto de papelaria?')) return;
    try {
      const res = await fetch(`/api/admin/produtos?id=${id}`, { method: 'DELETE' });
      const resData = (await res.json()) as { error?: string };
      if (!res.ok || resData.error) throw new Error(resData.error || 'Erro ao excluir');
      await mutateProducts();
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : 'Falha';
      alert(`Erro ao excluir: ${errorMsg}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-serif">Produtos de Papelaria</h1>
          <p className="text-sm font-medium text-slate-600">Cadastre e gerencie itens físicos com preço fixo e controle de estoque.</p>
        </div>
        <button 
          onClick={startNew}
          disabled={editingId !== null}
          className="inline-flex items-center gap-2 bg-[#0F2040] hover:bg-[#CC1A1A] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Novo Produto
        </button>
      </div>

      {/* Editor Box */}
      {editingId && (
        <div className="bg-white rounded-3xl border-2 border-blue-500 shadow-xl p-6 sm:p-8 space-y-6 animate-in fade-in duration-200">
          <div className="flex justify-between items-center border-b border-slate-200 pb-4">
            <h2 className="text-lg font-bold text-slate-900 font-serif">
              {editingId === 'new' ? 'Cadastrar Novo Produto' : 'Editar Produto'}
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
                Salvar Produto
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left: Image Uploader */}
            <div className="md:col-span-4">
              <ImageUploader
                imageUrl={formData.image_url}
                onImageUploaded={(url) => setFormData({ ...formData, image_url: url })}
                label="Foto do Produto"
                folder="products"
                aspectRatio="square"
              />
            </div>

            {/* Right: Inputs */}
            <div className="md:col-span-8 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">
                    Nome do Produto *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Resma Sulfite A4 500fls, Caneta Ponta Fina"
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
                    placeholder="resma-sulfite-a4"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono font-medium shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">
                    Categoria
                  </label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none cursor-pointer transition"
                  >
                    <option value="">Sem categoria</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">
                    Preço de Venda (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.price || ''}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">
                    Estoque (opcional)
                  </label>
                  <input
                    type="number"
                    placeholder="Ilimitado"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value === '' ? '' : Number(e.target.value) })}
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
                  placeholder="Detalhes, especificações técnicas e marca..."
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
                  <span className="text-sm font-semibold text-slate-800">Produto Ativo na Loja</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {prodLoading ? (
          <div className="p-16 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : prodError ? (
          <div className="p-16 text-center text-red-600 font-bold">Erro ao carregar produtos.</div>
        ) : produtos.length === 0 ? (
          <div className="p-16 text-center text-slate-600">
            <Package className="w-12 h-12 mx-auto mb-3 text-slate-400" />
            <p className="font-bold text-slate-800">Nenhum produto cadastrado.</p>
            <p className="text-xs text-slate-500 mt-1">Clique em &ldquo;Novo Produto&rdquo; para adicionar materiais de papelaria.</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-800 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 w-20">Foto</th>
                <th className="px-6 py-4">Nome & Slug</th>
                <th className="px-6 py-4">Categoria</th>
                <th className="px-6 py-4">Preço</th>
                <th className="px-6 py-4">Estoque</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {produtos.map((prod) => (
                <tr key={prod.id} className={`hover:bg-slate-50 transition ${!prod.is_active ? 'opacity-60 bg-slate-50/50' : ''}`}>
                  <td className="px-6 py-4">
                    {prod.image_url ? (
                      <img src={prod.image_url} alt={prod.name} className="w-11 h-11 object-cover rounded-xl border border-slate-200" />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-extrabold text-slate-900">{prod.name}</p>
                    <p className="text-xs text-slate-600 font-mono font-medium">{prod.slug}</p>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-800">
                    {prod.categories?.name || 'Sem categoria'}
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-900">
                    {formatCurrency(prod.price)}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-800">
                    {prod.stock_quantity !== null ? prod.stock_quantity : '∞ Ilimitado'}
                  </td>
                  <td className="px-6 py-4">
                    {prod.is_active ? (
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-extrabold rounded-full uppercase">Ativo</span>
                    ) : (
                      <span className="px-2.5 py-1 bg-slate-200 text-slate-800 text-xs font-extrabold rounded-full uppercase">Inativo</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right space-x-1">
                    <button 
                      onClick={() => startEdit(prod)}
                      disabled={editingId !== null}
                      className="p-2 text-slate-700 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition disabled:opacity-50"
                      title="Editar produto"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(prod.id)}
                      disabled={editingId !== null}
                      className="p-2 text-slate-700 hover:text-red-600 hover:bg-red-50 rounded-xl transition disabled:opacity-50"
                      title="Excluir produto"
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
