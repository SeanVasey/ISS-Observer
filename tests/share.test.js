import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildShareParams,
  parseShareParams,
  findSharedPass,
  isPlaceholderName,
  PASS_MATCH_TOLERANCE_MS
} from '../src/lib/share.js';

const observer = { lat: 47.6062, lon: -122.3321 };

const makePass = (startIso, durationMinutes = 10) => {
  const start = new Date(startIso);
  return {
    start,
    end: new Date(start.getTime() + durationMinutes * 60000)
  };
};

describe('share link params', () => {
  it('round-trips observer, pass time, and location name', () => {
    const pass = makePass('2026-07-11T04:32:00.000Z');
    const params = buildShareParams(observer, pass, 'Seattle, WA');
    const parsed = parseShareParams(`?${params.toString()}`);
    assert.equal(parsed.observer.lat, 47.6062);
    assert.equal(parsed.observer.lon, -122.3321);
    assert.equal(parsed.passTime.toISOString(), '2026-07-11T04:32:00.000Z');
    assert.equal(parsed.locationName, 'Seattle, WA');
  });

  it('omits placeholder location names from links', () => {
    const pass = makePass('2026-07-11T04:32:00.000Z');
    for (const placeholder of ['Custom location', 'Locating...', 'Shared location']) {
      const params = buildShareParams(observer, pass, placeholder);
      assert.equal(params.has('loc'), false, `should omit "${placeholder}"`);
      assert.ok(isPlaceholderName(placeholder));
    }
  });

  it('clamps very long location names', () => {
    const pass = makePass('2026-07-11T04:32:00.000Z');
    const params = buildShareParams(observer, pass, 'x'.repeat(500));
    assert.equal(params.get('loc').length, 80);
    const parsed = parseShareParams(`?loc=${'y'.repeat(500)}&lat=10&lon=10`);
    assert.equal(parsed.locationName.length, 80);
  });

  it('rejects out-of-range or malformed coordinates', () => {
    assert.equal(parseShareParams('?lat=91&lon=0').observer, null);
    assert.equal(parseShareParams('?lat=0&lon=-181').observer, null);
    assert.equal(parseShareParams('?lat=abc&lon=10').observer, null);
    assert.equal(parseShareParams('?lon=10').observer, null);
    assert.equal(parseShareParams('').observer, null);
  });

  it('rejects malformed pass timestamps but keeps valid coordinates', () => {
    const parsed = parseShareParams('?lat=47.6&lon=-122.3&pass=not-a-date');
    assert.deepEqual(parsed.observer, { lat: 47.6, lon: -122.3 });
    assert.equal(parsed.passTime, null);
  });
});

describe('findSharedPass', () => {
  const passes = [
    makePass('2026-07-11T04:32:00.000Z'),
    makePass('2026-07-11T06:08:00.000Z'),
    makePass('2026-07-11T07:45:00.000Z')
  ];

  it('matches an exact start time', () => {
    const match = findSharedPass(passes, new Date('2026-07-11T06:08:00.000Z'));
    assert.equal(match, passes[1]);
  });

  it('matches within the drift tolerance', () => {
    const target = new Date(passes[1].start.getTime() - PASS_MATCH_TOLERANCE_MS + 1000);
    assert.equal(findSharedPass(passes, target), passes[1]);
  });

  it('matches a time inside the pass window', () => {
    const target = new Date(passes[0].start.getTime() + 5 * 60000);
    assert.equal(findSharedPass(passes, target), passes[0]);
  });

  it('prefers the pass whose start is nearest the target', () => {
    // Midway-ish between pass 0 end and pass 1 start, closer to pass 1 start
    const target = new Date('2026-07-11T05:58:00.000Z');
    assert.equal(findSharedPass(passes, target), passes[1]);
  });

  it('returns null when nothing is near the target', () => {
    assert.equal(findSharedPass(passes, new Date('2026-07-12T00:00:00.000Z')), null);
    assert.equal(findSharedPass([], new Date('2026-07-11T04:32:00.000Z')), null);
  });

  it('returns null for missing or invalid targets', () => {
    assert.equal(findSharedPass(passes, null), null);
    assert.equal(findSharedPass(passes, new Date('garbage')), null);
  });
});
