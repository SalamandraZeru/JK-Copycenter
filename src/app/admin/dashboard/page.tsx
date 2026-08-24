'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';
import { DollarSign, ShoppingCart, TrendingUp, Package, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function DashboardPage() {
  const [period, setPeriod] = useState(7);
  const { data, error, isLoading } = useSWR(`/api/admin/dashboard?period=${period}`, fetcher);

  if (error) return <div className="text-red-500">Erro ao carregar dashboard.</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <select 
          value={period} 
          onChange={(e) => setPeriod(Number(e.target.value))}
          className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value={7}>Últimos 7 dias</option>
          <option value={30}>Últimos 30 dias</option>
          <option value={90}>Últimos 90 dias</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Receita Reconciliada</p>
                  <p className="text-2xl font-bold text-slate-900">{formatCurrency(data?.metrics?.totalRevenue || 0)}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <ShoppingCart className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Total de Pedidos</p>
                  <p className="text-2xl font-bold text-slate-900">{data?.metrics?.totalOrders || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Ticket Médio</p>
                  <p className="text-2xl font-bold text-slate-900">{formatCurrency(data?.metrics?.averageTicket || 0)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <Package className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Mais Vendido</p>
                  <p className="text-lg font-bold text-slate-900 truncate">{data?.metrics?.topItem || '-'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row 1 */}
          <p className="text-xs text-slate-500 -mt-2">{data?.metrics?.reconciliation}</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Receita por Dia</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data?.charts?.revenue || []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(val) => new Date(String(val)).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})} />
                    <YAxis tickFormatter={(val) => `R$ ${val}`} />
                    <Tooltip formatter={(value: any) => formatCurrency(Number(value))} labelFormatter={(val: any) => new Date(String(val)).toLocaleDateString('pt-BR')} />
                    <Line type="monotone" dataKey="revenue" stroke="#0088FE" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Pedidos por Dia</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data?.charts?.orders || []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(val) => new Date(String(val)).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})} />
                    <YAxis allowDecimals={false} />
                    <Tooltip labelFormatter={(val: any) => new Date(String(val)).toLocaleDateString('pt-BR')} />
                    <Line type="monotone" dataKey="count" stroke="#00C49F" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm lg:col-span-1">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Formas de Pagamento</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data?.charts?.payment || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {(data?.charts?.payment || []).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length] || '#8884d8'} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex flex-wrap justify-center gap-4">
                {(data?.charts?.payment || []).map((entry: any, index: number) => (
                  <div key={entry.name} className="flex items-center gap-2 text-sm">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                    <span className="capitalize">{entry.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm lg:col-span-2">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Top 5 Serviços</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.charts?.topServices || []} layout="vertical" margin={{ left: 50 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
                    <Tooltip />
                    <Bar dataKey="quantity" fill="#8884d8" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Recent Orders Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">Últimos Pedidos</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-sm">
                  <tr>
                    <th className="px-6 py-4 font-medium">Pedido</th>
                    <th className="px-6 py-4 font-medium">Cliente</th>
                    <th className="px-6 py-4 font-medium">Data</th>
                    <th className="px-6 py-4 font-medium">Total</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(data?.recentOrders || []).map((order: any) => (
                    <tr key={order.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-blue-600">#{order.order_number}</td>
                      <td className="px-6 py-4 text-slate-900">{order.customer_name}</td>
                      <td className="px-6 py-4 text-slate-600">
                        {new Date(order.created_at).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 text-slate-900 font-medium">
                        {formatCurrency(order.total)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg uppercase">
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
