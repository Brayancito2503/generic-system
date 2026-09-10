import { IGymRepository } from '@/core/ports/gym-repository.port';
import { PersonEntity } from '@/core/entities/person';
import { GymMembershipEntity, GymAccessLogEntity } from '@/core/entities/gym';

export class MockGymRepository implements IGymRepository {
  private persons: PersonEntity[] = [
    {
      id: 'person-1',
      tenantId: 'powerfit-gym',
      firstName: 'Carlos',
      lastName: 'Mendoza',
      email: 'carlos@example.com',
      phone: '+504 9988-7766',
      documentId: '0801199512345',
      metadata: { birthDate: '1995-05-12', photoUrl: '' },
      createdAt: new Date('2026-01-10'),
    },
    {
      id: 'person-2',
      tenantId: 'powerfit-gym',
      firstName: 'Ana',
      lastName: 'García',
      email: 'ana@example.com',
      phone: '+504 8877-6655',
      documentId: '0801199854321',
      metadata: { birthDate: '1998-08-20', photoUrl: '' },
      createdAt: new Date('2026-02-01'),
    },
  ];

  private memberships: GymMembershipEntity[] = [
    {
      id: 'mem-1',
      tenantId: 'powerfit-gym',
      personId: 'person-1',
      planName: 'Plan Mensual VIP',
      startDate: new Date('2026-08-01'),
      endDate: new Date('2026-09-30'), // Vigente
      status: 'ACTIVE',
      createdAt: new Date('2026-08-01'),
    },
    {
      id: 'mem-2',
      tenantId: 'powerfit-gym',
      personId: 'person-2',
      planName: 'Pase Básico 15 Días',
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-07-16'), // Vencido
      status: 'EXPIRED',
      createdAt: new Date('2026-07-01'),
    },
  ];

  private accessLogs: (GymAccessLogEntity & { personName: string })[] = [
    {
      id: 'log-1',
      tenantId: 'powerfit-gym',
      membershipId: 'mem-1',
      accessTime: new Date(Date.now() - 1000 * 60 * 15), // Hace 15 mins
      granted: true,
      personName: 'Carlos Mendoza',
    },
  ];

  async findPersonWithMembership(
    tenantId: string,
    query: { documentId?: string; personId?: string }
  ): Promise<{ person: PersonEntity; membership: GymMembershipEntity | null } | null> {
    const person = this.persons.find(
      (p) =>
        p.tenantId === tenantId &&
        ((query.documentId && p.documentId === query.documentId) ||
          (query.personId && p.id === query.personId))
    );

    if (!person) return null;

    const membership = this.memberships.find((m) => m.personId === person.id && m.tenantId === tenantId) ?? null;

    return { person, membership };
  }

  async createMembership(data: {
    tenantId: string;
    personId: string;
    planName: string;
    startDate: Date;
    endDate: Date;
  }): Promise<GymMembershipEntity> {
    const newMembership: GymMembershipEntity = {
      id: `mem-${Date.now()}`,
      tenantId: data.tenantId,
      personId: data.personId,
      planName: data.planName,
      startDate: data.startDate,
      endDate: data.endDate,
      status: 'ACTIVE',
      createdAt: new Date(),
    };

    // Reemplazar si existe una anterior
    this.memberships = this.memberships.filter((m) => m.personId !== data.personId);
    this.memberships.push(newMembership);

    return newMembership;
  }

  async logAccess(data: {
    tenantId: string;
    membershipId: string;
    granted: boolean;
    denialReason?: string;
  }): Promise<GymAccessLogEntity> {
    const membership = this.memberships.find((m) => m.id === data.membershipId);
    const person = membership ? this.persons.find((p) => p.id === membership.personId) : null;

    const newLog: GymAccessLogEntity & { personName: string } = {
      id: `log-${Date.now()}`,
      tenantId: data.tenantId,
      membershipId: data.membershipId,
      accessTime: new Date(),
      granted: data.granted,
      denialReason: data.denialReason,
      personName: person ? `${person.firstName} ${person.lastName}` : 'Desconocido',
    };

    this.accessLogs.unshift(newLog);
    return newLog;
  }

  async getRecentLogs(tenantId: string, limit = 10): Promise<(GymAccessLogEntity & { personName: string })[]> {
    return this.accessLogs.filter((l) => l.tenantId === tenantId).slice(0, limit);
  }
}
