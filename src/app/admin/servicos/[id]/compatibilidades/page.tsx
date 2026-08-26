'use client';

import { use, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { ArrowLeft, Check, Link2, Loader2, Plus, Trash2 } from 'lucide-react';

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Não foi possível carregar os dados.');
  return data;
};

interface StoredOptionItem {
  label: string;
  value: string;
  is_active?: boolean;
}

interface ServiceField {
  id: string;
  service_id: string;
  key: string;
  label: string;
  field_type: 'select' | 'radio' | 'checkbox' | 'number' | 'text' | 'textarea';
  is_active: boolean;
  sort_order: number;
  options?: StoredOptionItem[] | null;
}

interface ServiceDetailResponse {
  id: string;
  name: string;
  fields?: ServiceField[];
  error?: string;
}

interface Condition {
  field_id: string;
  option_value: string;
}

interface DependencyRow {
  id: string;
  source_field_id: string;
  source_option_value: string;
  source_conditions?: unknown;
  target_field_id: string;
  target_option_value: string;
}

interface CompatibilityNode {
  id: string;
  fieldId: string;
  optionValues: string[];
  children: Record<string, CompatibilityNode[]>;
}

interface CompatibilityRule {
  source_conditions: Condition[];
  target_field_id: string;
  target_option_value: string;
}

function createNode(): CompatibilityNode {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    fieldId: '',
    optionValues: [],
    children: {},
  };
}

function conditionsFromDependency(dependency: DependencyRow): Condition[] {
  if (Array.isArray(dependency.source_conditions)) {
    const conditions = dependency.source_conditions.flatMap((condition): Condition[] => {
      if (!condition || typeof condition !== 'object' || Array.isArray(condition)) return [];
      const record = condition as Record<string, unknown>;
      return typeof record.field_id === 'string' && typeof record.option_value === 'string'
        ? [{ field_id: record.field_id, option_value: record.option_value }]
        : [];
    });
    if (conditions.length > 0) return conditions;
  }
  return [{
    field_id: dependency.source_field_id,
    option_value: dependency.source_option_value,
  }];
}

function sameConditions(left: readonly Condition[], right: readonly Condition[]) {
  return left.length === right.length && left.every((condition, index) => (
    condition.field_id === right[index]?.field_id
    && condition.option_value === right[index]?.option_value
  ));
}

function activeOptions(field: ServiceField | undefined): StoredOptionItem[] {
  if (!field) return [];
  if (field.field_type === 'checkbox') {
    return [
      { value: 'true', label: 'Permitir marcação' },
      { value: 'false', label: 'Não permitir (desmarcado)' },
    ];
  }
  return (field.options ?? []).filter((option) => option.is_active !== false);
}

function optionLabel(field: ServiceField | undefined, value: string) {
  return activeOptions(field).find((option) => option.value === value)?.label ?? value;
}

function buildTree(
  dependencies: readonly DependencyRow[],
  parentConditions: readonly Condition[],
  depth = 0,
): CompatibilityNode[] {
  if (depth > 20) return [];
  const matching = dependencies.filter((dependency) => (
    sameConditions(conditionsFromDependency(dependency), parentConditions)
  ));
  const byTargetField = new Map<string, DependencyRow[]>();
  for (const dependency of matching) {
    byTargetField.set(dependency.target_field_id, [
      ...(byTargetField.get(dependency.target_field_id) ?? []),
      dependency,
    ]);
  }

  return Array.from(byTargetField.entries()).map(([fieldId, rules]) => {
    const optionValues = Array.from(new Set(rules.map((rule) => rule.target_option_value)));
    return {
      id: `stored-${parentConditions.map((condition) => `${condition.field_id}:${condition.option_value}`).join('|')}-${fieldId}`,
      fieldId,
      optionValues,
      children: Object.fromEntries(optionValues.map((optionValue) => [
        optionValue,
        buildTree(dependencies, [...parentConditions, { field_id: fieldId, option_value: optionValue }], depth + 1),
      ])),
    };
  });
}

function updateNodeInTree(
  nodes: CompatibilityNode[],
  nodeId: string,
  updater: (node: CompatibilityNode) => CompatibilityNode,
): CompatibilityNode[] {
  return nodes.map((node) => {
    if (node.id === nodeId) return updater(node);
    return {
      ...node,
      children: Object.fromEntries(Object.entries(node.children).map(([optionValue, children]) => [
        optionValue,
        updateNodeInTree(children, nodeId, updater),
      ])),
    };
  });
}

function removeNodeFromTree(nodes: CompatibilityNode[], nodeId: string): CompatibilityNode[] {
  return nodes
    .filter((node) => node.id !== nodeId)
    .map((node) => ({
      ...node,
      children: Object.fromEntries(Object.entries(node.children).map(([optionValue, children]) => [
        optionValue,
        removeNodeFromTree(children, nodeId),
      ])),
    }));
}

