import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';

export const MAX_SITE_RADIUS_METERS = 5000;
export const MAX_GPS_ACCURACY_METERS = 500;

export interface SiteGeoInput {
  latitude?: number;
  longitude?: number;
  clockInRadiusMeters?: number;
  clockOutRadiusMeters?: number;
  checkpointDefaultRadiusMeters?: number;
  minimumGpsAccuracyMeters?: number;
}

export function validateSiteCoordinates(
  latitude: number,
  longitude: number,
): void {
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new AppException(
      'Site coordinates are out of range',
      HttpStatus.BAD_REQUEST,
      ErrorCode.SITE_COORDINATES_INVALID,
    );
  }
}

export function validateSiteRadiusMeters(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0 || value > MAX_SITE_RADIUS_METERS) {
    throw new AppException(
      `${field} must be a positive number up to ${MAX_SITE_RADIUS_METERS} meters`,
      HttpStatus.BAD_REQUEST,
      ErrorCode.SITE_RADIUS_INVALID,
    );
  }
}

export function validateGpsAccuracyMeters(value: number): void {
  if (
    !Number.isFinite(value) ||
    value <= 0 ||
    value > MAX_GPS_ACCURACY_METERS
  ) {
    throw new AppException(
      `minimumGpsAccuracyMeters must be a positive number up to ${MAX_GPS_ACCURACY_METERS} meters`,
      HttpStatus.BAD_REQUEST,
      ErrorCode.SITE_RADIUS_INVALID,
    );
  }
}

export function validateSiteGeoFields(input: SiteGeoInput): void {
  if (input.latitude !== undefined && input.longitude !== undefined) {
    validateSiteCoordinates(input.latitude, input.longitude);
  } else if (input.latitude !== undefined || input.longitude !== undefined) {
    throw new AppException(
      'Both latitude and longitude are required when updating coordinates',
      HttpStatus.BAD_REQUEST,
      ErrorCode.SITE_COORDINATES_INVALID,
    );
  }

  if (input.clockInRadiusMeters !== undefined) {
    validateSiteRadiusMeters(input.clockInRadiusMeters, 'clockInRadiusMeters');
  }
  if (input.clockOutRadiusMeters !== undefined) {
    validateSiteRadiusMeters(
      input.clockOutRadiusMeters,
      'clockOutRadiusMeters',
    );
  }
  if (input.checkpointDefaultRadiusMeters !== undefined) {
    validateSiteRadiusMeters(
      input.checkpointDefaultRadiusMeters,
      'checkpointDefaultRadiusMeters',
    );
  }
  if (input.minimumGpsAccuracyMeters !== undefined) {
    validateGpsAccuracyMeters(input.minimumGpsAccuracyMeters);
  }
}
