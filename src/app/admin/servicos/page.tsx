'use client';
/* eslint-disable @next/next/no-img-element */

import React, { useRef, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Loader2, Plus, Edit2, Trash2, Check, Printer, Settings, Image as ImageIcon, Copy, Download, Upload } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';
import { ImageUploader } from '@/components/admin/ImageUploader';
import { pricingProfileTemplates } from '@/lib/pricing/profiles';
import type { PricingProfile } from '@/types/pricing';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface Service {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  base_price: number;
  catalog_state: 'draft' | 'review' | 'published' | 'inactive';
  catalog_version: number;
  pricing_fallback_behavior: 'use_base' | 'block';
  pricing_profile: PricingProfile;
  pricing_profile_config: Record<string, unknown>;
  sort_order: number;
}

export default function ServicosPage() {
  const { data: rawServices, error: servError, isLoading: servLoading, mutate: mutateServices } = useSWR<Service[]>('/api/admin/servicos', fetcher);

  const servicos: Service[] = Array.isArray(rawServices) ? rawServices : [];

  const [editingId, setEditingId] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<{
    id?: string;
    name: string;
    slug: string;
    description: string;
    image_url: string | null;
    base_price: number;
    catalog_state: Service['catalog_state'];
    pricing_fallback_behavior: Service['pricing_fallback_behavior'];
    pricing_profile: PricingProfile;
    pricing_profile_config: string;
    sort_order: number;
  }>({
    name: '',
    slug: '',
    description: '',
    image_url: null,
    base_price: 0,
    catalog_state: 'draft',
    pricing_fallback_behavior: 'block',
    pricing_profile: 'per_page',
    pricing_profile_config: '{}',
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
      catalog_state: 'draft',
      pricing_fallback_behavior: 'block',
      pricing_profile: 'per_page',
      pricing_profile_config: JSON.stringify(pricingProfileTemplates.per_page, null, 2),
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
      catalog_state: serv.catalog_state,
      pricing_fallback_behavior: serv.pricing_fallback_behavior,
      pricing_profile: serv.pricing_profile ?? 'per_page',
      pricing_profile_config: JSON.stringify(serv.pricing_profile_config ?? {}, null, 2),
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

    let pricingProfileConfig: Record<string, unknown>;
    try {
      const parsed = JSON.parse(formData.pricing_profile_config);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      pricingProfileConfig = parsed as Record<string, unknown>;
    } catch {
      alert('A configuração técnica precisa ser um objeto JSON válido.');
      return;
    }

    setIsSaving(true);
    const method = editingId === 'new' ? 'POST' : 'PUT';
    try {
      const res = await fetch('/api/admin/servicos', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, pricing_profile_config: pricingProfileConfig }),
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

  const handleDuplicate = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/servicos/${id}/duplicar`, { method: 'POST' });
      const data = await response.json() as { error?: string; id?: string };
      if (!response.ok || data.error) throw new Error(data.error || 'Erro ao duplicar serviço');
      await mutateServices();
      if (data.id) window.location.href = `/admin/servicos/${data.id}`;
    } catch (error) {
      alert(`Erro ao duplicar serviço: ${error instanceof Error ? error.message : 'Falha de rede'}`);
    }
  };

  const handleExport = async (id: string, slug: string) => {
    try {
      const response = await fetch(`/api/admin/servicos/${id}/exportar`);
      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error || 'Erro ao exportar configuração');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${slug}-config.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(`Erro ao exportar serviço: ${error instanceof Error ? error.message : 'Falha de rede'}`);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const raw = await file.text();
      const response = await fetch('/api/admin/servicos/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: raw,
      });
      const data = await response.json() as { error?: string; id?: string };
      if (!response.ok || data.error) throw new Error(data.error || 'Arquivo de configuração inválido');
      await mutateServices();
      if (data.id) window.location.href = `/admin/servicos/${data.id}`;
    } catch (error) {
      alert(`Erro ao importar serviço: ${error instanceof Error ? error.message : 'Arquivo inválido'}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-serif">Serviços Gráficos</h1>
          <p className="text-sm font-medium text-slate-600">Cadastre serviços de impressão e configure campos dinâmicos de personalização.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={importInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImport} />
          <button type="button" onClick={() => importInputRef.current?.click()} disabled={editingId !== null} className="inline-flex items-center gap-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 px-4 py-2.5 rounded-xl font-bold text-sm shadow-sm transition disabled:opacity-50">
            <Upload className="w-4 h-4" /> Importar
          </button>
          <button
            onClick={startNew}
            disabled={editingId !== null}
            className="inline-flex items-center gap-2 bg-[#0F2040] hover:bg-[#CC1A1A] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Novo Serviço
          </button>
        </div>
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
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">Ordem no Catálogo</label>
                  <input type="number" value={formData.sort_order} onChange={(e) => setFormData({ ...formData, sort_order: Number(e.target.value) })} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition" />
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
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">
                    Perfil de cobrança técnica
                  </label>
                  <select
                    value={formData.pricing_profile}
                    onChange={(event) => {
                      const pricingProfile = event.target.value as PricingProfile;
                      setFormData({
                        ...formData,
                        pricing_profile: pricingProfile,
                        pricing_profile_config: JSON.stringify(pricingProfileTemplates[pricingProfile], null, 2),
                      });
                    }}
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition"
                  >
                    <option value="per_page">Por página</option>
                    <option value="per_item">Por unidade</option>
                    <option value="per_sheet">Por folha física</option>
                    <option value="per_square_meter">Por metro quadrado</option>
                    <option value="per_linear_meter">Por metro linear</option>
                    <option value="binding_by_file_pages">Encadernação por páginas do arquivo</option>
                    <option value="booklet_imposition">Livreto por imposição</option>
                    <option value="manual_quote">Orçamento técnico manual</option>
                  </select>
                  <p className="mt-1 text-xs text-slate-500">O preço permanece no serviço e nas regras; este perfil define a unidade e os limites técnicos.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">
                  Configuração técnica (JSON)
                </label>
                <textarea
                  rows={5}
                  value={formData.pricing_profile_config}
                  onChange={(event) => setFormData({ ...formData, pricing_profile_config: event.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono text-xs shadow-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition"
                  aria-describedby="pricing-profile-help"
                />
                <p id="pricing-profile-help" className="mt-1 text-xs text-slate-500">Ex.: livreto usa <code>page_multiple</code>, <code>min_pages</code>, <code>allow_blank_page_padding</code> e <code>requires_customer_approval_for_padding</code>.</p>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">Estado editorial</label>
                  <select value={formData.catalog_state} onChange={(e) => setFormData({ ...formData, catalog_state: e.target.value as Service['catalog_state'] })} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition">
                    <option value="draft">Rascunho</option>
                    <option value="review">Em revisão</option>
                    <option value="published">Publicado</option>
                    <option value="inactive">Inativo</option>
                  </select>
                  <p className="mt-1 text-xs text-slate-500">Só serviços publicados aparecem ao cliente.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">Sem regra correspondente</label>
                  <select value={formData.pricing_fallback_behavior} onChange={(e) => setFormData({ ...formData, pricing_fallback_behavior: e.target.value as Service['pricing_fallback_behavior'] })} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition">
                    <option value="block">Bloquear cotação</option>
                    <option value="use_base">Usar preço-base</option>
                  </select>
                </div>
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
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {servicos.map((serv) => (
                <tr key={serv.id} className={`hover:bg-slate-50 transition ${serv.catalog_state !== 'published' ? 'bg-slate-50/50' : ''}`}>
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
                    <span className={`px-2.5 py-1 text-xs font-extrabold rounded-full uppercase ${serv.catalog_state === 'published' ? 'bg-emerald-100 text-emerald-800' : serv.catalog_state === 'review' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-800'}`}>{serv.catalog_state === 'draft' ? 'Rascunho' : serv.catalog_state === 'review' ? 'Em revisão' : serv.catalog_state === 'published' ? 'Publicado' : 'Inativo'}</span>
                    <p className="mt-1 text-[11px] text-slate-500">v{serv.catalog_version}</p>
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
                    <button onClick={() => handleDuplicate(serv.id)} disabled={editingId !== null} className="p-2 text-slate-700 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition disabled:opacity-50" title="Duplicar como rascunho">
                      <Copy className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleExport(serv.id, serv.slug)} disabled={editingId !== null} className="p-2 text-slate-700 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition disabled:opacity-50" title="Exportar configuração sem dados pessoais">
                      <Download className="w-4 h-4" />
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
