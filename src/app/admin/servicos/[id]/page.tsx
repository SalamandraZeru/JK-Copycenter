'use client';

import React, { useState, use } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Loader2, ArrowLeft, Plus, Edit2, Trash2, Check, Settings2, HelpCircle, ShieldCheck, TriangleAlert } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface OptionItem {
  label: string;
  value: string;
  price_effect: {
    type: 'fixed' | 'multiply' | 'per_page' | 'none';
    value: number;
  } | null;
}

interface StoredOptionItem {
  label: string;
  value: string;
  is_active?: boolean;
  price_effect?: {
    type: 'fixed' | 'multiply' | 'per_page' | 'none';
    value?: number;
    value_cents?: number;
    multiplier_bps?: number;
  } | null;
}

interface ServiceField {
  id: string;
  service_id: string;
  key: string;
  label: string;
  field_type: string;
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
  options?: StoredOptionItem[] | null;
}

interface ServiceDetailResponse {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  base_price: number;
  fields?: ServiceField[];
  error?: string;
}

interface CatalogReadiness {
  ready: boolean;
  errors: string[];
  warnings: string[];
  coverage: {
    inspectedCombinations: number;
    uncoveredCombinations: number;
    ambiguousCombinations: number;
    limited: boolean;
  };
}

export default function ServicoCamposPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const { data, error, isLoading, mutate } = useSWR<ServiceDetailResponse>(`/api/admin/servicos/${params.id}/campos`, fetcher);
  const { data: readiness } = useSWR<CatalogReadiness>(`/api/admin/servicos/${params.id}/validacao`, fetcher);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    key: string;
    label: string;
    field_type: string;
    is_required: boolean;
    sort_order: number;
    is_active: boolean;
    options: OptionItem[];
  }>({
    key: '',
    label: '',
    field_type: 'select',
    is_required: true,
    sort_order: 0,
    is_active: true,
    options: [],
  });
  const [isSaving, setIsSaving] = useState(false);

  if (isLoading) return <div className="p-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" /></div>;
  if (error || !data || data.error) return <div className="p-20 text-center text-red-600 font-bold">Erro ao carregar campos do serviço.</div>;

  const { fields = [], ...service } = data;

  const startNew = () => {
    setEditingId('new');
    setFormData({
      key: '',
      label: '',
      field_type: 'select',
      is_required: true,
      sort_order: (fields.length || 0) + 1,
      is_active: true,
      options: [
        { label: 'Opção 1', value: 'opcao_1', price_effect: { type: 'none', value: 0 } },
        { label: 'Opção 2', value: 'opcao_2', price_effect: { type: 'none', value: 0 } },
      ],
    });
  };

  const startEdit = (field: ServiceField) => {
    setEditingId(field.id);
    const mappedOptions: OptionItem[] = (field.options || []).map((opt) => ({
      label: opt.label || '',
      value: opt.value || '',
      price_effect: {
        type: opt.price_effect?.type || 'none',
        value: opt.price_effect?.type === 'multiply'
          ? opt.price_effect.multiplier_bps !== undefined
            ? opt.price_effect.multiplier_bps / 10_000
            : opt.price_effect.value ?? 0
          : opt.price_effect?.value_cents !== undefined
            ? opt.price_effect.value_cents / 100
            : opt.price_effect?.value ?? 0,
      },
    }));
    setFormData({
      key: field.key,
      label: field.label,
      field_type: field.field_type,
      is_required: field.is_required,
      sort_order: field.sort_order,
      is_active: field.is_active,
      options: mappedOptions,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const addOption = () => {
    setFormData({
      ...formData,
      options: [
        ...formData.options,
        { label: '', value: '', price_effect: { type: 'none', value: 0 } },
      ],
    });
  };

  const removeOption = (index: number) => {
    const newOptions = [...formData.options];
    newOptions.splice(index, 1);
    setFormData({ ...formData, options: newOptions });
  };

  const updateOption = (index: number, field: 'label' | 'value' | 'effectType' | 'effectValue', val: string) => {
    const newOptions = [...formData.options];
    const target = newOptions[index];
    if (!target) return;

    if (field === 'effectType') {
      target.price_effect = {
        type: val as 'fixed' | 'multiply' | 'per_page' | 'none',
        value: target.price_effect?.value || 0,
      };
    } else if (field === 'effectValue') {
      target.price_effect = {
        type: target.price_effect?.type || 'fixed',
        value: Number(val) || 0,
      };
    } else if (field === 'label') {
      target.label = val;
    } else if (field === 'value') {
      target.value = val;
    }
    setFormData({ ...formData, options: newOptions });
  };

  const handleSave = async () => {
    if (!formData.key.trim() || !formData.label.trim()) {
      alert('Por favor informe a Chave e o Rótulo do campo.');
      return;
    }

    setIsSaving(true);
    const method = editingId === 'new' ? 'POST' : 'PUT';
    try {
      const res = await fetch(`/api/admin/servicos/${service.id}/campos`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          id: editingId === 'new' ? undefined : editingId,
        }),
      });

      const resData = (await res.json()) as { error?: string };
      if (!res.ok || resData.error) throw new Error(resData.error || 'Erro ao salvar');

      await mutate();
      cancelEdit();
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : 'Falha de rede';
      alert(`Erro ao salvar campo: ${errorMsg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (fieldId: string) => {
    if (!confirm('Deseja realmente EXCLUIR este campo de personalização?')) return;
    
    try {
      const res = await fetch(`/api/admin/servicos/${service.id}/campos?fieldId=${fieldId}`, {
        method: 'DELETE',
      });
      const resData = (await res.json()) as { error?: string };
      if (!res.ok || resData.error) throw new Error(resData.error || 'Erro ao excluir');
      await mutate();
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : 'Falha';
      alert(`Erro ao excluir campo: ${errorMsg}`);
    }
  };

  const showOptions = ['select', 'radio'].includes(formData.field_type);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/servicos" className="p-2 hover:bg-slate-200 rounded-xl text-slate-800 transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 font-serif">{service.name}</h1>
            <p className="text-sm font-medium text-slate-600">Configuração de campos dinâmicos e opções de personalização</p>
          </div>
        </div>

        <button
          onClick={startNew}
          disabled={editingId !== null}
          className="inline-flex items-center gap-2 bg-[#0F2040] hover:bg-[#CC1A1A] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Novo Campo
        </button>
      </div>

      {readiness && (
        <section className={`rounded-2xl border p-5 ${readiness.ready ? 'border-emerald-200 bg-emerald-50/60' : 'border-red-200 bg-red-50/60'}`}>
          <div className="flex items-start gap-3">
            {readiness.ready ? <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" /> : <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />}
            <div className="min-w-0">
              <h2 className="font-bold text-slate-900">Validação para publicação</h2>
              <p className="mt-1 text-sm text-slate-700">
                {readiness.ready ? 'A estrutura está apta para ser publicada.' : 'Corrija os itens abaixo antes de publicar o serviço.'}
              </p>
              {readiness.coverage.inspectedCombinations > 0 && (
                <p className="mt-2 text-xs font-medium text-slate-700">{readiness.coverage.inspectedCombinations} combinações verificadas · {readiness.coverage.uncoveredCombinations} sem regra específica · {readiness.coverage.ambiguousCombinations} ambíguas.</p>
              )}
              <ul className="mt-3 space-y-1 text-sm text-slate-700">
                {readiness.errors.map((message) => <li key={`error-${message}`} className="text-red-800">• {message}</li>)}
                {readiness.warnings.map((message) => <li key={`warning-${message}`}>• {message}</li>)}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* Editor Box */}
      {editingId && (
        <div className="bg-white rounded-3xl border-2 border-blue-500 shadow-xl p-6 sm:p-8 space-y-6 animate-in fade-in duration-200">
          <div className="flex justify-between items-center border-b border-slate-200 pb-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 font-serif">
              <Settings2 className="w-5 h-5 text-blue-600" />
              {editingId === 'new' ? 'Novo Campo de Personalização' : 'Editar Campo'}
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
                Salvar Campo
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">
                Rótulo Visível ao Cliente *
              </label>
              <input
                type="text"
                placeholder="Ex: Tipo de Papel, Acabamento, Cor"
                value={formData.label}
                onChange={(e) => {
                  const label = e.target.value;
                  const autoKey = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '_');
                  setFormData({
                    ...formData,
                    label,
                    key: editingId === 'new' ? autoKey : formData.key,
                  });
                }}
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">
                Chave Interna (slug sem espaços) *
              </label>
              <input
                type="text"
                placeholder="Ex: tipo_papel, acabamento"
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono font-medium shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">
                Tipo de Campo
              </label>
              <select
                value={formData.field_type}
                onChange={(e) => setFormData({ ...formData, field_type: e.target.value })}
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none cursor-pointer transition"
              >
                <option value="select">Seleção Dropdown (Select)</option>
                <option value="radio">Botões de Opção (Radio)</option>
                <option value="checkbox">Caixa de Marcar (Checkbox)</option>
                <option value="number">Número (Quantidade extra)</option>
                <option value="text">Texto Curto</option>
                <option value="textarea">Texto Longo / Observações</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">
                  Ordem de Exibição
                </label>
                <input
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: Number(e.target.value) })}
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition"
                />
              </div>

              <div className="flex items-center gap-4 pt-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_required}
                    onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-600/20"
                  />
                  <span className="text-sm font-semibold text-slate-800">Obrigatório</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-600/20"
                  />
                  <span className="text-sm font-semibold text-slate-800">Ativo</span>
                </label>
              </div>
            </div>
          </div>

          {/* Dynamic Options Section for Select / Radio */}
          {showOptions && (
            <div className="pt-4 border-t border-slate-200">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Opções de Escolha e Efeitos no Preço
                </h3>
                <button
                  type="button"
                  onClick={addOption}
                  className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar Opção
                </button>
              </div>

              <div className="space-y-3">
                {formData.options.map((opt, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-semibold text-slate-800 mb-1">Rótulo Visível</label>
                      <input
                        type="text"
                        placeholder="Ex: Sulfite 75g"
                        value={opt.label}
                        onChange={(e) => updateOption(idx, 'label', e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none text-sm transition"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-800 mb-1">Valor Interno</label>
                      <input
                        type="text"
                        placeholder="sulfite_75g"
                        value={opt.value}
                        onChange={(e) => updateOption(idx, 'value', e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono font-medium shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none text-sm transition"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-800 mb-1">Efeito no Preço</label>
                      <select
                        value={opt.price_effect?.type || 'none'}
                        onChange={(e) => updateOption(idx, 'effectType', e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none text-xs cursor-pointer transition"
                      >
                        <option value="none">Sem Efeito (R$ 0,00)</option>
                        <option value="fixed">Acréscimo Fixo (+ R$)</option>
                        <option value="per_page">Por Página (+ R$/pág)</option>
                        <option value="multiply">Multiplicador (x)</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2 flex items-end gap-2">
                      <div className="flex-1">
                        <label className="block text-[11px] font-semibold text-slate-800 mb-1">Valor</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          disabled={opt.price_effect?.type === 'none'}
                          value={opt.price_effect?.value || ''}
                          onChange={(e) => updateOption(idx, 'effectValue', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none text-sm disabled:bg-slate-100 disabled:text-slate-400 transition"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeOption(idx)}
                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                        title="Remover opção"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-slate-900 font-serif">Compatibilidades entre escolhas</h2>
            <p className="text-xs font-medium text-slate-600 mt-1">
              Configure em uma árvore quais materiais, gramaturas, acabamentos e caixas de marcar ficam disponíveis em cada combinação.
            </p>
          </div>
          <Link
            href={`/admin/servicos/${service.id}/compatibilidades`}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F2040] hover:bg-[#CC1A1A] text-white font-bold text-sm shadow-md transition"
          >
            Configurar compatibilidades
          </Link>
        </div>
      </section>

      {/* Fields List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-slate-900 font-serif">Campos Atuais do Serviço</h2>
            <p className="text-xs font-medium text-slate-600">Renderizados dinamicamente na página pública do configurador</p>
          </div>
          <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-extrabold rounded-full">
            {fields.length} campos configurados
          </span>
        </div>

        {fields.length === 0 ? (
          <div className="p-16 text-center text-slate-600">
            <HelpCircle className="w-12 h-12 mx-auto mb-3 text-slate-400" />
            <p className="font-bold text-slate-800">Nenhum campo personalizado cadastrado.</p>
            <p className="text-xs text-slate-500 mt-1">Clique em &ldquo;Novo Campo&rdquo; para adicionar opções como Tipo de Papel, Cor ou Encadernação.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {fields.map((field) => (
              <div key={field.id} className="p-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:bg-slate-50/80 transition">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0">
                    {field.sort_order}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-extrabold text-slate-900">{field.label}</h3>
                      <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                        {field.key}
                      </span>
                      {field.is_required && (
                        <span className="text-[10px] font-extrabold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full uppercase">
                          Obrigatório
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 font-medium mt-1">
                      Tipo: <strong className="text-slate-800">{field.field_type}</strong> · Opções cadastradas: <strong className="text-slate-800">{field.options?.length || 0}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    onClick={() => startEdit(field)}
                    disabled={editingId !== null}
                    className="p-2 text-slate-700 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition"
                    title="Editar campo"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(field.id)}
                    disabled={editingId !== null}
                    className="p-2 text-slate-700 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                    title="Excluir campo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
