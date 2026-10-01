import { useEffect, useState } from 'react';
import { useT } from '../i18n/index.js';
import { supabase } from '../supabaseClient.js';
import { formaterCode, codeComplet } from '../lib/acces.js';
import Header from './Header.jsx';
import { Maison } from './Comptes.jsx';

/**
 * La page du lien reçu par l'administrateur : qui demande à rejoindre le
 * compte pro, le code de liaison à taper pour accepter, ou un toucher pour
 * refuser. Elle s'ouvre connecté ou non : seule la clé du lien compte.
 */
export default function AccesDecision({ id, cle, onFini }) {
  const t = useT();
  const [info, setInfo] = useState(null);
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState(null);
  const [occupe, setOccupe] = useState(false);
  const [resultat, setResultat] = useState(null);

  useEffect(() => {
    let vivant = true;
    (async () => {
      const { data } = supabase
        ? await supabase.rpc('cmp_acces_voir', { p_id: id, p_cle: cle })
        : { data: null };
      if (vivant) setInfo(data || { statut: 'introuvable' });
    })();
    return () => {
      vivant = false;
    };
  }, [id, cle]);

  const decider = async (accepter) => {
    setErreur(null);
    setOccupe(true);
    const { data, error } = await supabase.rpc('cmp_acces_decider', {
      p_id: id,
      p_cle: cle,
      p_code: accepter ? code : null,
      p_accepter: accepter,
    });
    setOccupe(false);
    if (error || !data) {
      setErreur(error ? error.message : t('acces.introuvable'));
      return;
    }
    if (data.resultat === 'faux') {
      setErreur(t('acces.faux', { n: data.restants }));
      setCode('');
    } else if (data.resultat === 'deja') setInfo({ ...info, statut: data.statut });
    else if (data.resultat === 'expiree') setInfo({ ...info, statut: 'expiree' });
    else if (data.resultat === 'introuvable') setInfo({ statut: 'introuvable' });
    else setResultat(data.resultat);
  };

  const qui = info?.qui || '';
  const nom = info?.nom || '';

  let contenu;
  if (!info) contenu = <p className="soft-text">{t('app.instant')}</p>;
  else if (resultat === 'acceptee')
    contenu = (
      <>
        <p className="lede">{t('acces.fait', { qui, nom })}</p>
        <p className="soft-text">{t('acces.penseCode')}</p>
      </>
    );
  else if (resultat === 'refusee') contenu = <p className="lede">{t('acces.refusee')}</p>;
  else if (resultat === 'bloquee') contenu = <p className="lede">{t('acces.bloque')}</p>;
  else if (info.statut === 'introuvable') contenu = <p className="lede">{t('acces.introuvable')}</p>;
  else if (info.statut === 'expiree') contenu = <p className="lede">{t('acces.expiree')}</p>;
  else if (info.statut !== 'attente') contenu = <p className="lede">{t('acces.dejaTraitee')}</p>;
  else
    contenu = (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (codeComplet(code)) decider(true);
        }}
      >
        <p className="lede">{t('acces.titre')}</p>
        <div className="compte compte-fixe">
          <span className="compte-logo compte-perso">
            <Maison />
          </span>
          <span className="compte-texte">
            <span className="compte-nom">{qui}</span>
            <span className="compte-email">{info.email}</span>
          </span>
          <span />
        </div>
        <p className="soft-text">{t('acces.veut', { nom })}</p>
        <label className="field-label" htmlFor="code-liaison">
          {t('acces.code')}
        </label>
        <input
          id="code-liaison"
          className="field code-liaison-champ"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck="false"
          placeholder="XXXX-XXXX"
          value={code}
          onChange={(e) => {
            setErreur(null);
            setCode(formaterCode(e.target.value));
          }}
        />
        {erreur && <p className="error">{erreur}</p>}
        <div className="acces-boutons">
          <button className="btn btn-accent" type="submit" disabled={occupe || !codeComplet(code)}>
            {t('acces.accepter')}
          </button>
          <button className="btn" type="button" disabled={occupe} onClick={() => decider(false)}>
            {t('acces.refuser')}
          </button>
        </div>
      </form>
    );

  const termine = info && (resultat || info.statut !== 'attente');
  return (
    <div className="screen">
      <Header />
      <div className="panel">
        {contenu}
        {termine && (
          <button className="btn btn-block acces-continuer" type="button" onClick={onFini}>
            {t('acces.continuer')}
          </button>
        )}
      </div>
    </div>
  );
}
