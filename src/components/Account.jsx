import { useEffect, useRef, useState } from 'react';
import {
  pushSupported,
  enablePush,
  disablePush,
  setEvening,
  eveningEnabled,
  setBinome,
  binomeEnabled,
  wantsBinome,
  syncPush,
  wantsPush,
  wantsEvening,
} from '../lib/push.js';
import InstallHint from './InstallHint.jsx';
import ShareInvite, { PartagerAppli } from './ShareInvite.jsx';
import LangPicker from './LangPicker.jsx';
import { useT } from '../i18n/index.js';
import { familleDOffice, tousLesMembres } from '../lib/famille.js';
import EquipeReglages from './EquipeReglages.jsx';
import Comptes from './Comptes.jsx';
import PostePartage from './PostePartage.jsx';
import Proches from './Proches.jsx';

// Adresse de contact, fournie au moment de la compilation. Vide = bloc masqué.
const CONTACT = import.meta.env.VITE_CONTACT_EMAIL || '';

export default function Account({ account, rewards = null, equipe = null, acces = null }) {
  const t = useT();
  const [name, setName] = useState(account.displayName || '');
  const [saved, setSaved] = useState(false);
  const [nameError, setNameError] = useState(null);
  // Tant que l'utilisateur n'a pas tapé, le champ suit la valeur du serveur ;
  // dès qu'il tape, on ne l'écrase plus sous ses doigts.
  const touched = useRef(false);
  const dirty = name.trim() !== (account.displayName || '').trim();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [zoneRouge, setZoneRouge] = useState(false);
  const [suppressionEnCours, setSuppression] = useState(false);
  const [suppressionErreur, setSuppressionErreur] = useState(null);

  // On part du choix mémorisé : l'interrupteur affiche tout de suite le bon
  // état, même si le navigateur met un instant à retrouver son abonnement.
  // Le mot de passe se change depuis le profil : un bouton, puis une case.
  const [passOuvert, setPassOuvert] = useState(false);
  const [pass, setPass] = useState('');
  // D'abord l'ancien mot de passe. Secours d'un compte pro : le code
  // responsable. Secours d'un compte perso : le lien du mail, après lequel
  // l'ancien n'est plus demandé pendant une heure.
  const [actuel, setActuel] = useState('');
  const [secours, setSecours] = useState(false);
  const [oubliAide, setOubliAide] = useState(false);
  const demandeActuel = Boolean(equipe) || !account.lienRecent;
  const actuelPret = !demandeActuel || (secours ? actuel.length >= 4 : actuel.length > 0);
  const [passSaved, setPassSaved] = useState(false);
  const [passError, setPassError] = useState(null);

  const [notifOn, setNotifOn] = useState(wantsPush);
  const [soirOn, setSoirOn] = useState(wantsEvening);
  const [binomeOn, setBinomeOn] = useState(wantsBinome);
  const seul = account.seul === true;
  // Le rappel « invite ta moitié » n'a de sens qu'en couple : une famille
  // s'agrandit à son rythme, une équipe partage un seul compte.
  const rappelInvitation = seul && !equipe && !rewards?.familleActivee;
  const [notifBusy, setNotifBusy] = useState(false);
  const [notifError, setNotifError] = useState(null);

  const email = account.session?.user?.email || '';
  const userId = account.session?.user?.id;
  const code = account.household?.id || '';

  useEffect(() => {
    if (!touched.current) setName(account.displayName || '');
  }, [account.displayName]);

  useEffect(() => {
    let alive = true;
    (async () => {
      // Recrée l'abonnement si la mise à jour l'a emporté, sans rien demander.
      const state = await syncPush(userId, code);
      if (!alive) return;
      setNotifOn(state.on);
      setSoirOn(state.evening);
      if (state.on) {
        const soir = await eveningEnabled();
        if (alive) setSoirOn(soir);
        const bin = await binomeEnabled();
        if (alive) setBinomeOn(bin);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId, code]);

  const saveName = async () => {
    setNameError(null);
    const ok = await account.updateDisplayName(name);
    if (!ok) {
      setNameError(t('compte.prenomErreur'));
      return;
    }
    touched.current = false;
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const fermerMotDePasse = () => {
    setPassOuvert(false);
    setPass('');
    setActuel('');
    setSecours(false);
    setOubliAide(false);
    setPassError(null);
  };

  const savePassword = async () => {
    setPassError(null);
    const r = secours
      ? await account.motDePassePro(actuel, pass)
      : await account.changerMotDePasse(demandeActuel ? actuel : null, pass);
    if (r) {
      setPassError(
        r === 'faux'
          ? secours
            ? t('entreprise.codeRespFaux')
            : t('compte.actuelFaux')
          : r === 'bloque'
            ? t('compte.tropEssais')
            : r === 'court'
              ? t('auth.motDePasseCourt')
              : r,
      );
      if (r === 'faux') setActuel('');
      return;
    }
    fermerMotDePasse();
    setPassSaved(true);
    setTimeout(() => setPassSaved(false), 2600);
  };

  const toggleNotif = async () => {
    setNotifError(null);
    setNotifBusy(true);
    try {
      if (notifOn) {
        await disablePush();
        setNotifOn(false);
        setSoirOn(false);
      } else {
        await enablePush(userId, code);
        setNotifOn(true);
        setSoirOn(true);
      }
    } catch (e) {
      setNotifError(e.message);
    }
    setNotifBusy(false);
  };

  // Compte entreprise : supprimer efface toute l'équipe, il faut le code
  // responsable (vérifié par la base).
  const [codeSuppr, setCodeSuppr] = useState('');
  // L'interrupteur « Ordinateur partagé » change la liste des comptes : on la
  // relit.
  const [versionComptes, setVersionComptes] = useState(0);
  const supprimer = async () => {
    setSuppressionErreur(null);
    setSuppression(true);
    const err = await account.supprimerLeCompte(equipe ? codeSuppr : null);
    if (!err) return; // la session se ferme, l'application repart toute seule
    setSuppression(false);
    if (err.code) {
      setCodeSuppr('');
      setSuppressionErreur(t('entreprise.codeRespFaux'));
      return;
    }
    setSuppressionErreur(`${t('suppression.erreur')} ${err}`);
  };

  const toggleBinome = async () => {
    if (!notifOn) return;
    const next = !binomeOn;
    setBinomeOn(next);
    await setBinome(next);
  };

  const toggleSoir = async () => {
    if (!notifOn) return;
    const next = !soirOn;
    setSoirOn(next);
    await setEvening(next);
  };

  return (
    <main className="account">
      <p className="brain-lede">{t('compte.titre')}</p>

      <section className="setgroup">
        <h2 className="setlabel">{t('compte.profil')}</h2>
        <div className="setcard">
          <label className="field-label" htmlFor="prenom">{t('compte.prenom')}</label>
          <input
            id="prenom"
            className="field"
            value={name}
            placeholder={t('compte.prenomPlaceholder')}
            onChange={(e) => {
              touched.current = true;
              setName(e.target.value);
            }}
          />
          {(dirty || saved) && (
            <button
              className="btn btn-accent btn-block"
              type="button"
              disabled={!dirty}
              onClick={saveName}
            >
              {saved ? t('app.enregistre') : t('app.enregistrer')}
            </button>
          )}
          {nameError && <p className="error">{nameError}</p>}
          <label className="field-label" htmlFor="mail">{t('compte.email')}</label>
          <input id="mail" className="field" value={email} disabled />
          {passOuvert ? (
            <form
              className="mdp-case"
              onSubmit={(e) => {
                e.preventDefault();
                if (pass.length >= 8 && actuelPret) savePassword();
              }}
            >
              {demandeActuel && (
                <>
                  <label className="field-label" htmlFor="pass-actuel">
                    {secours ? t('entreprise.codeResp') : t('compte.motDePasseActuel')}
                  </label>
                  <input
                    id="pass-actuel"
                    key={secours ? 'code' : 'mdp'}
                    className="field"
                    type="password"
                    inputMode={secours ? 'numeric' : undefined}
                    autoComplete={secours ? 'off' : 'current-password'}
                    autoFocus
                    value={actuel}
                    onChange={(e) => {
                      setPassError(null);
                      setActuel(secours ? e.target.value.replace(/\D/g, '').slice(0, 8) : e.target.value);
                    }}
                  />
                </>
              )}
              <label className="field-label" htmlFor="pass">{t('compte.nouveauMotDePasse')}</label>
              <input
                id="pass"
                className="field"
                type="password"
                autoComplete="new-password"
                minLength={8}
                autoFocus={!demandeActuel}
                value={pass}
                placeholder={t('auth.motDePassePlaceholder')}
                onChange={(e) => {
                  setPassError(null);
                  setPass(e.target.value);
                }}
              />
              {passError && <p className="error">{passError}</p>}
              <div className="mdp-boutons">
                <button className="btn btn-accent" type="submit" disabled={pass.length < 8 || !actuelPret}>
                  {t('compte.valider')}
                </button>
                <button className="btn" type="button" onClick={fermerMotDePasse}>
                  {t('app.annuler')}
                </button>
              </div>
              {demandeActuel && (
                <p className="authlinks mdp-oubli">
                  <button
                    type="button"
                    onClick={() => {
                      setPassError(null);
                      setActuel('');
                      if (equipe) setSecours(!secours);
                      else setOubliAide(!oubliAide);
                    }}
                  >
                    {equipe && secours ? t('compte.avecMotDePasse') : t('compte.oublie')}
                  </button>
                </p>
              )}
              {oubliAide && <p className="setnote">{t('compte.oubliAide', { lien: t('auth.oublieLien') })}</p>}
            </form>
          ) : (
            <button className="btn btn-block mdp-bouton" type="button" onClick={() => setPassOuvert(true)}>
              {passSaved
                ? `✓ ${t('compte.motDePasseChange')}`
                : equipe
                  ? t('entreprise.changerMotDePasse')
                  : t('compte.changerMotDePasse')}
            </button>
          )}
        </div>
      </section>

      <InstallHint />

      <section className="setgroup">
        <h2 className="setlabel">{t('notifications.titre')}</h2>
        <div className="setcard">
          {pushSupported() ? (
            <>
              <div className="rowline">
                <span>{t('notifications.quandLautreAgit')}</span>
                <button
                  type="button"
                  className="switch"
                  role="switch"
                  aria-checked={notifOn}
                  aria-label={t('notifications.titre')}
                  disabled={notifBusy}
                  onClick={toggleNotif}
                />
              </div>
              <p className="setnote">{t('notifications.quandLautreAide')}</p>
              <div className="rowline">
                <span>{t('notifications.rappel')}</span>
                <button
                  type="button"
                  className="switch"
                  role="switch"
                  aria-checked={soirOn}
                  aria-label={t('notifications.rappel')}
                  disabled={!notifOn}
                  onClick={toggleSoir}
                />
              </div>
              <p className="setnote">{t('notifications.rappelAide')}</p>
              {rappelInvitation && (
                <>
                  <div className="rowline">
                    <span>{t('notifications.binome')}</span>
                    <button
                      type="button"
                      className="switch"
                      role="switch"
                      aria-checked={binomeOn}
                      aria-label={t('notifications.binome')}
                      disabled={!notifOn}
                      onClick={toggleBinome}
                    />
                  </div>
                  <p className="setnote">{t('notifications.binomeAide')}</p>
                </>
              )}
              {notifError && <p className="error">{notifError}</p>}
            </>
          ) : (
            <p className="setnote">{t('notifications.nonGere')}</p>
          )}
        </div>
      </section>

      {/* Entreprise : ni invitation ni code foyer (l'équipe passe par le
          responsable) ; « Partager l'appli » reste, seul, en bas. */}
      {!equipe && (
        <section className="setgroup">
          <h2 className="setlabel">{t('partage.titre')}</h2>
          <div className="setcard">
            <ShareInvite code={code} prenom={account.displayName} />
          </div>
        </section>
      )}

      {/* Perso, pro… : les comptes rangés sur cet appareil, d'un toucher.
          Chacun se retire après confirmation ; un bouton ajoute celui qui
          manque. */}
      <section className="setgroup">
        <h2 className="setlabel">{t('comptes.titre')}</h2>
        <div className="setcard">
          <Comptes
            key={versionComptes}
            courant={account.session.user.id}
            acces={acces}
            onDeconnecter={account.signOut}
          />
        </div>
      </section>

      {/* Compte pro : réserver un poste du bureau à ce seul compte. */}
      {equipe && (
        <section className="setgroup">
          <h2 className="setlabel">{t('poste.titre')}</h2>
          <div className="setcard">
            <PostePartage
              account={account}
              equipe={equipe}
              onChange={() => setVersionComptes((v) => v + 1)}
            />
          </div>
        </section>
      )}

      {/* Mode entreprise : l'équipe et ses codes, derrière le code responsable. */}
      {equipe && (
        <section className="setgroup">
          <h2 className="setlabel">{t('entreprise.equipe')}</h2>
          <div className="setcard">
            <EquipeReglages equipe={equipe} />
          </div>
        </section>
      )}

      {/* Le mode famille : d'office à partir de 3 membres (membres sans compte
          compris), au choix avant. */}
      {rewards && !equipe && (
        <section className="setgroup">
          <h2 className="setlabel">{t('famille.titre')}</h2>
          <div className="setcard">
            <div className="rowline">
              <span>{t('famille.titre')}</span>
              <button
                type="button"
                className="switch"
                role="switch"
                aria-checked={rewards.familleActivee || familleDOffice(tousLesMembres(rewards.members, rewards.proches))}
                aria-label={t('famille.titre')}
                disabled={familleDOffice(tousLesMembres(rewards.members, rewards.proches))}
                onClick={() => rewards.activerFamille(!rewards.familleActivee)}
              />
            </div>
            <p className="setnote">
              {familleDOffice(tousLesMembres(rewards.members, rewards.proches))
                ? t('famille.dOffice', { n: tousLesMembres(rewards.members, rewards.proches).length })
                : t('famille.aide')}
            </p>
            <Proches rewards={rewards} />
          </div>
        </section>
      )}

      <section className="setgroup">
        <h2 className="setlabel">{t('donnees.titre')}</h2>
        <div className="setcard">
          <ul className="privacy">
            <li>{t('donnees.foyerSeul')}</li>
            <li>{t('donnees.rienVendu')}</li>
            <li>{t('donnees.heberge')}</li>
            <li>{t('donnees.chiffre')}</li>
          </ul>
        </div>
      </section>

      {equipe && <PartagerAppli />}

      <LangPicker />

      <button className="btn btn-block" type="button" onClick={account.signOut}>
        {t('auth.deconnexion')}
      </button>

      {/* Un compte entreprise ne quitte jamais son foyer (la base le refuse
          aussi). */}
      {!equipe && (
      <p className="miniquit">
        {confirmLeave ? (
          <>
            {t('foyer.quitterSur')}{' '}
            <button type="button" onClick={account.leaveHousehold}>{t('foyer.quitterOui')}</button>{' '}
            ·{' '}
            <button type="button" onClick={() => setConfirmLeave(false)}>{t('app.annuler')}</button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirmLeave(true)}>
            {t('foyer.quitter')}
          </button>
        )}
      </p>
      )}

      {CONTACT && (
        <p className="contact">
          
          <a
            href={`mailto:${CONTACT}?subject=${encodeURIComponent(t('app.titre'))}`}
          >
            {t('compte.contactLien')}
          </a>
        </p>
      )}

      <section className="danger">
        {zoneRouge ? (
          <>
            <h2 className="danger-titre">{t('suppression.titre')}</h2>
            <p className="danger-texte">
              {equipe ? t('suppression.avertissementEntreprise') : t('suppression.avertissement')}
            </p>
            {equipe && (
              <input
                className="field code-masque danger-code"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                data-1p-ignore="true"
                data-bwignore="true"
                placeholder={t('entreprise.codeResp')}
                aria-label={t('entreprise.codeResp')}
                value={codeSuppr}
                onChange={(e) => setCodeSuppr(e.target.value.replace(/\D/g, '').slice(0, 8))}
              />
            )}
            {suppressionErreur && <p className="error">{suppressionErreur}</p>}
            <button
              className="btn btn-block btn-danger"
              type="button"
              disabled={suppressionEnCours || (equipe && codeSuppr.length < 4)}
              onClick={supprimer}
            >
              {suppressionEnCours ? t('app.instant') : t('suppression.oui')}
            </button>
            <button
              className="btn btn-block"
              type="button"
              disabled={suppressionEnCours}
              onClick={() => {
                setZoneRouge(false);
                setCodeSuppr('');
                setSuppressionErreur(null);
              }}
            >
              {t('suppression.non')}
            </button>
          </>
        ) : (
          <button
            className="danger-lien"
            type="button"
            onClick={() => setZoneRouge(true)}
          >
            {t('suppression.bouton')}
          </button>
        )}
      </section>

      {/* Scellee au build depuis index.html : une version ecrite a la main
          ici resterait figee pendant que l'application, elle, avance. */}
      <p className="ver">
        {t('app.titre')} · {__CMP_BUILD__}
      </p>
    </main>
  );
}
