// ========================================
// Multipart Form-Data Upload Middleware
// ========================================
// Parses multipart/form-data requests without third-party dependencies.
// Extracts fields into req.body and uploaded file into req.file.
// ========================================

import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors.js";

export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      file?: UploadedFile;
    }
  }
}

export const DEFAULT_MAX_UPLOAD_SIZE_BYTES =
  parseInt(process.env.MAX_UPLOAD_SIZE_BYTES || "", 10) || 15 * 1024 * 1024; // 15MB default

/**
 * Express middleware to parse multipart/form-data streams.
 */
export function multipartUpload(maxBytes = DEFAULT_MAX_UPLOAD_SIZE_BYTES) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    void (async () => {
      const contentType = req.headers["content-type"] || "";
      if (!contentType.includes("multipart/form-data")) {
        return next();
      }

      const match = contentType.match(/boundary=(?:["']([^"']+)["']|([^;\s]+))/i);
      const boundary = match ? match[1] || match[2] : null;
      if (!boundary) {
        return next(AppError.badRequest("Invalid multipart payload: missing boundary delimiter"));
      }

    try {
      const chunks: Buffer[] = [];
      let totalBytes = 0;

      for await (const chunk of req) {
        const buf = chunk as Buffer;
        totalBytes += buf.length;
        if (totalBytes > maxBytes) {
          return next(
            AppError.badRequest(
              `Uploaded file exceeds maximum allowable size of ${Math.round(maxBytes / (1024 * 1024))}MB`
            )
          );
        }
        chunks.push(buf);
      }

      const bodyBuffer = Buffer.concat(chunks);
      const boundaryBuf = Buffer.from(`--${boundary}`);
      const doubleCrlf = Buffer.from("\r\n\r\n");

      let searchPos = 0;
      while (searchPos < bodyBuffer.length) {
        const boundaryIdx = bodyBuffer.indexOf(boundaryBuf, searchPos);
        if (boundaryIdx === -1) break;

        const nextBoundaryIdx = bodyBuffer.indexOf(boundaryBuf, boundaryIdx + boundaryBuf.length);
        if (nextBoundaryIdx === -1) break;

        const partBuffer = bodyBuffer.subarray(boundaryIdx + boundaryBuf.length, nextBoundaryIdx);
        searchPos = nextBoundaryIdx;

        // Strip leading CRLF or LF
        let partStart = 0;
        if (partBuffer[0] === 13 && partBuffer[1] === 10) partStart = 2;
        else if (partBuffer[0] === 10) partStart = 1;

        const headerEnd = partBuffer.indexOf(doubleCrlf, partStart);
        if (headerEnd === -1) continue;

        const headerStr = partBuffer.subarray(partStart, headerEnd).toString("utf-8");

        // Strip trailing CRLF or LF
        let bodyEnd = partBuffer.length;
        if (partBuffer[bodyEnd - 2] === 13 && partBuffer[bodyEnd - 1] === 10) bodyEnd -= 2;
        else if (partBuffer[bodyEnd - 1] === 10) bodyEnd -= 1;

        const content = partBuffer.subarray(headerEnd + 4, bodyEnd);

        // Parse Content-Disposition
        const dispMatch = headerStr.match(/content-disposition:\s*form-data;\s*([^;\r\n]+)(?:;\s*filename="([^"]*)")?/i);
        const nameMatch = headerStr.match(/name="([^"]*)"/i);
        const fieldName = nameMatch ? nameMatch[1] : undefined;
        const filename = dispMatch && dispMatch[2] !== undefined ? dispMatch[2] : undefined;

        if (filename !== undefined && fieldName) {
          const typeMatch = headerStr.match(/content-type:\s*([^\r\n;]+)/i);
          const mimetype = typeMatch ? typeMatch[1]?.trim() || "application/octet-stream" : "application/octet-stream";

          req.file = {
            fieldname: fieldName,
            originalname: filename,
            encoding: "7bit",
            mimetype,
            buffer: content,
            size: content.length,
          };
        } else if (fieldName) {
          req.body = req.body || {};
          req.body[fieldName] = content.toString("utf-8");
        }
      }

      next();
    } catch (err) {
      next(err);
    }
    })().catch(next);
  };
}
