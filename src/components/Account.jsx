import { useEffect, useRef, useState } from 'react';
import {
  pushSupported,
  enablePush,
  disablePush,
  setEvening,
  eveningEnabled,
  syncPush,
  wantsPush,
  wantsEvening,
} from '../lib/push.js';
import InstallHint from './InstallHint.jsx';
import ShareInvite from './ShareInvite.jsx';
import LangPicker from './LangPicker.jsx';
import { useT } from '../i18n/index.js';

// Adresse de contact, fournie au moment de la compilation. Vide = bloc masqué.
const CONTACT = import.meta.env.VITE_CONTACT_EMAIL || '';

export default function Account({ account }) {
  const t = useT();
  const [name, setName] = useState(account.displayName || '');
  const [saved, setSaved] = useState(false);
  const [nameError, setNameError] = useState(null);
  // Tant que l'utilisateur n'a pas tapé, le champ suit la valeur du serveur ;
  // dès qu'il tape, on ne l'écrase plus sous ses doigts.
  const touched = useRef(false);
  const dirty = name.trim() !== (account.displayName || '').trim();
  const [confirmLeave, setConfirmLeave] = useState(false);

  // On part du choix mémorisé : l'interrupteur affiche tout de suite le bon
  // état, même si le navigateur met un instant à retrouver son abonnement.
  const [pass, setPass] = useState('');
  const [passSaved, setPassSaved] = useState(false);
  const [passError, setPassError] = useState(null);

  const [notifOn, setNotifOn] = useState(wantsPush);
  const [soirOn, setSoirOn] = useState(wantsEvening);
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

  const savePassword = async () => {
    setPassError(null);
    const ok = await account.setPassword(pass);
    if (!ok) {
      setPassError(account.error || t('compte.motDePasseErreur'));
      return;
    }
    setPass('');
    setPassSaved(true);
    setTimeout(() => setPassSaved(false), 2200);
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
          <label className="field-label" htmlFor="mail">{t('compte.email')}</label>
          <input id="mail" className="field" value={email} disabled />
          <button
            className="btn btn-accent btn-block"
            type="button"
            disabled={!dirty}
            onClick={saveName}
          >
            {saved ? t('app.enregistre') : t('app.enregistrer')}
          </button>
          {nameError && <p className="error">{nameError}</p>}
        </div>
      </section>

      <section className="setgroup">
        <h2 className="setlabel">{t('compte.motDePasse')}</h2>
        <div className="setcard">
          <p className="setnote">{t('compte.motDePasseAide')}</p>
          <label className="field-label" htmlFor="pass">{t('compte.nouveauMotDePasse')}</label>
          <input
            id="pass"
            className="field"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={pass}
            placeholder={t('auth.motDePassePlaceholder')}
            onChange={(e) => {
              setPassError(null);
              setPass(e.target.value);
            }}
          />
          <button
            className="btn btn-accent btn-block"
            type="button"
            disabled={pass.length < 8}
            onClick={savePassword}
          >
            {passSaved ? t('app.enregistre') : t('compte.enregistrerMotDePasse')}
          </button>
          {passError && <p className="error">{passError}</p>}
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
              {notifError && <p className="error">{notifError}</p>}
            </>
          ) : (
            <p className="setnote">{t('notifications.nonGere')}</p>
          )}
        </div>
      </section>

      <section className="setgroup">
        <h2 className="setlabel">{t('partage.titre')}</h2>
        <div className="setcard">
          <ShareInvite code={code} prenom={account.displayName} />
        </div>
      </section>

      <section className="setgroup">
        <h2 className="setlabel">{t('donnees.titre')}</h2>
        <div className="setcard">
          <ul className="privacy">
            <li>{t('donnees.foyerSeul')}</li>
            <li>{t('donnees.rienVendu')}</li>
            <li>{t('donnees.heberge')}</li>
            <li>{t('donnees.chiffre')}</li>
            <li>{t('donnees.effacer')}</li>
          </ul>
        </div>
      </section>

      <LangPicker />

      <button className="btn btn-block" type="button" onClick={account.signOut}>
        {t('auth.deconnexion')}
      </button>

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

      {CONTACT && (
        <p className="contact">
          
          <a
            href={`mailto:${CONTACT}?subject=${encodeURIComponent(t('app.titre'))}`}
          >
            {t('compte.contactLien')}
          </a>
        </p>
      )}

      <p className="ver">{t('app.titre')} · v4.6</p>
    </main>
  );
}
