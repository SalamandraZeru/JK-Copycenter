'use client';
/* eslint-disable @next/next/no-img-element */

import React, { useState } from 'react';
import useSWR from 'swr';
import { Loader2, Plus, Edit2, Trash2, Check, Images, Image as ImageIcon } from 'lucide-react';
import { ImageUploader } from '@/components/admin/ImageUploader';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface GalleryItem {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  service_id: string | null;
  is_active: boolean;
  sort_order: number;
  service?: { name: string } | { name: string }[] | null;
}

interface ServiceOption {
  id: string;
  name: string;
}

function serviceName(item: GalleryItem): string | null {
  const s = Array.isArray(item.service) ? item.service[0] : item.service;
  return s?.name ?? null;
}

export default function GaleriaAdminPage() {
  const { data: rawData, error, isLoading, mutate } = useSWR<GalleryItem[]>('/api/admin/galeria', fetcher);
  const items: GalleryItem[] = Array.isArray(rawData) ? rawData : [];
  const { data: rawServices } = useSWR<ServiceOption[]>('/api/admin/servicos', fetcher);
  const services: ServiceOption[] = Array.isArray(rawServices) ? rawServices : [];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    id?: string;
    title: string;
    description: string;
    image_url: string | null;
    service_id: string;
    is_active: boolean;
    sort_order: number;
  }>({
    title: '',
    description: '',
    image_url: null,
    service_id: '',
    is_active: true,
    sort_order: 0,
  });
  const [isSaving, setIsSaving] = useState(false);

  const startNew = () => {
    setEditingId('new');
    setFormData({ title: '', description: '', image_url: null, service_id: '', is_active: true, sort_order: items.length + 1 });
  };

  const startEdit = (item: GalleryItem) => {
    setEditingId(item.id);
    setFormData({
      id: item.id,
      title: item.title || '',
      description: item.description || '',
      image_url: item.image_url || null,
      service_id: item.service_id || '',
      is_active: item.is_active ?? true,
      sort_order: item.sort_order ?? 0,
    });
  };

  const cancelEdit = () => setEditingId(null);

  const handleSave = async () => {
    if (!formData.title.trim()) {
      alert('Informe o título do trabalho.');
      return;
    }
    if (!formData.image_url) {
      alert('Envie uma imagem do trabalho.');
      return;
    }

    setIsSaving(true);
    const method = editingId === 'new' ? 'POST' : 'PUT';
    const payload = {
      ...(formData.id ? { id: formData.id } : {}),
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      image_url: formData.image_url,
      service_id: formData.service_id || null,
      is_active: formData.is_active,
      sort_order: formData.sort_order,
    };
    try {
      const res = await fetch('/api/admin/galeria', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const resData = (await res.json()) as { error?: string };
      if (!res.ok || resData.error) throw new Error(resData.error || 'Erro ao salvar');
      await mutate();
      cancelEdit();
    } catch (e: unknown) {
      alert(`Erro ao salvar: ${e instanceof Error ? e.message : 'Falha de rede'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente EXCLUIR este trabalho da galeria?')) return;
    try {
      const res = await fetch(`/api/admin/galeria?id=${id}`, { method: 'DELETE' });
      const resData = (await res.json()) as { error?: string };
      if (!res.ok || resData.error) throw new Error(resData.error || 'Erro ao excluir');
      await mutate();
    } catch (e: unknown) {
      alert(`Erro ao excluir: ${e instanceof Error ? e.message : 'Falha'}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-serif">Galeria de Trabalhos</h1>
          <p className="text-sm font-medium text-slate-600">Exemplos exibidos na página pública. Ao clicar, o cliente pede um orçamento pelo WhatsApp.</p>
        </div>
        <button
          onClick={startNew}
          disabled={editingId !== null}
          className="inline-flex items-center gap-2 bg-[#092653] hover:bg-[#b4232d] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Novo Trabalho
        </button>
      </div>

      {editingId && (
        <div className="bg-white rounded-3xl border-2 border-[#092653] shadow-xl p-6 sm:p-8 space-y-6">
          <div className="flex justify-between items-center border-b border-slate-200 pb-4">
            <h2 className="text-lg font-bold text-slate-900 font-serif">
              {editingId === 'new' ? 'Adicionar Trabalho' : 'Editar Trabalho'}
            </h2>
            <div className="flex gap-2">
              <button type="button" onClick={cancelEdit} disabled={isSaving} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-sm transition">Cancelar</button>
              <button type="button" onClick={handleSave} disabled={isSaving} className="inline-flex items-center gap-2 px-6 py-2 bg-[#092653] hover:bg-[#b4232d] text-white font-bold rounded-xl text-sm shadow-md transition">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Salvar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-4">
              <ImageUploader
                imageUrl={formData.image_url}
                onImageUploaded={(url) => setFormData({ ...formData, image_url: url })}
                label="Foto do trabalho *"
                folder="gallery"
                aspectRatio="wide"
              />
            </div>

            <div className="md:col-span-8 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">Título *</label>
                <input
                  type="text"
                  placeholder="Ex: Folder institucional 3 dobras"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm placeholder:text-slate-400 focus:border-[#092653] focus:ring-2 focus:ring-[#092653]/20 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">Descrição curta</label>
                <input
                  type="text"
                  placeholder="Papel, acabamento ou detalhe que ajude o cliente a reconhecer o trabalho"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm placeholder:text-slate-400 focus:border-[#092653] focus:ring-2 focus:ring-[#092653]/20 outline-none transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">Serviço vinculado</label>
                  <select
                    value={formData.service_id}
                    onChange={(e) => setFormData({ ...formData, service_id: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm focus:border-[#092653] focus:ring-2 focus:ring-[#092653]/20 outline-none transition"
                  >
                    <option value="">Sem vínculo</option>
                    {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">Ordem de exibição</label>
                  <input
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm focus:border-[#092653] focus:ring-2 focus:ring-[#092653]/20 outline-none transition"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-300 text-[#092653] focus:ring-2 focus:ring-[#092653]/20"
                />
                <span className="text-sm font-semibold text-slate-800">Visível na galeria pública</span>
              </label>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-16 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#092653]" /></div>
        ) : error ? (
          <div className="p-16 text-center text-red-600 font-bold">Erro ao carregar a galeria.</div>
        ) : items.length === 0 ? (
          <div className="p-16 text-center text-slate-600">
            <Images className="w-12 h-12 mx-auto mb-3 text-slate-400" />
            <p className="font-bold text-slate-800">Nenhum trabalho cadastrado.</p>
            <p className="text-xs text-slate-500 mt-1">Clique em &ldquo;Novo Trabalho&rdquo; para adicionar o primeiro.</p>
          </div>
        ) : (
          <>
          <ul className="divide-y divide-slate-100 md:hidden">
            {items.map((item) => (
              <li key={item.id} className={`flex gap-3 p-4 ${!item.is_active ? 'opacity-60' : ''}`}>
                {item.image_url ? <img src={item.image_url} alt={item.title} className="h-16 w-20 shrink-0 rounded-lg border border-slate-200 object-cover" /> : <div className="flex h-16 w-20 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-500"><ImageIcon className="h-5 w-5" /></div>}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-extrabold text-slate-900">{item.title}</p>
                  <p className="truncate text-xs text-slate-500">#{item.sort_order} · {serviceName(item) || 'Sem vínculo'}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    {item.is_active ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-emerald-800">Visível</span> : <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-extrabold uppercase text-slate-800">Oculto</span>}
                    <button onClick={() => startEdit(item)} disabled={editingId !== null} className="ml-auto inline-flex min-h-9 items-center gap-1 rounded-lg bg-blue-50 px-3 text-xs font-bold text-[#061a3b] disabled:opacity-50"><Edit2 className="h-3.5 w-3.5" /> Editar</button>
                    <button onClick={() => handleDelete(item.id)} disabled={editingId !== null} className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-red-50 px-3 text-xs font-bold text-red-700 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <table className="hidden w-full text-left md:table">
            <thead className="bg-slate-50 text-slate-800 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 w-16">Ordem</th>
                <th className="px-6 py-4 w-24">Foto</th>
                <th className="px-6 py-4">Título & Serviço</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id} className={`hover:bg-slate-50 transition ${!item.is_active ? 'opacity-60 bg-slate-50/50' : ''}`}>
                  <td className="px-6 py-4 text-slate-800 font-bold font-mono text-sm">{item.sort_order}</td>
                  <td className="px-6 py-4">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.title} className="w-16 h-12 object-cover rounded-lg border border-slate-200" />
                    ) : (
                      <div className="w-16 h-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500"><ImageIcon className="w-5 h-5" /></div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-extrabold text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-600 font-medium">{serviceName(item) || 'Sem vínculo'}</p>
                  </td>
                  <td className="px-6 py-4">
                    {item.is_active ? (
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-extrabold rounded-full uppercase">Visível</span>
                    ) : (
                      <span className="px-2.5 py-1 bg-slate-200 text-slate-800 text-xs font-extrabold rounded-full uppercase">Oculto</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right space-x-1">
                    <button onClick={() => startEdit(item)} disabled={editingId !== null} className="p-2 text-slate-700 hover:text-[#092653] hover:bg-blue-50 rounded-xl transition disabled:opacity-50" title="Editar"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(item.id)} disabled={editingId !== null} className="p-2 text-slate-700 hover:text-red-600 hover:bg-red-50 rounded-xl transition disabled:opacity-50" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </>
        )}
      </div>
    </div>
  );
}
