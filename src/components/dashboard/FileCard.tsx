'use client';

import React, { useState } from 'react';
import { 
  FileText, 
  Download, 
  Clock, 
  AlertTriangle, 
  Loader2,
  FileCode,
  FileImage,
  Layers
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface FileCardProps {
  id: string;
  name: string;
  type: string;
  sizeBytes: number;
  pageCount: number;
  uploadedAt: string;
  expiresAt: string | null;
  onDownload: (id: string) => Promise<string | null>;
  onDelete?: (id: string) => void;
  isDeleting?: boolean;
}

function formatBytes(bytes: number, decimals = 1): string {
  if (!+bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function getFileTypeDetails(type: string) {
  const ext = type.toLowerCase().replace('.', '');
  if (ext === 'pdf') {
    return {
      label: 'PDF',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
      iconClass: 'bg-rose-100 text-rose-600',
      icon: FileText,
    };
  }
  if (['doc', 'docx'].includes(ext)) {
    return {
      label: 'WORD',
      badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
      iconClass: 'bg-sky-100 text-sky-600',
      icon: FileText,
    };
  }
  if (['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext)) {
    return {
      label: ext.toUpperCase(),
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      iconClass: 'bg-emerald-100 text-emerald-600',
      icon: FileImage,
    };
  }
  if (['ai', 'psd', 'cdr', 'eps'].includes(ext)) {
    return {
      label: ext.toUpperCase(),
      badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
      iconClass: 'bg-purple-100 text-purple-600',
      icon: Layers,
    };
  }
  return {
    label: ext.toUpperCase() || 'ARQ',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    iconClass: 'bg-slate-100 text-slate-600',
    icon: FileCode,
  };
}

export function FileCard({
  id,
  name,
  type,
  sizeBytes,
  pageCount,
  uploadedAt,
  expiresAt,
  onDownload,
  onDelete,
  isDeleting = false,
}: FileCardProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typeConfig = getFileTypeDetails(type);
  const IconComponent = typeConfig.icon;

  const handleDownload = async () => {
    setIsDownloading(true);
    setError(null);
    try {
      const url = await onDownload(id);
      if (url) {
        window.open(url, '_blank');
      } else {
        setError('Não foi possível gerar o link de download.');
      }
    } catch {
      setError('Erro ao baixar o arquivo.');
    } finally {
      setIsDownloading(false);
    }
  };

  const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;
  const daysToExpire = expiresAt ? differenceInDays(new Date(expiresAt), new Date()) : null;
  const showWarning = daysToExpire !== null && daysToExpire > 0 && daysToExpire <= 7;

  return (
    <div className="group bg-white border border-slate-200/90 hover:border-blue-300 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs hover:shadow-md transition-all duration-200">
      {/* File Info */}
      <div className="flex items-start gap-3.5 min-w-0 flex-1">
        <div className={`w-12 h-12 rounded-xl ${typeConfig.iconClass} flex items-center justify-center flex-shrink-0 shadow-xs`}>
          <IconComponent className="w-6 h-6" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-bold text-slate-900 truncate max-w-md" title={name}>
              {name}
            </h4>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${typeConfig.badgeClass}`}>
              {typeConfig.label}
            </span>
          </div>

          <div className="mt-1.5 flex items-center gap-2.5 text-xs text-slate-500 flex-wrap">
            <span className="font-semibold text-slate-700">{formatBytes(sizeBytes)}</span>
            <span>&bull;</span>
            <span>{pageCount} {pageCount === 1 ? 'página' : 'páginas'}</span>
            <span>&bull;</span>
            <span className="flex items-center gap-1 text-slate-400">
              <Clock className="w-3 h-3" />
              {format(new Date(uploadedAt), "dd/MM/yyyy", { locale: ptBR })}
            </span>
          </div>

          {/* Expiration alert */}
          {isExpired ? (
            <div className="mt-2 text-xs font-semibold text-rose-600 bg-rose-50 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md border border-rose-200">
              Arquivo expirado
            </div>
          ) : showWarning ? (
            <div className="mt-2 text-xs font-semibold text-amber-700 bg-amber-50 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md border border-amber-200">
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              Expira em {daysToExpire} {daysToExpire === 1 ? 'dia' : 'dias'}
            </div>
          ) : null}

          {error && <p className="mt-1.5 text-xs text-rose-600 font-medium">{error}</p>}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 self-end sm:self-center">
        {onDelete && (
          <button
            onClick={() => onDelete(id)}
            disabled={isDeleting}
            className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors disabled:opacity-50"
            title="Excluir arquivo"
          >
            {isDeleting ? 'Excluindo...' : 'Excluir'}
          </button>
        )}

        <button
          onClick={handleDownload}
          disabled={isDownloading || isExpired}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
          title="Baixar arquivo original"
        >
          {isDownloading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
          <span>Baixar</span>
        </button>
      </div>
    </div>
  );
}
