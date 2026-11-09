import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { calculateTouchDistance, detectHorizontalSwipe } from './gestures';

test('calculateTouchDistance computes Euclidean distance accurately', () => {
  const mockTouches = [
    { clientX: 0, clientY: 0 },
    { clientX: 3, clientY: 4 },
  ] as unknown as React.TouchList;
  assert.equal(calculateTouchDistance(mockTouches), 5);
});

test('detectHorizontalSwipe identifies left and right swipes beyond threshold', () => {
  const now = Date.now();
  assert.equal(
    detectHorizontalSwipe({ startX: 200, startY: 100, startTime: now }, 110, 105),
    'left'
  );
  assert.equal(
    detectHorizontalSwipe({ startX: 100, startY: 100, startTime: now }, 195, 110),
    'right'
  );
  assert.equal(
    detectHorizontalSwipe({ startX: 100, startY: 100, startTime: now }, 120, 100),
    null
  );
  assert.equal(
    detectHorizontalSwipe({ startX: 100, startY: 100, startTime: now }, 185, 220),
    null
  );
});
