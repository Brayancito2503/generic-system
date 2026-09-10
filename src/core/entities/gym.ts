export type MembershipStatus = 'ACTIVE' | 'EXPIRED' | 'FROZEN' | 'CANCELLED';

export interface GymMembershipEntity {
  id: string;
  tenantId: string;
  personId: string;
  planName: string;
  startDate: Date;
  endDate: Date;
  status: MembershipStatus;
  createdAt: Date;
}

export interface GymAccessLogEntity {
  id: string;
  tenantId: string;
  membershipId: string;
  accessTime: Date;
  granted: boolean;
  denialReason?: string | null;
}
