/**
 * Interfaces de Control de Acceso Basado en Roles (RBAC)
 */

export interface Role {
    rolId: number;
    rolName: string;
    description: string;
    isAdministrator: boolean;
    creationDate: string;
    creationUserId: number;
}

export interface Permission {
    permissionId: number;
    accessName: string;
    description: string;
    permissionParentId?: number | null;
}

export interface PermissionByRole {
    id: number;
    rolId: number;
    permissionId: number;
    isEnabled: boolean;
}

export interface UserByRole {
    id: number;
    userId: number;
    rolId: number;
    isEnabled: number; // Mapeo directo de 'int IsEnabled' en DB, aunque boolean sería ideal si el backend lo soporta
    creationDate: string;
    creationUserId: number;
}
