'use client';

import { FormEvent, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';

const requestTypes = [
  ['confirmation_access', 'Confirmar ou acessar meus dados'],
  ['correction', 'Corrigir dados'],
  ['deletion_anonymization', 'Eliminar ou anonimizar dados'],
  ['sharing_information', 'Saber com quem os dados foram compartilhados'],
  ['consent_revocation', 'Revogar um consentimento'],
  ['opposition', 'Apresentar oposição'],
  ['other', 'Outro assunto de privacidade'],
] as const;

export function PrivacyRequestForm() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [protocol, setProtocol] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/privacidade/solicitacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(form.entries())),
    }).catch(() => null);
    const result = response ? await response.json().catch(() => null) : null;
    if (!response?.ok || !result?.protocol) {
      setError(result?.error || 'Não foi possível registrar. Tente novamente ou fale conosco pelo WhatsApp.');
      setSubmitting(false);
      return;
    }
    setProtocol(result.protocol);
    setSubmitting(false);
  }

  if (protocol) return <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950"><CheckCircle2 className="h-7 w-7" /><h2 className="mt-3 text-xl font-black">Solicitação registrada</h2><p className="mt-2 text-sm leading-6">Guarde o protocolo <strong>{protocol}</strong>. Antes de fornecer dados, a equipe poderá confirmar sua identidade por um meio proporcional ao pedido.</p></div>;

  return (
    <form onSubmit={submit} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="hidden" aria-hidden="true"><label>Site<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <label className="block text-sm font-bold text-slate-800">O que você deseja solicitar?<select name="requestType" required defaultValue="confirmation_access" className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3">{requestTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="block text-sm font-bold text-slate-800">Nome<input name="name" required minLength={2} maxLength={120} autoComplete="name" className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-3" /></label>
      <div className="grid gap-5 sm:grid-cols-2"><label className="block text-sm font-bold text-slate-800">E-mail<input name="email" type="email" maxLength={254} autoComplete="email" className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-3" /></label><label className="block text-sm font-bold text-slate-800">Telefone/WhatsApp<input name="phone" type="tel" maxLength={20} autoComplete="tel" className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-3" /></label></div>
      <p className="-mt-2 text-xs leading-5 text-slate-500">Informe ao menos um canal para retorno. Não envie senha, documento completo ou arquivo sensível neste formulário.</p>
      <label className="block text-sm font-bold text-slate-800">Detalhes opcionais<textarea name="details" maxLength={1000} rows={5} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3" /></label>
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-800">{error}</p>}
      <button disabled={submitting} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0d2b5c] px-5 font-bold text-white hover:bg-[#163f77] disabled:opacity-60">{submitting && <Loader2 className="h-5 w-5 animate-spin" />}Registrar solicitação</button>
    </form>
  );
}
