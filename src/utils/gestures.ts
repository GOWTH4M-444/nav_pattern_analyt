/**
 * Touch & Gesture Interaction Utilities
 * Supports:
 * 1. Horizontal swipe detection (`onTouchStart`, `onTouchEnd`) to cycle between workspace tabs
 * 2. Two-finger pinch-to-zoom & single-finger touch pan for SVG topology and matrix canvases
 */

import React from 'react';

export interface SwipeState {
  startX: number;
  startY: number;
  startTime: number;
}

export function calculateTouchDistance(touches: React.TouchList): number {
  if (touches.length < 2) return 0;
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

export function detectHorizontalSwipe(
  start: SwipeState | null,
  endX: number,
  endY: number,
  minSwipeDistancePx = 75,
  maxVerticalDriftPx = 65
): 'left' | 'right' | null {
  if (!start) return null;
  const dx = endX - start.startX;
  const dy = Math.abs(endY - start.startY);
  const elapsed = Date.now() - start.startTime;

  if (elapsed > 650 || dy > maxVerticalDriftPx) return null;
  if (Math.abs(dx) < minSwipeDistancePx) return null;
  return dx < 0 ? 'left' : 'right';
}