function flattenTree(nodes: CompatibilityNode[], parentConditions: Condition[]): CompatibilityRule[] {
  const rules: CompatibilityRule[] = [];
  for (const node of nodes) {
    if (!node.fieldId) continue;
    for (const optionValue of node.optionValues) {
      rules.push({
        source_conditions: parentConditions,
        target_field_id: node.fieldId,
        target_option_value: optionValue,
      });
      rules.push(...flattenTree(
        node.children[optionValue] ?? [],
        [...parentConditions, { field_id: node.fieldId, option_value: optionValue }],
      ));
    }
  }
  return rules;
}

export default function CompatibilidadesServicoPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const { data: service, error: serviceError, isLoading } = useSWR<ServiceDetailResponse>(
    `/api/admin/servicos/${params.id}/campos`,
    fetcher,
  );
  const { data: rawDependencies, mutate: mutateDependencies } = useSWR<DependencyRow[]>(
    `/api/admin/servicos/${params.id}/dependencias`,
    fetcher,
  );
  const [rootFieldId, setRootFieldId] = useState('');
  const [rootOptionValue, setRootOptionValue] = useState('');
  const [tree, setTree] = useState<CompatibilityNode[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const fields = service?.fields;
  const linkableFields = useMemo(() => (fields ?? []).filter((field) => (
    field.is_active && ['select', 'radio', 'checkbox'].includes(field.field_type)
  )), [fields]);
  const dependencies = Array.isArray(rawDependencies) ? rawDependencies : [];
  const rootField = linkableFields.find((field) => field.id === rootFieldId);
  const rootOptions = activeOptions(rootField);
  const rootCondition = rootFieldId && rootOptionValue
    ? [{ field_id: rootFieldId, option_value: rootOptionValue }]
    : [];

  useEffect(() => {
    if (rootCondition.length === 0) {
      setTree([]);
      return;
    }
    setTree(buildTree(dependencies, rootCondition));
  // A reconstrução é intencional ao trocar a raiz ou após salvar no servidor.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootFieldId, rootOptionValue, rawDependencies]);

  const changeNodeField = (nodeId: string, fieldId: string) => {
    setTree((current) => updateNodeInTree(current, nodeId, (node) => ({
      ...node,
      fieldId,
      optionValues: [],
      children: {},
    })));
  };

  const toggleNodeOption = (nodeId: string, optionValue: string) => {
    setTree((current) => updateNodeInTree(current, nodeId, (node) => {
      const isSelected = node.optionValues.includes(optionValue);
      const optionValues = isSelected
        ? node.optionValues.filter((value) => value !== optionValue)
        : [...node.optionValues, optionValue];
      const children = { ...node.children };
      if (isSelected) delete children[optionValue];
      return { ...node, optionValues, children };
    }));
  };

  const addChildNode = (nodeId: string, optionValue: string) => {
    setTree((current) => updateNodeInTree(current, nodeId, (node) => ({
      ...node,
      children: {
        ...node.children,
        [optionValue]: [...(node.children[optionValue] ?? []), createNode()],
      },
    })));
  };

  const saveTree = async () => {
    if (!rootFieldId || !rootOptionValue) {
      alert('Selecione o campo e a opção inicial da compatibilidade.');
      return;
    }
    const rules = flattenTree(tree, rootCondition);
    if (rules.length === 0 && !confirm('Salvar sem ramificações removerá todos os vínculos desta opção inicial. Continuar?')) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/servicos/${params.id}/dependencias`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          root: rootCondition[0],
          rules,
        }),
      });
      const result = await response.json() as { error?: string; rule_count?: number };
      if (!response.ok || result.error) throw new Error(result.error || 'Não foi possível salvar as compatibilidades.');
      await mutateDependencies();
      alert(`${result.rule_count ?? rules.length} vínculo(s) salvo(s) para esta opção.`);
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Não foi possível salvar as compatibilidades.');
    } finally {
      setIsSaving(false);
    }
  };

  const renderNodes = (
    nodes: CompatibilityNode[],
    parentConditions: Condition[],
    depth: number,
  ): ReactNode => nodes.map((node) => {
    const selectedField = linkableFields.find((field) => field.id === node.fieldId);
    const unavailableFieldIds = new Set([
      ...parentConditions.map((condition) => condition.field_id),
      ...nodes.filter((candidate) => candidate.id !== node.id).map((candidate) => candidate.fieldId),
    ]);
    const targetFields = linkableFields.filter((field) => !unavailableFieldIds.has(field.id) || field.id === node.fieldId);
    const options = activeOptions(selectedField);

    return (
      <div
        key={node.id}
        className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        style={{ marginLeft: depth > 0 ? `${Math.min(depth, 3) * 8}px` : undefined }}
      >
        <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-end">
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Campo liberado por esta escolha
            </label>
            <select
              value={node.fieldId}
              onChange={(event) => changeNodeField(node.id, event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-900"
            >
              <option value="">Selecione um campo...</option>
              {targetFields.map((field) => <option key={field.id} value={field.id}>{field.label}</option>)}
            </select>
          </div>
          <button
            type="button"
            onClick={() => setTree((current) => removeNodeFromTree(current, node.id))}
            className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50 md:w-auto"
          >
            <Trash2 className="h-4 w-4" /> Remover campo
          </button>
        </div>

        {selectedField && (
          <div className="mt-4 space-y-3">
            <p className="break-words text-sm font-semibold leading-5 text-slate-800">
              Opções de {selectedField.label} que ficarão disponíveis
            </p>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {options.map((option) => {
                const checked = node.optionValues.includes(option.value);
                const children = node.children[option.value] ?? [];
                return (
                  <div key={option.value} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <label className="flex min-w-0 cursor-pointer items-start gap-2 text-sm font-medium text-slate-900">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleNodeOption(node.id, option.value)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="min-w-0 break-words leading-5">{option.label}</span>
                    </label>
                    {checked && (
                      <div className="mt-3 border-t border-slate-200 pt-3">
                        {renderNodes(
                          children,
                          [...parentConditions, { field_id: node.fieldId, option_value: option.value }],
                          depth + 1,
                        )}
                        <button
                          type="button"
                          onClick={() => addChildNode(node.id, option.value)}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-900"
                        >
                          <Plus className="h-3.5 w-3.5" /> Vincular outro campo a esta opção
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  });

  if (isLoading) {
    return <div className="p-20 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" /></div>;
  }
  if (serviceError || !service || service.error) {
    return <div className="p-20 text-center font-bold text-red-600">Erro ao carregar as compatibilidades do serviço.</div>;
  }

  const ruleCount = rootCondition.length > 0 ? flattenTree(tree, rootCondition).length : 0;
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-4">
          <Link href={`/admin/servicos/${params.id}`} className="rounded-xl p-2 text-slate-800 transition hover:bg-slate-200">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="font-serif text-2xl font-extrabold text-slate-900">Compatibilidades</h1>
            <p className="break-words text-sm font-medium leading-5 text-slate-600">{service.name}: defina quais escolhas podem coexistir no pedido.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={saveTree}
          disabled={!rootFieldId || !rootOptionValue || isSaving}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0F2040] px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-[#CC1A1A] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Salvar compatibilidades
        </button>
      </div>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/70 p-6">
          <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-slate-900">
            <Link2 className="h-5 w-5 text-blue-600" /> Árvore de escolhas permitidas
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Escolha uma opção inicial e, por caixas de seleção, libere os materiais, gramaturas, acabamentos e outras escolhas que ela suporta. Cada ramificação pode continuar para quantos campos forem necessários.
          </p>
        </div>

        <div className="grid gap-4 border-b border-slate-100 p-6 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-800">1. Campo inicial</label>
            <select
              value={rootFieldId}
              onChange={(event) => {
                setRootFieldId(event.target.value);
                setRootOptionValue('');
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900"
            >
              <option value="">Selecione o campo...</option>
              {linkableFields.map((field) => <option key={field.id} value={field.id}>{field.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-800">2. Opção inicial</label>
            <select
              value={rootOptionValue}
              disabled={!rootField}
              onChange={(event) => setRootOptionValue(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 disabled:bg-slate-100"
            >
              <option value="">Selecione a opção...</option>
              {rootOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        </div>

        {rootCondition.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-600">Selecione o ponto inicial para montar ou revisar a árvore de compatibilidades.</p>
        ) : (
          <div className="space-y-4 p-6">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-bold text-blue-950">Início: {rootField?.label} = {optionLabel(rootField, rootOptionValue)}</p>
              <p className="mt-1 text-xs text-blue-800">{ruleCount} vínculo(s) serão gravados para esta opção inicial.</p>
            </div>

            {tree.length > 0 && <div className="space-y-3">{renderNodes(tree, rootCondition, 0)}</div>}

            <button
              type="button"
              onClick={() => setTree((current) => [...current, createNode()])}
              className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-bold text-blue-800 transition hover:bg-blue-50"
            >
              <Plus className="h-4 w-4" /> Vincular um campo a {optionLabel(rootField, rootOptionValue)}
            </button>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
        <p className="font-bold">Exemplo para impressão</p>
        <p className="mt-1">Em “A4”, vincule “Tipo de Papel”; em “Adesivo”, vincule “Frente e Verso” e marque apenas “Não permitir (desmarcado)”. Para os papéis que aceitam frente e verso, crie a ramificação correspondente e marque “Permitir marcação”.</p>
      </section>
    </div>
  );
}
