'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ClipboardCheck,
  FileText,
  Loader2,
  MessageCircle,
  Ruler,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import type { FieldValue, GraphicQuoteService, ServiceField } from '@/types/service';
import type { PricingDimensions } from '@/types/pricing';
import { isFieldOptionSelectionAllowed, resolveFieldOptionAvailability } from '@/lib/services/field-option-dependencies';
import { formatBrazilianPhone, digitsOnly } from '@/lib/forms/brazil';
import { useCartStore } from '@/lib/cart/store';
import { GRAPHIC_QUOTE_CONFIRMATION_KEY } from '@/lib/orders/graphic-quote-confirmation';
import { SelectField } from './fields/SelectField';
import { RadioField } from './fields/RadioField';
import { NumberField } from './fields/NumberField';
import { TextField } from './fields/TextField';
import { TextareaField } from './fields/TextareaField';
import { CheckboxField } from './fields/CheckboxField';
import { FileUploadDropzone, type UploadedFileItem } from './FileUploadDropzone';
import { GraphicQuoteSuccess } from './GraphicQuoteSuccess';

interface GraphicQuoteConfiguratorProps {
  service: GraphicQuoteService;
}

interface QuoteResponse {
  success: boolean;
  error?: string;
  data?: {
    requestId: string;
    protocol: string;
    requestCode: string;
    quoteStatus: 'pending' | 'negotiating' | 'quoted' | 'accepted' | 'declined' | 'expired' | 'cancelled';
    whatsappUrl: string | null;
    whatsappMessage: string;
    replayed: boolean;
  };
}

type FormErrors = Record<string, string>;

function selectedValuesByFieldId(service: GraphicQuoteService, values: FieldValue[]) {
  const fieldsByKey = new Map(service.fields.map((field) => [field.key, field]));
  const selected = new Map<string, string | number | boolean>();
  for (const value of values) {
    const field = fieldsByKey.get(value.fieldKey);
    if (field) selected.set(field.id, value.value);
  }
  return selected;
}

function normalizeDependentFieldValues(service: GraphicQuoteService, values: FieldValue[]): FieldValue[] {
  let normalized = values;
  for (let attempt = 0; attempt < service.fields.length; attempt += 1) {
    const selected = selectedValuesByFieldId(service, normalized);
    const next = normalized.filter((value) => {
      const field = service.fields.find((candidate) => candidate.key === value.fieldKey);
      return !field || isFieldOptionSelectionAllowed(
        service.fieldOptionDependencies,
        selected,
        field.id,
        value.value,
        { requireCompletePathMatch: service.technicalRequirements.requireCompleteCompatibility },
      );
    });
    if (next.length === normalized.length) return normalized;
    normalized = next;
  }
  return normalized;
}

