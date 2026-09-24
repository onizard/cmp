import { describe, it, expect, afterEach } from 'vitest';
import { definirLangue } from '../i18n/index.js';
import { libelleRecompense, libelleBon } from './libelle.js';

const linge = {
  id: 'r1',
  cle: 'linge',
  label: "Le linge lavé, étendu, plié et rangé par l'autre",
};

afterEach(() => definirLangue('fr'));

describe('libelleRecompense', () => {
  it('traduit une récompense du catalogue', () => {
    definirLangue('en');
    expect(libelleRecompense(linge)).toBe(
      'The laundry washed, hung, folded and put away by your other half',
    );
  });

  it('suit la langue choisie', () => {
    definirLangue('he');
    expect(libelleRecompense(linge)).toBe('החצי השני מכבס, תולה, מקפל ומסדר את הכביסה');
  });

  it('garde le libellé en base quand il n’y a pas de clé', () => {
    definirLangue('en');
    expect(libelleRecompense({ label: 'Un truc ajouté à la main' })).toBe(
      'Un truc ajouté à la main',
    );
  });

  it('n’affiche jamais une clé inconnue', () => {
    // Une clé posée par une version plus récente de la base que de l'appli.
    definirLangue('en');
    expect(libelleRecompense({ cle: 'inventeeDemain', label: 'Repli' })).toBe('Repli');
  });
});

describe('libelleBon', () => {
  it('traduit un bon venu du catalogue', () => {
    definirLangue('de');
    const bon = { rewardId: 'r1', label: linge.label };
    expect(libelleBon(bon, [linge])).toBe(
      'Die Wäsche gewaschen, aufgehängt, gefaltet und eingeräumt von deiner besseren Hälfte',
    );
  });

  it('laisse un souhait sur mesure tel qu’il a été écrit', () => {
    definirLangue('en');
    const bon = { rewardId: null, label: 'Un week-end à Rome' };
    expect(libelleBon(bon, [linge])).toBe('Un week-end à Rome');
  });

  it('se rabat sur le libellé figé si la récompense a disparu', () => {
    definirLangue('en');
    const bon = { rewardId: 'supprimee', label: 'Ancien libellé' };
    expect(libelleBon(bon, [linge])).toBe('Ancien libellé');
  });
});
