import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import { ApiExcludeController, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { createReadStream, existsSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { Public } from '../../common/decorators/public.decorator';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';
import { LocalStorageProvider } from './local-storage.provider';

/**
 * HTTP bridge for local storage tickets.
 * Browsers cannot use `local-upload://` / `local-download://` schemes;
 * these routes materialise the same ticket flow over HTTP (presigned-style).
 */
@ApiTags('storage')
@ApiExcludeController()
@Controller('storage/local')
export class LocalStorageController {
  constructor(private readonly localStorage: LocalStorageProvider) {}

  @Public()
  @Put('upload/:ticketId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Accept local upload ticket body (dev/local only)' })
  async upload(
    @Param('ticketId') ticketId: string,
    @Req() req: Request,
  ): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const body = Buffer.concat(chunks);
    if (!body.length) {
      throw new AppException(
        'Upload body is required',
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
      );
    }
    const written = this.localStorage.writeObjectFromTicket(ticketId, body);
    if (!written.exists) {
      throw new AppException(
        'Upload ticket expired or missing',
        HttpStatus.BAD_REQUEST,
        ErrorCode.EVIDENCE_UPLOAD_INCOMPLETE,
      );
    }
  }

  @Public()
  @Get('download/:token')
  @ApiOperation({ summary: 'Serve local download ticket (dev/local only)' })
  download(@Param('token') token: string, @Res() res: Response): void {
    const ticketPath = join(this.localStorage.getRoot(), '.tickets', `dl-${token}`);
    if (!existsSync(ticketPath)) {
      throw new AppException(
        'Download ticket expired or missing',
        HttpStatus.NOT_FOUND,
        ErrorCode.EVIDENCE_NOT_FOUND,
      );
    }
    const ticket = JSON.parse(readFileSync(ticketPath, 'utf8')) as {
      storageKey: string;
      expiresAt: number;
      mimeType?: string;
    };
    if (ticket.expiresAt < Date.now()) {
      unlinkSync(ticketPath);
      throw new AppException(
        'Download ticket expired',
        HttpStatus.GONE,
        ErrorCode.EVIDENCE_NOT_FOUND,
      );
    }
    this.streamObject(ticket.storageKey, res, ticket.mimeType);
  }

  /**
   * Serve a stored object by key (used for avatar public URLs in local/dev).
   * Accepts either `?key=` or a single URI-encoded path segment.
   */
  @Public()
  @Get('object')
  @ApiOperation({ summary: 'Serve local object by storage key query (dev/local only)' })
  objectByQuery(@Req() req: Request, @Res() res: Response): void {
    const key = typeof req.query.key === 'string' ? req.query.key : '';
    if (!key.trim()) {
      throw new AppException(
        'storage key is required',
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
      );
    }
    this.streamObject(key, res);
  }

  @Public()
  @Get('object/:encodedKey')
  @ApiOperation({ summary: 'Serve local object by encoded storage key (dev/local only)' })
  objectByParam(
    @Param('encodedKey') encodedKey: string,
    @Res() res: Response,
  ): void {
    this.streamObject(decodeURIComponent(encodedKey), res);
  }

  private streamObject(
    storageKey: string,
    res: Response,
    mimeTypeOverride?: string,
  ): void {
    const objectPath = this.localStorage.resolveObjectPath(storageKey);
    if (!existsSync(objectPath)) {
      throw new AppException(
        'Object not found',
        HttpStatus.NOT_FOUND,
        ErrorCode.EVIDENCE_NOT_FOUND,
      );
    }
    const mimeType = mimeTypeOverride || mimeTypeFromStorageKey(storageKey);
    const fileName = storageKey.split('/').pop() || 'file';
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('Content-Type', mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${fileName.replace(/"/g, '')}"`,
    );
    createReadStream(objectPath).pipe(res);
  }
}

function mimeTypeFromStorageKey(storageKey: string): string {
  const lower = storageKey.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
}
