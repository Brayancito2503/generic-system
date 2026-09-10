export interface PersonMetadata {
  birthDate?: string;
  avatarUrl?: string;
  emergencyContact?: string;
  notes?: string;
  [key: string]: unknown;
}

export interface PersonEntity {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  documentId?: string | null;
  metadata: PersonMetadata;
  createdAt: Date;
}
