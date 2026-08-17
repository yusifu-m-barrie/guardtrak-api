import { HttpStatus, Injectable } from '@nestjs/common';
import { GeofencePolicy } from '../../../generated/prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';

const EARTH_RADIUS_METERS = 6_371_000;

type NumericInput = number | string | { toString(): string };

export interface GeofenceEvaluationInput {
  distanceMeters: number;
  radiusMeters: number;
  policy: GeofencePolicy;
  reason?: string | null;
}

export interface GeofenceEvaluationResult {
  allowed: boolean;
  requiresReview: boolean;
  outside: boolean;
}

@Injectable()
export class GeofenceService {
  validateCoordinates(latitude: NumericInput, longitude: NumericInput): void {
    const lat = Number(latitude);
    const lng = Number(longitude);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      throw new AppException(
        'Coordinates are out of range',
        HttpStatus.BAD_REQUEST,
        ErrorCode.SITE_COORDINATES_INVALID,
      );
    }
  }

  distanceMeters(
    lat1: NumericInput,
    lon1: NumericInput,
    lat2: NumericInput,
    lon2: NumericInput,
  ): number {
    const latitude1 = Number(lat1);
    const longitude1 = Number(lon1);
    const latitude2 = Number(lat2);
    const longitude2 = Number(lon2);

    const lat1Rad = this.toRadians(latitude1);
    const lat2Rad = this.toRadians(latitude2);
    const deltaLat = this.toRadians(latitude2 - latitude1);
    const deltaLon = this.toRadians(longitude2 - longitude1);

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1Rad) *
        Math.cos(lat2Rad) *
        Math.sin(deltaLon / 2) *
        Math.sin(deltaLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_METERS * c;
  }

  applyEnforcement(
    enabled: boolean,
    evaluation: GeofenceEvaluationResult,
  ): GeofenceEvaluationResult {
    if (!enabled) {
      return {
        ...evaluation,
        allowed: true,
        requiresReview: false,
      };
    }
    return evaluation;
  }

  evaluateGeofence(input: GeofenceEvaluationInput): GeofenceEvaluationResult {
    const outside = input.distanceMeters > input.radiusMeters;

    if (!outside) {
      return {
        allowed: true,
        requiresReview: false,
        outside: false,
      };
    }

    switch (input.policy) {
      case GeofencePolicy.BLOCK:
        return {
          allowed: false,
          requiresReview: false,
          outside: true,
        };
      case GeofencePolicy.ALLOW_WITH_REASON: {
        const hasReason =
          typeof input.reason === 'string' && input.reason.trim().length > 0;
        return {
          allowed: hasReason,
          requiresReview: hasReason,
          outside: true,
        };
      }
      case GeofencePolicy.REQUIRE_SUPERVISOR_APPROVAL:
        return {
          allowed: true,
          requiresReview: true,
          outside: true,
        };
      default:
        return {
          allowed: false,
          requiresReview: false,
          outside: true,
        };
    }
  }

  private toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }
}
