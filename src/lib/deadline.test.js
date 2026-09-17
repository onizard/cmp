import { describe, it, expect } from 'vitest';
import {
  dueLevel,
  dueLabel,
  dueFull,
  buildDue,
  splitDue,
  sortByDue,
} from './deadline.js';

const H = 3600000;
const J = 86400000;
const NOW = new Date('2026-09-17T10:00:00Z').getTime();
const inMs = (ms) => new Date(NOW + ms).toISOString();

describe('niveau d’urgence', () => {
  it('rien sans échéance', () => {
    expect(dueLevel(null, NOW)).toBeNull();
    expect(dueLevel('pas une date', NOW)).toBeNull();
  });

  it('calme au-delà de deux jours', () => {
    expect(dueLevel(inMs(3 * J), NOW)).toBe('calme');
    expect(dueLevel(inMs(49 * H), NOW)).toBe('calme');
  });

  it('proche en dessous de 48 h', () => {
    expect(dueLevel(inMs(48 * H), NOW)).toBe('proche');
    expect(dueLevel(inMs(7 * H), NOW)).toBe('proche');
  });

  it('urgent en dessous de 6 h', () => {
    expect(dueLevel(inMs(6 * H), NOW)).toBe('urgent');
    expect(dueLevel(inMs(30 * 60000), NOW)).toBe('urgent');
  });

  it('dépassé une fois l’heure passée', () => {
    expect(dueLevel(inMs(-1), NOW)).toBe('depasse');
    expect(dueLevel(inMs(-3 * J), NOW)).toBe('depasse');
  });
});

describe('temps restant', () => {
  it('en minutes, puis en heures, puis en jours', () => {
    expect(dueLabel(inMs(25 * 60000), NOW)).toBe('dans 25 min');
    expect(dueLabel(inMs(5 * H), NOW)).toBe('dans 5 h');
    expect(dueLabel(inMs(3 * J), NOW)).toBe('dans 3 j');
  });

  it('dit le retard', () => {
    expect(dueLabel(inMs(-25 * 60000), NOW)).toBe('en retard de 25 min');
    expect(dueLabel(inMs(-5 * H), NOW)).toBe('en retard de 5 h');
    expect(dueLabel(inMs(-2 * J), NOW)).toBe('en retard de 2 j');
  });

  it('bascule sur une date au-delà d’un mois', () => {
    expect(dueLabel(inMs(40 * J), NOW)).toMatch(/^\d{2}\/\d{2}$/);
  });

  it('rien sans échéance', () => {
    expect(dueLabel(null, NOW)).toBe('');
  });
});

describe('saisie de l’échéance', () => {
  it('sans heure, vise la fin de la journée', () => {
    const due = buildDue('2026-09-21', '');
    expect(due.hasTime).toBe(false);
    const d = new Date(due.iso);
    expect(d.getHours()).toBe(23);
    expect(d.getMinutes()).toBe(59);
  });

  it('avec heure, respecte l’heure donnée', () => {
    const due = buildDue('2026-09-21', '18:30');
    expect(due.hasTime).toBe(true);
    const d = new Date(due.iso);
    expect(d.getHours()).toBe(18);
    expect(d.getMinutes()).toBe(30);
  });

  it('rien sans date', () => {
    expect(buildDue('', '18:30')).toBeNull();
  });

  it('fait l’aller-retour avec les champs', () => {
    const due = buildDue('2026-09-21', '18:30');
    expect(splitDue(due.iso, true)).toEqual({ date: '2026-09-21', time: '18:30' });
    const jour = buildDue('2026-09-21', '');
    expect(splitDue(jour.iso, false)).toEqual({ date: '2026-09-21', time: '' });
  });

  it('écrit l’échéance en toutes lettres', () => {
    const due = buildDue('2026-09-21', '18:30');
    expect(dueFull(due.iso, true)).toBe('21/09/2026 à 18 h 30');
    expect(dueFull(due.iso, false)).toBe('21/09/2026');
  });
});

describe('tri par échéance', () => {
  it('la plus proche en tête, celles sans échéance à la fin', () => {
    const list = [
      { id: 'sans' },
      { id: 'loin', dueAt: inMs(3 * J) },
      { id: 'proche', dueAt: inMs(2 * H) },
    ];
    expect(sortByDue(list, NOW).map((t) => t.id)).toEqual([
      'proche',
      'loin',
      'sans',
    ]);
  });
});
