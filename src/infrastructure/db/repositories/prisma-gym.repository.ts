import { prisma } from '../prisma';
import { IGymRepository } from '@/core/ports/gym-repository.port';
import { PersonEntity } from '@/core/entities/person';
import { GymMembershipEntity, GymAccessLogEntity, MembershipStatus } from '@/core/entities/gym';

export class PrismaGymRepository implements IGymRepository {
  async findPersonWithMembership(
    tenantId: string,
    query: { documentId?: string; personId?: string }
  ): Promise<{ person: PersonEntity; membership: GymMembershipEntity | null } | null> {
    const personDb = await prisma.person.findFirst({
      where: {
        tenantId,
        OR: [
          query.documentId ? { documentId: query.documentId } : {},
          query.personId ? { id: query.personId } : {},
        ],
      },
      include: {
        gymMembership: true,
      },
    });

    if (!personDb) return null;

    const person: PersonEntity = {
      id: personDb.id,
      tenantId: personDb.tenantId,
      firstName: personDb.firstName,
      lastName: personDb.lastName,
      email: personDb.email,
      phone: personDb.phone,
      documentId: personDb.documentId,
      metadata: (personDb.metadata as Record<string, unknown>) ?? {},
      createdAt: personDb.createdAt,
    };

    const membership: GymMembershipEntity | null = personDb.gymMembership
      ? {
          id: personDb.gymMembership.id,
          tenantId: personDb.gymMembership.tenantId,
          personId: personDb.gymMembership.personId,
          planName: personDb.gymMembership.planName,
          startDate: personDb.gymMembership.startDate,
          endDate: personDb.gymMembership.endDate,
          status: personDb.gymMembership.status as MembershipStatus,
          createdAt: personDb.gymMembership.createdAt,
        }
      : null;

    return { person, membership };
  }

  async createMembership(data: {
    tenantId: string;
    personId: string;
    planName: string;
    startDate: Date;
    endDate: Date;
  }): Promise<GymMembershipEntity> {
    const created = await prisma.gymMembership.create({
      data: {
        tenantId: data.tenantId,
        personId: data.personId,
        planName: data.planName,
        startDate: data.startDate,
        endDate: data.endDate,
        status: 'ACTIVE',
      },
    });

    return {
      id: created.id,
      tenantId: created.tenantId,
      personId: created.personId,
      planName: created.planName,
      startDate: created.startDate,
      endDate: created.endDate,
      status: created.status as MembershipStatus,
      createdAt: created.createdAt,
    };
  }

  async logAccess(data: {
    tenantId: string;
    membershipId: string;
    granted: boolean;
    denialReason?: string;
  }): Promise<GymAccessLogEntity> {
    const created = await prisma.gymAccessLog.create({
      data: {
        tenantId: data.tenantId,
        membershipId: data.membershipId,
        granted: data.granted,
        denialReason: data.denialReason,
      },
    });

    return {
      id: created.id,
      tenantId: created.tenantId,
      membershipId: created.membershipId,
      accessTime: created.accessTime,
      granted: created.granted,
      denialReason: created.denialReason,
    };
  }

  async getRecentLogs(tenantId: string, limit = 10): Promise<(GymAccessLogEntity & { personName: string })[]> {
    const logs = await prisma.gymAccessLog.findMany({
      where: { tenantId },
      orderBy: { accessTime: 'desc' },
      take: limit,
      include: {
        membership: {
          include: {
            person: true,
          },
        },
      },
    });

    return logs.map((log: (typeof logs)[number]) => ({
      id: log.id,
      tenantId: log.tenantId,
      membershipId: log.membershipId,
      accessTime: log.accessTime,
      granted: log.granted,
      denialReason: log.denialReason,
      personName: log.membership.person
        ? `${log.membership.person.firstName} ${log.membership.person.lastName}`
        : 'Desconocido',
    }));
  }
}
