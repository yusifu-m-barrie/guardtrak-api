/**
 * FOLPS development seed — idempotent.
 * Faith Of Life Protective Services.
 * Credentials below are DEVELOPMENT ONLY. Never use in production.
 */
import 'dotenv/config';
import { createHash } from 'crypto';
import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import {
  AccountStatus,
  AssignmentStatus,
  AttendanceEventType,
  AttendanceStatus,
  BreakStatus,
  BreakType,
  CheckpointStatus,
  CheckpointVerificationMethod,
  ClientStatus,
  DevicePlatform,
  DeviceStatus,
  EmergencyStatus,
  EvidenceStatus,
  EvidenceType,
  IncidentCategory,
  IncidentNoteVisibility,
  IncidentPriority,
  IncidentSeverity,
  IncidentStatus,
  NotificationPriority,
  NotificationType,
  SupportRequestCategory,
  SupportRequestPriority,
  SupportRequestStatus,
  OfficerEmploymentStatus,
  OrganisationStatus,
  PatrolAssignmentStatus,
  PatrolRouteStatus,
  PrismaClient,
  ShiftStatus,
  SiteStatus,
  UserRole,
} from '../generated/prisma/client';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is required for seeding');
}
if (
  !DATABASE_URL.startsWith('postgresql://') &&
  !DATABASE_URL.startsWith('postgres://')
) {
  throw new Error(
    'DATABASE_URL must be a direct postgres:// or postgresql:// URL for seeding',
  );
}

const pool = new Pool({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

/** Stable development IDs for idempotent upserts */
const IDS = {
  organisation: '11111111-1111-4111-8111-111111111111',
  superAdmin: '22222222-2222-4222-8222-222222222222',
  admin: '33333333-3333-4333-8333-333333333333',
  supervisorUser: '44444444-4444-4444-8444-444444444444',
  officerUser: '55555555-5555-4555-8555-555555555555',
  officer2User: '66666666-6666-4666-8666-666666666666',
  officerProfile: '77777777-7777-4777-8777-777777777777',
  officer2Profile: '88888888-8888-4888-8888-888888888888',
  supervisorProfile: '99999999-9999-4999-8999-999999999999',
  client: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  siteA: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  siteB: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  device: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  shiftCurrent: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  shiftUpcoming: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
  assignmentCurrent: 'a1111111-a111-4111-8111-a11111111111',
  assignmentUpcoming: 'a2222222-a222-4222-8222-a22222222222',
  attendance: 'a3333333-a333-4333-8333-a33333333333',
  break: 'a4444444-a444-4444-8444-a44444444444',
  patrolRoute: 'a5555555-a555-4555-8555-a55555555555',
  checkpoint1: 'a6666666-a666-4666-8666-a66666666666',
  checkpoint2: 'a7777777-a777-4777-8777-a77777777777',
  checkpoint3: 'a8888888-a888-4888-8888-a88888888888',
  patrolAssignment: 'a9999999-a999-4999-8999-a99999999999',
  patrolSnap1: 'aa111111-a111-4111-8111-aa1111111111',
  patrolSnap2: 'aa222222-a222-4222-8222-aa2222222222',
  patrolSnap3: 'aa333333-a333-4333-8333-aa3333333333',
  patrolVisit1: 'aa444444-a444-4444-8444-aa4444444444',
  incident: 'b1111111-b111-4111-8111-b11111111111',
  emergency: 'b2222222-b222-4222-8222-b22222222222',
  notification: 'b3333333-b333-4333-8333-b33333333333',
  evidence: 'b4444444-b444-4444-8444-b44444444444',
  faq1: 'b5555555-b555-4555-8555-b55555555555',
  faq2: 'b6666666-b666-4666-8666-b66666666666',
  faq3: 'b7777777-b777-4777-8777-b77777777777',
  supportRequest: 'b8888888-b888-4888-8888-b88888888888',
} as const;

const DEV_PASSWORD = 'FOLPS!Dev2026';

async function upsertUser(input: {
  id: string;
  organisationId: string | null;
  employeeId: string | null;
  email: string;
  phone: string | null;
  passwordHash: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  role: UserRole;
}): Promise<void> {
  const displayName = [input.firstName, input.middleName, input.lastName]
    .filter(Boolean)
    .join(' ');
  await prisma.user.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      organisationId: input.organisationId,
      employeeId: input.employeeId,
      email: input.email.toLowerCase(),
      phone: input.phone,
      passwordHash: input.passwordHash,
      firstName: input.firstName,
      middleName: input.middleName ?? null,
      lastName: input.lastName,
      displayName,
      role: input.role,
      status: AccountStatus.ACTIVE,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
    },
    update: {
      email: input.email.toLowerCase(),
      firstName: input.firstName,
      middleName: input.middleName ?? null,
      lastName: input.lastName,
      displayName,
      role: input.role,
      status: AccountStatus.ACTIVE,
      passwordHash: input.passwordHash,
      lockedUntil: null,
      failedLoginAttempts: 0,
      deletedAt: null,
    },
  });
}

