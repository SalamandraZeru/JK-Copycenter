import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ArquivosList, ArquivoItem } from '@/components/dashboard/ArquivosList';
import Link from 'next/link';
import { FileText, ShieldCheck, Printer } from 'lucide-react';

export default async function ArquivosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data } = await supabase
    .from('order_files')
    .select('id, original_name, file_type, size_bytes, page_count, created_at, expires_at, deleted_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const files: ArquivoItem[] = (data || []).map((file) => ({
    id: String(file.id),
    original_name: String(file.original_name),
    file_type: String(file.file_type || 'pdf'),
    size_bytes: Number(file.size_bytes) || 0,
    page_count: Number(file.page_count) || 1,
    created_at: String(file.created_at),
    expires_at: file.expires_at ? String(file.expires_at) : null,
    deleted_at: file.deleted_at ? String(file.deleted_at) : null,
  }));

  return (
    <div className="max-w-5xl space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-amber-600" />
            Meus Arquivos & Documentos
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Repositório seguro de arquivos enviados para impressão e reprografia.
          </p>
        </div>

        <Link
          href="/grafica"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-blue-600/20 transition-all hover:shadow-lg self-start sm:self-auto"
        >
          <Printer className="w-4 h-4" />
          Imprimir Novo Arquivo
        </Link>
      </div>

      {/* Info Notice Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-white border border-blue-100 flex items-start gap-3 shadow-xs">
        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0 mt-0.5">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div className="text-xs text-slate-600">
          <p className="font-semibold text-slate-900">Armazenamento Seguro e Otimizado</p>
          <p className="mt-0.5 leading-relaxed">
            Seus arquivos permanecem privados durante o prazo de retenção configurado. Cada download exige nova autorização e usa um acesso temporário curto.
          </p>
        </div>
      </div>

      {/* Arquivos List */}
      <ArquivosList files={files} />
    </div>
  );
}
