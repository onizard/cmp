import { describe, it, expect } from 'vitest';
import { connexionParLienRecente } from './account.js';

// Un jeton factice : seule la charge utile compte ici.
const jeton = (amr) =>
  `x.${Buffer.from(JSON.stringify({ amr })).toString('base64').replace(/=+$/, '')}.y`;
const maintenant = Date.UTC(2026, 9, 1, 12);
const il_y_a = (min) => Math.floor((maintenant - min * 60_000) / 1000);

describe('connexion par le lien du mail', () => {
  it('récente : l’ancien mot de passe n’est pas demandé', () => {
    const s = { access_token: jeton([{ method: 'otp', timestamp: il_y_a(5) }]) };
    expect(connexionParLienRecente(s, maintenant)).toBe(true);
  });

  it('il y a plus d’une heure, ou par mot de passe : il l’est', () => {
    expect(connexionParLienRecente({ access_token: jeton([{ method: 'otp', timestamp: il_y_a(90) }]) }, maintenant)).toBe(false);
    expect(connexionParLienRecente({ access_token: jeton([{ method: 'password', timestamp: il_y_a(1) }]) }, maintenant)).toBe(false);
    expect(connexionParLienRecente(null, maintenant)).toBe(false);
  });
});
