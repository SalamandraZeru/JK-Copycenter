'use client';
/* eslint-disable @next/next/no-img-element */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCartStore } from '@/lib/cart/store';
import { Trash2, Plus, Minus, ArrowRight, ShoppingBag } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function CarrinhoPage() {
  const router = useRouter();
  const { items, removeItem, updateQuantity } = useCartStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const hasFiles = items.some((item) => item.fileIds.length > 0);
  const requiresFileReupload = items.some((item) => item.requiresFileReupload);

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="bg-white rounded-3xl p-12 border border-slate-200 shadow-sm flex flex-col items-center">
          <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
            <ShoppingBag className="w-10 h-10 text-slate-400" />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Seu carrinho está vazio</h2>
          <p className="text-lg text-slate-600 mb-8 max-w-md">
            Adicione serviços gráficos ou produtos de papelaria para continuar.
          </p>
          <div className="flex gap-4">
            <Link 
              href="/grafica" 
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              Ver Gráfica
            </Link>
            <Link 
              href="/papelaria" 
              className="bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              Ver Papelaria
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Meu Carrinho</h1>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Lista de Itens */}
        <div className="flex-1 space-y-6">
          {items.map((item) => (
            <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col sm:flex-row gap-6 shadow-sm">
              <div className="w-24 h-24 bg-slate-100 rounded-xl overflow-hidden flex-shrink-0 relative">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name || 'Item do carrinho'} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ShoppingBag className="w-8 h-8 text-slate-300" />
                  </div>
                )}
              </div>
              
              <div className="flex-1">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-xl font-bold text-slate-900">{item.name || 'Item selecionado'}</h3>
                  <button 
                    onClick={() => removeItem(item.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remover item"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                
                {item.serviceId && (
                  <div className="text-sm text-slate-600 mb-4 space-y-1">
                    <p>
                      <strong>Configuração:</strong> {item.fieldValues.length > 0 
                        ? item.fieldValues.map((field) => field.fieldKey).join(', ')
                        : 'Padrão'}
                    </p>
                    {item.fileIds.length > 0 && (
                      <p><strong>Arquivos:</strong> {item.fileIds.length} anexados</p>
                    )}
                    {item.requiresFileReupload && (
                      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
                        <p><strong>Reenvio necessário:</strong> por segurança, anexos não ficam salvos após encerrar ou trocar a sessão.</p>
                        <Link href={`/servico/${item.serviceId}`} className="mt-2 inline-block font-semibold text-blue-700 underline">
                          Reconfigurar e reenviar o arquivo
                        </Link>
                      </div>
                    )}
                    <p><strong>Páginas:</strong> conferidas no checkout</p>
                  </div>
                )}

                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
                    <button 
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors"
                      disabled={item.quantity <= 1}
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="px-4 py-2 font-medium text-slate-900 bg-white">
                      {item.quantity}
                    </span>
                    <button 
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <p className="text-right text-sm font-medium text-slate-600">Cotação no checkout</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Resumo do Pedido */}
        <div className="w-full lg:w-96 flex-shrink-0">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sticky top-24 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Resumo do Pedido</h2>
            
            <div className="space-y-4 mb-6">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal ({items.length} itens)</span>
                <span className="font-medium text-slate-900">Recalculado no checkout</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Taxa de Entrega</span>
                <span className="text-sm">Calculada no checkout</span>
              </div>
            </div>
            
            <div className="border-t border-slate-200 pt-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-slate-900">Total Estimado</span>
                <span className="text-right text-sm font-medium text-blue-700">O valor final é confirmado no servidor</span>
              </div>
            </div>

            {hasFiles && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-sm mb-6">
                <strong>Atenção:</strong> Arquivos e valores serão conferidos no checkout. O navegador não define o preço final.
              </div>
            )}

            {requiresFileReupload && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-sm mb-6">
                Reconfigure os itens indicados e envie os arquivos novamente antes de finalizar o pedido.
              </div>
            )}

            <button 
              onClick={() => router.push('/carrinho/checkout')}
              disabled={requiresFileReupload}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg transition-colors mb-4 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Finalizar Pedido <ArrowRight className="w-5 h-5" />
            </button>
            
            <Link 
              href="/grafica"
              className="w-full block text-center py-3 text-slate-600 font-medium hover:bg-slate-50 rounded-xl transition-colors"
            >
              Continuar Comprando
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
