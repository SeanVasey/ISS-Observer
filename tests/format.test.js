import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  scorePass,
  estimateBrightness,
  formatAzimuth
} from '../src/lib/format.js';

describe('format helpers', () => {
  it('scores higher elevation and darker skies', () => {
    const lowScore = scorePass(20, 200, -2);
    const highScore = scorePass(80, 400, -18);
    assert.ok(highScore > lowScore);
  });

  it('labels brightness bands', () => {
    assert.equal(estimateBrightness(80, -18), 'Very bright');
    assert.equal(estimateBrightness(40, -2), 'Dim');
  });

  it('formats azimuth', () => {
    assert.ok(formatAzimuth(90).includes('E'));
  });
});
