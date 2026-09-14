import 'server-only';

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ForbiddenError, UnauthorizedError } from '@/lib/session';

/**
 * Unified API error contract: routes throw typed errors and `handleApiError`
 * maps them deterministically to 400 (validation) / 401 (unauth) / 403 (role) /
 * 404 (not found / cross-tenant) / 409 (conflict). Messages are Spanish and
 * i18n-consistent with the `errors.*` keys in messages/{es,en}.json.
 */
export class ApiError extends Error {
  readonly status: 400 | 401 | 403 | 404 | 409;

  constructor(status: 400 | 401 | 403 | 404 | 409, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Legacy bridge: repository methods still throw plain `Error` with these exact
 * Spanish messages. Kept so existing 409/404/400 semantics survive the route
 * migration; P0/P1 replace these throws with typed `ApiError`s in the repository.
 */
const LEGACY_STATUS_BY_MESSAGE: ReadonlyArray<readonly [string, number]> = [
  ['Stock insuficiente', 409],
  ['El SKU ya existe', 409],
  ['Tasa de impuesto no encontrada', 404],
  ['Producto no encontrado', 404],
  ['Cliente no encontrado', 404],
  ['Sesión de caja no encontrada o ya cerrada', 400],
  ['Debe abrir la caja antes de registrar una venta', 400],
  ['La venta no tiene productos', 400],
  ['Cantidad inválida en uno de los productos', 400],
  ['Uno o más productos no existen', 400],
  ['Debe existir al menos una tasa de impuesto', 400],
];

function errorResponse(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return errorResponse(error.status, error.message);
  }
  if (error instanceof UnauthorizedError) {
    return errorResponse(401, error.message);
  }
  if (error instanceof ForbiddenError) {
    return errorResponse(403, error.message);
  }
  if (error instanceof ZodError) {
    return errorResponse(400, 'Datos inválidos');
  }
  if (error instanceof SyntaxError) {
    // request.json() failed: malformed JSON body
    return errorResponse(400, 'Datos inválidos');
  }
  if (error instanceof Error) {
    const match = LEGACY_STATUS_BY_MESSAGE.find(([message]) =>
      error.message.includes(message)
    );
    if (match) {
      return errorResponse(match[1], error.message);
    }
    console.error('[api]', error);
    return errorResponse(500, 'Error interno del servidor');
  }
  console.error('[api]', error);
  return errorResponse(500, 'Error interno del servidor');
}