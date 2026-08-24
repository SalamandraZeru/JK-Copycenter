'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { Loader2, Plus, Edit2, Check, X, ShieldAlert } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

const ROLES: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  producao: 'Produção',
  catalogo: 'Catálogo'
};

interface AdminUser {
  id: string;
  name?: string | null;
  full_name?: string | null;
  email?: string | null;
  role: string;
  is_active: boolean;
}

interface UserFormData {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
  is_active?: boolean;
}

export default function UsuariosPage() {
  const { data: users, error, isLoading, mutate } = useSWR<AdminUser[]>('/api/admin/usuarios', fetcher);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<UserFormData>({});
  const [isSaving, setIsSaving] = useState(false);

  const startNew = () => {
    setEditingId('new');
    setFormData({ name: '', email: '', password: '', role: 'producao', is_active: true });
  };

  const startEdit = (user: AdminUser) => {
    setEditingId(user.id);
    setFormData({ 
      name: user.full_name || user.name || '', 
      role: user.role, 
      is_active: user.is_active, 
      password: '' 
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({});
  };

  const handleSave = async () => {
    setIsSaving(true);
    const method = editingId === 'new' ? 'POST' : 'PUT';
    try {
      const payload = editingId === 'new'
        ? formData
        : {
            id: editingId,
            name: formData.name,
            role: formData.role,
            is_active: formData.is_active,
          };
      const res = await fetch('/api/admin/usuarios', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errorData = (await res.json()) as { error?: string };
        throw new Error(errorData.error || 'Erro ao salvar');
      }
      await mutate();
      cancelEdit();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao salvar usuário';
      alert(`Erro: ${msg}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (error && typeof error === 'object' && 'message' in error && String(error.message).includes('403')) {
    return (
      <div className="flex flex-col items-center justify-center p-20 bg-white rounded-3xl border border-red-200 shadow-sm">
        <ShieldAlert className="w-12 h-12 text-red-600 mb-4" />
        <h2 className="text-xl font-bold text-slate-900 mb-2">Acesso Negado</h2>
        <p className="text-slate-600 font-medium">Apenas usuários Super Admin podem acessar esta tela.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-serif">Usuários Administrativos</h1>
          <p className="text-sm font-medium text-slate-600">Gerencie acessos e permissões do painel operacional.</p>
        </div>
        <button 
          onClick={startNew}
          disabled={editingId !== null}
          className="inline-flex items-center gap-2 bg-[#0F2040] hover:bg-[#CC1A1A] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Novo Usuário
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-16 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : error ? (
          <div className="p-16 text-center text-red-600 font-bold">Erro ao carregar usuários.</div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-800 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Usuário</th>
                <th className="px-6 py-4">Permissão (Role)</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {editingId === 'new' && (
                <tr className="bg-blue-50/60">
                  <td className="px-6 py-4 space-y-2">
                    <input 
                      type="text" 
                      required
                      placeholder="Nome Completo" 
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none text-sm" 
                      value={formData.name || ''} 
                      onChange={e => setFormData({...formData, name: e.target.value})} 
                    />
                    <input 
                      type="email" 
                      required
                      placeholder="E-mail de login" 
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none text-sm" 
                      value={formData.email || ''} 
                      onChange={e => setFormData({...formData, email: e.target.value})} 
                    />
                    <input 
                      type="password" 
                      required
                      minLength={8}
                      placeholder="Senha provisória (mín. 8)" 
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none text-sm" 
                      value={formData.password || ''} 
                      onChange={e => setFormData({...formData, password: e.target.value})} 
                    />
                  </td>
                  <td className="px-6 py-4">
                    <select 
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none text-sm cursor-pointer" 
                      value={formData.role || 'producao'} 
                      onChange={e => setFormData({...formData, role: e.target.value})}
                    >
                      {Object.entries(ROLES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formData.is_active ?? true} 
                        onChange={e => setFormData({...formData, is_active: e.target.checked})} 
                        className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-600/20"
                      />
                      <span className="text-sm font-semibold text-slate-800">Ativo</span>
                    </label>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button 
                      onClick={handleSave} 
                      disabled={isSaving} 
                      className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition"
                      title="Salvar"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={cancelEdit} 
                      disabled={isSaving} 
                      className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition"
                      title="Cancelar"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              )}

              {(users || []).map((user) => editingId === user.id ? (
                <tr key={user.id} className="bg-blue-50/60">
                  <td className="px-6 py-4 space-y-2">
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none text-sm" 
                      value={formData.name || ''} 
                      onChange={e => setFormData({...formData, name: e.target.value})} 
                    />
                  </td>
                  <td className="px-6 py-4">
                    <select 
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium shadow-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none text-sm cursor-pointer" 
                      value={formData.role || user.role} 
                      onChange={e => setFormData({...formData, role: e.target.value})}
                    >
                      {Object.entries(ROLES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formData.is_active ?? user.is_active} 
                        onChange={e => setFormData({...formData, is_active: e.target.checked})} 
                        className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-600/20"
                      />
                      <span className="text-sm font-semibold text-slate-800">Ativo</span>
                    </label>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button 
                      onClick={handleSave} 
                      disabled={isSaving} 
                      className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition"
                      title="Salvar"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={cancelEdit} 
                      disabled={isSaving} 
                      className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition"
                      title="Cancelar"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={user.id} className={`hover:bg-slate-50 transition ${!user.is_active ? 'opacity-60' : ''}`}>
                  <td className="px-6 py-4">
                    <p className="font-extrabold text-slate-900">{user.full_name || user.name}</p>
                    <p className="text-xs text-slate-500 font-mono">ID: {user.id}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-800 text-xs font-extrabold rounded-lg">
                      {ROLES[user.role] || user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {user.is_active ? (
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-extrabold rounded-full uppercase">Ativo</span>
                    ) : (
                      <span className="px-2.5 py-1 bg-slate-200 text-slate-800 text-xs font-extrabold rounded-full uppercase">Inativo</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => startEdit(user)}
                      disabled={editingId !== null}
                      className="p-2 text-slate-700 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition disabled:opacity-50"
                      title="Editar usuário"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
