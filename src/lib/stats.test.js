import { describe, it, expect } from 'vitest';
import { part, nombre, courbe, total } from './stats.js';

describe('parts', () => {
  it('arrondit au pourcentage', () => {
    expect(part(3, 4)).toBe(75);
    expect(part(7, 10)).toBe(70);
    expect(part(1, 3)).toBe(33);
  });

  it('ne divise jamais par zéro', () => {
    expect(part(0, 0)).toBe(0);
    expect(part(5, 0)).toBe(0);
    expect(part(5, null)).toBe(0);
  });
});

describe('nombres', () => {
  it('sépare les milliers à la française', () => {
    expect(nombre(1248)).toBe('1 248');
    expect(nombre(999)).toBe('999');
    expect(nombre(1234567)).toBe('1 234 567');
  });

  it('tolère l’absence de valeur', () => {
    expect(nombre(null)).toBe('0');
    expect(nombre(undefined)).toBe('0');
  });
});

describe('courbe', () => {
  it('rien à tracer sans points', () => {
    expect(courbe([]).ligne).toBe('');
    expect(courbe(null).n).toBe(0);
  });

  it('étale les points sur la largeur', () => {
    const c = courbe([{ n: 0 }, { n: 2 }, { n: 4 }], 300, 60);
    expect(c.max).toBe(4);
    expect(c.ligne).toBe('0,60 150,30 300,0');
  });

  it('une série de zéros reste au fond sans s’écraser', () => {
    const c = courbe([{ n: 0 }, { n: 0 }], 100, 50);
    expect(c.max).toBe(1);
    expect(c.ligne).toBe('0,50 100,50');
  });

  it('ferme l’aire sous la ligne', () => {
    const c = courbe([{ n: 1 }, { n: 1 }], 100, 40);
    expect(c.aire.startsWith('0,40')).toBe(true);
    expect(c.aire.endsWith('100,40')).toBe(true);
  });

  it('additionne la série', () => {
    expect(total([{ n: 2 }, { n: 3 }, { n: 0 }])).toBe(5);
    expect(total(null)).toBe(0);
  });
});
