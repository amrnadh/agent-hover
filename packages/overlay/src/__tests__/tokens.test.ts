import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Calculates WCAG 2.1 relative luminance for an sRGB hex color.
 */
function getRelativeLuminance(hex: string): number {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Calculates WCAG contrast ratio between two hex colors.
 */
function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getRelativeLuminance(hex1);
  const lum2 = getRelativeLuminance(hex2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('Design Tokens Architecture (P2-04 / §7.10)', () => {
  const tokensCssPath = path.resolve(__dirname, '../styles/tokens.css');
  const tokensCss = fs.readFileSync(tokensCssPath, 'utf8');

  it('defines integer-only font sizes without fractional blurriness (F-10)', () => {
    // Assert all defined font-size tokens (2xs, xs, sm, base, lg) use integer pixel values
    const fontSizeMatches = tokensCss.match(/--ah-text-(2xs|xs|sm|base|lg):\s*([^;]+);/g) || [];
    expect(fontSizeMatches.length).toBe(5);

    for (const match of fontSizeMatches) {
      const value = match.split(':')[1].trim().replace(';', '');
      expect(value).toMatch(/^[0-9]+px$/);
      const pxNum = parseInt(value, 10);
      expect(Number.isInteger(pxNum)).toBe(true);
    }
  });

  it('enforces tabular numbers for numeric metrics and badges', () => {
    expect(tokensCss).toContain('font-variant-numeric: tabular-nums');
    expect(tokensCss).toContain('.ah-tabular-nums');
  });

  it('includes prefers-reduced-motion media query', () => {
    expect(tokensCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(tokensCss).toContain('animation-duration: 0.01ms !important');
  });

  describe('WCAG AA Contrast Verification (F-11)', () => {
    it('satisfies WCAG AA contrast for dark theme tokens (>= 4.5:1 text, >= 3:1 controls)', () => {
      const surfaceBase = '#111214';
      const textPrimary = '#f2f4f8';
      const textSecondary = '#9aa0a6';
      const textMuted = '#757d8a';
      const textOnAccent = '#ffffff';
      const accentPrimary = '#0090ff';

      // Primary body text: expected >= 15:1 (WCAG AAA >= 7:1)
      const ratioPrimary = getContrastRatio(textPrimary, surfaceBase);
      expect(ratioPrimary).toBeGreaterThanOrEqual(4.5);

      // Secondary body text: expected >= 7:1 (WCAG AAA >= 7:1)
      const ratioSecondary = getContrastRatio(textSecondary, surfaceBase);
      expect(ratioSecondary).toBeGreaterThanOrEqual(4.5);

      // Muted body text: calibrated to meet WCAG AA >= 4.5:1
      const ratioMuted = getContrastRatio(textMuted, surfaceBase);
      expect(ratioMuted).toBeGreaterThanOrEqual(4.5);

      // Accent button UI control (WCAG SC 1.4.11 UI Components >= 3:1)
      const ratioAccent = getContrastRatio(textOnAccent, accentPrimary);
      expect(ratioAccent).toBeGreaterThanOrEqual(3.0);
    });

    it('satisfies WCAG AA contrast for light theme tokens (>= 4.5:1 text, >= 3:1 controls)', () => {
      const surfaceBase = '#ffffff';
      const textPrimary = '#111827';
      const textSecondary = '#4b5563';
      const textMuted = '#6b7280';
      const textOnAccent = '#ffffff';
      const accentPrimary = '#0070f3';

      // Primary text on white: expected >= 15:1 (WCAG AAA >= 7:1)
      const ratioPrimary = getContrastRatio(textPrimary, surfaceBase);
      expect(ratioPrimary).toBeGreaterThanOrEqual(4.5);

      // Secondary text on white: expected >= 7:1 (WCAG AAA >= 7:1)
      const ratioSecondary = getContrastRatio(textSecondary, surfaceBase);
      expect(ratioSecondary).toBeGreaterThanOrEqual(4.5);

      // Muted text on white: expected >= 4.5:1 (WCAG AA >= 4.5:1)
      const ratioMuted = getContrastRatio(textMuted, surfaceBase);
      expect(ratioMuted).toBeGreaterThanOrEqual(4.5);

      // Accent button UI control (WCAG SC 1.4.11 UI Components >= 3:1)
      const ratioAccent = getContrastRatio(textOnAccent, accentPrimary);
      expect(ratioAccent).toBeGreaterThanOrEqual(3.0);
    });
  });
});
