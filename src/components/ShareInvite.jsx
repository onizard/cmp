import { origineWeb } from '../lib/natif.js';
import { useState } from 'react';
import { useT } from '../i18n/index.js';
import {
  lienDInvitation,
  messageDInvitation,
  messageDecouverte,
} from '../lib/invite.js';

export default function ShareInvite({ code, prenom }) {
  const t = useT();
  const [copie, setCopie] = useState(null);

  const origine = origineWeb();
  const lienFoyer = lienDInvitation(origine, code);
  const lienNu = origine ? `${origine.replace(/\/+$/, '')}/` : null;

  // Un seul bouton : la feuille du téléphone mène déjà à WhatsApp, aux SMS,
  // au mail, au presse-papier. Là où elle n'existe pas, on copie.
  const partager = async (quoi, texte, url) => {
    if (url === null) return;
    const charge = url
      ? { title: 'Charge mentale partagée', text: texte, url }
      : { title: 'Charge mentale partagée', text: texte };
    if (navigator.share) {
      try {
        await navigator.share(charge);
      } catch {
        /* partage annulé */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url ? `${texte}\n${url}` : texte);
      setCopie(quoi);
      setTimeout(() => setCopie(null), 1900);
    } catch {
      setCopie(null);
    }
  };

  // « Code foyer : … » : un toucher le copie, tel quel ; « Code copié »
  // s'affiche alors juste en dessous.
  const copierCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopie('code');
      setTimeout(() => setCopie(null), 1900);
    } catch {
      setCopie(null);
    }
  };

  return (
    <>
      <button
        className="btn btn-accent btn-block"
        type="button"
        disabled={!lienFoyer}
        onClick={() =>
          partager('foyer', messageDInvitation(prenom), lienFoyer)
        }
      >
        {copie === 'foyer' ? t('partage.copie') : t('partage.inviter')}
      </button>

      <button
        className="btn btn-block"
        type="button"
        onClick={() => partager('appli', messageDecouverte(), lienNu)}
      >
        {copie === 'appli' ? t('partage.copie') : t('partage.partagerAppli')}
      </button>

      {code && (
        <button type="button" className="code-foyer" onClick={copierCode}>
          <span className="code-foyer-libelle">{t('partage.codeFoyer')}</span>{' '}
          <span className="code-foyer-valeur">{code}</span>
          <span className="code-foyer-etat" role="status">
            {copie === 'code' ? t('partage.codeCopie') : ''}
          </span>
        </button>
      )}
    </>
  );
}
