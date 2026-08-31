import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isCatalogThumbnailFilename } from './media-filenames';

describe('catalog thumbnail allowlist', () => {
  it('allows published course image filenames', () => {
    assert.equal(isCatalogThumbnailFilename('abc.png'), true);
    assert.equal(isCatalogThumbnailFilename('abc.jpg'), true);
  });

  it('rejects intro videos', () => {
    assert.equal(isCatalogThumbnailFilename('abc-intro.mp4'), false);
    assert.equal(isCatalogThumbnailFilename('abc.mp4'), false);
  });
});
