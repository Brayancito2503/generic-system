/**
 * Interfaces de Usuarios y Autenticación
 */

export enum UserStatusEnum {
    Active = 1,
    Inactive = 2,
    Suspended = 3,
    Pending = 4
}

export interface UserStatus {
    userStatusId: number;
    description: string;
}

export interface User {
    userId: number;
    userName: string;
    userFullName: string;
    email: string;
    password?: string;
    userStatusId: number;
    deactivationDate?: string | null;
    creationDate: string;
    creationUserId: number;
}
