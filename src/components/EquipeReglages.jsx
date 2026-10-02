import { useEffect, useState } from 'react';
import { useT } from '../i18n/index.js';
import { codeOperateurValide } from '../lib/equipe.js';

/**
 * Mode entreprise : gérer l'équipe, derrière le code responsable.
 *
 * Le code responsable n'est gardé qu'en mémoire, le temps de la gestion, et
 * la base le revérifie à chaque enregistrement. « Verrouiller » ou quitter
 * l'onglet referme tout.
 */
export default function EquipeReglages({ equipe }) {
  const t = useT();
  const [responsable, setResponsable] = useState(null);
  const [saisie, setSaisie] = useState('');
  const [erreur, setErreur] = useState(null);
  const [occupe, setOccupe] = useState(false);
  const [nom, setNom] = useState('');
  const [code, setCode] = useState('');
  const [nouveauCode, setNouveauCode] = useState({});
  // Les téléphones qui ont rejoint le compte pro, et celui qu'on s'apprête
  // à retirer (on confirme d'abord).
  // Un membre supprimé disparaît des listes. En base, il reste, désactivé :
  // son code ne marche plus (et peut resservir), ses tâches passées gardent
  // son prénom.
  const membres = equipe.membres.filter((m) => m.actif);
  const [aSupprimer, setASupprimer] = useState(null);
  const [relies, setRelies] = useState(null);
  const [aRetirer, setARetirer] = useState(null);
  // Un nouveau code responsable : l'ancien, puis le nouveau, une seule fois.
  const [nouveauResp, setNouveauResp] = useState(null);
  const [respChange, setRespChange] = useState(false);

  const changerResponsable = async (e) => {
    e.preventDefault();
    const { ancien, nouveau } = nouveauResp;
    setOccupe(true);
    const m = await equipe.changerCodeResponsable(ancien, nouveau);
    setOccupe(false);
    if (m) {
      setErreur(
        m === 'faux'
          ? t('entreprise.codeRespFaux')
          : m === 'format'
            ? t('entreprise.codeRespFormat')
            : m,
      );
      if (m === 'faux') setNouveauResp({ ...nouveauResp, ancien: '' });
      return;
    }
    setErreur(null);
    setNouveauResp(null);
    setResponsable(null);
    setRespChange(true);
    setTimeout(() => setRespChange(false), 2600);
  };

  const chiffres8 = (v) => v.replace(/\D/g, '').slice(0, 8);
  const formulaireResponsable = nouveauResp && (
    <form className="mdp-case equipe-resp" onSubmit={changerResponsable}>
      <label className="field-label" htmlFor="resp-ancien">{t('entreprise.ancienCodeResp')}</label>
      <input
        id="resp-ancien"
        className="field"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        autoFocus
        value={nouveauResp.ancien}
        onChange={(e) => {
          setErreur(null);
          setNouveauResp({ ...nouveauResp, ancien: chiffres8(e.target.value) });
        }}
      />
      <label className="field-label" htmlFor="resp-nouveau">{t('entreprise.nouveauCodeResp')}</label>
      <input
        id="resp-nouveau"
        className="field"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        value={nouveauResp.nouveau}
        onChange={(e) => {
          setErreur(null);
          setNouveauResp({ ...nouveauResp, nouveau: chiffres8(e.target.value) });
        }}
      />
      <div className="mdp-boutons">
        <button
          className="btn btn-accent"
          type="submit"
          disabled={occupe || nouveauResp.ancien.length < 4 || nouveauResp.nouveau.length < 4}
        >
          {t('compte.valider')}
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => {
            setErreur(null);
            setNouveauResp(null);
          }}
        >
          {t('app.annuler')}
        </button>
      </div>
    </form>
  );

  const lienResponsable = !nouveauResp && (
    <p className="authlinks equipe-resp-lien">
      <button type="button" onClick={() => setNouveauResp({ ancien: '', nouveau: '' })}>
        {respChange ? `✓ ${t('entreprise.codeRespChange')}` : t('entreprise.changerCodeResp')}
      </button>
    </p>
  );

  useEffect(() => {
    if (!responsable) {
      setRelies(null);
      return undefined;
    }
    let vivant = true;
    equipe.relies(responsable).then((r) => {
      if (vivant) setRelies(Array.isArray(r) ? r : []);
    });
    return () => {
      vivant = false;
    };
  }, [responsable, equipe.relies]);

  const retirer = async (id) => {
    setOccupe(true);
    const m = await equipe.retirer(responsable, id);
    setOccupe(false);
    setARetirer(null);
    if (m) {
      setErreur(message(m));
      if (m === 'faux') setResponsable(null);
      return;
    }
    setRelies((l) => (l || []).filter((x) => x.id !== id));
  };

  const message = (m) =>
    m === 'faux'
      ? t('entreprise.codeRespFaux')
      : m === 'pris'
        ? t('entreprise.codePris')
        : m;

  const deverrouiller = async (e) => {
    e.preventDefault();
    setOccupe(true);
    const m = await equipe.verifierResponsable(saisie);
    setOccupe(false);
    setSaisie('');
    if (m) setErreur(message(m));
    else {
      setErreur(null);
      setResponsable(saisie);
    }
  };

  const enregistrer = async (champs) => {
    setOccupe(true);
    const m = await equipe.enregistrer(responsable, champs);
    setOccupe(false);
    if (m === 'faux') setResponsable(null);
    setErreur(m ? message(m) : null);
    return !m;
  };

  const ajouter = async (e) => {
    e.preventDefault();
    if (!nom.trim()) return;
    if (!codeOperateurValide(code)) {
      setErreur(t('entreprise.codeFormat'));
      return;
    }
    if (await enregistrer({ nom: nom.trim(), code })) {
      setNom('');
      setCode('');
    }
  };

  if (!responsable) {
    return (
      <>
        <form className="equipe-verrou" onSubmit={deverrouiller}>
          <ul className="equipe-liste">
            {membres.length === 0 && <li className="setnote">{t('entreprise.equipeVide')}</li>}
            {membres.map((m) => (
              <li key={m.id}>
                <span>{m.nom}</span>
              </li>
            ))}
          </ul>
          <label className="field-label" htmlFor="code-resp">{t('entreprise.codeRespDemande')}</label>
          <div className="equipe-ligne">
            <input
              id="code-resp"
              className="field"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={saisie}
              onChange={(e) => setSaisie(e.target.value.replace(/\D/g, '').slice(0, 8))}
            />
            <button className="btn btn-accent" type="submit" disabled={occupe || saisie.length < 4}>
              {t('entreprise.deverrouiller')}
            </button>
          </div>
          {erreur && !nouveauResp && <p className="error">{erreur}</p>}
        </form>
        {formulaireResponsable}
        {nouveauResp && erreur && <p className="error">{erreur}</p>}
        {lienResponsable}
      </>
    );
  }

  return (
    <div className="equipe-gestion">
      <ul className="equipe-liste">
        {membres.map((m) => (
          <li key={m.id}>
            <span className="equipe-nom">{m.nom}</span>
            {aSupprimer === m.id ? (
              <span className="equipe-confirme">
                <button
                  className="link equipe-retirer"
                  type="button"
                  disabled={occupe}
                  onClick={async () => {
                    await enregistrer({ id: m.id, nom: m.nom, actif: false });
                    setASupprimer(null);
                  }}
                >
                  {t('entreprise.supprimerOui')}
                </button>
                <button className="link" type="button" onClick={() => setASupprimer(null)}>
                  {t('app.annuler')}
                </button>
              </span>
            ) : (
              <button className="link equipe-bascule" type="button" onClick={() => setASupprimer(m.id)}>
                {t('entreprise.supprimer')}
              </button>
            )}
            <div className="equipe-actions">
              <input
                className="field"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                placeholder={t('entreprise.nouveauCode')}
                aria-label={`${t('entreprise.nouveauCode')} — ${m.nom}`}
                value={nouveauCode[m.id] || ''}
                onChange={(e) =>
                  setNouveauCode({ ...nouveauCode, [m.id]: e.target.value.replace(/\D/g, '').slice(0, 4) })
                }
              />
              <button
                className="btn btn-small"
                type="button"
                disabled={occupe || !codeOperateurValide(nouveauCode[m.id])}
                onClick={async () => {
                  if (await enregistrer({ id: m.id, nom: m.nom, code: nouveauCode[m.id], actif: m.actif })) {
                    setNouveauCode({ ...nouveauCode, [m.id]: '' });
                  }
                }}
              >
                {t('app.enregistrer')}
              </button>
            </div>
          </li>
        ))}
      </ul>

      <form className="equipe-ajout" onSubmit={ajouter}>
        <p className="field-label">{t('entreprise.ajouter')}</p>
        <div className="equipe-ligne">
          <input
            className="field"
            type="text"
            autoComplete="off"
            maxLength={40}
            placeholder={t('entreprise.prenom')}
            aria-label={t('entreprise.prenom')}
            value={nom}
            onChange={(e) => setNom(e.target.value)}
          />
          <input
            className="field equipe-code"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            placeholder={t('entreprise.code')}
            aria-label={t('entreprise.code')}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
          />
        </div>
        <button className="btn btn-accent btn-block" type="submit" disabled={occupe || !nom.trim()}>
          {t('entreprise.ajouterBouton')}
        </button>
      </form>
      {/* Les téléphones reliés : ceux qui ont rejoint par une demande. */}
      <div className="equipe-relies">
        <p className="field-label">{t('entreprise.relies')}</p>
        {relies && relies.length === 0 && <p className="setnote">{t('entreprise.reliesVide')}</p>}
        {relies && relies.length > 0 && (
          <ul className="equipe-liste">
            {relies.map((r) => (
              <li key={r.id}>
                <span className="equipe-nom">
                  {r.qui}
                  <span className="equipe-email">{r.email}</span>
                </span>
                {aRetirer === r.id ? (
                  <span className="equipe-confirme">
                    <button className="link equipe-retirer" type="button" disabled={occupe} onClick={() => retirer(r.id)}>
                      {t('entreprise.retirerOui')}
                    </button>
                    <button className="link" type="button" onClick={() => setARetirer(null)}>
                      {t('app.annuler')}
                    </button>
                  </span>
                ) : (
                  <button className="link equipe-bascule" type="button" onClick={() => setARetirer(r.id)}>
                    {t('entreprise.retirer')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {formulaireResponsable}
      {erreur && <p className="error">{erreur}</p>}
      {lienResponsable}
      <button className="link" type="button" onClick={() => setResponsable(null)}>
        {t('entreprise.verrouiller')}
      </button>
    </div>
  );
}
