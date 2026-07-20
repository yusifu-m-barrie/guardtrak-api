import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class IncidentNumberService {
  constructor(private readonly prisma: PrismaService) {}

  async nextNumber(organisationId: string): Promise<string> {
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `INC-${day}-`;
    const latest = await this.prisma.incident.findFirst({
      where: {
        organisationId,
        incidentNumber: { startsWith: prefix },
      },
      orderBy: { incidentNumber: 'desc' },
      select: { incidentNumber: true },
    });
    let seq = 1;
    if (latest?.incidentNumber) {
      const part = latest.incidentNumber.slice(prefix.length);
      const parsed = Number.parseInt(part, 10);
      if (!Number.isNaN(parsed)) {
        seq = parsed + 1;
      }
    }
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }
}
