import { GymMembershipEntity, GymAccessLogEntity } from '../entities/gym';
import { PersonEntity } from '../entities/person';

export interface CheckInResult {
  granted: boolean;
  message: string;
  person?: PersonEntity | null;
  membership?: GymMembershipEntity | null;
  accessLog?: GymAccessLogEntity | null;
}

export interface IGymRepository {
  findPersonWithMembership(
    tenantId: string,
    query: { documentId?: string; personId?: string }
  ): Promise<{ person: PersonEntity; membership: GymMembershipEntity | null } | null>;

  createMembership(data: {
    tenantId: string;
    personId: string;
    planName: string;
    startDate: Date;
    endDate: Date;
  }): Promise<GymMembershipEntity>;

  logAccess(data: {
    tenantId: string;
    membershipId: string;
    granted: boolean;
    denialReason?: string;
  }): Promise<GymAccessLogEntity>;

  getRecentLogs(tenantId: string, limit?: number): Promise<(GymAccessLogEntity & { personName: string })[]>;
}
