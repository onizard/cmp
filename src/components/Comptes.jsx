import { useState } from 'react';
import { useT, langue } from '../i18n/index.js';
import { lireComptes, basculer, creer, oublier } from '../lib/comptes.js';

// Les deux petits logos : une maison pour le perso, une mallette pour le pro.
export const Maison = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);
export const Mallette = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <rect x="3.5" y="7.5" width="17" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5M3.5 12.5h17" fill="none" stroke="currentColor" strokeWidth="2" />
  </svg>
);

/**
 * Les comptes rangés sur cet appareil, à choisir d'un toucher — sur l'écran
 * de connexion comme dans Mon compte. `courant` : l'identifiant du compte
 * connecté (aucun sur l'écran de connexion). `onChange(liste)` : prévenu
 * quand la liste change. `ajout` : rejoindre ou créer un compte pro, que
 * seul un compte perso propose — un compte pro est celui d'une équipe.
 * `acces` : la demande pour rejoindre un compte pro (lib/acces.js).
 * `choix` : la page de choix des comptes, rien que les tuiles ; `onChoisi`
 * y est appelé une fois le compte ouvert, celui en cours compris.
 */
export default function Comptes({ courant = null, ajout = true, onChange, choix = false, onChoisi, acces = null }) {
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
  // Le formulaire : fermé, 'rejoindre' (le compte pro de son entreprise,
  // sur simple demande) ou 'creer' (un nouveau compte pro, pour qui monte
  // son équipe).
  const [formulaire, setFormulaire] = useState(null);
  const [email, setEmail] = useState('');
  const [mdp, setMdp] = useState('');

  const choisir = async (c) => {
    if (c.userId === courant) {
      onChoisi?.();
      return;
    }
    setOccupe(c.userId);
    setErreur(null);
    const r = await basculer(c.userId);
    setOccupe(null);
    if (r) {
      setErreur(t('comptes.expire', { email: c.email }));
      setComptes(lireComptes());
    } else onChoisi?.();
  };

  const fermer = () => {
    setFormulaire(null);
    setEmail('');
    setMdp('');
  };

  // Les réponses de la base, en clair.
  const ERREURS_ACCES = {
    inconnu: t('comptes.accesInconnu'),
    deja: t('comptes.accesDeja'),
    trop: t('comptes.accesTrop'),
    soi: t('comptes.accesSoi'),
  };

  const valider = async (e) => {
    e.preventDefault();
    setErreur(null);
    if (formulaire === 'rejoindre') {
      setOccupe('ajout');
      const r = await acces.envoyer(email, langue());
      setOccupe(null);
      if (r) setErreur(ERREURS_ACCES[r] || r);
      else fermer();
      return;
    }
    if (mdp.length < 8) {
      setErreur(t('auth.motDePasseCourt'));
      return;
    }
    setOccupe('ajout');
    const r = await creer(email, mdp);
    setOccupe(null);
    if (r === 'dejaInscrit') {
      // Le compte existe : on ne l'ouvre pas avec un mot de passe, on demande.
      setErreur(t('comptes.dejaExistant'));
      setFormulaire('rejoindre');
    } else if (r === 'confirmation') setErreur(t('auth.confirmationRequise'));
    else if (r) setErreur(r);
    else fermer();
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
                className={`compte ${c.userId === courant && !choix ? 'compte-actif' : ''}`}
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
                  {c.userId === courant && !choix
                    ? t('comptes.actif')
                    : occupe === c.userId
                      ? t('app.instant')
                      : t('comptes.ouvrir')}
                </span>
              </button>
              {c.userId !== courant && !choix && (
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

      {/* La demande envoyée : le code à donner à l'administrateur. */}
      {ajout && acces?.demande && (
        <>
          <ul className="comptes-liste">
            <li>
              <div className="compte compte-attente">
                <span className="compte-logo compte-pro">
                  <Mallette />
                </span>
                <span className="compte-texte">
                  <span className="compte-nom">
                    {t('comptes.pro')} · {t('comptes.enAttente')}
                  </span>
                  <span className="compte-email">{acces.demande.email}</span>
                </span>
                <span className="compte-etat" aria-hidden="true">
                  ⏳
                </span>
              </div>
            </li>
          </ul>
          <div className="code-liaison">
            <p className="code-liaison-titre">{t('comptes.codeLiaison')}</p>
            <p className="code-liaison-code">{acces.demande.code}</p>
            <p className="code-liaison-aide">{t('comptes.codeLiaisonAide')}</p>
          </div>
          <button className="btn btn-block" type="button" onClick={acces.annuler}>
            {t('comptes.annulerDemande')}
          </button>
        </>
      )}

      {ajout &&
        !acces?.demande &&
        (formulaire ? (
          <form className="compte-ajout" onSubmit={valider}>
            <input
              className="field"
              type="email"
              autoComplete={formulaire === 'creer' ? 'username' : 'off'}
              required
              placeholder={formulaire === 'creer' ? t('comptes.emailPro') : t('comptes.emailEntreprise')}
              aria-label={formulaire === 'creer' ? t('comptes.emailPro') : t('comptes.emailEntreprise')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {formulaire === 'creer' && (
              <input
                className="field"
                type="password"
                autoComplete="new-password"
                required
                placeholder={t('auth.motDePassePlaceholder')}
                aria-label={t('auth.motDePasse')}
                value={mdp}
                onChange={(e) => setMdp(e.target.value)}
              />
            )}
            <button className="btn btn-accent btn-block" type="submit" disabled={occupe !== null}>
              {occupe === 'ajout'
                ? t('app.instant')
                : formulaire === 'creer'
                  ? t('comptes.creerPro')
                  : t('comptes.envoyerDemande')}
            </button>
            <button className="btn btn-block" type="button" onClick={fermer}>
              {t('app.annuler')}
            </button>
            <p className="authlinks">
              <button
                type="button"
                onClick={() => {
                  setErreur(null);
                  setFormulaire(formulaire === 'creer' ? 'rejoindre' : 'creer');
                }}
              >
                {formulaire === 'creer' ? t('comptes.rejoindrePro') : t('comptes.nouveauPro')}
              </button>
            </p>
          </form>
        ) : (
          <button className="btn btn-block" type="button" onClick={() => setFormulaire('rejoindre')}>
            <span className="compte-ajout-logo" aria-hidden="true">
              <Mallette />
            </span>
            {t('comptes.rejoindrePro')}
          </button>
        ))}
    </div>
  );
}
