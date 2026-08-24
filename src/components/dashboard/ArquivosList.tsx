'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { FileCard } from './FileCard';
import { 
  Search, 
  RefreshCcw, 
  Printer, 
  FolderOpen,
  Filter
} from 'lucide-react';
import Link from 'next/link';

export interface ArquivoItem {
  id: string;
  original_name: string;
  file_type: string;
  size_bytes: number;
  page_count: number;
  created_at: string;
  expires_at: string | null;
  deleted_at: string | null;
}

export function ArquivosList({ files }: { files: ArquivoItem[] }) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'pdf' | 'office' | 'images'>('all');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const activeFiles = useMemo(() => {
    return files.filter((f) => !f.deleted_at);
  }, [files]);

  const filteredFiles = useMemo(() => {
    return activeFiles.filter((f) => {
      const matchesSearch = f.original_name.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      const ext = f.file_type.toLowerCase().replace('.', '');
      if (typeFilter === 'pdf') return ext === 'pdf';
      if (typeFilter === 'office') return ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext);
      if (typeFilter === 'images') return ['png', 'jpg', 'jpeg', 'webp', 'svg', 'ai', 'psd', 'cdr'].includes(ext);
      return true;
    });
  }, [activeFiles, searchTerm, typeFilter]);

  const handleDownload = async (id: string): Promise<string | null> => {
    try {
      const res = await fetch(`/api/dashboard/arquivos/${id}/download`);
      const data = await res.json();
      if (data && data.success && typeof data.url === 'string') {
        return data.url;
      }
      return null;
    } catch {
      return null;
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente remover este arquivo? Ele não poderá mais ser reutilizado em novos pedidos.')) {
      return;
    }
    
    setIsDeleting(id);
    try {
      const response = await fetch(`/api/dashboard/arquivos/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Não foi possível excluir o arquivo.');
      router.refresh();
    } catch {
      alert('Erro ao excluir arquivo. Tente novamente mais tarde.');
    } finally {
      setIsDeleting(null);
    }
  };

  if (activeFiles.length === 0) {
    return (
      <div className="text-center p-12 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
        <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <FolderOpen className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Nenhum arquivo encontrado</h3>
        <p className="mt-1.5 text-sm text-slate-500 max-w-md mx-auto">
          Quando você realiza um pedido na JK Copycenter, os arquivos enviados são salvos aqui temporariamente para sua comodidade.
        </p>
        <Link
          href="/grafica"
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-blue-600/20 transition-all"
        >
          <Printer className="w-4 h-4" />
          Fazer Pedido e Enviar Arquivo
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar arquivo por nome..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 px-1">
            <Filter className="w-3 h-3" /> Tipo:
          </span>
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              typeFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Todos ({activeFiles.length})
          </button>
          <button
            onClick={() => setTypeFilter('pdf')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              typeFilter === 'pdf'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            PDF
          </button>
          <button
            onClick={() => setTypeFilter('office')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              typeFilter === 'office'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Office
          </button>
          <button
            onClick={() => setTypeFilter('images')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              typeFilter === 'images'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Imagens & Vetores
          </button>
        </div>
      </div>

      {/* Files List */}
      {filteredFiles.length === 0 ? (
        <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl text-slate-500 text-xs">
          Nenhum arquivo encontrado para a busca &quot;{searchTerm}&quot;.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFiles.map((file) => {
            const isExpired = file.expires_at ? new Date(file.expires_at) < new Date() : false;

            return (
              <div key={file.id} className="relative">
                <FileCard
                  id={file.id}
                  name={file.original_name}
                  type={file.file_type}
                  sizeBytes={file.size_bytes}
                  pageCount={file.page_count}
                  uploadedAt={file.created_at}
                  expiresAt={file.expires_at}
                  onDownload={handleDownload}
                  onDelete={handleDelete}
                  isDeleting={isDeleting === file.id}
                />

                {!isExpired && (
                  <div className="hidden sm:block absolute bottom-4 right-28">
                    <Link
                      href="/grafica"
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-xl transition-colors border border-blue-200/50 shadow-xs"
                      title="Utilizar arquivo em uma nova impressão no catálogo"
                    >
                      <RefreshCcw className="w-3 h-3" />
                      <span>Reutilizar</span>
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
