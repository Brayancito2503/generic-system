'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Users, Plus, Search, ShieldCheck, DollarSign, Phone, Mail, UserCheck, UserX, Pencil, KeyRound, X, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { EmployeeEntity } from '../entities';
import { apiGet, apiSend } from '../api';

const fmtLps = (n: number) => `C$ ${n.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const toDateInput = (v?: Date | string | null): string =>
  v ? new Date(v).toISOString().slice(0, 10) : '';

interface EmployeeFormState {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  salary: string;
  commissionRate: string;
  hireDate: string;
}

const emptyForm = (): EmployeeFormState => ({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  role: 'Vendedor',
  department: 'Ventas',
  salary: '',
  commissionRate: '',
  hireDate: '',
});

const toForm = (emp: EmployeeEntity): EmployeeFormState => ({
  id: emp.id,
  firstName: emp.firstName,
  lastName: emp.lastName,
  email: emp.email ?? '',
  phone: emp.phone ?? '',
  role: emp.role,
  department: emp.department ?? '',
  salary: emp.salary != null ? String(emp.salary) : '',
  commissionRate: emp.commissionRate != null ? String(emp.commissionRate) : '',
  hireDate: toDateInput(emp.hireDate),
});

export default function EmployeesView() {
  const t = useTranslations('distributionModule.employees');
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [editModal, setEditModal] = useState<EmployeeFormState | null>(null);
  const [pinModal, setPinModal] = useState<EmployeeEntity | null>(null);
  const [pinValue, setPinValue] = useState('');
  const [deactivateTarget, setDeactivateTarget] = useState<EmployeeEntity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [newEmployee, setNewEmployee] = useState<EmployeeFormState>(emptyForm());

  const { data: employees = [], isPending } = useQuery<EmployeeEntity[]>({
    queryKey: ['employees'],
    queryFn: () => apiGet<EmployeeEntity[]>(`/employees`),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['employees'] });

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
    onSuccess: () => {
      setShowAddEmployeeModal(false);
      setError(null);
      refresh();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Error de solicitud'),
  });

  const updateEmployee = useMutation({
    mutationFn: (form: EmployeeFormState) => {
      const payload: Record<string, unknown> = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        role: form.role.trim(),
        department: form.department.trim() || null,
      };
      const salary = parseFloat(form.salary);
      const commissionRate = parseFloat(form.commissionRate);
      if (!Number.isNaN(salary)) payload.salary = salary;
      if (!Number.isNaN(commissionRate)) payload.commissionRate = commissionRate;
      // Empty hireDate must NOT be sent: Zod coerce('') fails (400).
      if (form.hireDate) payload.hireDate = new Date(form.hireDate);
      return apiSend<EmployeeEntity>(`/employees/${form.id}`, 'PATCH', payload);
    },
    onSuccess: () => {
      setEditModal(null);
      setError(null);
      refresh();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Error al actualizar el empleado'),
  });

  const assignPin = useMutation({
    mutationFn: (payload: { employeeId: string; pin: string }) =>
      apiSend<EmployeeEntity>(`/employees/${payload.employeeId}`, 'PATCH', { pin: payload.pin }),
    onSuccess: () => {
      setPinModal(null);
      setPinValue('');
      setError(null);
      setSuccess(t('pinAssigned'));
      setTimeout(() => setSuccess(null), 3000);
      refresh();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Error al asignar el PIN'),
  });

  const deactivateEmployee = useMutation({
    mutationFn: (employeeId: string) =>
      apiSend<EmployeeEntity>(`/employees/${employeeId}`, 'PATCH', { isActive: false }),
    onSuccess: () => {
      setDeactivateTarget(null);
      setError(null);
      refresh();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Error al desactivar el empleado'),
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

    setNewEmployee(emptyForm());
  };

  const handleUpdateEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal) return;
    if (!editModal.firstName.trim() || !editModal.lastName.trim()) {
      setError(t('invalidForm'));
      return;
    }
    updateEmployee.mutate(editModal);
  };

  const handleAssignPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinModal) return;
    if (!/^\d{4,6}$/.test(pinValue.trim())) {
      setError(t('invalidPin'));
      return;
    }
    assignPin.mutate({ employeeId: pinModal.id, pin: pinValue.trim() });
  };

  const totalMonthlyPayroll = employees
    .filter((e) => e.isActive)
    .reduce((acc, curr) => acc + (curr.salary || 0), 0);

  return (
    <div className="p-6 space-y-6 text-foreground">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Users className="w-7 h-7 text-primary" /> {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        <button
          onClick={() => setShowAddEmployeeModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 font-medium text-sm text-primary-foreground rounded-lg transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> {t('newEmployee')}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-xl flex items-center gap-3 text-destructive text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto hover:underline">{t('errorClose')}</button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3 text-emerald-500 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0" /> {success}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-primary/10 text-primary rounded-lg border border-primary/20">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t('totalCollabs')}</p>
            <h3 className="text-2xl font-bold text-foreground mt-1">
              {employees.filter((e) => e.isActive).length} <span className="text-xs font-normal text-muted-foreground">{t('activeCount')}</span>
            </h3>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-lg border border-emerald-500/20">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t('monthlyPayroll')}</p>
            <h3 className="text-2xl font-bold text-emerald-500 mt-1">{fmtLps(totalMonthlyPayroll)}</h3>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-amber-500/10 text-amber-500 rounded-lg border border-amber-500/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t('routeSellers')}</p>
            <h3 className="text-2xl font-bold text-amber-500 mt-1">
              {employees.filter((e) => (e.commissionRate || 0) > 0).length} <span className="text-xs font-normal text-muted-foreground">{t('withCommission')}</span>
            </h3>
          </div>
        </div>
      </div>

      {/* Filter and Table */}
      <div className="space-y-4">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          {isPending ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> {t('loading')}
            </div>
          ) : (
            <table className="w-full text-left text-sm text-foreground">
              <thead className="bg-muted/50 border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">{t('colName')}</th>
                  <th className="px-5 py-3">{t('colPosition')}</th>
                  <th className="px-5 py-3">{t('colDepartment')}</th>
                  <th className="px-5 py-3 text-right">{t('colSalary')}</th>
                  <th className="px-5 py-3 text-right">{t('colCommission')}</th>
                  <th className="px-5 py-3 text-center">{t('colStatus')}</th>
                  <th className="px-5 py-3 text-right">{t('colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-foreground">
                        {emp.firstName} {emp.lastName}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                        {emp.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-muted-foreground" /> {emp.phone}
                          </span>
                        )}
                        {emp.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3 text-muted-foreground" /> {emp.email}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-foreground font-medium">{emp.role || t('noRole')}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{emp.department || t('noDepartment')}</td>
                    <td className="px-5 py-3.5 text-right font-medium text-emerald-500">
                      {fmtLps(emp.salary || 0)}
                    </td>
                    <td className="px-5 py-3.5 text-right text-primary font-mono">
                      {emp.commissionRate ? `${emp.commissionRate}%` : '0%'}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {emp.isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          <UserCheck className="w-3 h-3" /> {t('active')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                          <UserX className="w-3 h-3" /> {t('inactive')}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditModal(toForm(emp))}
                          title={t('edit')}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-muted hover:bg-primary/20 hover:text-primary text-muted-foreground text-xs font-medium transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" /> {t('edit')}
                        </button>
                        {emp.isActive && (
                          <>
                            <button
                              type="button"
                              onClick={() => { setPinModal(emp); setPinValue(''); }}
                              title={t('assignPin')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-muted hover:bg-primary/20 hover:text-primary text-muted-foreground text-xs font-medium transition-colors"
                            >
                              <KeyRound className="w-3.5 h-3.5" /> {t('assignPin')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeactivateTarget(emp)}
                              title={t('deactivate')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-muted hover:bg-destructive/20 hover:text-destructive text-muted-foreground text-xs font-medium transition-colors"
                            >
                              <UserX className="w-3.5 h-3.5" /> {t('deactivate')}
                            </button>
                          </>
                        )}
                      </div>
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
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h2 className="text-lg font-bold text-foreground">{t('createTitle')}</h2>
              <button
                onClick={() => setShowAddEmployeeModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateEmployee} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">{t('firstName')} *</label>
                  <input
                    type="text"
                    required
                    value={newEmployee.firstName}
                    onChange={(e) => setNewEmployee({ ...newEmployee, firstName: e.target.value })}
                    placeholder={t('firstNamePlaceholder')}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">{t('lastName')} *</label>
                  <input
                    type="text"
                    required
                    value={newEmployee.lastName}
                    onChange={(e) => setNewEmployee({ ...newEmployee, lastName: e.target.value })}
                    placeholder={t('lastNamePlaceholder')}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">{t('email')}</label>
                  <input
                    type="email"
                    value={newEmployee.email}
                    onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                    placeholder={t('emailPlaceholder')}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">{t('phone')}</label>
                  <input
                    type="text"
                    value={newEmployee.phone}
                    onChange={(e) => setNewEmployee({ ...newEmployee, phone: e.target.value })}
                    placeholder={t('phonePlaceholder')}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">{t('role')}</label>
                  <input
                    type="text"
                    value={newEmployee.role}
                    onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value })}
                    placeholder={t('rolePlaceholder')}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">{t('department')}</label>
                  <input
                    type="text"
                    value={newEmployee.department}
                    onChange={(e) => setNewEmployee({ ...newEmployee, department: e.target.value })}
                    placeholder={t('departmentPlaceholder')}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">{t('salary')}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newEmployee.salary}
                    onChange={(e) => setNewEmployee({ ...newEmployee, salary: e.target.value })}
                    placeholder={t('salaryPlaceholder')}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">{t('commissionRate')}</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newEmployee.commissionRate}
                    onChange={(e) => setNewEmployee({ ...newEmployee, commissionRate: e.target.value })}
                    placeholder={t('commissionPlaceholder')}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowAddEmployeeModal(false)}
                  className="px-4 py-2 bg-muted hover:bg-muted/80 text-xs font-semibold rounded-lg text-foreground transition-colors"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={createEmployee.isPending}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-xs font-semibold rounded-lg text-primary-foreground transition-colors disabled:opacity-60"
                >
                  {t('saveEmployee')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Employee */}
      {editModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h2 className="text-lg font-bold text-foreground">{t('editTitle')}</h2>
              <button
                onClick={() => setEditModal(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateEmployee} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">{t('firstName')} *</label>
                  <input
                    type="text"
                    required
                    value={editModal.firstName}
                    onChange={(e) => setEditModal({ ...editModal, firstName: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">{t('lastName')} *</label>
                  <input
                    type="text"
                    required
                    value={editModal.lastName}
                    onChange={(e) => setEditModal({ ...editModal, lastName: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">{t('email')}</label>
                  <input
                    type="email"
                    value={editModal.email}
                    onChange={(e) => setEditModal({ ...editModal, email: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">{t('phone')}</label>
                  <input
                    type="text"
                    value={editModal.phone}
                    onChange={(e) => setEditModal({ ...editModal, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">{t('role')}</label>
                  <input
                    type="text"
                    value={editModal.role}
                    onChange={(e) => setEditModal({ ...editModal, role: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">{t('department')}</label>
                  <input
                    type="text"
                    value={editModal.department}
                    onChange={(e) => setEditModal({ ...editModal, department: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">{t('salary')}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editModal.salary}
                    onChange={(e) => setEditModal({ ...editModal, salary: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">{t('commissionRate')}</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editModal.commissionRate}
                    onChange={(e) => setEditModal({ ...editModal, commissionRate: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">{t('hireDate')}</label>
                <input
                  type="date"
                  value={editModal.hireDate}
                  onChange={(e) => setEditModal({ ...editModal, hireDate: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditModal(null)}
                  className="px-4 py-2 bg-muted hover:bg-muted/80 text-xs font-semibold rounded-lg text-foreground transition-colors"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={updateEmployee.isPending}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-xs font-semibold rounded-lg text-primary-foreground transition-colors disabled:opacity-60"
                >
                  {updateEmployee.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Assign PIN */}
      {pinModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleAssignPin}
            className="bg-card border border-border rounded-xl max-w-sm w-full p-6 space-y-4 shadow-xl"
          >
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h2 className="text-lg font-bold text-foreground">{t('pinModalTitle')}</h2>
              <button
                type="button"
                onClick={() => setPinModal(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{pinModal.firstName} {pinModal.lastName}</span>
            </p>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">{t('pinLabel')}</label>
              <input
                type="password"
                inputMode="numeric"
                value={pinValue}
                onChange={(e) => setPinValue(e.target.value)}
                placeholder={t('pinPlaceholder')}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground mt-1.5">{t('pinHint')}</p>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setPinModal(null)}
                className="px-4 py-2 bg-muted hover:bg-muted/80 text-xs font-semibold rounded-lg text-foreground transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={assignPin.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-xs font-semibold rounded-lg text-primary-foreground transition-colors disabled:opacity-60"
              >
                <KeyRound className="w-3.5 h-3.5" /> {t('assignPin')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Confirm Deactivate */}
      {deactivateTarget && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-destructive/30 rounded-xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h2 className="text-lg font-bold text-foreground">{t('deactivateTitle')}</h2>
              <button
                type="button"
                onClick={() => setDeactivateTarget(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('deactivateConfirm', { name: `${deactivateTarget.firstName} ${deactivateTarget.lastName}` })}
            </p>
            <div className="flex justify-end gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setDeactivateTarget(null)}
                className="px-4 py-2 bg-muted hover:bg-muted/80 text-xs font-semibold rounded-lg text-foreground transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={() => deactivateEmployee.mutate(deactivateTarget.id)}
                disabled={deactivateEmployee.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-destructive hover:bg-destructive/90 text-xs font-semibold rounded-lg text-white transition-colors disabled:opacity-60"
              >
                <UserX className="w-3.5 h-3.5" /> {t('deactivate')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}