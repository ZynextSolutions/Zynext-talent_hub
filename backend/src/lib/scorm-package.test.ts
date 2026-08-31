import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import AdmZip from 'adm-zip';
import { assertScormZipLimits } from './scorm-zip-limits';

describe('SCORM zip-bomb limits', () => {
  it('rejects highly compressible oversized payloads', () => {
    const zip = new AdmZip();
    zip.addFile('imsmanifest.xml', Buffer.from('<manifest></manifest>'));
    zip.addFile('zeros.bin', Buffer.alloc(2 * 1024 * 1024, 0));
    const buffer = zip.toBuffer();
    const sizes = zip.getEntries().map((entry) => entry.header.size);
    assert.throws(
      () => assertScormZipLimits(buffer.length, zip.getEntries().length, sizes),
      /compression ratio|not allowed|too many|PAYLOAD/i,
    );
  });
});
