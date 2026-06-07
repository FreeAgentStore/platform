import { describe, expect, it } from 'vitest';
import { parseColor, fallbackPosition, faceToHaloParams } from './halo';
import type { FaceBox } from './halo';

describe('parseColor', () => {
  it('parses gold hex', () => {
    expect(parseColor('#FFD700')).toEqual([255, 215, 0]);
  });
  it('parses without hash', () => {
    expect(parseColor('FF0000')).toEqual([255, 0, 0]);
  });
  it('parses black', () => {
    expect(parseColor('#000000')).toEqual([0, 0, 0]);
  });
  it('parses white', () => {
    expect(parseColor('#FFFFFF')).toEqual([255, 255, 255]);
  });
  it('parses lowercase', () => {
    expect(parseColor('#ff8800')).toEqual([255, 136, 0]);
  });
});

describe('fallbackPosition', () => {
  it('centers horizontally', () => {
    const p = fallbackPosition(800, 600);
    expect(p.cx).toBe(400);
  });
  it('places halo in upper quarter', () => {
    const p = fallbackPosition(800, 600);
    expect(p.cy).toBe(150); // 600 * 0.25
  });
  it('radius is 20% of width', () => {
    const p = fallbackPosition(1000, 800);
    expect(p.radius).toBe(200);
  });
  it('works for small images', () => {
    const p = fallbackPosition(100, 100);
    expect(p.cx).toBe(50);
    expect(p.cy).toBe(25);
    expect(p.radius).toBe(20);
  });
});

describe('faceToHaloParams', () => {
  const face: FaceBox = { x: 200, y: 150, width: 100, height: 120 };

  it('centers halo on face', () => {
    const p = faceToHaloParams(face);
    expect(p.cx).toBe(250); // 200 + 100/2
  });

  it('places halo slightly above face', () => {
    const p = faceToHaloParams(face);
    expect(p.cy).toBe(138); // 150 - 120 * 0.1
  });

  it('radius is 1.2x face width', () => {
    const p = faceToHaloParams(face);
    expect(p.radius).toBe(120); // 100 * 1.2
  });

  it('handles face at origin', () => {
    const p = faceToHaloParams({ x: 0, y: 50, width: 80, height: 100 });
    expect(p.cx).toBe(40);
    expect(p.cy).toBe(40); // 50 - 100 * 0.1
    expect(p.radius).toBe(96); // 80 * 1.2
  });

  it('handles large face', () => {
    const p = faceToHaloParams({ x: 100, y: 200, width: 500, height: 600 });
    expect(p.cx).toBe(350);
    expect(p.cy).toBe(140); // 200 - 600 * 0.1
    expect(p.radius).toBe(600); // 500 * 1.2
  });
});
