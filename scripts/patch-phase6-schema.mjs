import fs from 'fs';

const path = 'prisma/schema.prisma';
let s = fs.readFileSync(path, 'utf8');
const start = s.indexOf('model PatrolRoute {');
const end = s.indexOf(
  '// =============================================================================\n// INCIDENTS',
);
if (start < 0 || end < 0) {
  throw new Error(`markers not found ${start} ${end}`);
}

const replacement = `model PatrolRoute {
  id                          String            @id @default(uuid()) @db.Uuid
  organisationId              String            @db.Uuid
  siteId                      String            @db.Uuid
  name                        String
  description                 String?
  instructions                String?
  status                      PatrolRouteStatus @default(DRAFT)
  estimatedDurationMinutes    Int?
  requireSequentialCompletion Boolean           @default(true)
  createdByUserId             String            @db.Uuid
  createdAt                   DateTime          @default(now()) @db.Timestamptz(3)
  updatedAt                   DateTime          @updatedAt @db.Timestamptz(3)
  deletedAt                   DateTime?         @db.Timestamptz(3)

  organisation Organisation       @relation(fields: [organisationId], references: [id], onDelete: Restrict)
  site         SecuritySite       @relation(fields: [siteId], references: [id], onDelete: Restrict)
  createdBy    User               @relation("PatrolRouteCreator", fields: [createdByUserId], references: [id], onDelete: Restrict)
  checkpoints  PatrolCheckpoint[]
  assignments  PatrolAssignment[]

  @@index([organisationId, status])
  @@index([siteId, status])
  @@index([deletedAt])
  @@map("patrol_routes")
}

model PatrolCheckpoint {
  id                       String                       @id @default(uuid()) @db.Uuid
  organisationId           String                       @db.Uuid
  patrolRouteId            String                       @db.Uuid
  name                     String
  description              String?
  sequence                 Int
  latitude                 Decimal                      @db.Decimal(10, 7)
  longitude                Decimal                      @db.Decimal(10, 7)
  allowedRadiusMeters      Int
  verificationMethod       CheckpointVerificationMethod @default(GPS)
  /// Dev/migration plaintext — never returned by API. Prefer qrCodeHash.
  qrCodeValue              String?
  qrCodeHash               String?
  minimumGpsAccuracyMeters Int?
  requiresPhoto            Boolean                      @default(false)
  requiresNote             Boolean                      @default(false)
  instructions             String?
  active                   Boolean                      @default(true)
  createdAt                DateTime                     @default(now()) @db.Timestamptz(3)
  updatedAt                DateTime                     @updatedAt @db.Timestamptz(3)
  deletedAt                DateTime?                    @db.Timestamptz(3)

  organisation    Organisation                 @relation(fields: [organisationId], references: [id], onDelete: Restrict)
  patrolRoute     PatrolRoute                  @relation(fields: [patrolRouteId], references: [id], onDelete: Restrict)
  visits          PatrolVisit[]
  assignmentSnaps PatrolAssignmentCheckpoint[]

  @@unique([patrolRouteId, sequence])
  @@unique([qrCodeHash])
  @@index([patrolRouteId, sequence])
  @@index([organisationId])
  @@index([deletedAt])
  @@map("patrol_checkpoints")
}

model PatrolAssignment {
  id                       String                 @id @default(uuid()) @db.Uuid
  organisationId           String                 @db.Uuid
  patrolRouteId            String                 @db.Uuid
  assignmentId             String                 @db.Uuid
  officerId                String                 @db.Uuid
  shiftId                  String                 @db.Uuid
  siteId                   String                 @db.Uuid
  scheduledStartAt         DateTime?              @db.Timestamptz(3)
  scheduledEndAt           DateTime?              @db.Timestamptz(3)
  startedAt                DateTime?              @db.Timestamptz(3)
  startedAtDevice          DateTime?              @db.Timestamptz(3)
  completedAt              DateTime?              @db.Timestamptz(3)
  completedAtDevice        DateTime?              @db.Timestamptz(3)
  status                   PatrolAssignmentStatus @default(NOT_STARTED)
  completedCheckpointCount Int                    @default(0)
  totalCheckpointCount     Int                    @default(0)
  finalNote                String?
  cancellationReason       String?
  cancelledAt              DateTime?              @db.Timestamptz(3)
  cancelledByUserId        String?                @db.Uuid
  createdAt                DateTime               @default(now()) @db.Timestamptz(3)
  updatedAt                DateTime               @updatedAt @db.Timestamptz(3)

  organisation        Organisation                 @relation(fields: [organisationId], references: [id], onDelete: Restrict)
  patrolRoute         PatrolRoute                  @relation(fields: [patrolRouteId], references: [id], onDelete: Restrict)
  assignment          Assignment                   @relation(fields: [assignmentId], references: [id], onDelete: Restrict)
  officer             OfficerProfile               @relation(fields: [officerId], references: [id], onDelete: Restrict)
  shift               Shift                        @relation(fields: [shiftId], references: [id], onDelete: Restrict)
  site                SecuritySite                 @relation(fields: [siteId], references: [id], onDelete: Restrict)
  cancelledBy         User?                        @relation("PatrolAssignmentCanceller", fields: [cancelledByUserId], references: [id], onDelete: SetNull)
  visits              PatrolVisit[]
  checkpointSnapshots PatrolAssignmentCheckpoint[]
  events              PatrolAssignmentEvent[]

  @@index([organisationId, status])
  @@index([officerId, status])
  @@index([assignmentId])
  @@index([siteId, status])
  @@map("patrol_assignments")
}

/// Immutable checkpoint snapshot copied when a patrol assignment is created.
model PatrolAssignmentCheckpoint {
  id                       String                       @id @default(uuid()) @db.Uuid
  organisationId           String                       @db.Uuid
  patrolAssignmentId       String                       @db.Uuid
  sourceCheckpointId       String?                      @db.Uuid
  name                     String
  description              String?
  sequence                 Int
  latitude                 Decimal                      @db.Decimal(10, 7)
  longitude                Decimal                      @db.Decimal(10, 7)
  allowedRadiusMeters      Int
  verificationMethod       CheckpointVerificationMethod
  qrCodeHash               String?
  requiresPhoto            Boolean                      @default(false)
  requiresNote             Boolean                      @default(false)
  instructions             String?
  minimumGpsAccuracyMeters Int?
  createdAt                DateTime                     @default(now()) @db.Timestamptz(3)

  organisation     Organisation      @relation(fields: [organisationId], references: [id], onDelete: Restrict)
  patrolAssignment PatrolAssignment  @relation(fields: [patrolAssignmentId], references: [id], onDelete: Cascade)
  sourceCheckpoint PatrolCheckpoint? @relation(fields: [sourceCheckpointId], references: [id], onDelete: SetNull)
  visits           PatrolVisit[]

  @@unique([patrolAssignmentId, sequence])
  @@index([patrolAssignmentId, sequence])
  @@index([organisationId])
  @@map("patrol_assignment_checkpoints")
}

model PatrolAssignmentEvent {
  id                 String                  @id @default(uuid()) @db.Uuid
  patrolAssignmentId String                  @db.Uuid
  actorUserId        String?                 @db.Uuid
  previousStatus     PatrolAssignmentStatus?
  newStatus          PatrolAssignmentStatus
  reason             String?
  createdAt          DateTime                @default(now()) @db.Timestamptz(3)

  patrolAssignment PatrolAssignment @relation(fields: [patrolAssignmentId], references: [id], onDelete: Cascade)
  actorUser        User?            @relation("PatrolAssignmentEventActor", fields: [actorUserId], references: [id], onDelete: SetNull)

  @@index([patrolAssignmentId, createdAt])
  @@map("patrol_assignment_events")
}

model PatrolVisit {
  id                     String                       @id @default(uuid()) @db.Uuid
  organisationId         String                       @db.Uuid
  patrolAssignmentId     String                       @db.Uuid
  patrolCheckpointId     String?                      @db.Uuid
  assignmentCheckpointId String?                      @db.Uuid
  officerId              String                       @db.Uuid
  shiftId                String                       @db.Uuid
  siteId                 String                       @db.Uuid
  status                 CheckpointStatus             @default(PENDING)
  verificationMethod     CheckpointVerificationMethod
  visitedAtDevice        DateTime                     @db.Timestamptz(3)
  visitedAtServer        DateTime?                    @db.Timestamptz(3)
  latitude               Decimal                      @db.Decimal(10, 7)
  longitude              Decimal                      @db.Decimal(10, 7)
  accuracyMeters         Decimal?                     @db.Decimal(10, 2)
  distanceMeters         Decimal?                     @db.Decimal(10, 2)
  note                   String?
  /// Soft reference to Evidence.id
  evidenceId             String?                      @db.Uuid
  localVisitId           String?
  reviewedAt             DateTime?                    @db.Timestamptz(3)
  reviewedByUserId       String?                      @db.Uuid
  reviewReason           String?
  createdAt              DateTime                     @default(now()) @db.Timestamptz(3)
  updatedAt              DateTime                     @updatedAt @db.Timestamptz(3)

  organisation         Organisation                @relation(fields: [organisationId], references: [id], onDelete: Restrict)
  patrolAssignment     PatrolAssignment            @relation(fields: [patrolAssignmentId], references: [id], onDelete: Restrict)
  patrolCheckpoint     PatrolCheckpoint?           @relation(fields: [patrolCheckpointId], references: [id], onDelete: Restrict)
  assignmentCheckpoint PatrolAssignmentCheckpoint? @relation(fields: [assignmentCheckpointId], references: [id], onDelete: Restrict)
  officer              OfficerProfile              @relation(fields: [officerId], references: [id], onDelete: Restrict)
  shift                Shift                       @relation(fields: [shiftId], references: [id], onDelete: Restrict)
  site                 SecuritySite                @relation(fields: [siteId], references: [id], onDelete: Restrict)
  reviewedBy           User?                       @relation("PatrolVisitReviewer", fields: [reviewedByUserId], references: [id], onDelete: SetNull)
  evidences            Evidence[]

  @@unique([patrolAssignmentId, assignmentCheckpointId])
  @@unique([organisationId, localVisitId])
  @@index([patrolAssignmentId, status])
  @@index([officerId, visitedAtServer])
  @@index([status, visitedAtServer])
  @@map("patrol_visits")
}

`;

s = s.slice(0, start) + replacement + s.slice(end);
s = s.replace(
  '  patrolAssignments     PatrolAssignment[]\n  patrolVisits          PatrolVisit[]',
  '  patrolAssignments     PatrolAssignment[]\n  patrolAssignmentCheckpoints PatrolAssignmentCheckpoint[]\n  patrolVisits          PatrolVisit[]',
);
s = s.replace(
  '  createdPatrolRoutes         PatrolRoute[]          @relation("PatrolRouteCreator")\n  reviewedPatrolVisits        PatrolVisit[]          @relation("PatrolVisitReviewer")',
  '  createdPatrolRoutes         PatrolRoute[]          @relation("PatrolRouteCreator")\n  cancelledPatrolAssignments  PatrolAssignment[]     @relation("PatrolAssignmentCanceller")\n  patrolAssignmentEvents      PatrolAssignmentEvent[] @relation("PatrolAssignmentEventActor")\n  reviewedPatrolVisits        PatrolVisit[]          @relation("PatrolVisitReviewer")',
);
fs.writeFileSync(path, s);
console.log('schema updated');
