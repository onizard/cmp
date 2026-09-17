import { describe, it, expect } from 'vitest';
import {
  codeDeLUrl,
  lienDInvitation,
  messageDInvitation,
  messageDecouverte,
} from './invite.js';

const CODE = '980b1023-47e4-48af-8094-7fd863abe45b';

describe('code dans l’adresse', () => {
  it('lit un code valide', () => {
    expect(codeDeLUrl(`https://exemple.fr/?foyer=${CODE}`)).toBe(CODE);
  });

  it('accepte les majuscules et les rabaisse', () => {
    expect(codeDeLUrl(`https://exemple.fr/?foyer=${CODE.toUpperCase()}`)).toBe(CODE);
  });

  it('refuse ce qui n’est pas un code', () => {
    expect(codeDeLUrl('https://exemple.fr/?foyer=bonjour')).toBeNull();
    expect(codeDeLUrl('https://exemple.fr/?foyer=')).toBeNull();
    expect(codeDeLUrl('https://exemple.fr/')).toBeNull();
  });

  it('ne casse pas sur une adresse invalide', () => {
    expect(codeDeLUrl('pas une adresse')).toBeNull();
    expect(codeDeLUrl(null)).toBeNull();
  });

  it('cohabite avec d’autres paramètres', () => {
    expect(codeDeLUrl(`https://exemple.fr/?a=1&foyer=${CODE}&b=2`)).toBe(CODE);
  });
});

describe('lien d’invitation', () => {
  it('compose l’adresse', () => {
    expect(lienDInvitation('https://exemple.fr', CODE)).toBe(
      `https://exemple.fr/?foyer=${CODE}`,
    );
  });

  it('ne double pas la barre oblique', () => {
    expect(lienDInvitation('https://exemple.fr/', CODE)).toBe(
      `https://exemple.fr/?foyer=${CODE}`,
    );
  });

  it('rien à partager sans code valide', () => {
    expect(lienDInvitation('https://exemple.fr', 'bonjour')).toBeNull();
    expect(lienDInvitation('https://exemple.fr', null)).toBeNull();
  });
});

describe('message', () => {
  it('nomme la personne quand on la connaît', () => {
    expect(messageDInvitation('Olivier')).toMatch(/^Olivier t’invite/);
  });

  it('reste neutre sans prénom', () => {
    expect(messageDInvitation('')).toMatch(/^Rejoins notre foyer/);
    expect(messageDInvitation(null)).toMatch(/^Rejoins notre foyer/);
  });

  it('le message de découverte ne parle pas de foyer', () => {
    expect(messageDecouverte()).not.toMatch(/foyer/i);
    expect(messageDecouverte()).toMatch(/charge mentale/i);
  });
});
