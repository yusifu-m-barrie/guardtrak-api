import { HttpStatus } from '@nestjs/common';
import { GeofencePolicy } from '../../../generated/prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';
import { GeofenceService } from './geofence.service';

describe('GeofenceService', () => {
  const service = new GeofenceService();

  describe('validateCoordinates', () => {
    it('accepts valid coordinates', () => {
      expect(() => service.validateCoordinates(8.8833, -12.05)).not.toThrow();
    });

    it('accepts Decimal-like values via Number()', () => {
      expect(() =>
        service.validateCoordinates({ toString: () => '8.8833' }, ' -12.05'),
      ).not.toThrow();
    });

    it('rejects latitude out of range', () => {
      expect(() => service.validateCoordinates(91, 0)).toThrow(AppException);

      try {
        service.validateCoordinates(91, 0);
      } catch (error) {
        expect((error as AppException).getResponse()).toMatchObject({
          code: ErrorCode.SITE_COORDINATES_INVALID,
        });
        expect((error as AppException).getStatus()).toBe(
          HttpStatus.BAD_REQUEST,
        );
      }
    });

    it('rejects non-finite coordinates', () => {
      expect(() => service.validateCoordinates(Number.NaN, 0)).toThrow(
        AppException,
      );
    });
  });

  describe('distanceMeters', () => {
    it('returns zero for identical coordinates', () => {
      expect(service.distanceMeters(8.8833, -12.05, 8.8833, -12.05)).toBe(0);
    });

    it('calculates Haversine distance using Earth radius 6371000', () => {
      const distance = service.distanceMeters(0, 0, 0, 1);
      expect(distance).toBeGreaterThan(110_000);
      expect(distance).toBeLessThan(112_000);
    });

    it('accepts Decimal-like coordinate values', () => {
      const distance = service.distanceMeters(
        { toString: () => '0' },
        { toString: () => '0' },
        { toString: () => '0' },
        { toString: () => '1' },
      );
      expect(distance).toBeGreaterThan(0);
    });
  });

  describe('evaluateGeofence', () => {
    const radiusMeters = 100;

    it('allows inside geofence without review', () => {
      expect(
        service.evaluateGeofence({
          distanceMeters: 50,
          radiusMeters,
          policy: GeofencePolicy.BLOCK,
        }),
      ).toEqual({
        allowed: true,
        requiresReview: false,
        outside: false,
      });
    });

    it('blocks outside geofence with BLOCK policy', () => {
      expect(
        service.evaluateGeofence({
          distanceMeters: 150,
          radiusMeters,
          policy: GeofencePolicy.BLOCK,
        }),
      ).toEqual({
        allowed: false,
        requiresReview: false,
        outside: true,
      });
    });

    it('requires reason for ALLOW_WITH_REASON when outside', () => {
      expect(
        service.evaluateGeofence({
          distanceMeters: 150,
          radiusMeters,
          policy: GeofencePolicy.ALLOW_WITH_REASON,
        }),
      ).toEqual({
        allowed: false,
        requiresReview: false,
        outside: true,
      });

      expect(
        service.evaluateGeofence({
          distanceMeters: 150,
          radiusMeters,
          policy: GeofencePolicy.ALLOW_WITH_REASON,
          reason: 'Gate was locked; supervisor notified',
        }),
      ).toEqual({
        allowed: true,
        requiresReview: true,
        outside: true,
      });
    });

    it('allows outside with review for REQUIRE_SUPERVISOR_APPROVAL', () => {
      expect(
        service.evaluateGeofence({
          distanceMeters: 150,
          radiusMeters,
          policy: GeofencePolicy.REQUIRE_SUPERVISOR_APPROVAL,
        }),
      ).toEqual({
        allowed: true,
        requiresReview: true,
        outside: true,
      });
    });
  });

  describe('applyEnforcement', () => {
    it('keeps an outside result but does not reject when enforcement is off', () => {
      const outside = service.evaluateGeofence({
        distanceMeters: 7_237_000,
        radiusMeters: 100,
        policy: GeofencePolicy.BLOCK,
      });
      expect(outside.allowed).toBe(false);
      expect(outside.outside).toBe(true);
      expect(service.applyEnforcement(false, outside)).toEqual({
        allowed: true,
        requiresReview: false,
        outside: true,
      });
    });

    it('still rejects when enforcement is on', () => {
      const outside = service.evaluateGeofence({
        distanceMeters: 7_237_000,
        radiusMeters: 100,
        policy: GeofencePolicy.BLOCK,
      });
      expect(service.applyEnforcement(true, outside).allowed).toBe(false);
    });
  });
});
