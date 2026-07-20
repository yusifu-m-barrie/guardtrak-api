import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';
import {
  validateGpsAccuracyMeters,
  validateSiteCoordinates,
  validateSiteGeoFields,
  validateSiteRadiusMeters,
  MAX_GPS_ACCURACY_METERS,
  MAX_SITE_RADIUS_METERS,
} from './sites-validation.util';

describe('sites-validation.util', () => {
  describe('validateSiteCoordinates', () => {
    it('accepts valid coordinates', () => {
      expect(() => validateSiteCoordinates(8.8833, -12.05)).not.toThrow();
    });

    it('rejects latitude out of range', () => {
      expect(() => validateSiteCoordinates(91, 0)).toThrow(AppException);
      try {
        validateSiteCoordinates(91, 0);
      } catch (error) {
        expect((error as AppException).getResponse()).toMatchObject({
          code: ErrorCode.SITE_COORDINATES_INVALID,
        });
        expect((error as AppException).getStatus()).toBe(
          HttpStatus.BAD_REQUEST,
        );
      }
    });

    it('rejects longitude out of range', () => {
      expect(() => validateSiteCoordinates(0, 181)).toThrow(AppException);
    });
  });

  describe('validateSiteRadiusMeters', () => {
    it('accepts positive radius within max', () => {
      expect(() =>
        validateSiteRadiusMeters(150, 'clockInRadiusMeters'),
      ).not.toThrow();
    });

    it('rejects zero radius', () => {
      expect(() => validateSiteRadiusMeters(0, 'clockInRadiusMeters')).toThrow(
        AppException,
      );
    });

    it('rejects radius above max', () => {
      expect(() =>
        validateSiteRadiusMeters(
          MAX_SITE_RADIUS_METERS + 1,
          'clockInRadiusMeters',
        ),
      ).toThrow(AppException);

      try {
        validateSiteRadiusMeters(
          MAX_SITE_RADIUS_METERS + 1,
          'clockInRadiusMeters',
        );
      } catch (error) {
        expect((error as AppException).getResponse()).toMatchObject({
          code: ErrorCode.SITE_RADIUS_INVALID,
        });
      }
    });
  });

  describe('validateGpsAccuracyMeters', () => {
    it('accepts valid GPS accuracy', () => {
      expect(() => validateGpsAccuracyMeters(50)).not.toThrow();
    });

    it('rejects accuracy above max', () => {
      expect(() =>
        validateGpsAccuracyMeters(MAX_GPS_ACCURACY_METERS + 1),
      ).toThrow(AppException);
    });
  });

  describe('validateSiteGeoFields', () => {
    it('requires both coordinates when one is provided', () => {
      expect(() => validateSiteGeoFields({ latitude: 8.8833 })).toThrow(
        AppException,
      );
    });

    it('validates combined geo input', () => {
      expect(() =>
        validateSiteGeoFields({
          latitude: 8.8833,
          longitude: -12.05,
          clockInRadiusMeters: 150,
          minimumGpsAccuracyMeters: 50,
        }),
      ).not.toThrow();
    });
  });
});
