/**
 * Interfaces de Licenciamiento y Dispositivos
 */

export enum LicenseTypeEnum {
    Trial = 1,
    Standard = 2,
    Professional = 3,
    Enterprise = 4
}

export interface License {
    licenseId: number;
    licenseName: string;
    licenseType: number;
    startDate: Date | string;
    endDate: Date | string;
    isActive: boolean;
}

export interface Device {
    deviceId: number;
    deviceName: string;
    macHash: string;
    isActive: boolean;
}

export interface LicenseAssignment {
    licenseAssignmentId: number;
    licenseId: number;
    userId: number;
    deviceId: number;
    assignedAt: Date | string;
    userParentId?: number | null;
    isActive: boolean;
}
