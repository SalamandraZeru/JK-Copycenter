'use client';

import React, { useMemo, useState } from 'react';
import useSWR from 'swr';
import { BookOpen, Calculator, Check, Edit2, Loader2, Percent, Plus, Trash2, X } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';
import { evaluateBindingTierCoverage } from '@/lib/pricing/binding-tiers';

const fetcher = (url: string) => fetch(url).then((res) => res.json());
type FieldValue = string | number | boolean | null;

interface PricingService { id: string; name: string; }
interface ServiceFieldOption { value: string; label: string; is_active?: boolean; }
interface ServiceField {
  id: string;
  key: string;
  label: string;
  field_type: 'select' | 'radio' | 'number' | 'text' | 'textarea' | 'checkbox';
  options: ServiceFieldOption[];
  is_required: boolean;
}
interface PricingRuleFieldCondition {
  id: string;
  service_field_id: string;
  expected_value: FieldValue;
  service_fields?: Pick<ServiceField, 'id' | 'key' | 'label' | 'field_type'> | null;
}
interface PricingRule {
  id: string;
  name: string;
  price_per_page: number;
  services?: PricingService | null;
  pricing_rule_field_conditions?: PricingRuleFieldCondition[];
  pricing_rule_attributes?: Array<{ attributes?: { name: string } | null }>;
}
interface QuantityDiscount {
  id: string;
  min_quantity: number;
  max_quantity: number | null;
  discount_percent: number;
  services?: PricingService | null;
}
interface BindingPriceTier {
  id: string;
  service_id: string;
  min_pages: number;
  max_pages: number | null;
  price_cents: number;
  is_active: boolean;
  services?: PricingService | null;
}
interface BindingTierForm {
  id?: string;
  service_id: string;
  min_pages: number;
  max_pages: number | '';
  price: number;
  is_active: boolean;
}
interface RuleForm {
  service_id: string;
  name: string;
  price_per_page: number;
  fallback_behavior: 'base_price' | 'block';
  selected_field_values: Record<string, string>;
}

function activeOptions(field: ServiceField): ServiceFieldOption[] {
  return Array.isArray(field.options) ? field.options.filter((option) => option.is_active !== false) : [];
}

function fieldValueFromInput(field: ServiceField, rawValue: string): FieldValue {
  if (rawValue === '') return null;
  if (field.field_type === 'checkbox') return rawValue === 'true';
  if (field.field_type === 'number') {
    const value = Number(rawValue);
    return Number.isFinite(value) ? value : null;
  }
  return rawValue;
}

function displayFieldValue(value: FieldValue): string {
  if (value === null) return 'Qualquer valor';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  return String(value);
}

