export type IndustryType = 'GENERIC' | 'GYM' | 'RESTAURANT' | 'PHARMACY' | 'RETAIL';

export interface TenantSettings {
  logoUrl?: string;
  primaryColor?: string;
  currency?: string;
  timezone?: string;
  [key: string]: unknown;
}

export interface TenantEntity {
  id: string;
  slug: string;
  name: string;
  industry: IndustryType;
  modules: string[];
  settings: TenantSettings;
  createdAt: Date;
  updatedAt: Date;
}
