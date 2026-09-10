'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Search, ShieldCheck, DollarSign, Phone, Mail, UserCheck, UserX, X, Loader2 } from 'lucide-react';
import type { EmployeeEntity } from '../entities';
import { apiGet, apiSend } from '../api';

const fmtLps = (n: number) => `C$ ${n.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function EmployeesView() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);

  const [newEmployee, setNewEmployee] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'Vendedor',
    department: 'Ventas',
    salary: '',
    commissionRate: '',
  });

  const { data: employees = [], isPending } = useQuery<EmployeeEntity[]>({
    queryKey: ['employees'],
    queryFn: () => apiGet<EmployeeEntity[]>(`/employees`),
  });

  const createEmployee = useMutation({
    mutationFn: (payload: {
      firstName: string;
      lastName: string;
      email?: string | null;
      phone?: string | null;
      role: string;
      department?: string | null;
      salary?: number;
      commissionRate?: number;
    }) => apiSend<EmployeeEntity>(`/employees`, 'POST', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  });

  const filteredEmployees = employees.filter((e) => {
    const fullName = `${e.firstName} ${e.lastName}`.toLowerCase();
    const role = (e.role || '').toLowerCase();
    const dept = (e.department || '').toLowerCase();
    const query = searchTerm.toLowerCase();
    return fullName.includes(query) || role.includes(query) || dept.includes(query);
  });

  const handleCreateEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmployee.firstName || !newEmployee.lastName) return;

    createEmployee.mutate({
      firstName: newEmployee.firstName,
      lastName: newEmployee.lastName,
      email: newEmployee.email || null,
      phone: newEmployee.phone || null,
      role: newEmployee.role,
      department: newEmployee.department,
      salary: parseFloat(newEmployee.salary) || 0,
      commissionRate: parseFloat(newEmployee.commissionRate) || 0,
    });

    setShowAddEmployeeModal(false);
    setNewEmployee({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      role: 'Vendedor',
      department: 'Ventas',
      salary: '',
      commissionRate: '',
    });
  };

  const totalMonthlyPayroll = employees
    .filter((e) => e.isActive)
    .reduce((acc, curr) => acc + (curr.salary || 0), 0);

  return (
    <div className="p-6 space-y-6 text-zinc-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Users className="w-7 h-7 text-indigo-400" /> Gestión de Empleados & Personal
          </h1>
          <p className="text-sm text-zinc-400">
            Control de personal, asignación de roles, salarios base y comisiones de ventas.
          </p>
        </div>
        <button
          onClick={() => setShowAddEmployeeModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 font-medium text-sm text-white rounded-lg transition-colors shadow-lg shadow-indigo-600/20"
        >
          <Plus className="w-4 h-4" /> Registrar Empleado
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Total Colaboradores</p>
            <h3 className="text-2xl font-bold text-white mt-1">
              {employees.filter((e) => e.isActive).length} <span className="text-xs font-normal text-zinc-500">activos</span>
            </h3>
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Planilla Base Mensual</p>
            <h3 className="text-2xl font-bold text-emerald-400 mt-1">{fmtLps(totalMonthlyPayroll)}</h3>
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Vendedores de Ruta</p>
            <h3 className="text-2xl font-bold text-amber-400 mt-1">
              {employees.filter((e) => (e.commissionRate || 0) > 0).length} <span className="text-xs font-normal text-zinc-500">con comisión</span>
            </h3>
          </div>
        </div>
      </div>

      {/* Filter and Table */}
      <div className="space-y-4">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar por nombre, cargo o departamento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl overflow-hidden">
          {isPending ? (
            <div className="flex items-center justify-center py-16 text-zinc-500 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Cargando empleados...
            </div>
          ) : (
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="bg-zinc-900 border-b border-zinc-800 text-xs text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Empleado</th>
                  <th className="px-5 py-3">Cargo / Rol</th>
                  <th className="px-5 py-3">Departamento</th>
                  <th className="px-5 py-3 text-right">Salario Base</th>
                  <th className="px-5 py-3 text-right">% Comisión</th>
                  <th className="px-5 py-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-zinc-100">
                        {emp.firstName} {emp.lastName}
                      </div>
                      <div className="text-xs text-zinc-400 flex items-center gap-3 mt-0.5">
                        {emp.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-zinc-500" /> {emp.phone}
                          </span>
                        )}
                        {emp.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3 text-zinc-500" /> {emp.email}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-zinc-200 font-medium">{emp.role || 'Sin cargo'}</td>
                    <td className="px-5 py-3.5 text-zinc-400">{emp.department || 'General'}</td>
                    <td className="px-5 py-3.5 text-right font-medium text-emerald-400">
                      {fmtLps(emp.salary || 0)}
                    </td>
                    <td className="px-5 py-3.5 text-right text-indigo-400 font-mono">
                      {emp.commissionRate ? `${emp.commissionRate}%` : '0%'}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {emp.isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <UserCheck className="w-3 h-3" /> Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                          <UserX className="w-3 h-3" /> Inactivo
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal Add Employee */}
      {showAddEmployeeModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
              <h2 className="text-lg font-bold text-white">Registrar Nuevo Empleado</h2>
              <button
                onClick={() => setShowAddEmployeeModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateEmployee} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Nombre *</label>
                  <input
                    type="text"
                    required
                    value={newEmployee.firstName}
                    onChange={(e) => setNewEmployee({ ...newEmployee, firstName: e.target.value })}
                    placeholder="Mario"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Apellido *</label>
                  <input
                    type="text"
                    required
                    value={newEmployee.lastName}
                    onChange={(e) => setNewEmployee({ ...newEmployee, lastName: e.target.value })}
                    placeholder="Alvarado"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    value={newEmployee.email}
                    onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                    placeholder="mario@empresa.com"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={newEmployee.phone}
                    onChange={(e) => setNewEmployee({ ...newEmployee, phone: e.target.value })}
                    placeholder="+505 9999-9999"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Cargo / Rol</label>
                  <input
                    type="text"
                    value={newEmployee.role}
                    onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value })}
                    placeholder="Ej: Vendedor de Ruta"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Departamento</label>
                  <input
                    type="text"
                    value={newEmployee.department}
                    onChange={(e) => setNewEmployee({ ...newEmployee, department: e.target.value })}
                    placeholder="Ej: Ventas Exterior"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Salario Mensual Base (córdobas - C$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newEmployee.salary}
                    onChange={(e) => setNewEmployee({ ...newEmployee, salary: e.target.value })}
                    placeholder="15000.00"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">% Comisión sobre Ventas</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newEmployee.commissionRate}
                    onChange={(e) => setNewEmployee({ ...newEmployee, commissionRate: e.target.value })}
                    placeholder="2.5"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAddEmployeeModal(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold rounded-lg text-zinc-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createEmployee.isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold rounded-lg text-white transition-colors disabled:opacity-60"
                >
                  Guardar Empleado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}