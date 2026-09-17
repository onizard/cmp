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

// Adresse de contact, fournie au moment de la compilation. Vide = bloc masqué.
const CONTACT = import.meta.env.VITE_CONTACT_EMAIL || '';

export default function Account({ account }) {
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
      setNameError("Le prénom n'a pas pu être enregistré.");
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
      setPassError(
        account.error || "Le mot de passe n'a pas pu être enregistré.",
      );
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
      <p className="brain-lede">Mon compte</p>

      <section className="setgroup">
        <h2 className="setlabel">Profil</h2>
        <div className="setcard">
          <label className="field-label" htmlFor="prenom">Prénom</label>
          <input
            id="prenom"
            className="field"
            value={name}
            placeholder="Ton prénom"
            onChange={(e) => {
              touched.current = true;
              setName(e.target.value);
            }}
          />
          <label className="field-label" htmlFor="mail">Email</label>
          <input id="mail" className="field" value={email} disabled />
          <button
            className="btn btn-accent btn-block"
            type="button"
            disabled={!dirty}
            onClick={saveName}
          >
            {saved ? 'Enregistré ✓' : 'Enregistrer'}
          </button>
          {nameError && <p className="error">{nameError}</p>}
        </div>
      </section>

      <section className="setgroup">
        <h2 className="setlabel">Mot de passe</h2>
        <div className="setcard">
          <p className="setnote">
            Pose-toi un mot de passe : tu te reconnecteras sans passer par ta
            boîte mail, même après une réinstallation.
          </p>
          <label className="field-label" htmlFor="pass">Nouveau mot de passe</label>
          <input
            id="pass"
            className="field"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={pass}
            placeholder="8 caractères au minimum"
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
            {passSaved ? 'Enregistré ✓' : 'Enregistrer le mot de passe'}
          </button>
          {passError && <p className="error">{passError}</p>}
        </div>
      </section>

      <InstallHint />

      <section className="setgroup">
        <h2 className="setlabel">Notifications</h2>
        <div className="setcard">
          {pushSupported() ? (
            <>
              <div className="rowline">
                <span>Quand l’autre agit</span>
                <button
                  type="button"
                  className="switch"
                  role="switch"
                  aria-checked={notifOn}
                  aria-label="Notifications"
                  disabled={notifBusy}
                  onClick={toggleNotif}
                />
              </div>
              <p className="setnote">
                Une notification quand ta moitié ajoute ou coche une chose.
              </p>
              <div className="rowline">
                <span>Rappel matin et soir</span>
                <button
                  type="button"
                  className="switch"
                  role="switch"
                  aria-checked={soirOn}
                  aria-label="Rappel matin et soir"
                  disabled={!notifOn}
                  onClick={toggleSoir}
                />
              </div>
              <p className="setnote">
                Vers 8 h et 20 h, la tâche qui attend depuis le plus longtemps.
              </p>
              {notifError && <p className="error">{notifError}</p>}
            </>
          ) : (
            <p className="setnote">
              Ce navigateur ne gère pas les notifications. Installe
              l’application sur l’écran d’accueil pour en profiter.
            </p>
          )}
        </div>
      </section>

      <section className="setgroup">
        <h2 className="setlabel">Le foyer</h2>
        <div className="setcard">
          <ShareInvite code={code} prenom={account.displayName} />
        </div>
      </section>

      <section className="setgroup">
        <h2 className="setlabel">Tes données</h2>
        <div className="setcard">
          <ul className="privacy">
            <li>
              <b>Personne d’autre que ton foyer</b> ne voit tes tâches. La base
              de données le refuse, ce n’est pas qu’une question d’affichage.
            </li>
            <li>
              <b>Rien n’est vendu, rien n’est transmis.</b> Aucune publicité,
              aucun traçage, aucun outil de mesure extérieur.
            </li>
            <li>
              Tout est hébergé sur <b>un serveur privé, en France</b>, pas chez
              un géant du nuage.
            </li>
            <li>
              Le texte des notifications est <b>chiffré</b> avant de partir :
              ni Google ni Apple ne peuvent le lire au passage.
            </li>
            <li>
              Tu veux que tout disparaisse ? Écris-nous, ton compte et tes
              données sont effacés.
            </li>
          </ul>
        </div>
      </section>

      <button className="btn btn-block" type="button" onClick={account.signOut}>
        Se déconnecter
      </button>

      <p className="miniquit">
        {confirmLeave ? (
          <>
            Quitter vraiment le foyer ?{' '}
            <button type="button" onClick={account.leaveHousehold}>oui, quitter</button>{' '}
            ·{' '}
            <button type="button" onClick={() => setConfirmLeave(false)}>annuler</button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirmLeave(true)}>
            Quitter le foyer
          </button>
        )}
      </p>

      {CONTACT && (
        <p className="contact">
          Une idée, une question, quelque chose qui cloche ?{' '}
          <a
            href={`mailto:${CONTACT}?subject=${encodeURIComponent(
              'Charge mentale partagée',
            )}`}
          >
            Écris-nous
          </a>
          .
        </p>
      )}

      <p className="ver">charge mentale partagée · v3.6</p>
    </main>
  );
}
