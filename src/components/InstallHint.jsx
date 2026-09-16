import { useInstall } from '../lib/install.js';

/**
 * Explique comment poser l'application sur l'écran d'accueil.
 * Ne s'affiche jamais quand c'est déjà fait.
 */
export default function InstallHint() {
  const { mode, install, navigateur } = useInstall();

  if (mode === 'installed' || mode === 'aucun') return null;

  if (mode === 'bouton') {
    return (
      <div className="install">
        <p className="install-title">Garde-la sous la main</p>
        <p className="install-text">
          Installe l’application sur ton écran d’accueil : elle s’ouvre en
          plein écran et peut t’envoyer des notifications.
        </p>
        <button className="btn btn-accent btn-block" type="button" onClick={install}>
          Installer l’application
        </button>
      </div>
    );
  }

  // iOS : aucun bouton n'est possible, Apple ne l'autorise pas.
  return (
    <div className="install">
      <p className="install-title">Sur iPhone, en deux gestes</p>
      {navigateur === 'safari' ? (
        <ol className="install-steps">
          <li>
            Touche <b>Partager</b> en bas de l’écran (le carré avec la flèche
            vers le haut).
          </li>
          <li>
            Fais défiler, puis choisis <b>Sur l’écran d’accueil</b>.
          </li>
          <li>
            Touche <b>Ajouter</b> en haut à droite.
          </li>
        </ol>
      ) : (
        <>
          <p className="install-text">
            Ce navigateur ne sait pas toujours le faire. Le plus sûr :
            rouvre cette page dans <b>Safari</b>.
          </p>
          <ol className="install-steps">
            <li>
              Dans Safari, touche <b>Partager</b> en bas de l’écran.
            </li>
            <li>
              Choisis <b>Sur l’écran d’accueil</b>, puis <b>Ajouter</b>.
            </li>
          </ol>
        </>
      )}
      <p className="install-text">
        Il n’y a rien à télécharger : l’icône se pose directement sur l’écran
        d’accueil.
      </p>
    </div>
  );
}
