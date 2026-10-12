import multipart from '@fastify/multipart';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { config } from '../config/env.js';
import { AppError } from '../utils/errors.js';

export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

export interface ParsedMultipart {
  fields: Record<string, string>;
  file?: UploadedFile;
}

export function registerMultipart(app: FastifyInstance): void {
  void app.register(multipart, {
    limits: {
      fileSize: config.maxUploadSizeBytes
    }
  });
}

/**
 * Read a `multipart/form-data` request into plain fields plus (optionally) the
 * single uploaded file. Replaces the hand-rolled Express stream parser.
 */
export async function parseMultipart(request: FastifyRequest): Promise<ParsedMultipart> {
  const contentType = request.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data')) {
    return { fields: {} };
  }

  if (!request.isMultipart()) {
    throw AppError.badRequest('Invalid multipart payload: expected multipart/form-data');
  }

  const fields: Record<string, string> = {};
  let file: UploadedFile | undefined;

  for await (const part of request.parts()) {
    if (part.type === 'file') {
      if (file) {
        // Only the first file is retained; drain the rest so the stream stays valid.
        continue;
      }
      const buffer = await part.toBuffer();
      file = {
        fieldname: part.fieldname,
        originalname: part.filename ?? 'upload',
        encoding: part.encoding,
        mimetype: part.mimetype,
        buffer,
        size: buffer.length
      };
    } else {
      fields[part.fieldname] = String(part.value);
    }
  }

  return { fields, file };
}