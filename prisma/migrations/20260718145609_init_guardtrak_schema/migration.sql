-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SECURITY_OFFICER', 'SUPERVISOR', 'ADMINISTRATOR', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'DISABLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OrganisationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SiteStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OfficerEmploymentStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('IOS', 'ANDROID', 'WEB', 'OTHER');

-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ASSIGNED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REASSIGNED', 'MISSED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PENDING', 'CLOCKED_IN', 'CLOCKED_OUT', 'PENDING_SUPERVISOR_APPROVAL', 'APPROVED_WITH_WARNING', 'SUPERVISOR_APPROVED', 'SUPERVISOR_REJECTED', 'VOIDED');

-- CreateEnum
CREATE TYPE "AttendanceEventType" AS ENUM ('CLOCK_IN', 'CLOCK_OUT', 'CLOCK_IN_REVIEW_REQUESTED', 'CLOCK_OUT_REVIEW_REQUESTED', 'APPROVED', 'REJECTED', 'CORRECTED', 'VOIDED');

-- CreateEnum
CREATE TYPE "GeofencePolicy" AS ENUM ('BLOCK', 'ALLOW_WITH_REASON', 'REQUIRE_SUPERVISOR_APPROVAL');

-- CreateEnum
CREATE TYPE "BreakType" AS ENUM ('MEAL', 'REST', 'MEDICAL', 'AUTHORISED', 'OTHER');

-- CreateEnum
CREATE TYPE "BreakStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED', 'PENDING_SYNC', 'REQUIRES_REVIEW');

-- CreateEnum
CREATE TYPE "PatrolRouteStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PatrolAssignmentStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'PARTIALLY_COMPLETED', 'MISSED', 'CANCELLED', 'REQUIRES_REVIEW');

-- CreateEnum
CREATE TYPE "CheckpointStatus" AS ENUM ('PENDING', 'AVAILABLE', 'COMPLETED', 'MISSED', 'SKIPPED', 'OUTSIDE_GEOFENCE', 'REQUIRES_REVIEW');

-- CreateEnum
CREATE TYPE "CheckpointVerificationMethod" AS ENUM ('GPS', 'QR_CODE', 'GPS_AND_QR', 'MANUAL_SUPERVISOR_OVERRIDE');

-- CreateEnum
CREATE TYPE "IncidentCategory" AS ENUM ('THEFT', 'TRESPASSING', 'VIOLENCE', 'FIRE', 'MEDICAL_EMERGENCY', 'PROPERTY_DAMAGE', 'SUSPICIOUS_ACTIVITY', 'MISSING_PROPERTY', 'ACCESS_CONTROL_VIOLATION', 'WORKPLACE_ACCIDENT', 'SECURITY_BREACH', 'PUBLIC_DISTURBANCE', 'EQUIPMENT_FAILURE', 'OTHER');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'NEW', 'ACKNOWLEDGED', 'OFFICER_DISPATCHED', 'UNDER_REVIEW', 'UNDER_INVESTIGATION', 'ESCALATED', 'RESOLVED', 'CLOSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "IncidentNoteVisibility" AS ENUM ('OFFICER_VISIBLE', 'SUPERVISOR_ONLY', 'ADMIN_ONLY');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('PENDING_UPLOAD', 'UPLOADING', 'UPLOADED', 'PROCESSING', 'AVAILABLE', 'FAILED', 'REJECTED', 'DELETED');

