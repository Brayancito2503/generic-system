// (Respuestas genéricas, Paginación, Errores)
// Envoltorio genérico de respuesta (Wrapper)
export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
  errors?: string[];
}

export interface ApiError {
  type: string;
  message: string;
  code?: string;
  status?: number;
  details?: unknown;
}

// Paginación estándar
export interface PaginatedResponse<T> {
  items: T[];
  pageIndex: number;
  totalPages: number;
  totalCount: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

// Filtros genéricos para paginación (CQRS Query Params)
export interface PaginationParams {
  pageNumber: number;
  pageSize: number;
  searchTerm?: string;
}