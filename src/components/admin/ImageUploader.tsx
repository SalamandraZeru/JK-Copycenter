'use client';
/* eslint-disable @next/next/no-img-element */

import React, { useState, useRef } from 'react';
import { Upload, X, Loader2, Image as ImageIcon, Check } from 'lucide-react';

interface ImageUploaderProps {
  imageUrl: string | null;
  onImageUploaded: (url: string | null) => void;
  label?: string;
  folder?: string;
  aspectRatio?: 'square' | 'wide' | 'auto';
}

export function ImageUploader({
  imageUrl,
  onImageUploaded,
  label = 'Imagem',
  folder = 'catalog',
  aspectRatio = 'square',
}: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Apenas arquivos de imagem são permitidos.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Tamanho máximo permitido: 10MB.');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);

      const res = await fetch('/api/admin/upload-catalog-image', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Erro no envio da imagem.');
      }

      onImageUploaded(data.url);
    } catch (err: any) {
      setError(err?.message || 'Falha ao enviar imagem.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onImageUploaded(null);
  };

  const aspectClass =
    aspectRatio === 'square'
      ? 'aspect-square max-w-[180px]'
      : aspectRatio === 'wide'
      ? 'aspect-[16/9] w-full'
      : 'min-h-[140px] w-full';

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-800">
          {label}
        </label>
      )}

      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center overflow-hidden group ${aspectClass} ${
          imageUrl
            ? 'border-slate-300 bg-slate-50 hover:border-blue-500'
            : 'border-slate-300 hover:border-blue-600 bg-white hover:bg-blue-50/40'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFileSelect(e.target.files[0]);
            }
          }}
        />

        {isUploading ? (
          <div className="flex flex-col items-center justify-center space-y-2 text-blue-600">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-xs font-bold text-slate-700">Enviando imagem...</span>
          </div>
        ) : imageUrl ? (
          <div className="relative w-full h-full flex items-center justify-center">
            <img
              src={imageUrl}
              alt="Preview"
              className="w-full h-full object-contain rounded-xl"
            />
            <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-2">
              <span className="text-white text-xs font-bold bg-black/60 px-2 py-1 rounded-md">
                Alterar
              </span>
              <button
                type="button"
                onClick={handleRemove}
                className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full transition-transform hover:scale-110 shadow-lg"
                title="Remover imagem"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-2 p-2">
            <div className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-blue-100 text-slate-500 group-hover:text-blue-600 flex items-center justify-center transition-colors">
              <Upload className="w-5 h-5" />
            </div>
            <div className="text-xs font-bold text-slate-800 group-hover:text-blue-600">
              Clique ou arraste foto
            </div>
            <div className="text-[10px] text-slate-500 font-medium">PNG, JPG ou WEBP (até 10MB)</div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs font-semibold text-red-600 mt-1">{error}</p>
      )}
    </div>
  );
}
