import { useState } from 'react';
import { useT } from '../i18n/index.js';
import { lireComptes, basculer, ajouter, oublier } from '../lib/comptes.js';

// Les deux petits logos : une maison pour le perso, une mallette pour le pro.
const Maison = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);
const Mallette = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <rect x="3.5" y="7.5" width="17" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5M3.5 12.5h17" fill="none" stroke="currentColor" strokeWidth="2" />
  </svg>
);

/**
 * Les comptes rangés sur cet appareil, à choisir d'un toucher — sur l'écran
 * de connexion comme dans Mon compte. `courant` : l'identifiant du compte
 * connecté (aucun sur l'écran de connexion). `onChange(liste)` : prévenu
 * quand la liste change.
 */
export default function Comptes({ courant = null, ajout = true, onChange }) {
  const t = useT();
  const [comptes, setListe] = useState(lireComptes);
  // L'écran de connexion suit la liste : un compte retiré ou expiré peut y
  // faire réapparaître le formulaire.
  const setComptes = (liste) => {
    setListe(liste);
    onChange?.(liste);
  };
  const [erreur, setErreur] = useState(null);
  const [occupe, setOccupe] = useState(null);
  const [formulaire, setFormulaire] = useState(false);
  const [email, setEmail] = useState('');
  const [mdp, setMdp] = useState('');

  const choisir = async (c) => {
    if (c.userId === courant) return;
    setOccupe(c.userId);
    setErreur(null);
    const r = await basculer(c.userId);
    setOccupe(null);
    if (r) {
      setErreur(t('comptes.expire', { email: c.email }));
      setComptes(lireComptes());
    }
  };

  const ajouterCompte = async (e) => {
    e.preventDefault();
    setOccupe('ajout');
    setErreur(null);
    const r = await ajouter(email, mdp);
    setOccupe(null);
    if (r) setErreur(/invalid login/i.test(r) ? t('auth.identifiantsFaux') : r);
    else {
      setFormulaire(false);
      setEmail('');
      setMdp('');
    }
  };

  if (comptes.length === 0 && !ajout) return null;

  return (
    <div className="comptes">
      {comptes.length > 0 && (
        <ul className="comptes-liste">
          {comptes.map((c) => (
            <li key={c.userId}>
              <button
                type="button"
                className={`compte ${c.userId === courant ? 'compte-actif' : ''}`}
                onClick={() => choisir(c)}
                disabled={occupe !== null}
                aria-current={c.userId === courant ? 'true' : undefined}
              >
                <span className={`compte-logo compte-${c.type === 'pro' ? 'pro' : 'perso'}`}>
                  {c.type === 'pro' ? <Mallette /> : <Maison />}
                </span>
                <span className="compte-texte">
                  <span className="compte-nom">
                    {c.type === 'pro' ? t('comptes.pro') : t('comptes.perso')}
                    {c.nom ? ` · ${c.nom}` : ''}
                  </span>
                  <span className="compte-email">{c.email}</span>
                </span>
                <span className="compte-etat">
                  {c.userId === courant
                    ? t('comptes.actif')
                    : occupe === c.userId
                      ? t('app.instant')
                      : t('comptes.ouvrir')}
                </span>
              </button>
              {c.userId !== courant && (
                <button
                  type="button"
                  className="link compte-oublier"
                  onClick={() => {
                    oublier(c.userId);
                    setComptes(lireComptes());
                  }}
                >
                  {t('comptes.oublier')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {erreur && <p className="error">{erreur}</p>}

      {ajout &&
        (formulaire ? (
          <form className="compte-ajout" onSubmit={ajouterCompte}>
            <input
              className="field"
              type="email"
              autoComplete="username"
              required
              placeholder={t('auth.emailPlaceholder')}
              aria-label={t('auth.email')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="field"
              type="password"
              autoComplete="current-password"
              required
              placeholder={t('auth.motDePasse')}
              aria-label={t('auth.motDePasse')}
              value={mdp}
              onChange={(e) => setMdp(e.target.value)}
            />
            <div className="compte-ajout-boutons">
              <button className="btn btn-accent" type="submit" disabled={occupe !== null}>
                {occupe === 'ajout' ? t('app.instant') : t('comptes.ajouterEtOuvrir')}
              </button>
              <button className="btn" type="button" onClick={() => setFormulaire(false)}>
                {t('app.annuler')}
              </button>
            </div>
          </form>
        ) : (
          <button className="btn btn-block" type="button" onClick={() => setFormulaire(true)}>
            {t('comptes.ajouter')}
          </button>
        ))}
      <p className="setnote">{t('comptes.aide')}</p>
    </div>
  );
}
