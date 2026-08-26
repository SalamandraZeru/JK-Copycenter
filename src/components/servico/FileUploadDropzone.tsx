'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Trash2, Loader2, Sparkles } from 'lucide-react';

export interface UploadedFileItem {
  fileId: string;
  originalName: string;
  sizeBytes: number;
  pageCount: number;
  countMethod: 'exact' | 'estimated' | 'pending_confirmation';
}

interface FileUploadDropzoneProps {
  files: UploadedFileItem[];
  onFilesChange: (files: UploadedFileItem[]) => void;
  onPageCountUpdate: (totalPageCount: number) => void;
  bindingAvailable?: boolean;
  bindingFileIds?: string[];
  onBindingFileIdsChange?: (fileIds: string[]) => void;
}

export function FileUploadDropzone({
  files,
  onFilesChange,
  onPageCountUpdate,
  bindingAvailable = false,
  bindingFileIds = [],
  onBindingFileIdsChange,
}: FileUploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_SIZE_MB = 50;
  const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.pptx', '.png', '.jpg', '.jpeg', '.webp', '.zip', '.rar'];
  const MIME_BY_EXTENSION: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.zip': 'application/zip',
    '.rar': 'application/vnd.rar',
  };

  const handleFileSelection = async (selectedFiles: FileList | File[]) => {
    setUploadError(null);
    const fileArray = Array.from(selectedFiles);

    if (fileArray.length === 0) return;

    setIsUploading(true);

    const newUploadedFiles: UploadedFileItem[] = [...files];

    for (const file of fileArray) {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setUploadError(`O arquivo "${file.name}" excede o tamanho máximo permitido de ${MAX_FILE_SIZE_MB}MB.`);
        continue;
      }

      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        setUploadError(`Formato não suportado para "${file.name}". Formatos aceitos: PDF, DOCX, Imagens (PNG/JPG/WEBP), ZIP e RAR.`);
        continue;
      }

      try {
        const intentResponse = await fetch('/api/upload/intents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originalName: file.name,
            declaredMime: file.type || MIME_BY_EXTENSION[ext],
            sizeBytes: file.size,
          }),
        });
        const intentData = await intentResponse.json();
        if (!intentResponse.ok || !intentData.success || typeof intentData.intentId !== 'string') {
          setUploadError(intentData.error || `Não foi possível autorizar o arquivo "${file.name}".`);
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('intentId', intentData.intentId);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          setUploadError(data.error || `Erro ao processar o arquivo "${file.name}".`);
          continue;
        }

        newUploadedFiles.push({
          fileId: data.fileId,
          originalName: data.originalName || file.name,
          sizeBytes: data.sizeBytes || file.size,
          pageCount: data.pageCount || 1,
          countMethod: data.countMethod || 'exact',
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Falha na conexão ao enviar arquivo';
        setUploadError(`Erro ao enviar "${file.name}": ${msg}`);
      }
    }

    setIsUploading(false);
    onFilesChange(newUploadedFiles);

    const totalPages = newUploadedFiles.reduce((sum, item) => sum + item.pageCount, 0);
    if (totalPages > 0) {
      onPageCountUpdate(totalPages);
    }
  };

  const handleRemoveFile = async (index: number) => {
    const selected = files[index];
    if (selected) {
      await fetch(`/api/upload/${selected.fileId}`, { method: 'DELETE' }).catch(() => undefined);
    }
    const updated = files.filter((_, i) => i !== index);
    onFilesChange(updated);
    if (selected && bindingFileIds.includes(selected.fileId)) {
      onBindingFileIdsChange?.(bindingFileIds.filter((fileId) => fileId !== selected.fileId));
    }

    const totalPages = updated.reduce((sum, item) => sum + item.pageCount, 0);
    onPageCountUpdate(totalPages > 0 ? totalPages : 1);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-blue-600" />
          Anexar Arquivo para Impressão
        </label>
        <span className="text-xs text-slate-500 font-medium">Até {MAX_FILE_SIZE_MB}MB por arquivo</span>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-blue-600 bg-blue-50/70 scale-[1.01]'
            : 'border-slate-300 bg-slate-50/50 hover:bg-slate-100/60 hover:border-slate-400'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.pptx,.png,.jpg,.jpeg,.webp,.zip,.rar"
          onChange={(e) => e.target.files && handleFileSelection(e.target.files)}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center gap-2">
          {isUploading ? (
            <div className="py-3 flex flex-col items-center gap-2 text-blue-600">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-sm font-semibold text-slate-800">
                Analisando e contando páginas automaticamente...
              </p>
              <p className="text-xs text-slate-500">Isso pode levar alguns instantes para PDFs e ZIPs.</p>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-1">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-800">
                Clique para selecionar ou arraste seus arquivos aqui
              </p>
              <p className="text-xs text-slate-500">
                Aceitamos <strong>PDF, DOCX, PPTX, Imagens (PNG/JPG), ZIP e RAR</strong>
              </p>
              <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-xs font-semibold text-blue-700">
                <Sparkles className="w-3.5 h-3.5" />
                Detecção e soma automática de páginas
              </div>
            </>
          )}
        </div>
      </div>

      {uploadError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700 font-medium">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600" />
          <span>{uploadError}</span>
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Arquivos Anexados ({files.length})
          </p>
          <div className="space-y-2">
            {files.map((file, index) => (
              <div
                key={file.fileId || index}
                className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-xs"
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate" title={file.originalName}>
                      {file.originalName}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{(file.sizeBytes / (1024 * 1024)).toFixed(2)} MB</span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1 text-blue-700 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {file.pageCount} {file.pageCount === 1 ? 'página detectada' : 'páginas detectadas'}
                        {file.countMethod !== 'exact' && ' (sujeito à conferência)'}
                      </span>
                    </div>
                    {bindingAvailable && (
                      <label className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={bindingFileIds.includes(file.fileId)}
                          onChange={(event) => {
                            const next = event.target.checked
                              ? [...bindingFileIds, file.fileId]
                              : bindingFileIds.filter((fileId) => fileId !== file.fileId);
                            onBindingFileIdsChange?.(next);
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        Encadernar este arquivo
                      </label>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveFile(index)}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                  title="Remover arquivo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          {bindingAvailable && (
            <p className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800">
              O valor da encadernação é definido automaticamente pela quantidade de páginas detectada em cada arquivo selecionado.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