function FieldConditionInput({ field, value, onChange }: { field: ServiceField; value: string; onChange: (value: string) => void }) {
  const className = 'w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 shadow-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition';
  return (
    <div>
      <label className="block text-[11px] font-semibold text-slate-800 mb-1">
        {field.label}{field.is_required ? ' (obrigatório no pedido)' : ''}
      </label>
      {(field.field_type === 'select' || field.field_type === 'radio') && (
        <select value={value} onChange={(event) => onChange(event.target.value)} className={className}>
          <option value="">Qualquer valor</option>
          {activeOptions(field).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      )}
      {field.field_type === 'checkbox' && (
        <select value={value} onChange={(event) => onChange(event.target.value)} className={className}>
          <option value="">Qualquer valor</option><option value="true">Sim</option><option value="false">Não</option>
        </select>
      )}
      {field.field_type === 'number' && <input type="number" value={value} onChange={(event) => onChange(event.target.value)} placeholder="Qualquer valor" className={className} />}
      {field.field_type === 'text' && <input type="text" value={value} onChange={(event) => onChange(event.target.value)} placeholder="Qualquer valor" maxLength={5000} className={className} />}
      {field.field_type === 'textarea' && <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder="Qualquer valor" maxLength={5000} rows={2} className={className} />}
    </div>
  );
}

export default function PrecosPage() {
  const [activeTab, setActiveTab] = useState<'regras' | 'descontos' | 'encadernacao'>('regras');
  const { data: rawRules, isLoading: rulesLoading, mutate: mutateRules } = useSWR<PricingRule[]>('/api/admin/precos/regras', fetcher);
  const { data: rawDiscounts, isLoading: discountsLoading, mutate: mutateDiscounts } = useSWR<QuantityDiscount[]>('/api/admin/precos/descontos', fetcher);
  const { data: rawBindingTiers, isLoading: bindingTiersLoading, mutate: mutateBindingTiers } = useSWR<BindingPriceTier[]>('/api/admin/encadernacao', fetcher);
  const { data: rawServices } = useSWR<PricingService[]>('/api/admin/servicos', fetcher);
  const rules = Array.isArray(rawRules) ? rawRules : [];
  const discounts = Array.isArray(rawDiscounts) ? rawDiscounts : [];
  const bindingTiers = useMemo(() => Array.isArray(rawBindingTiers) ? rawBindingTiers : [], [rawBindingTiers]);
  const services = useMemo(() => Array.isArray(rawServices) ? rawServices : [], [rawServices]);
  const bindingCoverageByService = useMemo(() => new Map(
    services.map((service) => [service.id, evaluateBindingTierCoverage(
      bindingTiers
        .filter((tier) => tier.service_id === service.id)
        .map((tier) => ({ minPages: tier.min_pages, maxPages: tier.max_pages, isActive: tier.is_active })),
    )]),
  ), [bindingTiers, services]);

  const [ruleForm, setRuleForm] = useState<RuleForm>({ service_id: '', name: '', price_per_page: 0.25, fallback_behavior: 'base_price', selected_field_values: {} });
  const [showRuleModal, setShowRuleModal] = useState(false);
  const { data: selectedServiceData, isLoading: fieldsLoading } = useSWR<{ service: PricingService; fields: ServiceField[] }>(
    ruleForm.service_id ? `/api/admin/precos/campos?service_id=${encodeURIComponent(ruleForm.service_id)}` : null,
    fetcher
  );
  const serviceFields = Array.isArray(selectedServiceData?.fields) ? selectedServiceData.fields : [];
  const [discountForm, setDiscountForm] = useState({ service_id: '', min_quantity: 50, max_quantity: '' as number | '', discount_percent: 10 });
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [bindingTierForm, setBindingTierForm] = useState<BindingTierForm>({ service_id: '', min_pages: 1, max_pages: '', price: 0, is_active: true });
  const [showBindingTierModal, setShowBindingTierModal] = useState(false);

  const resetRuleForm = () => setRuleForm({ service_id: '', name: '', price_per_page: 0.25, fallback_behavior: 'base_price', selected_field_values: {} });
  const setFieldValue = (fieldId: string, value: string) => setRuleForm((current) => ({ ...current, selected_field_values: { ...current.selected_field_values, [fieldId]: value } }));
  const resetBindingTierForm = () => setBindingTierForm({ service_id: '', min_pages: 1, max_pages: '', price: 0, is_active: true });

  const handleCreateRule = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ruleForm.service_id || !ruleForm.name.trim()) return alert('Selecione o serviço e informe um nome para a regra.');
    if (serviceFields.some((field) => field.field_type === 'number' && (ruleForm.selected_field_values[field.id] ?? '') !== '' && !Number.isFinite(Number(ruleForm.selected_field_values[field.id])))) {
      return alert('Informe um número válido nas condições de preço.');
    }
    try {
      const response = await fetch('/api/admin/precos/regras', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: ruleForm.service_id,
          name: ruleForm.name,
          price_per_page: ruleForm.price_per_page,
          fallback_behavior: ruleForm.fallback_behavior,
          field_conditions: serviceFields.map((field) => ({ service_field_id: field.id, expected_value: fieldValueFromInput(field, ruleForm.selected_field_values[field.id] ?? '') })),
        }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok || data.error) throw new Error(data.error || 'Erro ao criar regra');
      setShowRuleModal(false); resetRuleForm(); await mutateRules();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Falha ao salvar regra de preço');
    }
  };

  const handleDeactivateRule = async (ruleId: string) => {
    if (!confirm('Excluir permanentemente esta regra? As condições serão removidas; snapshots de pedidos antigos permanecem preservados.')) return;
    try {
      const response = await fetch(`/api/admin/precos/regras?id=${ruleId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error();
      await mutateRules();
    } catch { alert('Erro ao excluir regra'); }
  };

  const handleCreateDiscount = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!discountForm.service_id || !discountForm.min_quantity) return alert('Selecione o serviço e a quantidade mínima.');
    try {
      const response = await fetch('/api/admin/precos/descontos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(discountForm) });
      const data = await response.json() as { error?: string };
      if (!response.ok || data.error) throw new Error(data.error || 'Erro ao criar desconto');
      setShowDiscountModal(false); setDiscountForm({ service_id: '', min_quantity: 50, max_quantity: '', discount_percent: 10 }); await mutateDiscounts();
    } catch (error: unknown) { alert(error instanceof Error ? error.message : 'Falha ao salvar desconto'); }
  };

  const handleDeleteDiscount = async (discountId: string) => {
    if (!confirm('Deseja excluir esta faixa de desconto?')) return;
    try {
      const response = await fetch(`/api/admin/precos/descontos?id=${discountId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error();
      await mutateDiscounts();
    } catch { alert('Erro ao excluir desconto'); }
  };

  const handleSaveBindingTier = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!bindingTierForm.service_id) return alert('Selecione o serviço que oferece a encadernação.');
    if (bindingTierForm.max_pages !== '' && bindingTierForm.max_pages < bindingTierForm.min_pages) {
      return alert('A página final deve ser maior ou igual à página inicial.');
    }
    try {
      const response = await fetch('/api/admin/encadernacao', {
        method: bindingTierForm.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(bindingTierForm.id ? { id: bindingTierForm.id } : {}),
          service_id: bindingTierForm.service_id,
          min_pages: bindingTierForm.min_pages,
          max_pages: bindingTierForm.max_pages === '' ? null : bindingTierForm.max_pages,
          price: bindingTierForm.price,
          is_active: bindingTierForm.is_active,
        }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok || data.error) throw new Error(data.error || 'Erro ao salvar faixa de encadernação.');
      setShowBindingTierModal(false);
      resetBindingTierForm();
      await mutateBindingTiers();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Falha ao salvar faixa de encadernação.');
    }
  };

  const handleDeleteBindingTier = async (tierId: string) => {
    if (!confirm('Excluir esta faixa? Novos pedidos deixarão de poder usar esta encadernação nesta quantidade de páginas.')) return;
    try {
      const response = await fetch(`/api/admin/encadernacao?id=${tierId}`, { method: 'DELETE' });
      const data = await response.json() as { error?: string };
      if (!response.ok || data.error) throw new Error(data.error || 'Erro ao excluir faixa.');
      await mutateBindingTiers();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Falha ao excluir faixa.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 font-serif">Motor de Precificação & Descontos</h1>
        <p className="text-sm font-medium text-slate-600">Vincule cada regra a um serviço e use somente os campos reais configurados para ele.</p>
      </div>

      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button onClick={() => setActiveTab('regras')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'regras' ? 'bg-[#0F2040] text-white shadow-md' : 'bg-white text-slate-800 hover:bg-slate-100 border border-slate-300 shadow-sm'}`}><Calculator className="w-4 h-4" /> Regras por serviço ({rules.length})</button>
        <button onClick={() => setActiveTab('descontos')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'descontos' ? 'bg-[#0F2040] text-white shadow-md' : 'bg-white text-slate-800 hover:bg-slate-100 border border-slate-300 shadow-sm'}`}><Percent className="w-4 h-4" /> Descontos por quantidade ({discounts.length})</button>
        <button onClick={() => setActiveTab('encadernacao')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'encadernacao' ? 'bg-[#0F2040] text-white shadow-md' : 'bg-white text-slate-800 hover:bg-slate-100 border border-slate-300 shadow-sm'}`}><BookOpen className="w-4 h-4" /> Encadernação ({bindingTiers.length})</button>
      </div>

      {activeTab === 'regras' && <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm"><div><h2 className="text-base font-extrabold text-slate-900 font-serif">Regras de preço por configuração</h2><p className="text-xs text-slate-600 font-medium">Primeiro escolha o serviço. Em seguida, o painel mostra os seus campos e opções cadastrados.</p></div><button onClick={() => { resetRuleForm(); setShowRuleModal(true); }} className="inline-flex items-center gap-2 bg-[#0F2040] hover:bg-[#CC1A1A] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition"><Plus className="w-4 h-4" /> Nova regra</button></div>

        {showRuleModal && <div className="bg-white rounded-3xl border-2 border-blue-500 shadow-xl p-6 sm:p-8 space-y-6 animate-in fade-in duration-200">
          <div className="flex justify-between items-center border-b border-slate-200 pb-4"><div><h3 className="text-lg font-bold text-slate-900 font-serif flex items-center gap-2"><Calculator className="w-5 h-5 text-blue-600" /> Cadastrar regra de preço</h3><p className="mt-1 text-xs text-slate-600">Campos vazios significam “qualquer valor” e não limitam a regra.</p></div><button type="button" onClick={() => { setShowRuleModal(false); resetRuleForm(); }} className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg" aria-label="Fechar"><X className="w-5 h-5" /></button></div>
          <form onSubmit={handleCreateRule} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div><label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">1. Serviço vinculado *</label><select value={ruleForm.service_id} onChange={(event) => setRuleForm((current) => ({ ...current, service_id: event.target.value, selected_field_values: {} }))} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none cursor-pointer transition"><option value="">Selecione um serviço...</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></div><div><label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">Nome da regra *</label><input value={ruleForm.name} onChange={(event) => setRuleForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ex.: P&B frente e verso, A4" maxLength={200} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition" /></div></div>
            {!ruleForm.service_id ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">Selecione um serviço para carregar os campos que ele realmente oferece.</div> : fieldsLoading ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 flex items-center gap-3 text-sm text-slate-600"><Loader2 className="w-5 h-5 animate-spin text-blue-600" /> Carregando campos do serviço...</div> : serviceFields.length === 0 ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Este serviço não possui campos ativos. A regra será geral para o serviço; configure campos no cadastro do serviço caso precise diferenciar preços.</div> : <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3"><div><span className="block text-xs font-semibold uppercase tracking-wider text-slate-800">2. Condições baseadas nos campos do serviço</span><p className="mt-1 text-xs text-slate-600">As opções abaixo vêm do serviço selecionado, sem lista global pré-definida.</p></div><div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">{serviceFields.map((field) => <FieldConditionInput key={field.id} field={field} value={ruleForm.selected_field_values[field.id] ?? ''} onChange={(value) => setFieldValue(field.id, value)} />)}</div></div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div><label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">Preço por página (R$) *</label><input type="number" min="0" step="0.01" value={ruleForm.price_per_page} onChange={(event) => setRuleForm((current) => ({ ...current, price_per_page: Number(event.target.value) }))} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition" /></div><div><label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">Sem regra correspondente</label><select value={ruleForm.fallback_behavior} onChange={(event) => setRuleForm((current) => ({ ...current, fallback_behavior: event.target.value as RuleForm['fallback_behavior'] }))} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none cursor-pointer transition"><option value="base_price">Usar preço base do serviço</option><option value="block">Bloquear pedido (não calculável)</option></select></div></div>
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-200"><button type="button" onClick={() => { setShowRuleModal(false); resetRuleForm(); }} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-sm transition">Cancelar</button><button type="submit" className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#0F2040] hover:bg-[#CC1A1A] text-white font-bold rounded-xl text-sm shadow-md transition"><Check className="w-4 h-4" /> Salvar regra</button></div>
          </form>
        </div>}

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-x-auto">{rulesLoading ? <div className="p-16 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div> : rules.length === 0 ? <div className="p-16 text-center text-slate-600"><Calculator className="w-12 h-12 mx-auto mb-3 text-slate-400" /><p className="font-bold text-slate-800">Nenhuma regra de preço cadastrada.</p><p className="text-xs text-slate-500 mt-1">Crie uma regra e vincule-a aos campos do serviço.</p></div> : <table className="w-full min-w-[760px] text-left"><thead className="bg-slate-50 text-slate-800 text-xs font-semibold uppercase tracking-wider border-b border-slate-200"><tr><th className="px-6 py-4">Regra</th><th className="px-6 py-4">Serviço</th><th className="px-6 py-4">Condições do serviço</th><th className="px-6 py-4">Preço / pág.</th><th className="px-6 py-4 text-right">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">{rules.map((rule) => <tr key={rule.id} className="hover:bg-slate-50 transition"><td className="px-6 py-4 font-bold text-slate-900">{rule.name}</td><td className="px-6 py-4 font-semibold text-slate-800">{rule.services?.name || 'Serviço removido'}</td><td className="px-6 py-4"><div className="flex flex-wrap gap-1.5">{rule.pricing_rule_field_conditions?.length ? rule.pricing_rule_field_conditions.map((condition) => <span key={condition.id} className="px-2.5 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-lg text-xs font-bold">{condition.service_fields?.label || 'Campo'}: {displayFieldValue(condition.expected_value)}</span>) : rule.pricing_rule_attributes?.length ? <span className="px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-lg text-xs font-bold">Regra legada por atributos</span> : <span className="text-xs text-slate-600 italic">Padrão para o serviço</span>}</div></td><td className="px-6 py-4 font-extrabold text-blue-700 font-mono text-base">{formatCurrency(rule.price_per_page)}</td><td className="px-6 py-4 text-right"><button onClick={() => handleDeactivateRule(rule.id)} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition" title="Inativar regra"><Trash2 className="w-4 h-4" /></button></td></tr>)}</tbody></table>}</div>
      </div>}

      {activeTab === 'descontos' && <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm"><div><h2 className="text-base font-extrabold text-slate-900 font-serif">Descontos progressivos por volume</h2><p className="text-xs text-slate-600 font-medium">Aplica descontos automáticos por quantidade.</p></div><button onClick={() => { setDiscountForm({ service_id: '', min_quantity: 50, max_quantity: '', discount_percent: 10 }); setShowDiscountModal(true); }} className="inline-flex items-center gap-2 bg-[#0F2040] hover:bg-[#CC1A1A] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition"><Plus className="w-4 h-4" /> Nova faixa</button></div>
        {showDiscountModal && <div className="bg-white rounded-3xl border-2 border-blue-500 shadow-xl p-6 sm:p-8 space-y-6 animate-in fade-in duration-200"><div className="flex justify-between items-center border-b border-slate-200 pb-4"><h3 className="text-lg font-bold text-slate-900 font-serif flex items-center gap-2"><Percent className="w-5 h-5 text-blue-600" /> Cadastrar faixa de desconto</h3><button type="button" onClick={() => setShowDiscountModal(false)} className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg" aria-label="Fechar"><X className="w-5 h-5" /></button></div><form onSubmit={handleCreateDiscount} className="space-y-5"><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div><label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">Serviço vinculado *</label><select value={discountForm.service_id} onChange={(event) => setDiscountForm((current) => ({ ...current, service_id: event.target.value }))} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none cursor-pointer transition"><option value="">Selecione o serviço...</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></div><div><label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">Desconto (%) *</label><input type="number" min="1" max="99" value={discountForm.discount_percent} onChange={(event) => setDiscountForm((current) => ({ ...current, discount_percent: Number(event.target.value) }))} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition" /></div></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div><label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">Quantidade mínima *</label><input type="number" min="2" value={discountForm.min_quantity} onChange={(event) => setDiscountForm((current) => ({ ...current, min_quantity: Number(event.target.value) }))} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition" /></div><div><label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">Quantidade máxima (opcional)</label><input type="number" placeholder="Sem limite superior" value={discountForm.max_quantity} onChange={(event) => setDiscountForm((current) => ({ ...current, max_quantity: event.target.value === '' ? '' : Number(event.target.value) }))} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition" /></div></div><div className="flex justify-end gap-2 pt-4 border-t border-slate-200"><button type="button" onClick={() => setShowDiscountModal(false)} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-sm transition">Cancelar</button><button type="submit" className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#0F2040] hover:bg-[#CC1A1A] text-white font-bold rounded-xl text-sm shadow-md transition"><Check className="w-4 h-4" /> Salvar desconto</button></div></form></div>}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-x-auto">{discountsLoading ? <div className="p-16 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div> : discounts.length === 0 ? <div className="p-16 text-center text-slate-600"><Percent className="w-12 h-12 mx-auto mb-3 text-slate-400" /><p className="font-bold text-slate-800">Nenhum desconto progressivo cadastrado.</p></div> : <table className="w-full min-w-[650px] text-left"><thead className="bg-slate-50 text-slate-800 text-xs font-semibold uppercase tracking-wider border-b border-slate-200"><tr><th className="px-6 py-4">Serviço</th><th className="px-6 py-4">Faixa</th><th className="px-6 py-4">Desconto</th><th className="px-6 py-4 text-right">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">{discounts.map((discount) => <tr key={discount.id} className="hover:bg-slate-50 transition"><td className="px-6 py-4 font-bold text-slate-900">{discount.services?.name || 'Todos os serviços'}</td><td className="px-6 py-4 font-semibold text-slate-800">A partir de {discount.min_quantity} {discount.max_quantity ? `até ${discount.max_quantity}` : '+'} páginas</td><td className="px-6 py-4"><span className="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full text-xs font-extrabold">-{discount.discount_percent}% OFF</span></td><td className="px-6 py-4 text-right"><button onClick={() => handleDeleteDiscount(discount.id)} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition" title="Excluir desconto"><Trash2 className="w-4 h-4" /></button></td></tr>)}</tbody></table>}</div>
      </div>}

      {activeTab === 'encadernacao' && <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 font-serif">Encadernação por arquivo e páginas</h2>
            <p className="text-xs text-slate-600 font-medium">O cliente escolhe somente os arquivos a encadernar. A faixa e o valor são definidos aqui e recalculados no servidor.</p>
          </div>
          <button onClick={() => { resetBindingTierForm(); setShowBindingTierModal(true); }} className="inline-flex items-center gap-2 bg-[#0F2040] hover:bg-[#CC1A1A] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition">
            <Plus className="w-4 h-4" /> Nova faixa
          </button>
        </div>

        {Array.from(bindingCoverageByService.entries()).some(([, coverage]) => !coverage.isComplete) && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-bold">Há faixas de encadernação incompletas.</p>
            <p className="mt-1">A seleção só aparece ao cliente quando o serviço estiver coberto continuamente da página 1 até “sem limite”. Isso evita valores sem faixa definida.</p>
            <ul className="mt-2 list-disc pl-5 text-xs">
              {Array.from(bindingCoverageByService.entries()).filter(([, coverage]) => !coverage.isComplete).map(([serviceId, coverage]) => (
                <li key={serviceId}>{services.find((service) => service.id === serviceId)?.name || 'Serviço'}: {coverage.hasOverlap ? 'há faixas sobrepostas' : coverage.gaps.map((gap) => `${gap.minPages} até ${gap.maxPages ?? 'sem limite'}`).join(', ')}</li>
              ))}
            </ul>
          </div>
        )}

        {showBindingTierModal && <div className="bg-white rounded-3xl border-2 border-blue-500 shadow-xl p-6 sm:p-8 space-y-6 animate-in fade-in duration-200">
          <div className="flex justify-between items-center border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 font-serif flex items-center gap-2"><BookOpen className="w-5 h-5 text-blue-600" /> {bindingTierForm.id ? 'Editar faixa de encadernação' : 'Cadastrar faixa de encadernação'}</h3>
              <p className="mt-1 text-xs text-slate-600">Faixas ativas do mesmo serviço não podem se sobrepor. Deixe a página final vazia para não limitar a faixa.</p>
            </div>
            <button type="button" onClick={() => { setShowBindingTierModal(false); resetBindingTierForm(); }} className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg" aria-label="Fechar"><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={handleSaveBindingTier} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">Serviço vinculado *</label>
              <select value={bindingTierForm.service_id} onChange={(event) => setBindingTierForm((current) => ({ ...current, service_id: event.target.value }))} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none cursor-pointer transition">
                <option value="">Selecione o serviço...</option>
                {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div><label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">Página inicial *</label><input type="number" min="1" max="1000000" value={bindingTierForm.min_pages} onChange={(event) => setBindingTierForm((current) => ({ ...current, min_pages: Number(event.target.value) }))} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition" /></div>
              <div><label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">Página final</label><input type="number" min="1" max="1000000" placeholder="Sem limite" value={bindingTierForm.max_pages} onChange={(event) => setBindingTierForm((current) => ({ ...current, max_pages: event.target.value === '' ? '' : Number(event.target.value) }))} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition" /></div>
              <div><label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 mb-1.5">Valor por arquivo (R$) *</label><input type="number" min="0" step="0.01" value={bindingTierForm.price} onChange={(event) => setBindingTierForm((current) => ({ ...current, price: Number(event.target.value) }))} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition" /></div>
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-800 cursor-pointer"><input type="checkbox" checked={bindingTierForm.is_active} onChange={(event) => setBindingTierForm((current) => ({ ...current, is_active: event.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" /> Faixa ativa para novos pedidos</label>
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-200"><button type="button" onClick={() => { setShowBindingTierModal(false); resetBindingTierForm(); }} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-sm transition">Cancelar</button><button type="submit" className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#0F2040] hover:bg-[#CC1A1A] text-white font-bold rounded-xl text-sm shadow-md transition"><Check className="w-4 h-4" /> Salvar faixa</button></div>
          </form>
        </div>}

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-x-auto">
          {bindingTiersLoading ? <div className="p-16 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div> : bindingTiers.length === 0 ? <div className="p-16 text-center text-slate-600"><BookOpen className="w-12 h-12 mx-auto mb-3 text-slate-400" /><p className="font-bold text-slate-800">Nenhuma faixa de encadernação cadastrada.</p><p className="text-xs text-slate-500 mt-1">Crie as faixas que sua operação oferece para liberar a seleção de arquivos no serviço.</p></div> : <table className="w-full min-w-[720px] text-left"><thead className="bg-slate-50 text-slate-800 text-xs font-semibold uppercase tracking-wider border-b border-slate-200"><tr><th className="px-6 py-4">Serviço</th><th className="px-6 py-4">Faixa de páginas</th><th className="px-6 py-4">Valor / arquivo</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-right">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">{bindingTiers.map((tier) => <tr key={tier.id} className="hover:bg-slate-50 transition"><td className="px-6 py-4 font-bold text-slate-900">{tier.services?.name || 'Serviço removido'}</td><td className="px-6 py-4 font-semibold text-slate-800">{tier.min_pages} até {tier.max_pages ?? 'sem limite'} páginas</td><td className="px-6 py-4 font-extrabold text-blue-700">{formatCurrency(tier.price_cents / 100)}</td><td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-extrabold ${tier.is_active ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>{tier.is_active ? 'Ativa' : 'Inativa'}</span></td><td className="px-6 py-4 text-right"><button onClick={() => { setBindingTierForm({ id: tier.id, service_id: tier.service_id, min_pages: tier.min_pages, max_pages: tier.max_pages ?? '', price: tier.price_cents / 100, is_active: tier.is_active }); setShowBindingTierModal(true); }} className="p-2 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition" title="Editar faixa"><Edit2 className="w-4 h-4" /></button><button onClick={() => handleDeleteBindingTier(tier.id)} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition" title="Excluir faixa"><Trash2 className="w-4 h-4" /></button></td></tr>)}</tbody></table>}
        </div>
      </div>}
    </div>
  );
}
