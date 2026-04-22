import { describe, test, expect } from 'vitest';
import { imageUrl, thumbUrl } from './apiService.js';

describe('imageUrl', () => {
  test('builds URL under /blogs/:slug/files/images/', () => {
    const url = imageUrl('anna-trip', 'images/p1.jpg');
    expect(url).toContain('/blogs/anna-trip/files/images/images/p1.jpg');
  });

  test('strips leading slash from path', () => {
    const url = imageUrl('anna-trip', '/foo.jpg');
    expect(url).toContain('/blogs/anna-trip/files/images/foo.jpg');
    expect(url).not.toContain('//foo.jpg');
  });

  test('appends cache-bust query', () => {
    expect(imageUrl('a', 'b.jpg')).toMatch(/\?v\d+$/);
  });

  test('uses different slugs for different blogs (isolation)', () => {
    const a = imageUrl('anna-trip', 'p.jpg');
    const b = imageUrl('bob-trip', 'p.jpg');
    expect(a).not.toBe(b);
    expect(a).toContain('/anna-trip/');
    expect(b).toContain('/bob-trip/');
  });
});

describe('thumbUrl', () => {
  test('rewrites images/foo/bar.jpg → images/.thumbs/foo/bar.webp', () => {
    const url = thumbUrl('anna-trip', 'images/foo/bar.jpg');
    expect(url).toContain('/blogs/anna-trip/files/images/.thumbs/foo/bar.webp');
  });

  test('handles png/jpeg/webp extensions', () => {
    expect(thumbUrl('a', 'images/x.png')).toContain('/.thumbs/x.webp');
    expect(thumbUrl('a', 'images/x.jpeg')).toContain('/.thumbs/x.webp');
    expect(thumbUrl('a', 'images/x.webp')).toContain('/.thumbs/x.webp');
  });

  test('falls back to original URL for HEIC/HEIF (sharp without libheif)', () => {
    const url = thumbUrl('a', 'x.heic');
    expect(url).toContain('/files/images/x.heic');
    expect(url).not.toContain('.thumbs');
  });

  test('falls back to original URL for video files', () => {
    // Real data stores filenames without an "images/" prefix; the prefix is
    // added by imageUrl(). The fallback path should never produce a thumb URL.
    expect(thumbUrl('a', 'v.mp4')).toContain('/files/images/v.mp4');
    expect(thumbUrl('a', 'v.mov')).toContain('/files/images/v.mov');
    expect(thumbUrl('a', 'v.webm')).toContain('/files/images/v.webm');
    expect(thumbUrl('a', 'v.mp4')).not.toContain('.thumbs');
  });


  test('preserves nested directory structure', () => {
    const url = thumbUrl('a', 'images/sub/dir/file.jpg');
    expect(url).toContain('/.thumbs/sub/dir/file.webp');
  });

  test('strips leading slash like imageUrl', () => {
    const url = thumbUrl('a', '/images/p.jpg');
    expect(url).toContain('/blogs/a/files/images/.thumbs/p.webp');
  });
});
