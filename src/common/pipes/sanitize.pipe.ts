import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';
function sanitizeValue(value: any, key?: any): any {
  if (
    value instanceof Buffer ||
    value instanceof Uint8Array ||
    value instanceof ArrayBuffer
  ) {
    return value;
  }

  if (
    key === 'password' ||
    key === 'newPassword' ||
    key === 'confirmNewPassword' ||
    key === 'confirmPassword'
  ) {
    return value;
  }

  if (typeof value === 'string') {
    return sanitizeHtml(value, {
      allowedTags: [],
      allowedAttributes: {},
    }).trim();
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = sanitizeValue(v, k);
    }
    return out;
  }

  return value;
}

@Injectable()
export class SanitizePipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    if (value === null || value === undefined) return value;

    return sanitizeValue(value);
  }
}
