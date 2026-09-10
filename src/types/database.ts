/**
 * Mapeo de Entidades de Base de Datos
 * Basado en el esquema proporcionado por el usuario.
 */

export interface User {
    UserId: number;
    UserName: string;
    UserFullName: string;
    Email: string;
    Password?: string; // Opcional en frontend por seguridad, requerido en DB
    UserStatusId: number;
    DeactivationDate?: Date | string | null; // Puede ser nulo si el usuario está activo
    CreationDate: Date | string;
    CreationUserId: number;
}

export interface UserStatus {
    UserStatusId: number;
    Description: string;
}

export interface Role {
    RolId: number;
    RolName: string;
    Description: string;
    IsAdministrator: boolean; // bit -> boolean
    CreationDate: Date | string;
    CreationUserId: number;
}

export interface Permission {
    PermissionId: number;
    AccessName: string;
    Description: string;
    PermissionParentId?: number | null;
}

export interface PermissionByRole {
    Id: number;
    RolId: number;
    PermissionId: number;
    IsEnabled: boolean; // bit -> boolean
}

export interface UserByRole {
    Id: number;
    UserId: number;
    RolId: number;
    IsEnabled: number; // int en esquema, posible 0/1 mapeado a number
    CreationDate: Date | string;
    CreationUserId: number;
}

export interface Device {
    DeviceId: number;
    DeviceName: string;
    MacHash: string; // varbinary -> string (base64/hex)
    IsActive: boolean; // bit -> boolean
}

export interface License {
    LicenseId: number;
    LicenseName: string;
    LicenseType: number; // int
    StartDate: Date | string; // date
    EndDate: Date | string; // date
    IsActive: boolean; // bit -> boolean
}

export interface LicenseAssignment {
    LicenseAssignmentId: number;
    LicenseId: number;
    UserId: number;
    DeviceId: number;
    AssignedAt: Date | string; // datetime
    UserParentId?: number | null;
    IsActive: boolean; // bit -> boolean
}
