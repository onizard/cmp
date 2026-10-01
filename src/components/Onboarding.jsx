import { useState } from 'react';
import { useT } from '../i18n/index.js';
import Header from './Header.jsx';
import { codeResponsableValide } from '../lib/equipe.js';

// `pro` : un compte ajouté comme compte pro, qui va droit à l'entreprise.
export default function Onboarding({ account, pro = false }) {
  const t = useT();
  // Un code reçu par lien arrive déjà rempli : il n'y a plus qu'à confirmer.
  const [code, setCode] = useState(account.invitation || '');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    await account.createHousehold();
    setBusy(false);
  };

  // Compte entreprise : une équipe sur ce compte, chacun avec son code. Le
  // choix est définitif, d'où un bloc à part, qu'on ouvre exprès.
  const [entrepriseOuverte, setEntrepriseOuverte] = useState(pro);
  const [nomEntreprise, setNomEntreprise] = useState('');
  const [codeResp, setCodeResp] = useState('');
  const [codeResp2, setCodeResp2] = useState('');
  const [erreurEntreprise, setErreurEntreprise] = useState(null);

  const creerEntreprise = async (e) => {
    e.preventDefault();
    if (!codeResponsableValide(codeResp)) {
      setErreurEntreprise(t('entreprise.codeRespFormat'));
      return;
    }
    if (codeResp !== codeResp2) {
      setErreurEntreprise(t('entreprise.codesDifferents'));
      return;
    }
    setErreurEntreprise(null);
    setBusy(true);
    await account.createEntreprise(nomEntreprise.trim(), codeResp);
    setBusy(false);
  };

  const chiffres = (setter) => (e) => setter(e.target.value.replace(/\D/g, '').slice(0, 8));

  const join = async (e) => {
    e.preventDefault();
    setBusy(true);
    await account.joinHousehold(code);
    setBusy(false);
  };

  return (
    <div className="screen">
      <Header />
      {/* Un compte pro n'a ni foyer à rejoindre ni foyer à créer. */}
      {!pro && (
        <>
          <div className="panel">
            <p className="lede">{t('foyer.rejoindre')}</p>
            <p className="soft-text">
              {account.invitation ? t('foyer.inviteReconnue') : t('foyer.rejoindreAide')}
            </p>
            <form onSubmit={join}>
              <label className="field-label" htmlFor="code">
                {t('foyer.code')}
              </label>
              <input
                id="code"
                className="field"
                type="text"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck="false"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t('foyer.codePlaceholder')}
              />
              {account.error && <p className="error">{account.error}</p>}
              <button className="btn btn-accent" type="submit" disabled={busy}>
                {busy ? t('app.instant') : t('foyer.bouton')}
              </button>
            </form>
          </div>

          <div className="panel">
            <p className="soft-text">
              {t('foyer.premiereFois')}
            </p>
            <button className="btn" type="button" onClick={create} disabled={busy}>
              {t('foyer.creer')}
            </button>
          </div>
        </>
      )}

      <div className="panel">
        {!entrepriseOuverte ? (
          <>
            <p className="soft-text">{t('entreprise.creerAide')}</p>
            <button className="btn" type="button" onClick={() => setEntrepriseOuverte(true)}>
              {t('entreprise.creerTitre')}
            </button>
          </>
        ) : (
          <form onSubmit={creerEntreprise}>
            <p className="lede">{t('entreprise.creerTitre')}</p>
            <p className="soft-text">{t('entreprise.creerAide')}</p>
            <label className="field-label" htmlFor="ent-nom">{t('entreprise.nom')}</label>
            <input
              id="ent-nom"
              className="field"
              type="text"
              maxLength={60}
              value={nomEntreprise}
              onChange={(e) => setNomEntreprise(e.target.value)}
              required
            />
            <label className="field-label" htmlFor="ent-code">{t('entreprise.codeResp')}</label>
            <input
              id="ent-code"
              className="field"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              value={codeResp}
              onChange={chiffres(setCodeResp)}
              required
            />
            <label className="field-label" htmlFor="ent-code2">{t('entreprise.codeRespConfirm')}</label>
            <input
              id="ent-code2"
              className="field"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              value={codeResp2}
              onChange={chiffres(setCodeResp2)}
              required
            />
            <p className="soft-text">{t('entreprise.codeRespAide')}</p>
            {(erreurEntreprise || account.error) && (
              <p className="error">{erreurEntreprise || account.error}</p>
            )}
            <button className="btn btn-accent btn-block" type="submit" disabled={busy}>
              {busy ? t('app.instant') : t('entreprise.creer')}
            </button>
          </form>
        )}
      </div>

      <p className="signout-line">
        <button className="link" type="button" onClick={account.signOut}>
          {t('auth.deconnexion')}
        </button>
      </p>
    </div>
  );
}
