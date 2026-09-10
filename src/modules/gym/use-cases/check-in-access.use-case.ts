import { IGymRepository, CheckInResult } from '@/core/ports/gym-repository.port';

export class CheckInAccessUseCase {
  constructor(private gymRepository: IGymRepository) {}

  async execute(tenantId: string, searchInput: string): Promise<CheckInResult> {
    const trimmedInput = searchInput.trim();

    if (!trimmedInput) {
      return {
        granted: false,
        message: 'Debe ingresar un número de documento o ID de socio.',
      };
    }

    // Buscar socio por documento o ID de persona
    const result = await this.gymRepository.findPersonWithMembership(tenantId, {
      documentId: trimmedInput,
      personId: trimmedInput,
    });

    if (!result) {
      return {
        granted: false,
        message: `Socio con documento/ID "${trimmedInput}" no encontrado.`,
      };
    }

    const { person, membership } = result;

    if (!membership) {
      return {
        granted: false,
        message: `El socio ${person.firstName} ${person.lastName} no posee ninguna membresía registrada.`,
        person,
      };
    }

    const now = new Date();
    const isExpired = new Date(membership.endDate) < now;
    const isInactiveStatus = membership.status !== 'ACTIVE';

    if (isInactiveStatus || isExpired) {
      const denialReason = isExpired ? 'Membresía Vencida' : `Estado: ${membership.status}`;

      const accessLog = await this.gymRepository.logAccess({
        tenantId,
        membershipId: membership.id,
        granted: false,
        denialReason,
      });

      return {
        granted: false,
        message: `Acceso denegado a ${person.firstName} ${person.lastName}: ${denialReason}. (Venció: ${new Date(membership.endDate).toLocaleDateString()})`,
        person,
        membership,
        accessLog,
      };
    }

    // Membresía activa y vigente -> Acceso concedido
    const accessLog = await this.gymRepository.logAccess({
      tenantId,
      membershipId: membership.id,
      granted: true,
    });

    return {
      granted: true,
      message: `¡Bienvenido(a) ${person.firstName} ${person.lastName}! Membresía "${membership.planName}" activa hasta el ${new Date(membership.endDate).toLocaleDateString()}.`,
      person,
      membership,
      accessLog,
    };
  }
}
