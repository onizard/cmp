import { describe, it, expect } from 'vitest';
import {
  RESERVATION_MS,
  reservationActive,
  maReservation,
  etatReservation,
  minutesRestantes,
} from './reservation.js';

const MOI = 'moi';
const ELLE = 'elle';
// 30 septembre 2026, 18 h à Paris.
const NOW = Date.parse('2026-09-30T16:00:00Z');
const iso = (ms) => new Date(ms).toISOString();
const reservee = (id, par, debutIlYaMin, extra = {}) => {
  const debut = NOW - debutIlYaMin * 60000;
  return { id, text: id, reservePar: par, reserveDebut: iso(debut), reserveFin: iso(debut + RESERVATION_MS), ...extra };
};
const libre = (id, extra = {}) => ({ id, text: id, ...extra });

describe('réservation', () => {
  it('dure une heure', () => {
    expect(reservationActive(reservee('a', MOI, 59), NOW)).toBe(true);
    expect(reservationActive(reservee('a', MOI, 61), NOW)).toBe(false);
  });

  it('une tâche faite ou supprimée n’est plus réservée', () => {
    expect(reservationActive(reservee('a', MOI, 5, { done: true }), NOW)).toBe(false);
    expect(etatReservation(reservee('a', MOI, 5, { deleted: true }), [], MOI, NOW)).toBe(null);
  });

  it('dit qui s’en occupe', () => {
    const a = reservee('a', MOI, 10);
    const b = reservee('b', ELLE, 10);
    const tasks = [a, b];
    expect(etatReservation(a, tasks, MOI, NOW)).toBe('moi');
    expect(etatReservation(b, tasks, MOI, NOW)).toBe('autre');
    expect(maReservation(tasks, MOI, NOW)).toBe(a);
    expect(minutesRestantes(a, NOW)).toBe(50);
  });

  it('une seule à la fois', () => {
    const a = reservee('a', MOI, 10);
    const c = libre('c');
    expect(etatReservation(c, [a, c], MOI, NOW)).toBe('uneAutre');
    // L'autre, elle, peut réserver la sienne.
    expect(etatReservation(c, [a, c], ELLE, NOW)).toBe('libre');
  });

  it('annulée ou échue : pas deux fois le même jour, possible le lendemain', () => {
    const annulee = { ...reservee('a', MOI, 20), reserveFin: iso(NOW - 5 * 60000) };
    expect(etatReservation(annulee, [annulee], MOI, NOW)).toBe('aujourdhui');
    // L'autre peut la prendre à son tour.
    expect(etatReservation(annulee, [annulee], ELLE, NOW)).toBe('libre');
    const hier = reservee('a', MOI, 20 * 60);
    expect(etatReservation(hier, [hier], MOI, NOW)).toBe('libre');
  });

  it('le jour est celui de Paris', () => {
    // Réservée à 23 h 30 à Paris le 29 ; à 0 h 30 le 30, c'est le lendemain.
    const minuitEtDemi = Date.parse('2026-09-29T22:30:00Z');
    const t = { id: 'a', reservePar: MOI, reserveDebut: '2026-09-29T21:30:00Z', reserveFin: '2026-09-29T22:00:00Z' };
    expect(etatReservation(t, [t], MOI, minuitEtDemi)).toBe('libre');
  });
});