async function main(): Promise<void> {
  const passwordHash = await argon2.hash(DEV_PASSWORD);

  await prisma.organisation.upsert({
    where: { id: IDS.organisation },
    create: {
      id: IDS.organisation,
      code: 'FOLPS',
      name: 'Faith Of Life Protective Services',
      legalName: 'Faith Of Life Protective Services Ltd',
      registrationNumber: 'FOLPS-DEV-REG-001',
      email: 'ops@folps.local',
      phone: '+23276000000',
      address: 'Freetown, Sierra Leone',
      countryCode: 'SL',
      timezone: 'Africa/Freetown',
      status: OrganisationStatus.ACTIVE,
    },
    update: {
      code: 'FOLPS',
      name: 'Faith Of Life Protective Services',
      legalName: 'Faith Of Life Protective Services Ltd',
      email: 'ops@folps.local',
      timezone: 'Africa/Freetown',
      status: OrganisationStatus.ACTIVE,
      deletedAt: null,
    },
  });

  await upsertUser({
    id: IDS.superAdmin,
    organisationId: null,
    employeeId: 'SUPER-ADMIN',
    email: 'superadmin@folps.local',
    phone: null,
    passwordHash,
    firstName: 'Platform',
    lastName: 'SuperAdmin',
    role: UserRole.SUPER_ADMIN,
  });

  await upsertUser({
    id: IDS.admin,
    organisationId: IDS.organisation,
    employeeId: 'ADM-001',
    email: 'admin@folps.local',
    phone: '+23276000001',
    passwordHash,
    firstName: 'Daniel',
    middleName: 'Salifu',
    lastName: 'Samura',
    role: UserRole.ADMINISTRATOR,
  });

  await upsertUser({
    id: IDS.supervisorUser,
    organisationId: IDS.organisation,
    employeeId: 'SUP-001',
    phone: '+23276000002',
    email: 'supervisor@folps.local',
    passwordHash,
    firstName: 'Ibrahim',
    lastName: 'Sesay',
    role: UserRole.SUPERVISOR,
  });

  await upsertUser({
    id: IDS.officerUser,
    organisationId: IDS.organisation,
    employeeId: 'OFF-001',
    phone: '+23276000003',
    email: 'officer@folps.local',
    passwordHash,
    firstName: 'Fatmata',
    lastName: 'Conteh',
    role: UserRole.SECURITY_OFFICER,
  });

  await upsertUser({
    id: IDS.officer2User,
    organisationId: IDS.organisation,
    employeeId: 'OFF-002',
    phone: '+23276000004',
    email: 'officer2@folps.local',
    passwordHash,
    firstName: 'Mohamed',
    lastName: 'Bangura',
    role: UserRole.SECURITY_OFFICER,
  });

  await prisma.supervisorProfile.upsert({
    where: { id: IDS.supervisorProfile },
    create: {
      id: IDS.supervisorProfile,
      organisationId: IDS.organisation,
      userId: IDS.supervisorUser,
      supervisorNumber: 'SUP-N-001',
      title: 'Site Supervisor',
    },
    update: {
      title: 'Site Supervisor',
      deletedAt: null,
    },
  });

  await prisma.officerProfile.upsert({
    where: { id: IDS.officerProfile },
    create: {
      id: IDS.officerProfile,
      organisationId: IDS.organisation,
      userId: IDS.officerUser,
      officerNumber: 'OFF-N-001',
      employmentStatus: OfficerEmploymentStatus.ACTIVE,
      hireDate: new Date('2024-01-15'),
      rankOrTitle: 'Security Officer',
      skills: [{ name: 'First Aid', issuedAt: '2025-01-01' }],
    },
    update: {
      employmentStatus: OfficerEmploymentStatus.ACTIVE,
      deletedAt: null,
    },
  });

  await prisma.officerProfile.upsert({
    where: { id: IDS.officer2Profile },
    create: {
      id: IDS.officer2Profile,
      organisationId: IDS.organisation,
      userId: IDS.officer2User,
      officerNumber: 'OFF-N-002',
      employmentStatus: OfficerEmploymentStatus.ACTIVE,
      hireDate: new Date('2024-06-01'),
      rankOrTitle: 'Security Officer',
    },
    update: {
      employmentStatus: OfficerEmploymentStatus.ACTIVE,
      deletedAt: null,
    },
  });

  const existingLink = await prisma.supervisorOfficer.findFirst({
    where: {
      organisationId: IDS.organisation,
      supervisorId: IDS.supervisorProfile,
      officerId: IDS.officerProfile,
      activeUntil: null,
    },
  });
  if (!existingLink) {
    await prisma.supervisorOfficer.create({
      data: {
        organisationId: IDS.organisation,
        supervisorId: IDS.supervisorProfile,
        officerId: IDS.officerProfile,
        activeFrom: new Date('2024-01-15'),
      },
    });
  }

  await prisma.client.upsert({
    where: { id: IDS.client },
    create: {
      id: IDS.client,
      organisationId: IDS.organisation,
      name: 'Freetown Commercial Plaza',
      legalName: 'Freetown Commercial Plaza Ltd',
      registrationNumber: 'CLI-DEV-001',
      primaryContactName: 'Joseph Cole',
      primaryContactEmail: 'contact@fcplaza.local',
      primaryContactPhone: '+23277000001',
      status: ClientStatus.ACTIVE,
    },
    update: {
      name: 'Freetown Commercial Plaza',
      status: ClientStatus.ACTIVE,
      deletedAt: null,
    },
  });

  await prisma.securitySite.upsert({
    where: { id: IDS.siteA },
    create: {
      id: IDS.siteA,
      organisationId: IDS.organisation,
      clientId: IDS.client,
      name: 'Plaza Main Gate',
      code: 'FCP-GATE-01',
      address: 'Wilkinson Road, Freetown',
      latitude: 8.4657,
      longitude: -13.2317,
      clockInRadiusMeters: 100,
      clockOutRadiusMeters: 150,
      checkpointDefaultRadiusMeters: 40,
      minimumGpsAccuracyMeters: 40,
      requiresClockInSelfie: true,
      requiresPatrol: true,
      requiresFinalShiftNote: true,
      status: SiteStatus.ACTIVE,
    },
    update: {
      name: 'Plaza Main Gate',
      status: SiteStatus.ACTIVE,
      deletedAt: null,
    },
  });

  await prisma.securitySite.upsert({
    where: { id: IDS.siteB },
    create: {
      id: IDS.siteB,
      organisationId: IDS.organisation,
      clientId: IDS.client,
      name: 'Plaza Parking Deck',
      code: 'FCP-PARK-01',
      address: 'Wilkinson Road Parking, Freetown',
      latitude: 8.4662,
      longitude: -13.2321,
      clockInRadiusMeters: 80,
      clockOutRadiusMeters: 120,
      status: SiteStatus.ACTIVE,
    },
    update: {
      name: 'Plaza Parking Deck',
      status: SiteStatus.ACTIVE,
      deletedAt: null,
    },
  });

  await prisma.device.upsert({
    where: { id: IDS.device },
    create: {
      id: IDS.device,
      organisationId: IDS.organisation,
      userId: IDS.officerUser,
      installationId: 'dev-install-officer-001',
      platform: DevicePlatform.ANDROID,
      deviceName: 'Officer Dev Phone',
      manufacturer: 'Google',
      model: 'Pixel Emulator',
      operatingSystem: 'Android',
      operatingSystemVersion: '14',
      appVersion: '1.0.0-dev',
      status: DeviceStatus.ACTIVE,
      trustedAt: new Date(),
      lastSeenAt: new Date(),
    },
    update: {
      status: DeviceStatus.ACTIVE,
      lastSeenAt: new Date(),
    },
  });

  const now = new Date();
  const startCurrent = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const endCurrent = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  const startUpcoming = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const endUpcoming = new Date(now.getTime() + 32 * 60 * 60 * 1000);

  await prisma.shift.upsert({
    where: { id: IDS.shiftCurrent },
    create: {
      id: IDS.shiftCurrent,
      organisationId: IDS.organisation,
      siteId: IDS.siteA,
      title: 'Day Shift — Main Gate',
      scheduledStartAt: startCurrent,
      scheduledEndAt: endCurrent,
      unpaidBreakMinutes: 30,
      gracePeriodMinutes: 15,
      status: ShiftStatus.IN_PROGRESS,
      createdByUserId: IDS.admin,
    },
    update: {
      status: ShiftStatus.IN_PROGRESS,
      scheduledStartAt: startCurrent,
      scheduledEndAt: endCurrent,
      deletedAt: null,
    },
  });

  await prisma.shift.upsert({
    where: { id: IDS.shiftUpcoming },
    create: {
      id: IDS.shiftUpcoming,
      organisationId: IDS.organisation,
      siteId: IDS.siteB,
      title: 'Night Shift — Parking Deck',
      scheduledStartAt: startUpcoming,
      scheduledEndAt: endUpcoming,
      unpaidBreakMinutes: 30,
      status: ShiftStatus.SCHEDULED,
      createdByUserId: IDS.admin,
    },
    update: {
      status: ShiftStatus.SCHEDULED,
      scheduledStartAt: startUpcoming,
      scheduledEndAt: endUpcoming,
      deletedAt: null,
    },
  });

  await prisma.assignment.upsert({
    where: { id: IDS.assignmentCurrent },
    create: {
      id: IDS.assignmentCurrent,
      organisationId: IDS.organisation,
      shiftId: IDS.shiftCurrent,
      officerId: IDS.officerProfile,
      supervisorId: IDS.supervisorProfile,
      status: AssignmentStatus.IN_PROGRESS,
      assignedAt: startCurrent,
      confirmedAt: startCurrent,
      startedAt: startCurrent,
      createdByUserId: IDS.admin,
    },
    update: {
      status: AssignmentStatus.IN_PROGRESS,
      supervisorId: IDS.supervisorProfile,
    },
  });

  await prisma.assignment.upsert({
    where: { id: IDS.assignmentUpcoming },
    create: {
      id: IDS.assignmentUpcoming,
      organisationId: IDS.organisation,
      shiftId: IDS.shiftUpcoming,
      officerId: IDS.officerProfile,
      supervisorId: IDS.supervisorProfile,
      status: AssignmentStatus.ASSIGNED,
      assignedAt: now,
      createdByUserId: IDS.admin,
    },
    update: {
      status: AssignmentStatus.ASSIGNED,
    },
  });

  await prisma.attendance.upsert({
    where: { id: IDS.attendance },
    create: {
      id: IDS.attendance,
      organisationId: IDS.organisation,
      assignmentId: IDS.assignmentCurrent,
      officerId: IDS.officerProfile,
      shiftId: IDS.shiftCurrent,
      siteId: IDS.siteA,
      status: AttendanceStatus.CLOCKED_IN,
      clockInDeviceAt: startCurrent,
      clockInServerAt: startCurrent,
      clockInLatitude: 8.4657,
      clockInLongitude: -13.2317,
      clockInAccuracyMeters: 12.5,
      clockInDistanceMeters: 18.0,
      clockInOutsideGeofence: false,
      localAttendanceId: 'local-att-dev-001',
      totalBreakMinutes: 0,
    },
    update: {
      status: AttendanceStatus.CLOCKED_IN,
      deletedAt: null,
    },
  });

  const clockInEvent = await prisma.attendanceEvent.findFirst({
    where: {
      attendanceId: IDS.attendance,
      type: AttendanceEventType.CLOCK_IN,
    },
  });
  if (!clockInEvent) {
    await prisma.attendanceEvent.create({
      data: {
        organisationId: IDS.organisation,
        attendanceId: IDS.attendance,
        type: AttendanceEventType.CLOCK_IN,
        actorUserId: IDS.officerUser,
        deviceId: IDS.device,
        deviceTimestamp: startCurrent,
        serverTimestamp: startCurrent,
        latitude: 8.4657,
        longitude: -13.2317,
        accuracyMeters: 12.5,
        distanceMeters: 18.0,
      },
    });
  }

  await prisma.shiftBreak.upsert({
    where: { id: IDS.break },
    create: {
      id: IDS.break,
      organisationId: IDS.organisation,
      attendanceId: IDS.attendance,
      officerId: IDS.officerProfile,
      shiftId: IDS.shiftCurrent,
      type: BreakType.MEAL,
      status: BreakStatus.COMPLETED,
      startedAtDevice: new Date(startCurrent.getTime() + 3 * 60 * 60 * 1000),
      startedAtServer: new Date(startCurrent.getTime() + 3 * 60 * 60 * 1000),
      endedAtDevice: new Date(startCurrent.getTime() + 3.5 * 60 * 60 * 1000),
      endedAtServer: new Date(startCurrent.getTime() + 3.5 * 60 * 60 * 1000),
      durationMinutes: 30,
      note: 'Meal break',
      localBreakId: 'local-break-dev-001',
    },
    update: {
      status: BreakStatus.COMPLETED,
      durationMinutes: 30,
    },
  });

  await prisma.patrolRoute.upsert({
    where: { id: IDS.patrolRoute },
    create: {
      id: IDS.patrolRoute,
      organisationId: IDS.organisation,
      siteId: IDS.siteA,
      name: 'Main Gate Perimeter',
      description: 'Standard perimeter walk',
      status: PatrolRouteStatus.ACTIVE,
      estimatedDurationMinutes: 25,
      requireSequentialCompletion: true,
      createdByUserId: IDS.admin,
    },
    update: {
      status: PatrolRouteStatus.ACTIVE,
      requireSequentialCompletion: true,
      deletedAt: null,
    },
  });

  const hashSeedQr = (value: string) =>
    createHash('sha256').update(value.trim().toUpperCase(), 'utf8').digest('hex');

  const checkpoints = [
    {
      id: IDS.checkpoint1,
      snapId: IDS.patrolSnap1,
      name: 'Front Entrance',
      sequence: 1,
      latitude: 8.4657,
      longitude: -13.2317,
      verificationMethod: CheckpointVerificationMethod.GPS,
      qrCodeValue: null as string | null,
    },
    {
      id: IDS.checkpoint2,
      snapId: IDS.patrolSnap2,
      name: 'East Fence',
      sequence: 2,
      latitude: 8.4659,
      longitude: -13.2312,
      verificationMethod: CheckpointVerificationMethod.QR_CODE,
      qrCodeValue: 'GT-CP-2',
    },
    {
      id: IDS.checkpoint3,
      snapId: IDS.patrolSnap3,
      name: 'Loading Bay',
      sequence: 3,
      latitude: 8.4661,
      longitude: -13.2315,
      verificationMethod: CheckpointVerificationMethod.GPS_AND_QR,
      qrCodeValue: 'GT-CP-3',
    },
  ] as const;

  for (const cp of checkpoints) {
    const qrCodeHash = cp.qrCodeValue ? hashSeedQr(cp.qrCodeValue) : null;
    await prisma.patrolCheckpoint.upsert({
      where: { id: cp.id },
      create: {
        id: cp.id,
        organisationId: IDS.organisation,
        patrolRouteId: IDS.patrolRoute,
        name: cp.name,
        sequence: cp.sequence,
        latitude: cp.latitude,
        longitude: cp.longitude,
        allowedRadiusMeters: 40,
        verificationMethod: cp.verificationMethod,
        qrCodeValue: cp.qrCodeValue,
        qrCodeHash,
        requiresPhoto: cp.sequence === 3,
        active: true,
      },
      update: {
        name: cp.name,
        sequence: cp.sequence,
        verificationMethod: cp.verificationMethod,
        qrCodeValue: cp.qrCodeValue,
        qrCodeHash,
        active: true,
        deletedAt: null,
      },
    });
  }

  await prisma.patrolAssignment.upsert({
    where: { id: IDS.patrolAssignment },
    create: {
      id: IDS.patrolAssignment,
      organisationId: IDS.organisation,
      patrolRouteId: IDS.patrolRoute,
      assignmentId: IDS.assignmentCurrent,
      officerId: IDS.officerProfile,
      shiftId: IDS.shiftCurrent,
      siteId: IDS.siteA,
      status: PatrolAssignmentStatus.IN_PROGRESS,
      startedAt: startCurrent,
      completedCheckpointCount: 1,
      totalCheckpointCount: 3,
    },
    update: {
      status: PatrolAssignmentStatus.IN_PROGRESS,
      completedCheckpointCount: 1,
      totalCheckpointCount: 3,
    },
  });

  for (const cp of checkpoints) {
    const qrCodeHash = cp.qrCodeValue ? hashSeedQr(cp.qrCodeValue) : null;
    await prisma.patrolAssignmentCheckpoint.upsert({
      where: { id: cp.snapId },
      create: {
        id: cp.snapId,
        organisationId: IDS.organisation,
        patrolAssignmentId: IDS.patrolAssignment,
        sourceCheckpointId: cp.id,
        name: cp.name,
        sequence: cp.sequence,
        latitude: cp.latitude,
        longitude: cp.longitude,
        allowedRadiusMeters: 40,
        verificationMethod: cp.verificationMethod,
        qrCodeHash,
        requiresPhoto: cp.sequence === 3,
      },
      update: {
        name: cp.name,
        sequence: cp.sequence,
        verificationMethod: cp.verificationMethod,
        qrCodeHash,
        sourceCheckpointId: cp.id,
      },
    });
  }

  await prisma.patrolVisit.deleteMany({
    where: {
      organisationId: IDS.organisation,
      OR: [
        { localVisitId: 'local-visit-dev-001' },
        {
          patrolAssignmentId: IDS.patrolAssignment,
          assignmentCheckpointId: IDS.patrolSnap1,
        },
      ],
      NOT: { id: IDS.patrolVisit1 },
    },
  });

  await prisma.patrolVisit.upsert({
    where: { id: IDS.patrolVisit1 },
    create: {
      id: IDS.patrolVisit1,
      organisationId: IDS.organisation,
      patrolAssignmentId: IDS.patrolAssignment,
      patrolCheckpointId: IDS.checkpoint1,
      assignmentCheckpointId: IDS.patrolSnap1,
      officerId: IDS.officerProfile,
      shiftId: IDS.shiftCurrent,
      siteId: IDS.siteA,
      status: CheckpointStatus.COMPLETED,
      verificationMethod: CheckpointVerificationMethod.GPS,
      visitedAtDevice: startCurrent,
      visitedAtServer: startCurrent,
      latitude: 8.4657,
      longitude: -13.2317,
      accuracyMeters: 10,
      distanceMeters: 5,
      localVisitId: 'local-visit-dev-001',
    },
    update: {
      status: CheckpointStatus.COMPLETED,
      assignmentCheckpointId: IDS.patrolSnap1,
      patrolCheckpointId: IDS.checkpoint1,
      verificationMethod: CheckpointVerificationMethod.GPS,
    },
  });

  await prisma.incident.upsert({
    where: { id: IDS.incident },
    create: {
      id: IDS.incident,
      organisationId: IDS.organisation,
      incidentNumber: 'INC-DEV-0001',
      clientId: IDS.client,
      siteId: IDS.siteA,
      shiftId: IDS.shiftCurrent,
      assignmentId: IDS.assignmentCurrent,
      reportedByOfficerId: IDS.officerProfile,
      reportedByUserId: IDS.officerUser,
      category: IncidentCategory.SUSPICIOUS_ACTIVITY,
      severity: IncidentSeverity.MEDIUM,
      priority: IncidentPriority.NORMAL,
      status: IncidentStatus.UNDER_REVIEW,
      title: 'Unfamiliar vehicle near loading bay',
      description:
        'Officer observed an unfamiliar vehicle lingering near the loading bay for approximately 10 minutes.',
      actionsTaken: 'Approached vehicle, recorded plate number, notified supervisor.',
      occurredAtDevice: startCurrent,
      occurredAtServer: startCurrent,
      reportedAtServer: startCurrent,
      latitude: 8.4661,
      longitude: -13.2315,
      peopleInvolved: [{ role: 'driver', description: 'Unknown male' }],
      witnesses: [],
      emergencyServicesContacted: false,
      requiresImmediateNotification: false,
      assignedSupervisorId: IDS.supervisorUser,
      localIncidentId: 'local-inc-dev-001',
    },
    update: {
      status: IncidentStatus.UNDER_REVIEW,
      deletedAt: null,
    },
  });

  const statusEvent = await prisma.incidentStatusEvent.findFirst({
    where: {
      incidentId: IDS.incident,
      newStatus: IncidentStatus.UNDER_REVIEW,
    },
  });
  if (!statusEvent) {
    await prisma.incidentStatusEvent.create({
      data: {
        organisationId: IDS.organisation,
        incidentId: IDS.incident,
        previousStatus: IncidentStatus.SUBMITTED,
        newStatus: IncidentStatus.UNDER_REVIEW,
        actorUserId: IDS.supervisorUser,
        note: 'Supervisor reviewing report',
        occurredAt: now,
      },
    });
  }

  const existingNote = await prisma.incidentNote.findFirst({
    where: {
      incidentId: IDS.incident,
      visibility: IncidentNoteVisibility.SUPERVISOR_ONLY,
      authorUserId: IDS.supervisorUser,
    },
  });
  if (!existingNote) {
    await prisma.incidentNote.create({
      data: {
        organisationId: IDS.organisation,
        incidentId: IDS.incident,
        authorUserId: IDS.supervisorUser,
        visibility: IncidentNoteVisibility.SUPERVISOR_ONLY,
        body: 'Plate cross-check requested with plaza security logs.',
      },
    });
  }

  await prisma.emergency.upsert({
    where: { id: IDS.emergency },
    create: {
      id: IDS.emergency,
      organisationId: IDS.organisation,
      emergencyNumber: 'SOS-DEV-0001',
      officerId: IDS.officerProfile,
      userId: IDS.officerUser,
      assignmentId: IDS.assignmentCurrent,
      shiftId: IDS.shiftCurrent,
      siteId: IDS.siteA,
      deviceId: IDS.device,
      status: EmergencyStatus.RESOLVED,
      latitude: 8.4657,
      longitude: -13.2317,
      accuracyMeters: 15,
      deviceCreatedAt: new Date(startCurrent.getTime() - 24 * 60 * 60 * 1000),
      serverCreatedAt: new Date(startCurrent.getTime() - 24 * 60 * 60 * 1000),
      acknowledgedAt: new Date(startCurrent.getTime() - 24 * 60 * 60 * 1000 + 120000),
      acknowledgedByUserId: IDS.supervisorUser,
      respondingAt: new Date(startCurrent.getTime() - 24 * 60 * 60 * 1000 + 180000),
      resolvedAt: new Date(startCurrent.getTime() - 24 * 60 * 60 * 1000 + 900000),
      resolvedByUserId: IDS.supervisorUser,
      resolutionNotes: 'False alarm — accidental SOS press. Officer confirmed safe.',
      localEmergencyId: 'local-sos-dev-001',
    },
    update: {
      status: EmergencyStatus.RESOLVED,
      resolutionNotes: 'False alarm — accidental SOS press. Officer confirmed safe.',
    },
  });

  await prisma.notification.upsert({
    where: { id: IDS.notification },
    create: {
      id: IDS.notification,
      organisationId: IDS.organisation,
      recipientUserId: IDS.officerUser,
      type: NotificationType.SHIFT_ASSIGNED,
      priority: NotificationPriority.NORMAL,
      title: 'Shift assigned',
      body: 'You have been assigned to Day Shift — Main Gate.',
      data: { shiftId: IDS.shiftCurrent },
    },
    update: {
      title: 'Shift assigned',
      body: 'You have been assigned to Day Shift — Main Gate.',
    },
  });

  const preferenceUsers = [
    IDS.superAdmin,
    IDS.admin,
    IDS.supervisorUser,
    IDS.officerUser,
    IDS.officer2User,
  ];
  for (const userId of preferenceUsers) {
    await prisma.notificationPreference.upsert({
      where: { userId },
      create: {
        userId,
        inAppEnabled: true,
        pushEnabled: true,
        smsEnabled: false,
        emailEnabled: true,
        criticalAlertsAlwaysEnabled: true,
      },
      update: {
        inAppEnabled: true,
        pushEnabled: true,
        criticalAlertsAlwaysEnabled: true,
      },
    });
  }

  await prisma.evidence.upsert({
    where: { id: IDS.evidence },
    create: {
      id: IDS.evidence,
      organisationId: IDS.organisation,
      uploadedByUserId: IDS.officerUser,
      incidentId: IDS.incident,
      type: EvidenceType.IMAGE,
      status: EvidenceStatus.AVAILABLE,
      originalFileName: 'loading-bay.jpg',
      storageProvider: 'local',
      storageBucket: 'local',
      storageKey: `${IDS.organisation}/incidents/${IDS.incident}/${IDS.evidence}.jpg`,
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
      checksum: createHash('sha256').update('seed-evidence').digest('hex'),
      uploadedAt: now,
      processedAt: now,
      verified: false,
    },
    update: {
      status: EvidenceStatus.AVAILABLE,
      deletedAt: null,
    },
  });

  const faqs = [
    {
      id: IDS.faq1,
      category: 'Getting Started',
      question: 'How do I clock in?',
      answer:
        'Open the FOLPS app, select your assignment, and tap Clock In while inside the site geofence.',
      sortOrder: 1,
    },
    {
      id: IDS.faq2,
      category: 'Incidents',
      question: 'How do I report an incident?',
      answer:
        'From the home screen, tap Report Incident, fill in the details, attach evidence if available, and submit.',
      sortOrder: 2,
    },
    {
      id: IDS.faq3,
      category: 'SOS',
      question: 'What happens when I press SOS?',
      answer:
        'Supervisors and administrators are notified immediately with your GPS location. Stay on the line if safe.',
      sortOrder: 3,
    },
  ];
  for (const faq of faqs) {
    await prisma.faqArticle.upsert({
      where: { id: faq.id },
      create: {
        id: faq.id,
        organisationId: null,
        category: faq.category,
        question: faq.question,
        answer: faq.answer,
        sortOrder: faq.sortOrder,
        published: true,
      },
      update: {
        question: faq.question,
        answer: faq.answer,
        published: true,
        deletedAt: null,
      },
    });
  }

  await prisma.supportRequest.upsert({
    where: { id: IDS.supportRequest },
    create: {
      id: IDS.supportRequest,
      organisationId: IDS.organisation,
      requestNumber: 'SUP-DEV-0001',
      userId: IDS.officerUser,
      subject: 'App sync stuck offline',
      description:
        'My device shows pending sync for two clock events. Please advise.',
      category: SupportRequestCategory.TECHNICAL,
      priority: SupportRequestPriority.NORMAL,
      status: SupportRequestStatus.OPEN,
    },
    update: {
      status: SupportRequestStatus.OPEN,
      subject: 'App sync stuck offline',
    },
  });

  // eslint-disable-next-line no-console
  console.log('FOLPS development seed completed (idempotent).');
  // eslint-disable-next-line no-console
  console.log('DEV accounts (password for all): FOLPS!Dev2026');
  // eslint-disable-next-line no-console
  console.log(
    [
      'superadmin@folps.local (SUPER_ADMIN)',
      'admin@folps.local (ADMINISTRATOR)',
      'supervisor@folps.local (SUPERVISOR)',
      'officer@folps.local (SECURITY_OFFICER)',
      'officer2@folps.local (SECURITY_OFFICER)',
    ].join('\n'),
  );
}

main()
  .catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
