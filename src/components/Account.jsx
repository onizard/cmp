import { useEffect, useRef, useState } from 'react';
import {
  pushSupported,
  currentSubscription,
  enablePush,
  disablePush,
  setEvening,
  eveningEnabled,
} from '../lib/push.js';

export default function Account({ account }) {
  const [name, setName] = useState(account.displayName || '');
  const [saved, setSaved] = useState(false);
  const [nameError, setNameError] = useState(null);
  // Tant que l'utilisateur n'a pas tapé, le champ suit la valeur du serveur ;
  // dès qu'il tape, on ne l'écrase plus sous ses doigts.
  const touched = useRef(false);
  const dirty = name.trim() !== (account.displayName || '').trim();
  const [copied, setCopied] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const [notifOn, setNotifOn] = useState(false);
  const [soirOn, setSoirOn] = useState(false);
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
      const sub = await currentSubscription();
      if (!alive) return;
      setNotifOn(Boolean(sub));
      if (sub) setSoirOn(await eveningEnabled());
    })();
    return () => {
      alive = false;
    };
  }, []);

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

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
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
                <span>Petit rappel du soir</span>
                <button
                  type="button"
                  className="switch"
                  role="switch"
                  aria-checked={soirOn}
                  aria-label="Rappel du soir"
                  disabled={!notifOn}
                  onClick={toggleSoir}
                />
              </div>
              <p className="setnote">
                Vers 20 h, s’il reste des choses à porter.
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
          <p className="setnote">
            Transmets ce code à ta moitié pour qu’elle rejoigne le même foyer.
            Elle le colle une seule fois à l’ouverture de l’appli.
          </p>
          <div className="codebox">{code}</div>
          <button className="btn btn-accent" type="button" onClick={copy}>
            {copied ? 'Copié ✓' : "Copier le code d'invitation"}
          </button>
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

      <p className="ver">charge mentale partagée · v1.4</p>
    </main>
  );
}