-- CreateEnum
CREATE TYPE "EvidenceScanStatus" AS ENUM ('NOT_SCANNED', 'PENDING', 'CLEAN', 'INFECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('GENERAL', 'SHIFT_ASSIGNED', 'SHIFT_UPDATED', 'SHIFT_CANCELLED', 'CLOCK_IN_REMINDER', 'CLOCK_OUT_REMINDER', 'LATE_ALERT', 'ABSENCE_ALERT', 'ATTENDANCE_APPROVED', 'ATTENDANCE_REJECTED', 'INCIDENT_SUBMITTED', 'INCIDENT_ACKNOWLEDGED', 'INCIDENT_UPDATED', 'INCIDENT_ESCALATED', 'PATROL_ASSIGNED', 'PATROL_MISSED', 'SOS_ALERT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'PUSH', 'SMS', 'EMAIL');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('NOT_REQUESTED', 'QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "EmergencyStatus" AS ENUM ('CREATED', 'ACCEPTED_FOR_PROCESSING', 'ACKNOWLEDGED', 'RESPONDING', 'RESOLVED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "SupportRequestStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportRequestPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "SyncOperationStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CONFLICT', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'APPROVE', 'REJECT', 'ASSIGN', 'REASSIGN', 'CLOCK_IN', 'CLOCK_OUT', 'UPLOAD', 'DOWNLOAD', 'EXPORT', 'ESCALATE', 'RESOLVE');

-- CreateTable
CREATE TABLE "organisations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "registrationNumber" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "countryCode" VARCHAR(2) NOT NULL DEFAULT 'SL',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Freetown',
    "logoUrl" TEXT,
    "status" "OrganisationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "organisations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "organisationId" UUID,
    "employeeId" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "displayName" TEXT,
    "role" "UserRole" NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'INVITED',
    "avatarUrl" TEXT,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMPTZ(3),
    "passwordChangedAt" TIMESTAMPTZ(3),
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "deviceId" UUID,
    "tokenHash" TEXT NOT NULL,
    "familyId" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "replacedBySessionId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMPTZ(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "officer_profiles" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "officerNumber" TEXT NOT NULL,
    "employmentStatus" "OfficerEmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "hireDate" DATE,
    "nationalIdNumber" TEXT,
    "dateOfBirth" DATE,
    "gender" TEXT,
    "residentialAddress" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "emergencyContactRelationship" TEXT,
    "rankOrTitle" TEXT,
    "skills" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "officer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supervisor_profiles" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "supervisorNumber" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "supervisor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supervisor_officers" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "supervisorId" UUID NOT NULL,
    "officerId" UUID NOT NULL,
    "activeFrom" TIMESTAMPTZ(3) NOT NULL,
    "activeUntil" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supervisor_officers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "registrationNumber" TEXT,
    "primaryContactName" TEXT NOT NULL,
    "primaryContactEmail" TEXT,
    "primaryContactPhone" TEXT,
    "billingAddress" TEXT,
    "operationalNotes" TEXT,
    "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_sites" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "clockInRadiusMeters" INTEGER NOT NULL,
    "clockOutRadiusMeters" INTEGER NOT NULL,
    "checkpointDefaultRadiusMeters" INTEGER NOT NULL DEFAULT 50,
    "minimumGpsAccuracyMeters" INTEGER NOT NULL DEFAULT 50,
    "clockInOutsideGeofencePolicy" "GeofencePolicy" NOT NULL DEFAULT 'REQUIRE_SUPERVISOR_APPROVAL',
    "clockOutOutsideGeofencePolicy" "GeofencePolicy" NOT NULL DEFAULT 'ALLOW_WITH_REASON',
    "requiresClockInSelfie" BOOLEAN NOT NULL DEFAULT false,
    "requiresClockOutSelfie" BOOLEAN NOT NULL DEFAULT false,
    "requiresPatrol" BOOLEAN NOT NULL DEFAULT false,
    "requiresFinalShiftNote" BOOLEAN NOT NULL DEFAULT false,
    "instructions" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "status" "SiteStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "security_sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "installationId" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "deviceName" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "operatingSystem" TEXT,
    "operatingSystemVersion" TEXT,
    "appVersion" TEXT,
    "status" "DeviceStatus" NOT NULL DEFAULT 'PENDING',
    "trustedAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "lastSeenAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_tokens" (
    "id" UUID NOT NULL,
    "deviceId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastRegisteredAt" TIMESTAMPTZ(3) NOT NULL,
    "invalidatedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scheduledStartAt" TIMESTAMPTZ(3) NOT NULL,
    "scheduledEndAt" TIMESTAMPTZ(3) NOT NULL,
    "unpaidBreakMinutes" INTEGER NOT NULL DEFAULT 0,
    "gracePeriodMinutes" INTEGER NOT NULL DEFAULT 15,
    "overtimeThresholdMinutes" INTEGER,
    "status" "ShiftStatus" NOT NULL DEFAULT 'DRAFT',
    "instructions" TEXT,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "shiftId" UUID NOT NULL,
    "officerId" UUID NOT NULL,
    "supervisorId" UUID,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMPTZ(3),
    "startedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    "cancellationReason" TEXT,
    "replacedAssignmentId" UUID,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_events" (
    "id" UUID NOT NULL,
    "assignmentId" UUID NOT NULL,
    "actorUserId" UUID,
    "previousStatus" "AssignmentStatus",
    "newStatus" "AssignmentStatus" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendances" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "assignmentId" UUID NOT NULL,
    "officerId" UUID NOT NULL,
    "shiftId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PENDING',
    "clockInDeviceAt" TIMESTAMPTZ(3),
    "clockInServerAt" TIMESTAMPTZ(3),
    "clockOutDeviceAt" TIMESTAMPTZ(3),
    "clockOutServerAt" TIMESTAMPTZ(3),
    "clockInLatitude" DECIMAL(10,7),
    "clockInLongitude" DECIMAL(10,7),
    "clockInAccuracyMeters" DECIMAL(10,2),
    "clockInDistanceMeters" DECIMAL(10,2),
    "clockOutLatitude" DECIMAL(10,7),
    "clockOutLongitude" DECIMAL(10,7),
    "clockOutAccuracyMeters" DECIMAL(10,2),
    "clockOutDistanceMeters" DECIMAL(10,2),
    "clockInOutsideGeofence" BOOLEAN NOT NULL DEFAULT false,
    "clockOutOutsideGeofence" BOOLEAN NOT NULL DEFAULT false,
    "clockInReason" TEXT,
    "clockOutReason" TEXT,
    "clockInEvidenceId" UUID,
    "clockOutEvidenceId" UUID,
    "grossMinutes" INTEGER,
    "totalBreakMinutes" INTEGER NOT NULL DEFAULT 0,
    "payableMinutes" INTEGER,
    "overtimeMinutes" INTEGER,
    "lateMinutes" INTEGER,
    "earlyDepartureMinutes" INTEGER,
    "finalShiftNote" TEXT,
    "approvalRequestedAt" TIMESTAMPTZ(3),
    "reviewedAt" TIMESTAMPTZ(3),
    "reviewedByUserId" UUID,
    "reviewReason" TEXT,
    "localAttendanceId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_events" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "attendanceId" UUID NOT NULL,
    "type" "AttendanceEventType" NOT NULL,
    "actorUserId" UUID,
    "deviceId" UUID,
    "deviceTimestamp" TIMESTAMPTZ(3),
    "serverTimestamp" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "accuracyMeters" DECIMAL(10,2),
    "distanceMeters" DECIMAL(10,2),
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_breaks" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "attendanceId" UUID NOT NULL,
    "officerId" UUID NOT NULL,
    "shiftId" UUID NOT NULL,
    "type" "BreakType" NOT NULL,
    "status" "BreakStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAtDevice" TIMESTAMPTZ(3) NOT NULL,
    "startedAtServer" TIMESTAMPTZ(3),
    "endedAtDevice" TIMESTAMPTZ(3),
    "endedAtServer" TIMESTAMPTZ(3),
    "durationMinutes" INTEGER,
    "note" TEXT,
    "localBreakId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "shift_breaks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patrol_routes" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "status" "PatrolRouteStatus" NOT NULL DEFAULT 'DRAFT',
    "estimatedDurationMinutes" INTEGER,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "patrol_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patrol_checkpoints" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "patrolRouteId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sequence" INTEGER NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "allowedRadiusMeters" INTEGER NOT NULL,
    "qrCodeValue" TEXT,
    "requiresPhoto" BOOLEAN NOT NULL DEFAULT false,
    "requiresNote" BOOLEAN NOT NULL DEFAULT false,
    "instructions" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "patrol_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patrol_assignments" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "patrolRouteId" UUID NOT NULL,
    "assignmentId" UUID NOT NULL,
    "officerId" UUID NOT NULL,
    "shiftId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "scheduledStartAt" TIMESTAMPTZ(3),
    "scheduledEndAt" TIMESTAMPTZ(3),
    "startedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "status" "PatrolAssignmentStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "completedCheckpointCount" INTEGER NOT NULL DEFAULT 0,
    "totalCheckpointCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "patrol_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patrol_visits" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "patrolAssignmentId" UUID NOT NULL,
    "patrolCheckpointId" UUID NOT NULL,
    "officerId" UUID NOT NULL,
    "shiftId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "status" "CheckpointStatus" NOT NULL DEFAULT 'PENDING',
    "verificationMethod" "CheckpointVerificationMethod" NOT NULL,
    "visitedAtDevice" TIMESTAMPTZ(3) NOT NULL,
    "visitedAtServer" TIMESTAMPTZ(3),
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "accuracyMeters" DECIMAL(10,2),
    "distanceMeters" DECIMAL(10,2),
    "note" TEXT,
    "evidenceId" UUID,
    "localVisitId" TEXT,
    "reviewedAt" TIMESTAMPTZ(3),
    "reviewedByUserId" UUID,
    "reviewReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "patrol_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "incidentNumber" TEXT NOT NULL,
    "clientId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "shiftId" UUID,
    "assignmentId" UUID,
    "reportedByOfficerId" UUID NOT NULL,
    "reportedByUserId" UUID NOT NULL,
    "category" "IncidentCategory" NOT NULL,
    "severity" "IncidentSeverity" NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "actionsTaken" TEXT,
    "occurredAtDevice" TIMESTAMPTZ(3) NOT NULL,
    "occurredAtServer" TIMESTAMPTZ(3),
    "reportedAtServer" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "accuracyMeters" DECIMAL(10,2),
    "peopleInvolved" JSONB,
    "witnesses" JSONB,
    "emergencyServicesContacted" BOOLEAN NOT NULL DEFAULT false,
    "emergencyServiceDetails" TEXT,
    "requiresImmediateNotification" BOOLEAN NOT NULL DEFAULT false,
    "escalationReason" TEXT,
    "escalationTriggeredAt" TIMESTAMPTZ(3),
    "assignedSupervisorId" UUID,
    "acknowledgedAt" TIMESTAMPTZ(3),
    "dispatchedAt" TIMESTAMPTZ(3),
    "investigationStartedAt" TIMESTAMPTZ(3),
    "resolvedAt" TIMESTAMPTZ(3),
    "closedAt" TIMESTAMPTZ(3),
    "resolutionSummary" TEXT,
    "localIncidentId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_status_events" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "incidentId" UUID NOT NULL,
    "previousStatus" "IncidentStatus",
    "newStatus" "IncidentStatus" NOT NULL,
    "actorUserId" UUID,
    "note" TEXT,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_notes" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "incidentId" UUID NOT NULL,
    "authorUserId" UUID NOT NULL,
    "visibility" "IncidentNoteVisibility" NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "incident_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidences" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "uploadedByUserId" UUID NOT NULL,
    "incidentId" UUID,
    "attendanceId" UUID,
    "patrolVisitId" UUID,
    "emergencyId" UUID,
    "supportRequestId" UUID,
    "type" "EvidenceType" NOT NULL,
    "status" "EvidenceStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "scanStatus" "EvidenceScanStatus" NOT NULL DEFAULT 'NOT_SCANNED',
    "originalFileName" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "storageBucket" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "durationSeconds" INTEGER,
    "capturedAtDevice" TIMESTAMPTZ(3),
    "uploadedAt" TIMESTAMPTZ(3),
    "processedAt" TIMESTAMPTZ(3),
    "rejectedReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "evidences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "recipientUserId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "readAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL,
    "notificationId" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "providerMessageId" TEXT,
    "queuedAt" TIMESTAMPTZ(3),
    "sentAt" TIMESTAMPTZ(3),
    "deliveredAt" TIMESTAMPTZ(3),
    "failedAt" TIMESTAMPTZ(3),
    "failureReason" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "criticalAlertsAlwaysEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergencies" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "emergencyNumber" TEXT NOT NULL,
    "officerId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "assignmentId" UUID,
    "shiftId" UUID,
    "siteId" UUID,
    "deviceId" UUID,
    "status" "EmergencyStatus" NOT NULL DEFAULT 'CREATED',
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "accuracyMeters" DECIMAL(10,2),
    "deviceCreatedAt" TIMESTAMPTZ(3) NOT NULL,
    "serverCreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMPTZ(3),
    "acknowledgedByUserId" UUID,
    "respondingAt" TIMESTAMPTZ(3),
    "resolvedAt" TIMESTAMPTZ(3),
    "resolvedByUserId" UUID,
    "cancellationReason" TEXT,
    "resolutionNotes" TEXT,
    "localEmergencyId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "emergencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_status_events" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "emergencyId" UUID NOT NULL,
    "previousStatus" "EmergencyStatus",
    "newStatus" "EmergencyStatus" NOT NULL,
    "actorUserId" UUID,
    "note" TEXT,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emergency_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_requests" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "SupportRequestPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "SupportRequestStatus" NOT NULL DEFAULT 'OPEN',
    "assignedToUserId" UUID,
    "deviceDiagnostics" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMPTZ(3),
    "resolvedAt" TIMESTAMPTZ(3),
    "closedAt" TIMESTAMPTZ(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "support_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_messages" (
    "id" UUID NOT NULL,
    "supportRequestId" UUID NOT NULL,
    "authorUserId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL,
    "organisationId" UUID,
    "userId" UUID,
    "key" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" "SyncOperationStatus" NOT NULL DEFAULT 'RECEIVED',
    "httpStatus" INTEGER,
    "responseBody" JSONB,
    "resourceType" TEXT,
    "resourceId" UUID,
    "lockedUntil" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_conflicts" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "operationId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "localEntityId" TEXT,
    "serverEntityId" UUID,
    "reasonCode" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "localPayload" JSONB,
    "serverPayload" JSONB,
    "resolvedAt" TIMESTAMPTZ(3),
    "resolvedByUserId" UUID,
    "resolution" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sync_conflicts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_operations" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "deviceId" UUID,
    "operationId" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "status" "SyncOperationStatus" NOT NULL DEFAULT 'RECEIVED',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sync_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "organisationId" UUID,
    "actorUserId" UUID,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID,
    "requestId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "beforeData" JSONB,
    "afterData" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organisations_registrationNumber_key" ON "organisations"("registrationNumber");

-- CreateIndex
CREATE INDEX "organisations_status_idx" ON "organisations"("status");

-- CreateIndex
CREATE INDEX "organisations_deletedAt_idx" ON "organisations"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_organisationId_role_status_idx" ON "users"("organisationId", "role", "status");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_organisationId_employeeId_key" ON "users"("organisationId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "users_organisationId_phone_key" ON "users"("organisationId", "phone");

-- CreateIndex
CREATE INDEX "refresh_sessions_userId_idx" ON "refresh_sessions"("userId");

-- CreateIndex
CREATE INDEX "refresh_sessions_familyId_idx" ON "refresh_sessions"("familyId");

-- CreateIndex
CREATE INDEX "refresh_sessions_expiresAt_idx" ON "refresh_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "refresh_sessions_tokenHash_idx" ON "refresh_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expiresAt_idx" ON "password_reset_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "officer_profiles_userId_key" ON "officer_profiles"("userId");

-- CreateIndex
CREATE INDEX "officer_profiles_organisationId_employmentStatus_idx" ON "officer_profiles"("organisationId", "employmentStatus");

-- CreateIndex
CREATE INDEX "officer_profiles_deletedAt_idx" ON "officer_profiles"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "officer_profiles_organisationId_officerNumber_key" ON "officer_profiles"("organisationId", "officerNumber");

-- CreateIndex
CREATE UNIQUE INDEX "supervisor_profiles_userId_key" ON "supervisor_profiles"("userId");

-- CreateIndex
CREATE INDEX "supervisor_profiles_organisationId_idx" ON "supervisor_profiles"("organisationId");

-- CreateIndex
CREATE INDEX "supervisor_profiles_deletedAt_idx" ON "supervisor_profiles"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "supervisor_profiles_organisationId_supervisorNumber_key" ON "supervisor_profiles"("organisationId", "supervisorNumber");

-- CreateIndex
CREATE INDEX "supervisor_officers_organisationId_idx" ON "supervisor_officers"("organisationId");

-- CreateIndex
CREATE INDEX "supervisor_officers_supervisorId_officerId_idx" ON "supervisor_officers"("supervisorId", "officerId");

-- CreateIndex
CREATE INDEX "supervisor_officers_officerId_idx" ON "supervisor_officers"("officerId");

-- CreateIndex
CREATE INDEX "clients_organisationId_status_idx" ON "clients"("organisationId", "status");

-- CreateIndex
CREATE INDEX "clients_deletedAt_idx" ON "clients"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "clients_organisationId_name_key" ON "clients"("organisationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "clients_organisationId_registrationNumber_key" ON "clients"("organisationId", "registrationNumber");

-- CreateIndex
CREATE INDEX "security_sites_clientId_status_idx" ON "security_sites"("clientId", "status");

-- CreateIndex
CREATE INDEX "security_sites_organisationId_status_idx" ON "security_sites"("organisationId", "status");

-- CreateIndex
CREATE INDEX "security_sites_deletedAt_idx" ON "security_sites"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "security_sites_organisationId_code_key" ON "security_sites"("organisationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "devices_installationId_key" ON "devices"("installationId");

-- CreateIndex
CREATE INDEX "devices_userId_status_idx" ON "devices"("userId", "status");

-- CreateIndex
CREATE INDEX "devices_organisationId_status_idx" ON "devices"("organisationId", "status");

-- CreateIndex
CREATE INDEX "push_tokens_deviceId_active_idx" ON "push_tokens"("deviceId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "push_tokens_deviceId_token_key" ON "push_tokens"("deviceId", "token");

-- CreateIndex
CREATE INDEX "shifts_organisationId_status_scheduledStartAt_idx" ON "shifts"("organisationId", "status", "scheduledStartAt");

-- CreateIndex
CREATE INDEX "shifts_siteId_scheduledStartAt_idx" ON "shifts"("siteId", "scheduledStartAt");

-- CreateIndex
CREATE INDEX "shifts_deletedAt_idx" ON "shifts"("deletedAt");

-- CreateIndex
CREATE INDEX "assignments_organisationId_status_idx" ON "assignments"("organisationId", "status");

-- CreateIndex
CREATE INDEX "assignments_officerId_status_assignedAt_idx" ON "assignments"("officerId", "status", "assignedAt");

-- CreateIndex
CREATE INDEX "assignments_shiftId_officerId_status_idx" ON "assignments"("shiftId", "officerId", "status");

-- CreateIndex
CREATE INDEX "assignments_shiftId_status_idx" ON "assignments"("shiftId", "status");

-- CreateIndex
CREATE INDEX "assignments_assignedAt_idx" ON "assignments"("assignedAt");

-- CreateIndex
CREATE INDEX "assignment_events_assignmentId_createdAt_idx" ON "assignment_events"("assignmentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "attendances_assignmentId_key" ON "attendances"("assignmentId");

-- CreateIndex
CREATE INDEX "attendances_organisationId_status_idx" ON "attendances"("organisationId", "status");

-- CreateIndex
CREATE INDEX "attendances_officerId_clockInServerAt_idx" ON "attendances"("officerId", "clockInServerAt");

-- CreateIndex
CREATE INDEX "attendances_siteId_status_idx" ON "attendances"("siteId", "status");

-- CreateIndex
CREATE INDEX "attendances_shiftId_idx" ON "attendances"("shiftId");

-- CreateIndex
CREATE INDEX "attendances_deletedAt_idx" ON "attendances"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "attendances_organisationId_localAttendanceId_key" ON "attendances"("organisationId", "localAttendanceId");

-- CreateIndex
CREATE INDEX "attendance_events_attendanceId_createdAt_idx" ON "attendance_events"("attendanceId", "createdAt");

-- CreateIndex
CREATE INDEX "attendance_events_organisationId_type_idx" ON "attendance_events"("organisationId", "type");

-- CreateIndex
CREATE INDEX "shift_breaks_attendanceId_status_idx" ON "shift_breaks"("attendanceId", "status");

-- CreateIndex
CREATE INDEX "shift_breaks_officerId_status_idx" ON "shift_breaks"("officerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "shift_breaks_organisationId_localBreakId_key" ON "shift_breaks"("organisationId", "localBreakId");

-- CreateIndex
CREATE INDEX "patrol_routes_organisationId_status_idx" ON "patrol_routes"("organisationId", "status");

-- CreateIndex
CREATE INDEX "patrol_routes_siteId_status_idx" ON "patrol_routes"("siteId", "status");

-- CreateIndex
CREATE INDEX "patrol_routes_deletedAt_idx" ON "patrol_routes"("deletedAt");

-- CreateIndex
CREATE INDEX "patrol_checkpoints_patrolRouteId_sequence_idx" ON "patrol_checkpoints"("patrolRouteId", "sequence");

-- CreateIndex
CREATE INDEX "patrol_checkpoints_organisationId_idx" ON "patrol_checkpoints"("organisationId");

-- CreateIndex
CREATE INDEX "patrol_checkpoints_deletedAt_idx" ON "patrol_checkpoints"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "patrol_checkpoints_patrolRouteId_sequence_key" ON "patrol_checkpoints"("patrolRouteId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "patrol_checkpoints_qrCodeValue_key" ON "patrol_checkpoints"("qrCodeValue");

-- CreateIndex
CREATE INDEX "patrol_assignments_organisationId_status_idx" ON "patrol_assignments"("organisationId", "status");

-- CreateIndex
CREATE INDEX "patrol_assignments_officerId_status_idx" ON "patrol_assignments"("officerId", "status");

-- CreateIndex
CREATE INDEX "patrol_assignments_assignmentId_idx" ON "patrol_assignments"("assignmentId");

-- CreateIndex
CREATE INDEX "patrol_assignments_siteId_status_idx" ON "patrol_assignments"("siteId", "status");

-- CreateIndex
CREATE INDEX "patrol_visits_patrolAssignmentId_status_idx" ON "patrol_visits"("patrolAssignmentId", "status");

-- CreateIndex
CREATE INDEX "patrol_visits_officerId_visitedAtServer_idx" ON "patrol_visits"("officerId", "visitedAtServer");

-- CreateIndex
CREATE INDEX "patrol_visits_status_visitedAtServer_idx" ON "patrol_visits"("status", "visitedAtServer");

-- CreateIndex
CREATE UNIQUE INDEX "patrol_visits_patrolAssignmentId_patrolCheckpointId_key" ON "patrol_visits"("patrolAssignmentId", "patrolCheckpointId");

-- CreateIndex
CREATE UNIQUE INDEX "patrol_visits_organisationId_localVisitId_key" ON "patrol_visits"("organisationId", "localVisitId");

-- CreateIndex
CREATE INDEX "incidents_organisationId_status_severity_idx" ON "incidents"("organisationId", "status", "severity");

-- CreateIndex
CREATE INDEX "incidents_siteId_status_idx" ON "incidents"("siteId", "status");

-- CreateIndex
CREATE INDEX "incidents_reportedByOfficerId_reportedAtServer_idx" ON "incidents"("reportedByOfficerId", "reportedAtServer");

-- CreateIndex
CREATE INDEX "incidents_reportedAtServer_idx" ON "incidents"("reportedAtServer");

-- CreateIndex
CREATE INDEX "incidents_deletedAt_idx" ON "incidents"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "incidents_organisationId_incidentNumber_key" ON "incidents"("organisationId", "incidentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "incidents_organisationId_localIncidentId_key" ON "incidents"("organisationId", "localIncidentId");

-- CreateIndex
CREATE INDEX "incident_status_events_incidentId_occurredAt_idx" ON "incident_status_events"("incidentId", "occurredAt");

-- CreateIndex
CREATE INDEX "incident_notes_incidentId_createdAt_idx" ON "incident_notes"("incidentId", "createdAt");

-- CreateIndex
CREATE INDEX "incident_notes_visibility_idx" ON "incident_notes"("visibility");

-- CreateIndex
CREATE UNIQUE INDEX "evidences_storageKey_key" ON "evidences"("storageKey");

-- CreateIndex
CREATE INDEX "evidences_organisationId_status_idx" ON "evidences"("organisationId", "status");

-- CreateIndex
CREATE INDEX "evidences_incidentId_idx" ON "evidences"("incidentId");

-- CreateIndex
CREATE INDEX "evidences_uploadedByUserId_createdAt_idx" ON "evidences"("uploadedByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "evidences_attendanceId_idx" ON "evidences"("attendanceId");

-- CreateIndex
CREATE INDEX "evidences_patrolVisitId_idx" ON "evidences"("patrolVisitId");

-- CreateIndex
CREATE INDEX "evidences_createdAt_idx" ON "evidences"("createdAt");

-- CreateIndex
CREATE INDEX "evidences_deletedAt_idx" ON "evidences"("deletedAt");

-- CreateIndex
CREATE INDEX "notifications_recipientUserId_readAt_createdAt_idx" ON "notifications"("recipientUserId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_organisationId_type_idx" ON "notifications"("organisationId", "type");

-- CreateIndex
CREATE INDEX "notification_deliveries_notificationId_channel_idx" ON "notification_deliveries"("notificationId", "channel");

-- CreateIndex
CREATE INDEX "notification_deliveries_status_idx" ON "notification_deliveries"("status");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_key" ON "notification_preferences"("userId");

-- CreateIndex
CREATE INDEX "emergencies_organisationId_status_serverCreatedAt_idx" ON "emergencies"("organisationId", "status", "serverCreatedAt");

-- CreateIndex
CREATE INDEX "emergencies_officerId_serverCreatedAt_idx" ON "emergencies"("officerId", "serverCreatedAt");

-- CreateIndex
CREATE INDEX "emergencies_siteId_status_idx" ON "emergencies"("siteId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "emergencies_organisationId_emergencyNumber_key" ON "emergencies"("organisationId", "emergencyNumber");

-- CreateIndex
CREATE UNIQUE INDEX "emergencies_organisationId_localEmergencyId_key" ON "emergencies"("organisationId", "localEmergencyId");

-- CreateIndex
CREATE INDEX "emergency_status_events_emergencyId_occurredAt_idx" ON "emergency_status_events"("emergencyId", "occurredAt");

-- CreateIndex
CREATE INDEX "support_requests_organisationId_status_idx" ON "support_requests"("organisationId", "status");

-- CreateIndex
CREATE INDEX "support_requests_userId_createdAt_idx" ON "support_requests"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "support_requests_organisationId_requestNumber_key" ON "support_requests"("organisationId", "requestNumber");

-- CreateIndex
CREATE INDEX "support_messages_supportRequestId_createdAt_idx" ON "support_messages"("supportRequestId", "createdAt");

-- CreateIndex
CREATE INDEX "idempotency_records_expiresAt_status_idx" ON "idempotency_records"("expiresAt", "status");

-- CreateIndex
CREATE INDEX "idempotency_records_organisationId_operation_idx" ON "idempotency_records"("organisationId", "operation");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_userId_key_key" ON "idempotency_records"("userId", "key");

-- CreateIndex
CREATE INDEX "sync_conflicts_organisationId_userId_idx" ON "sync_conflicts"("organisationId", "userId");

-- CreateIndex
CREATE INDEX "sync_conflicts_operationId_idx" ON "sync_conflicts"("operationId");

-- CreateIndex
CREATE INDEX "sync_conflicts_resolvedAt_idx" ON "sync_conflicts"("resolvedAt");

-- CreateIndex
CREATE INDEX "sync_operations_organisationId_status_idx" ON "sync_operations"("organisationId", "status");

-- CreateIndex
CREATE INDEX "sync_operations_deviceId_receivedAt_idx" ON "sync_operations"("deviceId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "sync_operations_userId_operationId_key" ON "sync_operations"("userId", "operationId");

-- CreateIndex
CREATE INDEX "audit_logs_organisationId_createdAt_idx" ON "audit_logs"("organisationId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorUserId_createdAt_idx" ON "audit_logs"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_replacedBySessionId_fkey" FOREIGN KEY ("replacedBySessionId") REFERENCES "refresh_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "officer_profiles" ADD CONSTRAINT "officer_profiles_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "officer_profiles" ADD CONSTRAINT "officer_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supervisor_profiles" ADD CONSTRAINT "supervisor_profiles_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supervisor_profiles" ADD CONSTRAINT "supervisor_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supervisor_officers" ADD CONSTRAINT "supervisor_officers_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supervisor_officers" ADD CONSTRAINT "supervisor_officers_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "supervisor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supervisor_officers" ADD CONSTRAINT "supervisor_officers_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "officer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_sites" ADD CONSTRAINT "security_sites_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_sites" ADD CONSTRAINT "security_sites_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "security_sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "officer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "supervisor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_replacedAssignmentId_fkey" FOREIGN KEY ("replacedAssignmentId") REFERENCES "assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_events" ADD CONSTRAINT "assignment_events_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_events" ADD CONSTRAINT "assignment_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "officer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "security_sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "attendances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_breaks" ADD CONSTRAINT "shift_breaks_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_breaks" ADD CONSTRAINT "shift_breaks_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "attendances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_breaks" ADD CONSTRAINT "shift_breaks_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "officer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_breaks" ADD CONSTRAINT "shift_breaks_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patrol_routes" ADD CONSTRAINT "patrol_routes_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patrol_routes" ADD CONSTRAINT "patrol_routes_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "security_sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patrol_routes" ADD CONSTRAINT "patrol_routes_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patrol_checkpoints" ADD CONSTRAINT "patrol_checkpoints_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patrol_checkpoints" ADD CONSTRAINT "patrol_checkpoints_patrolRouteId_fkey" FOREIGN KEY ("patrolRouteId") REFERENCES "patrol_routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patrol_assignments" ADD CONSTRAINT "patrol_assignments_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patrol_assignments" ADD CONSTRAINT "patrol_assignments_patrolRouteId_fkey" FOREIGN KEY ("patrolRouteId") REFERENCES "patrol_routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patrol_assignments" ADD CONSTRAINT "patrol_assignments_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patrol_assignments" ADD CONSTRAINT "patrol_assignments_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "officer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patrol_assignments" ADD CONSTRAINT "patrol_assignments_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patrol_assignments" ADD CONSTRAINT "patrol_assignments_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "security_sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patrol_visits" ADD CONSTRAINT "patrol_visits_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patrol_visits" ADD CONSTRAINT "patrol_visits_patrolAssignmentId_fkey" FOREIGN KEY ("patrolAssignmentId") REFERENCES "patrol_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patrol_visits" ADD CONSTRAINT "patrol_visits_patrolCheckpointId_fkey" FOREIGN KEY ("patrolCheckpointId") REFERENCES "patrol_checkpoints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patrol_visits" ADD CONSTRAINT "patrol_visits_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "officer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patrol_visits" ADD CONSTRAINT "patrol_visits_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patrol_visits" ADD CONSTRAINT "patrol_visits_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "security_sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patrol_visits" ADD CONSTRAINT "patrol_visits_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "security_sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_reportedByOfficerId_fkey" FOREIGN KEY ("reportedByOfficerId") REFERENCES "officer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_reportedByUserId_fkey" FOREIGN KEY ("reportedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_assignedSupervisorId_fkey" FOREIGN KEY ("assignedSupervisorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_status_events" ADD CONSTRAINT "incident_status_events_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_status_events" ADD CONSTRAINT "incident_status_events_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_status_events" ADD CONSTRAINT "incident_status_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_notes" ADD CONSTRAINT "incident_notes_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_notes" ADD CONSTRAINT "incident_notes_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_notes" ADD CONSTRAINT "incident_notes_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "attendances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_patrolVisitId_fkey" FOREIGN KEY ("patrolVisitId") REFERENCES "patrol_visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_emergencyId_fkey" FOREIGN KEY ("emergencyId") REFERENCES "emergencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_supportRequestId_fkey" FOREIGN KEY ("supportRequestId") REFERENCES "support_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergencies" ADD CONSTRAINT "emergencies_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergencies" ADD CONSTRAINT "emergencies_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "officer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergencies" ADD CONSTRAINT "emergencies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergencies" ADD CONSTRAINT "emergencies_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergencies" ADD CONSTRAINT "emergencies_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergencies" ADD CONSTRAINT "emergencies_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "security_sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergencies" ADD CONSTRAINT "emergencies_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergencies" ADD CONSTRAINT "emergencies_acknowledgedByUserId_fkey" FOREIGN KEY ("acknowledgedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergencies" ADD CONSTRAINT "emergencies_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_status_events" ADD CONSTRAINT "emergency_status_events_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_status_events" ADD CONSTRAINT "emergency_status_events_emergencyId_fkey" FOREIGN KEY ("emergencyId") REFERENCES "emergencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_status_events" ADD CONSTRAINT "emergency_status_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_supportRequestId_fkey" FOREIGN KEY ("supportRequestId") REFERENCES "support_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_conflicts" ADD CONSTRAINT "sync_conflicts_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_conflicts" ADD CONSTRAINT "sync_conflicts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_conflicts" ADD CONSTRAINT "sync_conflicts_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_operations" ADD CONSTRAINT "sync_operations_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_operations" ADD CONSTRAINT "sync_operations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_operations" ADD CONSTRAINT "sync_operations_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
