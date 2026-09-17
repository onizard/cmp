import { useEffect, useState } from 'react';
import { lienDInvitation, messageDInvitation } from '../lib/invite.js';

export default function ShareInvite({ code, prenom }) {
  const [qr, setQr] = useState('');
  const [ouvert, setOuvert] = useState(false);
  const [copie, setCopie] = useState(false);

  const lien =
    typeof window !== 'undefined'
      ? lienDInvitation(window.location.origin, code)
      : null;
  const message = messageDInvitation(prenom);
  const texte = lien ? `${message}\n${lien}` : '';

  // Le générateur de QR pèse une douzaine de kilo-octets : on ne le charge
  // qu'au moment où quelqu'un demande à voir le code.
  useEffect(() => {
    if (!ouvert || !lien || qr) return;
    let vivant = true;
    import('qrcode')
      .then((m) =>
        m.default.toString(lien, {
          type: 'svg',
          margin: 1,
          errorCorrectionLevel: 'M',
          color: { dark: '#17284C', light: '#FFFFFF' },
        }),
      )
      .then((svg) => {
        if (vivant) setQr(svg);
      })
      .catch(() => {
        if (vivant) setQr('');
      });
    return () => {
      vivant = false;
    };
  }, [ouvert, lien, qr]);

  if (!lien) return null;

  const partager = async () => {
    // La feuille de partage du téléphone : WhatsApp, SMS, mail, AirDrop…
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Charge mentale partagée',
          text: message,
          url: lien,
        });
        return;
      } catch {
        // Partage annulé : on ne fait rien de plus.
        return;
      }
    }
    copier();
  };

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(texte);
      setCopie(true);
      setTimeout(() => setCopie(false), 1900);
    } catch {
      setCopie(false);
    }
  };

  const enc = encodeURIComponent(texte);

  return (
    <>
      <p className="setnote">
        Envoie ce lien à ta moitié. En ouvrant l’application, elle arrivera
        directement dans ce foyer — rien à recopier.
      </p>

      <button className="btn btn-accent btn-block" type="button" onClick={partager}>
        Partager l’invitation
      </button>

      <div className="canaux">
        <a
          className="canal"
          href={`https://wa.me/?text=${enc}`}
          target="_blank"
          rel="noreferrer"
        >
          WhatsApp
        </a>
        <a className="canal" href={`sms:?&body=${enc}`}>
          SMS
        </a>
        <a
          className="canal"
          href={`mailto:?subject=${encodeURIComponent(
            'Charge mentale partagée',
          )}&body=${enc}`}
        >
          E-mail
        </a>
        <button className="canal" type="button" onClick={copier}>
          {copie ? 'Copié ✓' : 'Copier'}
        </button>
      </div>

      <button
        className="btn btn-block"
        type="button"
        aria-expanded={ouvert}
        onClick={() => setOuvert((v) => !v)}
      >
        {ouvert ? 'Masquer le QR code' : 'Afficher le QR code'}
      </button>

      {ouvert && (
        <div className="qr-foyer">
          {qr ? (
            <div
              className="qr-image"
              role="img"
              aria-label="QR code d’invitation"
              dangerouslySetInnerHTML={{ __html: qr }}
            />
          ) : (
            <p className="setnote">Un instant…</p>
          )}
          <p className="setnote">
            À scanner avec l’appareil photo. Le code du foyer est dedans.
          </p>
        </div>
      )}

      <p className="code-repli">
        Le code, si besoin : <span>{code}</span>
      </p>
    </>
  );
}
