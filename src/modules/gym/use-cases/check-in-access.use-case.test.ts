import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckInAccessUseCase } from './check-in-access.use-case';
import type { IGymRepository } from '@/core/ports/gym-repository.port';
import type { GymMembershipEntity, GymAccessLogEntity } from '@/core/entities/gym';
import type { PersonEntity } from '@/core/entities/person';

const NOW = new Date('2026-09-17T12:00:00Z');

function makePerson(overrides: Partial<PersonEntity> = {}): PersonEntity {
  return {
    id: 'p1',
    tenantId: 'tnt_1',
    firstName: 'Ana',
    lastName: 'Lopez',
    documentId: '12345678',
    metadata: {},
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeMembership(overrides: Partial<GymMembershipEntity> = {}): GymMembershipEntity {
  return {
    id: 'm1',
    tenantId: 'tnt_1',
    personId: 'p1',
    planName: 'Plan Mensual',
    startDate: new Date('2026-01-01T00:00:00Z'),
    endDate: new Date('2026-12-31T23:59:59Z'),
    status: 'ACTIVE',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeAccessLog(overrides: Partial<GymAccessLogEntity> = {}): GymAccessLogEntity {
  return {
    id: 'log_1',
    tenantId: 'tnt_1',
    membershipId: 'm1',
    accessTime: NOW,
    granted: true,
    ...overrides,
  };
}

function makeRepo(overrides: Partial<IGymRepository> = {}): IGymRepository {
  return {
    findPersonWithMembership: vi.fn(async () => null),
    createMembership: vi.fn(),
    logAccess: vi.fn(async () => makeAccessLog()),
    getRecentLogs: vi.fn(async () => []),
    ...overrides,
  };
}

function setupFound(repo: IGymRepository, person: PersonEntity, membership: GymMembershipEntity | null) {
  vi.mocked(repo.findPersonWithMembership).mockResolvedValue({ person, membership });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CheckInAccessUseCase.execute', () => {
  it('denies access for empty input without calling the repository', async () => {
    const repo = makeRepo();
    const useCase = new CheckInAccessUseCase(repo);
    const result = await useCase.execute('tnt_1', '');
    expect(result.granted).toBe(false);
    expect(repo.findPersonWithMembership).not.toHaveBeenCalled();
    expect(repo.logAccess).not.toHaveBeenCalled();
  });

  it('denies access for whitespace-only input', async () => {
    const repo = makeRepo();
    const useCase = new CheckInAccessUseCase(repo);
    const result = await useCase.execute('tnt_1', '   ');
    expect(result.granted).toBe(false);
    expect(repo.findPersonWithMembership).not.toHaveBeenCalled();
  });

  it('trims surrounding whitespace before searching', async () => {
    const repo = makeRepo();
    setupFound(repo, makePerson(), makeMembership());
    const useCase = new CheckInAccessUseCase(repo);
    await useCase.execute('tnt_1', '  12345678  ');
    expect(repo.findPersonWithMembership).toHaveBeenCalledWith('tnt_1', {
      documentId: '12345678',
      personId: '12345678',
    });
  });

  it('denies access when the person is not found and echoes the searched input', async () => {
    const repo = makeRepo();
    const useCase = new CheckInAccessUseCase(repo);
    const result = await useCase.execute('tnt_1', '99999999');
    expect(result.granted).toBe(false);
    expect(result.message).toContain('99999999');
    expect(repo.logAccess).not.toHaveBeenCalled();
  });

  it('denies access when the person has no membership', async () => {
    const repo = makeRepo();
    setupFound(repo, makePerson(), null);
    const useCase = new CheckInAccessUseCase(repo);
    const result = await useCase.execute('tnt_1', '12345678');
    expect(result.granted).toBe(false);
    expect(result.person).toEqual(makePerson());
    expect(repo.logAccess).not.toHaveBeenCalled();
  });

  it('grants access for an ACTIVE membership with a future end date', async () => {
    const repo = makeRepo();
    const person = makePerson();
    const membership = makeMembership();
    setupFound(repo, person, membership);
    const useCase = new CheckInAccessUseCase(repo);

    const result = await useCase.execute('tnt_1', '12345678');

    expect(result.granted).toBe(true);
    expect(result.person).toEqual(person);
    expect(result.membership).toEqual(membership);
    expect(repo.logAccess).toHaveBeenCalledWith({
      tenantId: 'tnt_1',
      membershipId: 'm1',
      granted: true,
    });
    expect(result.accessLog).toEqual(makeAccessLog());
  });

  it('denies access for an expired membership even when status is still ACTIVE', async () => {
    const repo = makeRepo();
    const membership = makeMembership({
      status: 'ACTIVE',
      endDate: new Date('2026-09-01T00:00:00Z'), // before NOW
    });
    setupFound(repo, makePerson(), membership);
    const useCase = new CheckInAccessUseCase(repo);

    const result = await useCase.execute('tnt_1', '12345678');

    expect(result.granted).toBe(false);
    expect(repo.logAccess).toHaveBeenCalledWith({
      tenantId: 'tnt_1',
      membershipId: 'm1',
      granted: false,
      denialReason: 'Membresía Vencida',
    });
    expect(result.message).toContain('Membresía Vencida');
    expect(result.membership).toEqual(membership);
    expect(result.accessLog).toEqual(makeAccessLog());
  });

  it('denies access for an inactive status (FROZEN) with a future end date', async () => {
    const repo = makeRepo();
    const membership = makeMembership({ status: 'FROZEN' });
    setupFound(repo, makePerson(), membership);
    const useCase = new CheckInAccessUseCase(repo);

    const result = await useCase.execute('tnt_1', '12345678');

    expect(result.granted).toBe(false);
    expect(repo.logAccess).toHaveBeenCalledWith({
      tenantId: 'tnt_1',
      membershipId: 'm1',
      granted: false,
      denialReason: 'Estado: FROZEN',
    });
    expect(result.message).toContain('Estado: FROZEN');
  });

  it('denies access for status EXPIRED even if the date is still in the future', async () => {
    const repo = makeRepo();
    const membership = makeMembership({ status: 'EXPIRED' });
    setupFound(repo, makePerson(), membership);
    const useCase = new CheckInAccessUseCase(repo);

    const result = await useCase.execute('tnt_1', '12345678');

    expect(result.granted).toBe(false);
    expect(repo.logAccess).toHaveBeenCalledWith({
      tenantId: 'tnt_1',
      membershipId: 'm1',
      granted: false,
      denialReason: 'Estado: EXPIRED',
    });
  });

  it('treats membership ending exactly now as still valid (boundary: endDate < now is strict)', async () => {
    const repo = makeRepo();
    setupFound(
      repo,
      makePerson(),
      makeMembership({ endDate: new Date('2026-09-17T12:00:00Z') }) // equals NOW
    );
    const useCase = new CheckInAccessUseCase(repo);

    const result = await useCase.execute('tnt_1', '12345678');

    expect(result.granted).toBe(true);
    expect(repo.logAccess).toHaveBeenCalledWith(
      expect.objectContaining({ granted: true })
    );
  });
});