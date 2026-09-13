'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, CheckCircle2, XCircle, UserCheck, ShieldAlert, Clock, RefreshCw } from 'lucide-react';
import { MockGymRepository } from '@/infrastructure/db/repositories/mock-gym.repository';
import { CheckInAccessUseCase } from '@/modules/gym/use-cases/check-in-access.use-case';
import { CheckInResult } from '@/core/ports/gym-repository.port';
import { getMe } from '@/features/auth/api';

export function GymCheckInView() {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [logs, setLogs] = useState<Array<{ id: string; personName: string; granted: boolean; accessTime: Date; denialReason?: string | null }>>([]);

  // The tenant scope comes from the session (/api/auth/me); the client NEVER
  // sends a tenantId. The mock instances are keyed on it so a tenant switch
  // rebuilds the demo fixtures instead of leaking data across tenants.
  useEffect(() => {
    let active = true;
    getMe().then((me) => {
      if (active) setTenantId(me?.user.tenantId ?? null);
    });
    return () => { active = false; };
  }, []);

  const gymRepository = useMemo(() => new MockGymRepository(tenantId ?? ''), [tenantId]);
  const checkInUseCase = useMemo(() => new CheckInAccessUseCase(gymRepository), [gymRepository]);

  // Cargar logs al montar / cuando el tenant de sesión esté resuelto
  const fetchLogs = useCallback(async () => {
    if (!tenantId) return;
    const recentLogs = await gymRepository.getRecentLogs(tenantId, 8);
    setLogs(recentLogs);
  }, [tenantId, gymRepository]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      if (!tenantId) return;
      const res = await checkInUseCase.execute(tenantId, searchInput);
      setResult(res);
      await fetchLogs();
    } catch {
      setResult({
        granted: false,
        message: 'Ocurrió un error al procesar el check-in.',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!tenantId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100">
        <div className="text-sm text-zinc-400">Cargando sesión…</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-2">
            Módulo Activo: GYM & Fitness
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <UserCheck className="w-7 h-7 text-emerald-400" /> Control de Acceso & Check-In
          </h1>
          <p className="text-sm text-zinc-400">
            Recepción y validación instantánea de membresías por DNI o ID de socio.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-lg">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Sistema Multi-Tenant: <strong className="text-white">{tenantId}</strong>
        </div>
      </div>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Formulario de Check-in */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 backdrop-blur-sm shadow-xl">
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Escanear Código QR / DNI / ID del Socio
            </label>
            <form onSubmit={handleCheckIn} className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Ej: 0801199512345 (Carlos) ó 0801199854321 (Ana)"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-10 pr-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all font-mono text-sm"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={loading || !searchInput.trim()}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-6 py-3 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Verificar'}
              </button>
            </form>

            {/* Accesos directos de prueba */}
            <div className="mt-4 pt-4 border-t border-zinc-800/60 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-zinc-500">Pruebas rápidas:</span>
              <button
                type="button"
                onClick={() => setSearchInput('0801199512345')}
                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors font-mono"
              >
                Carlos (Activo)
              </button>
              <button
                type="button"
                onClick={() => setSearchInput('0801199854321')}
                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors font-mono"
              >
                Ana (Vencida)
              </button>
            </div>
          </div>

          {/* Resultado de la Validación */}
          {result && (
            <div
              className={`rounded-xl p-6 border transition-all duration-300 shadow-2xl ${
                result.granted
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
              }`}
            >
              <div className="flex items-start gap-4">
                {result.granted ? (
                  <div className="p-3 bg-emerald-500/20 rounded-full border border-emerald-500/30">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                  </div>
                ) : (
                  <div className="p-3 bg-rose-500/20 rounded-full border border-rose-500/30">
                    <XCircle className="w-10 h-10 text-rose-400" />
                  </div>
                )}

                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold tracking-wide">
                      {result.granted ? 'ACCESO PERMITIDO' : 'ACCESO DENEGADO'}
                    </h3>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase ${
                        result.granted
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {result.granted ? 'Pase Válido' : 'No Válido'}
                    </span>
                  </div>

                  <p className="text-sm font-medium opacity-90">{result.message}</p>

                  {result.person && (
                    <div className="mt-4 pt-3 border-t border-current/10 grid grid-cols-2 gap-4 text-xs font-mono">
                      <div>
                        <span className="opacity-60 block">Socio:</span>
                        <strong className="text-sm font-sans font-semibold">
                          {result.person.firstName} {result.person.lastName}
                        </strong>
                      </div>
                      <div>
                        <span className="opacity-60 block">Documento / ID:</span>
                        <strong>{result.person.documentId || result.person.id}</strong>
                      </div>
                      {result.membership && (
                        <>
                          <div>
                            <span className="opacity-60 block">Plan:</span>
                            <strong>{result.membership.planName}</strong>
                          </div>
                          <div>
                            <span className="opacity-60 block">Vencimiento:</span>
                            <strong>{new Date(result.membership.endDate).toLocaleDateString()}</strong>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Historial en Tiempo Real */}
        <div className="lg:col-span-5">
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 backdrop-blur-sm h-full">
            <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-zinc-400" /> Accesos Recientes en Tiempo Real
              </h2>
              <button
                onClick={fetchLogs}
                className="text-xs text-zinc-400 hover:text-white transition-colors p-1"
                title="Actualizar"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {logs.length === 0 ? (
                <div className="text-center py-8 text-xs text-zinc-500">
                  No hay registros de accesos hoy aún.
                </div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/60 border border-zinc-800/80 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      {log.granted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      ) : (
                        <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
                      )}
                      <div>
                        <div className="font-semibold text-zinc-200">{log.personName}</div>
                        {log.denialReason && (
                          <div className="text-[10px] text-rose-400">{log.denialReason}</div>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-zinc-500 font-mono text-[11px]">
                      {new Date(log.accessTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}