function positiveNumber(value: string): number | undefined {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function dimensionHint(minimum?: number, maximum?: number): string | null {
  if (minimum !== undefined && maximum !== undefined) return `de ${minimum} a ${maximum} cm`;
  if (minimum !== undefined) return `mínimo de ${minimum} cm`;
  if (maximum !== undefined) return `máximo de ${maximum} cm`;
  return null;
}

export function GraphicQuoteConfigurator({ service }: GraphicQuoteConfiguratorProps) {
  const router = useRouter();
  const saveQuoteDraft = useCartStore((state) => state.saveQuoteDraft);
  const clearQuoteDraft = useCartStore((state) => state.clearQuoteDraft);
  const [fieldValues, setFieldValues] = useState<FieldValue[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [dimensions, setDimensions] = useState<PricingDimensions>({});
  const [bookletPaddingApproved, setBookletPaddingApproved] = useState(false);
  const [artworkBleedAcknowledged, setArtworkBleedAcknowledged] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileItem[]>([]);
  const [bindingFileIds, setBindingFileIds] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [restoredDraft, setRestoredDraft] = useState(false);
  const [createdWithoutNavigation, setCreatedWithoutNavigation] = useState<QuoteResponse['data']>();
  const submissionKeyRef = useRef<string | null>(null);

  const invalidateSubmission = () => {
    submissionKeyRef.current = null;
    if (Object.keys(errors).length > 0) setErrors({});
  };

  useEffect(() => {
    let active = true;
    const restore = () => {
      if (!active) return;
      const draft = useCartStore.getState().quoteDrafts[service.id];
      if (draft) {
        setFieldValues(normalizeDependentFieldValues(service, draft.fieldValues));
        setQuantity(draft.quantity);
        setDimensions(draft.dimensions);
        setBookletPaddingApproved(draft.bookletPaddingApproved);
        setArtworkBleedAcknowledged(draft.artworkBleedAcknowledged);
        setRestoredDraft(true);
      }
      setDraftReady(true);
    };
    if (useCartStore.persist.hasHydrated()) restore();
    else {
      const unsubscribe = useCartStore.persist.onFinishHydration(restore);
      return () => {
        active = false;
        unsubscribe();
      };
    }
    return () => { active = false; };
  }, [service]);

  const pageCount = uploadedFiles.reduce((total, file) => total + file.pageCount, 0);

  useEffect(() => {
    if (!draftReady) return;
    const hasRecoverableContent = restoredDraft
      || fieldValues.length > 0
      || quantity !== 1
      || Object.keys(dimensions).length > 0
      || bookletPaddingApproved
      || artworkBleedAcknowledged
      || pageCount > 0;
    if (!hasRecoverableContent) return;
    saveQuoteDraft({
      serviceId: service.id,
      serviceSlug: service.slug,
      serviceName: service.name,
      imageUrl: service.imageUrl,
      fieldValues,
      pageCount: Math.max(1, pageCount),
      quantity,
      dimensions,
      bookletPaddingApproved,
      artworkBleedAcknowledged,
    });
  }, [
    artworkBleedAcknowledged,
    bookletPaddingApproved,
    dimensions,
    draftReady,
    fieldValues,
    pageCount,
    quantity,
    restoredDraft,
    saveQuoteDraft,
    service.id,
    service.imageUrl,
    service.name,
    service.slug,
  ]);

  const selectedByFieldId = useMemo(
    () => selectedValuesByFieldId(service, fieldValues),
    [fieldValues, service],
  );
  const fieldOptionAvailability = useMemo(() => new Map(service.fields.map((field) => [
    field.id,
    resolveFieldOptionAvailability(
      service.fieldOptionDependencies,
      selectedByFieldId,
      field.id,
      { requireCompletePathMatch: service.technicalRequirements.requireCompleteCompatibility },
    ),
  ])), [selectedByFieldId, service]);

  const updateFieldValue = (fieldKey: string, value: FieldValue) => {
    invalidateSubmission();
    setFieldValues((current) => normalizeDependentFieldValues(
      service,
      [...current.filter((field) => field.fieldKey !== fieldKey), value],
    ));
  };

  const renderField = (field: ServiceField) => {
    const availability = fieldOptionAvailability.get(field.id);
    const checkboxUnavailable = field.fieldType === 'checkbox'
      && availability?.isRestricted
      && !availability.allowedOptionValues.has('true');
    if (checkboxUnavailable) {
      return (
        <div key={field.key} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong>{field.label}:</strong> indisponível para as opções escolhidas.
        </div>
      );
    }
    const resolvedField = availability?.isRestricted
      ? { ...field, options: field.options.filter((option) => availability.allowedOptionValues.has(option.value)) }
      : field;
    const props = {
      field: resolvedField,
      value: fieldValues.find((value) => value.fieldKey === field.key),
      onChange: (value: FieldValue) => updateFieldValue(field.key, value),
      ...(errors[field.key] ? { error: errors[field.key] } : {}),
    };
    const input = field.fieldType === 'select' ? <SelectField {...props} />
      : field.fieldType === 'radio' ? <RadioField {...props} />
        : field.fieldType === 'number' ? <NumberField {...props} />
          : field.fieldType === 'text' ? <TextField {...props} />
            : field.fieldType === 'textarea' ? <TextareaField {...props} />
              : field.fieldType === 'checkbox' ? <CheckboxField {...props} />
                : null;
    return (
      <div key={field.key} className="space-y-1">
        {input}
        {availability?.isRestricted && resolvedField.options.length > 0 && (
          <p className="text-xs font-medium text-slate-500">Opções filtradas conforme as escolhas anteriores.</p>
        )}
      </div>
    );
  };

  const validate = (): boolean => {
    const next: FormErrors = {};
    for (const field of service.fields) {
      if (!field.isRequired) continue;
      const availability = fieldOptionAvailability.get(field.id);
      if (field.fieldType === 'checkbox' && availability?.isRestricted
          && !availability.allowedOptionValues.has('true')) continue;
      const selected = fieldValues.find((value) => value.fieldKey === field.key);
      if (!selected || selected.value === '' || selected.value === false) next[field.key] = 'Campo obrigatório';
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100_000_000) {
      next.quantity = 'Informe uma quantidade válida.';
    }
    if (uploadedFiles.length === 0) next.files = 'Anexe ao menos um arquivo.';

    const requirements = service.technicalRequirements;
    if (pageCount > 0 && ((requirements.minPages !== undefined && pageCount < requirements.minPages)
        || (requirements.maxPages !== undefined && pageCount > requirements.maxPages))) {
      next.files = 'A quantidade de páginas está fora dos limites deste serviço.';
    }
    if (requirements.kind === 'booklet' && uploadedFiles.length > 0) {
      const multiple = requirements.pageMultiple ?? 4;
      const needsPadding = pageCount % multiple !== 0;
      if (needsPadding && !requirements.allowBlankPagePadding) {
        next.booklet = `O livreto precisa ter páginas em múltiplos de ${multiple}.`;
      } else if (needsPadding && requirements.requiresCustomerApprovalForPadding && !bookletPaddingApproved) {
        next.booklet = 'Confirme a inclusão de páginas técnicas em branco.';
      }
    }
    if (requirements.kind === 'square_meter') {
      if (!dimensions.widthCm || !dimensions.heightCm) next.dimensions = 'Informe largura e altura.';
      else if ((requirements.minWidthCm !== undefined && dimensions.widthCm < requirements.minWidthCm)
          || (requirements.maxWidthCm !== undefined && dimensions.widthCm > requirements.maxWidthCm)
          || (requirements.minHeightCm !== undefined && dimensions.heightCm < requirements.minHeightCm)
          || (requirements.maxHeightCm !== undefined && dimensions.heightCm > requirements.maxHeightCm)) {
        next.dimensions = 'As dimensões estão fora dos limites informados.';
      }
    }
    if (requirements.kind === 'linear_meter' && !dimensions.lengthCm) next.dimensions = 'Informe o comprimento.';
    if (requirements.kind === 'print_run'
        && requirements.requiresArtworkBleedAcknowledgement
        && !artworkBleedAcknowledged) next.bleed = 'Confirme a ciência sobre sangria e margem segura.';
    if (customerName.trim().length < 2) next.customerName = 'Informe seu nome.';
    if (digitsOnly(customerPhone).length < 10) next.customerPhone = 'Informe um telefone válido.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())) next.guestEmail = 'Informe um e-mail válido.';
    if (!privacyAcknowledged) next.privacy = 'Confirme a ciência sobre o uso temporário dos arquivos.';

    setErrors(next);
    if (Object.keys(next).length > 0) {
      requestAnimationFrame(() => document.getElementById('quote-form-errors')?.focus());
      return false;
    }
    return true;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    setErrors({});
    const idempotencyKey = submissionKeyRef.current ?? crypto.randomUUID();
    submissionKeyRef.current = idempotencyKey;
    try {
      const response = await fetch('/api/graphic-quote-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey,
          items: [{
            serviceId: service.id,
            fieldValues: fieldValues.map(({ fieldKey, value }) => ({ fieldKey, value })),
            quantity,
            fileIds: uploadedFiles.map((file) => file.fileId),
            bindingFileIds,
            dimensions,
            bookletPaddingApproved,
            artworkBleedAcknowledged,
          }],
          customerName: customerName.trim(),
          customerPhone: digitsOnly(customerPhone),
          guestEmail: guestEmail.trim().toLowerCase(),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        }),
      });
      const result = await response.json() as QuoteResponse;
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || 'Não foi possível registrar a solicitação.');
      }
      clearQuoteDraft(service.id);
      const confirmation = {
        requestId: result.data.requestId,
        protocol: result.data.protocol,
        requestCode: result.data.requestCode,
        whatsappUrl: result.data.whatsappUrl,
        whatsappMessage: result.data.whatsappMessage,
        createdAt: new Date().toISOString(),
      };
      try {
        sessionStorage.setItem(GRAPHIC_QUOTE_CONFIRMATION_KEY, JSON.stringify(confirmation));
        router.push('/solicitacao-enviada');
      } catch {
        setCreatedWithoutNavigation(result.data);
      }
    } catch (caught) {
      setErrors({ submit: caught instanceof Error ? caught.message : 'Não foi possível registrar a solicitação.' });
      requestAnimationFrame(() => document.getElementById('quote-form-errors')?.focus());
    } finally {
      setIsSubmitting(false);
    }
  };

  if (createdWithoutNavigation) {
    return (
      <GraphicQuoteSuccess
        requestId={createdWithoutNavigation.requestId}
        requestCode={createdWithoutNavigation.requestCode}
        protocol={createdWithoutNavigation.protocol}
        whatsappUrl={createdWithoutNavigation.whatsappUrl}
        whatsappMessage={createdWithoutNavigation.whatsappMessage}
      />
    );
  }

  const selectedSummary = fieldValues
    .filter((field) => field.value !== '' && field.value !== false)
    .map((field) => `${field.label}: ${field.selectedOption?.label ?? (field.value === true ? 'Sim' : String(field.value))}`);
  const bookletNeedsPadding = service.technicalRequirements.kind === 'booklet'
    && pageCount > 0
    && pageCount % (service.technicalRequirements.pageMultiple ?? 4) !== 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
      <header className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="grid md:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b4232d]">Atendimento gráfico personalizado</p>
            <h1 className="mt-2 text-3xl font-extrabold text-[#13233b] sm:text-4xl">{service.name}</h1>
            <p className="mt-3 max-w-2xl leading-7 text-slate-600">
              {service.description || 'Escolha os detalhes, envie os arquivos e receba o orçamento diretamente da equipe JK Copycenter.'}
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-bold text-[#0d2b5c]">
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Valor informado após análise humana
            </div>
          </div>
          <div className="relative min-h-52 bg-[#0d2b5c]">
            {service.imageUrl ? (
              <img src={service.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="flex h-full min-h-52 items-center justify-center text-[#9ed0ff]">
                <FileText className="h-20 w-20" aria-hidden="true" />
              </div>
            )}
          </div>
        </div>
      </header>

      {restoredDraft && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
          Recuperamos suas escolhas anteriores. Por segurança, os arquivos precisam ser selecionados novamente.
        </div>
      )}

      <div id="quote-form-errors" tabIndex={-1} aria-live="assertive">
        {Object.keys(errors).length > 0 && (
          <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
            <div><strong>Revise os campos destacados.</strong>{errors.submit && <p className="mt-1">{errors.submit}</p>}</div>
          </div>
        )}
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="space-y-6">
          <section aria-labelledby="quote-options-title" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-6 flex items-start gap-3">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-[#0d2b5c] font-extrabold text-white">1</span>
              <div><h2 id="quote-options-title" className="text-xl font-extrabold text-[#13233b]">Escolha os detalhes</h2><p className="mt-1 text-sm text-slate-600">As combinações incompatíveis são removidas conforme suas escolhas.</p></div>
            </div>
            {service.fields.length > 0 ? (
              <div className="grid gap-5 sm:grid-cols-2">{service.fields.map(renderField)}</div>
            ) : (
              <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Este serviço não possui opções adicionais.</p>
            )}
            <div className="mt-6 max-w-xs">
              <label htmlFor="quote-quantity" className="text-sm font-semibold text-slate-800">Quantidade de cópias ou unidades *</label>
              <input id="quote-quantity" type="number" min="1" max="100000000" step="1" value={quantity} onChange={(event) => { invalidateSubmission(); setQuantity(Number(event.target.value)); }} aria-invalid={Boolean(errors.quantity)} aria-describedby={errors.quantity ? 'quote-quantity-error' : undefined} className={`mt-1.5 w-full rounded-lg border px-3.5 py-2.5 text-sm font-medium text-slate-900 shadow-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600 ${errors.quantity ? 'border-red-500 bg-red-50' : 'border-slate-300 bg-white'}`} />
              {errors.quantity && <p id="quote-quantity-error" className="mt-1 text-xs font-medium text-red-600">{errors.quantity}</p>}
            </div>
          </section>

          <section aria-labelledby="quote-files-title" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-6 flex items-start gap-3">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-[#0d2b5c] font-extrabold text-white">2</span>
              <div><h2 id="quote-files-title" className="text-xl font-extrabold text-[#13233b]">Envie os arquivos</h2><p className="mt-1 text-sm text-slate-600">Os anexos ficam no ambiente seguro do site; o WhatsApp recebe somente o resumo.</p></div>
            </div>
            <FileUploadDropzone
              mode="manual_quote"
              files={uploadedFiles}
              onFilesChange={(files) => {
                invalidateSubmission();
                setUploadedFiles(files);
                setBindingFileIds((current) => current.filter((fileId) => files.some((file) => file.fileId === fileId)));
              }}
              onPageCountUpdate={() => undefined}
              bindingAvailable={service.bindingAvailable}
              bindingFileIds={bindingFileIds}
              onBindingFileIdsChange={(fileIds) => { invalidateSubmission(); setBindingFileIds(fileIds); }}
              {...(service.technicalRequirements.kind === 'booklet' ? {
                acceptedExtensions: ['.pdf'],
                maxFiles: 1,
                requirementsText: 'Envie um único PDF completo, com capa e miolo na ordem final. A contagem será conferida no servidor.',
              } : {})}
            />
            {errors.files && <p id="quote-files-error" className="mt-3 text-sm font-medium text-red-600">{errors.files}</p>}

            {service.technicalRequirements.kind === 'square_meter' && (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-4 flex items-center gap-2 font-bold text-slate-900"><Ruler className="h-5 w-5 text-blue-700" aria-hidden="true" /> Dimensões finais</div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-800">Largura (cm) *<input type="text" inputMode="decimal" value={dimensions.widthCm ?? ''} onChange={(event) => { invalidateSubmission(); setDimensions((current) => ({ ...current, widthCm: positiveNumber(event.target.value) })); }} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5" /><span className="mt-1 block text-xs font-normal text-slate-500">{dimensionHint(service.technicalRequirements.minWidthCm, service.technicalRequirements.maxWidthCm)}</span></label>
                  <label className="text-sm font-semibold text-slate-800">Altura (cm) *<input type="text" inputMode="decimal" value={dimensions.heightCm ?? ''} onChange={(event) => { invalidateSubmission(); setDimensions((current) => ({ ...current, heightCm: positiveNumber(event.target.value) })); }} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5" /><span className="mt-1 block text-xs font-normal text-slate-500">{dimensionHint(service.technicalRequirements.minHeightCm, service.technicalRequirements.maxHeightCm)}</span></label>
                </div>
                {service.technicalRequirements.validateUploadedPdfDimensions && <p className="mt-3 text-xs text-slate-600">Quando houver metadados confiáveis no PDF, a equipe comparará as dimensões informadas com o arquivo.</p>}
                {errors.dimensions && <p className="mt-2 text-sm font-medium text-red-600">{errors.dimensions}</p>}
              </div>
            )}

            {service.technicalRequirements.kind === 'linear_meter' && (
              <div className="mt-6 max-w-xs"><label className="text-sm font-semibold text-slate-800">Comprimento (cm) *<input type="text" inputMode="decimal" value={dimensions.lengthCm ?? ''} onChange={(event) => { invalidateSubmission(); setDimensions({ lengthCm: positiveNumber(event.target.value) }); }} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5" /></label>{errors.dimensions && <p className="mt-2 text-sm font-medium text-red-600">{errors.dimensions}</p>}</div>
            )}

            {bookletNeedsPadding && (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                <p>O arquivo tem {pageCount} páginas. Este livreto usa múltiplos de {service.technicalRequirements.pageMultiple ?? 4}.</p>
                {service.technicalRequirements.allowBlankPagePadding && service.technicalRequirements.requiresCustomerApprovalForPadding && (
                  <label className="mt-3 flex cursor-pointer items-start gap-3 font-semibold"><input type="checkbox" checked={bookletPaddingApproved} onChange={(event) => { invalidateSubmission(); setBookletPaddingApproved(event.target.checked); }} className="mt-0.5 h-4 w-4 rounded border-amber-400 text-blue-700" />Autorizo completar o arquivo com páginas técnicas em branco.</label>
                )}
                {errors.booklet && <p className="mt-2 font-semibold text-red-700">{errors.booklet}</p>}
              </div>
            )}

            {service.technicalRequirements.kind === 'print_run' && service.technicalRequirements.requiresArtworkBleedAcknowledgement && (
              <div className="mt-5"><label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-950"><input type="checkbox" checked={artworkBleedAcknowledged} onChange={(event) => { invalidateSubmission(); setArtworkBleedAcknowledged(event.target.checked); }} className="mt-0.5 h-4 w-4 rounded border-amber-400 text-blue-700" />Estou ciente de que a arte será analisada quanto à sangria e à margem segura antes da produção.</label>{errors.bleed && <p className="mt-2 text-sm font-medium text-red-600">{errors.bleed}</p>}</div>
            )}
          </section>

          <section aria-labelledby="quote-contact-title" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-6 flex items-start gap-3"><span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-[#0d2b5c] font-extrabold text-white">3</span><div><h2 id="quote-contact-title" className="text-xl font-extrabold text-[#13233b]">Como podemos falar com você?</h2><p className="mt-1 text-sm text-slate-600">Usaremos estes dados para identificar e responder esta solicitação.</p></div></div>
            <div className="grid gap-5 sm:grid-cols-2">
              <label htmlFor="quote-customer-name" className="text-sm font-semibold text-slate-800 sm:col-span-2">Nome *<span className={`mt-1.5 flex items-center gap-2 rounded-lg border bg-white px-3.5 ${errors.customerName ? 'border-red-500' : 'border-slate-300'}`}><UserRound className="h-4 w-4 text-slate-400" aria-hidden="true" /><input id="quote-customer-name" type="text" autoComplete="name" value={customerName} onChange={(event) => { invalidateSubmission(); setCustomerName(event.target.value); }} aria-invalid={Boolean(errors.customerName)} aria-describedby={errors.customerName ? 'quote-customer-name-error' : undefined} className="min-h-11 w-full border-0 p-0 text-sm focus:ring-0" /></span>{errors.customerName && <span id="quote-customer-name-error" className="mt-1 block text-xs text-red-600">{errors.customerName}</span>}</label>
              <label htmlFor="quote-customer-phone" className="text-sm font-semibold text-slate-800">WhatsApp *<input id="quote-customer-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(35) 99999-9999" value={customerPhone} onChange={(event) => { invalidateSubmission(); setCustomerPhone(formatBrazilianPhone(event.target.value)); }} aria-invalid={Boolean(errors.customerPhone)} aria-describedby={errors.customerPhone ? 'quote-customer-phone-error' : undefined} className={`mt-1.5 min-h-11 w-full rounded-lg border bg-white px-3.5 text-sm ${errors.customerPhone ? 'border-red-500' : 'border-slate-300'}`} />{errors.customerPhone && <span id="quote-customer-phone-error" className="mt-1 block text-xs text-red-600">{errors.customerPhone}</span>}</label>
              <label htmlFor="quote-customer-email" className="text-sm font-semibold text-slate-800">E-mail *<input id="quote-customer-email" type="email" autoComplete="email" placeholder="voce@exemplo.com" value={guestEmail} onChange={(event) => { invalidateSubmission(); setGuestEmail(event.target.value); }} aria-invalid={Boolean(errors.guestEmail)} aria-describedby={errors.guestEmail ? 'quote-customer-email-error' : undefined} className={`mt-1.5 min-h-11 w-full rounded-lg border bg-white px-3.5 text-sm ${errors.guestEmail ? 'border-red-500' : 'border-slate-300'}`} />{errors.guestEmail && <span id="quote-customer-email-error" className="mt-1 block text-xs text-red-600">{errors.guestEmail}</span>}</label>
              <label className="text-sm font-semibold text-slate-800 sm:col-span-2">Observações para a equipe <textarea maxLength={500} rows={4} value={notes} onChange={(event) => { invalidateSubmission(); setNotes(event.target.value); }} placeholder="Prazo, acabamento, retirada ou outra informação importante." className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm" /><span className="mt-1 block text-right text-xs font-normal text-slate-500">{notes.length}/500</span></label>
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24">
          <section aria-labelledby="quote-review-title" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-3"><ClipboardCheck className="h-6 w-6 text-blue-700" aria-hidden="true" /><h2 id="quote-review-title" className="text-xl font-extrabold text-[#13233b]">Revise a solicitação</h2></div>
            <dl className="mt-5 space-y-4 text-sm">
              <div><dt className="font-semibold text-slate-500">Serviço</dt><dd className="mt-1 font-bold text-slate-900">{service.name}</dd></div>
              <div><dt className="font-semibold text-slate-500">Quantidade</dt><dd className="mt-1 font-bold text-slate-900">{quantity || '—'}</dd></div>
              <div><dt className="font-semibold text-slate-500">Opções</dt><dd className="mt-1 space-y-1 text-slate-800">{selectedSummary.length > 0 ? selectedSummary.map((item) => <span key={item} className="block">{item}</span>) : 'Nenhuma selecionada'}</dd></div>
              <div><dt className="font-semibold text-slate-500">Arquivos</dt><dd className="mt-1 space-y-1 text-slate-800">{uploadedFiles.length > 0 ? uploadedFiles.map((file) => <span key={file.fileId} className="block break-words">{file.originalName} · {file.pageCount} pág.</span>) : 'Nenhum anexado'}</dd></div>
            </dl>

            <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
              <div className="flex items-center gap-2 font-bold"><ShieldCheck className="h-5 w-5" aria-hidden="true" /> Privacidade dos arquivos</div>
              <p className="mt-2">Os anexos são usados somente para análise e eventual produção. Eles não são enviados pelo link do WhatsApp.</p>
              <label className="mt-3 flex cursor-pointer items-start gap-3 font-semibold"><input type="checkbox" checked={privacyAcknowledged} onChange={(event) => { invalidateSubmission(); setPrivacyAcknowledged(event.target.checked); }} aria-invalid={Boolean(errors.privacy)} aria-describedby={errors.privacy ? 'quote-privacy-error' : undefined} className="mt-1 h-4 w-4 rounded border-blue-400 text-blue-700" />Estou ciente do uso temporário para análise/produção e da eliminação física em 15 dias após conclusão, cancelamento ou decisão final.</label>
              <p className="mt-2 text-xs leading-5 text-blue-900">Não envie conteúdo ilegal ou para o qual não tenha autorização. Consulte o <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="font-bold underline">Aviso de Privacidade</a>.</p>
              {errors.privacy && <p id="quote-privacy-error" className="mt-2 font-semibold text-red-700">{errors.privacy}</p>}
            </div>

            <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
              <strong>Nenhuma cobrança acontece agora.</strong> O protocolo é criado antes de você abrir o WhatsApp; a equipe analisará os arquivos e informará o orçamento.
            </div>
            <button type="submit" disabled={isSubmitting} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#b4232d] px-5 py-4 text-base font-extrabold text-white shadow-sm transition-colors hover:bg-[#951c25] disabled:cursor-wait disabled:opacity-70">
              {isSubmitting ? <><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Registrando…</> : <><MessageCircle className="h-5 w-5" aria-hidden="true" /> Solicitar orçamento</>}
            </button>
            <p className="mt-3 text-center text-xs leading-5 text-slate-500">Depois do registro, você escolhe quando abrir ou copiar a mensagem do WhatsApp.</p>
          </section>
        </aside>
      </div>
    </form>
  );
}
