import { useState } from 'react';
import { useT, langue } from '../i18n/index.js';
import { lireComptes, basculer, ajouter, creer, oublier, postePartage } from '../lib/comptes.js';

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
 * quand la liste change. `ajout` : Mon compte, où chaque compte se retire
 * (après confirmation ; le compte en cours, par `onDeconnecter`), et où un
 * bouton ajoute le compte qui manque — perso s'il n'y a qu'un pro, pro s'il
 * n'y a qu'un perso, rien si les deux sont là.
 * `acces` : la demande pour rejoindre un compte pro (lib/acces.js).
 * `choix` : la page de choix des comptes, rien que les tuiles ; `onChoisi`
 * y est appelé une fois le compte ouvert, celui en cours compris.
 */
export default function Comptes({
  courant = null,
  ajout = true,
  onChange,
  choix = false,
  onChoisi,
  acces = null,
  onDeconnecter,
}) {
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
  // Le formulaire. Pour un compte pro : 'rejoindre' (sur simple demande),
  // 'connecter' (avec son mot de passe : pour l'administrateur) ou 'creer'
  // (pour qui monte son équipe). Pour un compte perso : 'perso' (avec son
  // mot de passe) ou 'persoCreer'.
  const [formulaire, setFormulaire] = useState(null);
  const [aRetirer, setARetirer] = useState(null);
  const aUnPro = comptes.some((c) => c.type === 'pro');
  const aUnPerso = comptes.some((c) => c.type !== 'pro');
  // Ordinateur partagé : on n'y ajoute aucun autre compte.
  const manque =
    !ajout || postePartage() ? null : aUnPro && !aUnPerso ? 'perso' : aUnPerso && !aUnPro ? 'pro' : null;
  const pourPerso = formulaire === 'perso' || formulaire === 'persoCreer';

  const retirer = (c) => {
    setARetirer(null);
    if (c.userId === courant) {
      onDeconnecter?.();
      return;
    }
    oublier(c.userId);
    setComptes(lireComptes());
  };
  const [email, setEmail] = useState('');
  const [mdp, setMdp] = useState('');

  const choisir = async (c) => {
    if (c.userId === courant) {
      onChoisi?.(c.userId);
      return;
    }
    setOccupe(c.userId);
    setErreur(null);
    const r = await basculer(c.userId);
    setOccupe(null);
    if (r) {
      setErreur(t('comptes.expire', { email: c.email }));
      setComptes(lireComptes());
    } else onChoisi?.(c.userId);
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
    if ((formulaire === 'creer' || formulaire === 'persoCreer') && mdp.length < 8) {
      setErreur(t('auth.motDePasseCourt'));
      return;
    }
    setOccupe('ajout');
    if (formulaire === 'connecter' || formulaire === 'perso') {
      const r = await ajouter(email, mdp, pourPerso ? 'perso' : 'pro');
      setOccupe(null);
      if (r) setErreur(/invalid login/i.test(r) ? t('auth.identifiantsFaux') : r);
      else fermer();
      return;
    }
    const r = await creer(email, mdp, pourPerso ? 'perso' : 'pro');
    setOccupe(null);
    if (r === 'dejaInscrit') {
      // Le compte existe : on l'ouvre avec son mot de passe (perso), ou on
      // demande à le rejoindre (pro).
      setErreur(pourPerso ? t('auth.dejaInscrit') : t('comptes.dejaExistant'));
      setFormulaire(pourPerso ? 'perso' : 'rejoindre');
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
              {ajout && !choix && (
                aRetirer === c.userId ? (
                  <div className="compte-retirer-sur">
                    <span>{t('comptes.retirerSur')}</span>
                    <button className="link equipe-retirer" type="button" onClick={() => retirer(c)}>
                      {t('comptes.retirerOui')}
                    </button>
                    <button className="link" type="button" onClick={() => setARetirer(null)}>
                      {t('app.annuler')}
                    </button>
                  </div>
                ) : (
                  <button type="button" className="link compte-oublier" onClick={() => setARetirer(c.userId)}>
                    {t('comptes.retirer')}
                  </button>
                )
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

      {manque && !(manque === 'pro' && acces?.demande) &&
        (formulaire ? (
          <form className="compte-ajout" onSubmit={valider}>
            <input
              className="field"
              type="email"
              autoComplete={formulaire === 'rejoindre' ? 'off' : 'username'}
              required
              placeholder={
                pourPerso ? t('comptes.emailPerso') : formulaire === 'creer' ? t('comptes.emailPro') : t('comptes.emailEntreprise')
              }
              aria-label={pourPerso ? t('comptes.emailPerso') : t('comptes.emailPro')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {formulaire !== 'rejoindre' && (
              <input
                className="field"
                type="password"
                autoComplete={formulaire === 'creer' || formulaire === 'persoCreer' ? 'new-password' : 'current-password'}
                required
                placeholder={
                  formulaire === 'creer' || formulaire === 'persoCreer'
                    ? t('auth.motDePassePlaceholder')
                    : t('auth.motDePasse')
                }
                aria-label={t('auth.motDePasse')}
                value={mdp}
                onChange={(e) => setMdp(e.target.value)}
              />
            )}
            <button className="btn btn-accent btn-block" type="submit" disabled={occupe !== null}>
              {occupe === 'ajout'
                ? t('app.instant')
                : {
                    rejoindre: t('comptes.envoyerDemande'),
                    connecter: t('comptes.ouvrirPro'),
                    creer: t('comptes.creerPro'),
                    perso: t('comptes.ouvrirPerso'),
                    persoCreer: t('comptes.creerPerso'),
                  }[formulaire]}
            </button>
            <button className="btn btn-block" type="button" onClick={fermer}>
              {t('app.annuler')}
            </button>
            {/* Les autres façons, en liens. */}
            {(pourPerso ? ['perso', 'persoCreer'] : ['rejoindre', 'connecter', 'creer'])
              .filter((m) => m !== formulaire)
              .map((m) => (
                <p className="authlinks" key={m}>
                  <button
                    type="button"
                    onClick={() => {
                      setErreur(null);
                      setFormulaire(m);
                    }}
                  >
                    {{
                      rejoindre: t('comptes.rejoindrePro'),
                      connecter: t('comptes.avecMotDePasse'),
                      creer: t('comptes.nouveauPro'),
                      perso: t('comptes.dejaPerso'),
                      persoCreer: t('comptes.nouveauPerso'),
                    }[m]}
                  </button>
                </p>
              ))}
          </form>
        ) : (
          <button
            className="btn btn-block"
            type="button"
            onClick={() => setFormulaire(manque === 'pro' ? 'rejoindre' : 'perso')}
          >
            <span className="compte-ajout-logo" aria-hidden="true">
              {manque === 'pro' ? <Mallette /> : <Maison />}
            </span>
            {manque === 'pro' ? t('comptes.ajouterPro') : t('comptes.ajouterPerso')}
          </button>
        ))}
    </div>
  );
}
