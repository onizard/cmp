import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAccount } from './lib/account.js';
import { useTasks } from './lib/store.js';
import { useRewards } from './lib/rewards.js';
import { useAdmin } from './lib/admin.js';
import { t, appliquerAuDocument } from './i18n/index.js';
import { monthKey, tasksVisibleIn, headline } from './lib/visibility.js';
import { pointsAvailable, affordable } from './lib/gamify.js';
import { creditees, bonsCredites, tousLesNoms } from './lib/famille.js';
import Header from './components/Header.jsx';
import Auth from './components/Auth.jsx';
import Onboarding from './components/Onboarding.jsx';
import TaskList from './components/TaskList.jsx';
import TabBar from './components/TabBar.jsx';
import BrainView from './components/BrainView.jsx';
import Account from './components/Account.jsx';
import AdminView from './components/AdminView.jsx';
import BilanView from './components/BilanView.jsx';
import UpdateBanner from './components/UpdateBanner.jsx';
import Combo from './components/Combo.jsx';
import BonsAHonorer from './components/BonsAHonorer.jsx';
import Nouvelles from './components/Nouvelles.jsx';
import { syncPush } from './lib/push.js';
import { useEquipe } from './lib/equipe.js';
import EquipeView from './components/EquipeView.jsx';
import ChoixCompte from './components/ChoixCompte.jsx';
import AccesDecision from './components/AccesDecision.jsx';
import AccesAnnonce from './components/AccesAnnonce.jsx';
import { useAcces, lireDecision } from './lib/acces.js';
import { lireComptes, plusieursComptes } from './lib/comptes.js';
import QuiEsTu from './components/QuiEsTu.jsx';
import {
  avecSessions,
  estTacheEnfants,
  useInactivite,
  DELAI_FAMILLE,
  DELAI_PRO,
  PROLONGER_MS,
} from './lib/session.js';

function NotConfigured() {
  return (
    <div className="screen">
      <Header />
      <p className="notice">{t('app.nonConfigure')}</p>
    </div>
  );
}

export default function App() {
  const account = useAccount();
  const currentMonth = monthKey();
  // Perso et pro sur le même appareil : on s'ouvre sur le choix du compte.
  // Un seul compte : droit sur ses tâches.
  const [choix, setChoix] = useState(plusieursComptes);
  // Le compte qu'on vient de choisir : la connexion bascule un instant après.
  // D'ici là, l'ancien compte est encore là, on n'en montre rien.
  const [attendu, setAttendu] = useState(null);
  const courant = account.session ? account.session.user.id : null;
  useEffect(() => {
    if (!attendu) return undefined;
    if (courant === attendu) {
      setAttendu(null);
      return undefined;
    }
    // Filet : la bascule n'arrive jamais ? On n'attend pas indéfiniment.
    const filet = setTimeout(() => setAttendu(null), 8000);
    return () => clearTimeout(filet);
  }, [attendu, courant]);
  // Passé par l'écran de connexion, on a déjà choisi.
  const deconnecte = account.ready && !account.session;
  useEffect(() => {
    if (deconnecte) setChoix(false);
  }, [deconnecte]);
  // Le lien du mail d'un administrateur : accepter ou refuser un équipier.
  // Connecté ou non, il passe avant tout le reste.
  const [decision, setDecision] = useState(lireDecision);

  if (!account.isConfigured) return <NotConfigured />;

  if (decision) {
    return (
      <AccesDecision
        id={decision.id}
        cle={decision.cle}
        onFini={() => {
          window.history.replaceState(null, '', window.location.pathname);
          setDecision(null);
        }}
      />
    );
  }

  // On patiente uniquement au tout premier chargement : ensuite, un
  // rafraîchissement en arrière-plan ne doit plus vider l'écran.
  if (!account.ready) {
    return (
      <div className="screen">
        <Header />
        <p className="notice">{t('app.instant')}</p>
      </div>
    );
  }

  if (!account.session) return <Auth account={account} />;

  // Juste après un changement de compte : le foyer lu est encore celui de
  // l'autre compte. On patiente plutôt que de mélanger les deux.
  if (!account.aJour || (attendu && courant !== attendu)) {
    return (
      <div className="screen">
        <Header />
        <p className="notice">{t('app.instant')}</p>
      </div>
    );
  }

  // On ne propose « créer un foyer » que si on a VRAIMENT pu vérifier qu'il
  // n'y en a pas. Sinon on invite des gens a se fabriquer un doublon.
  if (account.lectureRatee && !account.household) {
    return (
      <div className="screen">
        <Header />
        <div className="panel">
          <p className="lede">{t('foyer.perduTitre')}</p>
          <p className="soft-text">{t('foyer.perduTexte')}</p>
          <button
            className="btn btn-accent btn-block"
            type="button"
            onClick={account.reessayer}
          >
            {t('foyer.reessayer')}
          </button>
        </div>
      </div>
    );
  }

  if (choix) {
    return (
      <ChoixCompte
        courant={account.session.user.id}
        onFini={(id) => {
          setAttendu(id && id !== account.session.user.id ? id : null);
          setChoix(false);
        }}
      />
    );
  }

  // Un compte créé par « Ajouter un compte pro » va droit à l'entreprise.
  if (!account.household) {
    const pro = lireComptes().find((c) => c.userId === account.session.user.id)?.type === 'pro';
    return (
      <Onboarding
        account={account}
        pro={pro}
        onRetour={plusieursComptes() ? () => setChoix(true) : undefined}
      />
    );
  }

  return (
    <>
      <UpdateBanner />
      {/* Changer de compte change d'espace : tout l'écran repart de zéro. */}
      <Home
        key={`${account.session.user.id}:${account.household.id}`}
        account={account}
        currentMonth={currentMonth}
        onChangerCompte={() => setChoix(true)}
      />
    </>
  );
}

function Home({ account, currentMonth, onChangerCompte }) {
  const userId = account.session.user.id;
  const householdId = account.household.id;
  // Mode entreprise : une équipe sur ce compte, chacun avec son code.
  const entreprise = Boolean(account.household.entreprise);
  // La session ouverte sur ce téléphone partagé (session.js) : en famille
  // { id, nom, compte, proche, enfant }, en entreprise { op, code, nom }.
  const [acteur, setActeur] = useState(null);
  const famille = acteur && !entreprise ? acteur : null;
  const store = useTasks(householdId, userId, famille);
  const rewards = useRewards(householdId, userId, famille);
  const admin = useAdmin();
  const [tab, setTab] = useState('liste');
  const equipe = useEquipe(householdId, entreprise);

  // Plusieurs personnes sur ce téléphone : les tâches se voient dès
  // l'ouverture, et l'on dit qui l'on est au moment d'agir à son nom. La
  // session reste ouverte ensuite, jusqu'à la refermer ou ne plus toucher
  // l'écran. Seul sur son téléphone, rien ne change.
  const sessions = avecSessions({ entreprise, equipe: equipe.membres, proches: rewards.proches });
  const fermer = useCallback(() => setActeur(null), []);
  useEffect(() => {
    if (!sessions && acteur) fermer();
  }, [sessions, acteur, fermer]);
  // Le code tapé ouvre un ticket d'un quart d'heure (codes.sql) : tant que la
  // session vit, on le prolonge. Expiré, on referme.
  const prolonge = useRef(0);
  const avecCode = rewards.avecCode || [];
  useInactivite(
    sessions && Boolean(acteur),
    entreprise ? DELAI_PRO : DELAI_FAMILLE,
    fermer,
    () => {
      if (!famille || !avecCode.includes(famille.id)) return;
      if (Date.now() - prolonge.current < PROLONGER_MS) return;
      prolonge.current = Date.now();
      rewards.prolongerCode(famille.id).then((ok) => {
        if (!ok) fermer();
      });
    },
  );
  const ouvrir = useCallback(
    (a) => {
      prolonge.current = Date.now();
      // Tout de suite, sans attendre l'écran : l'action en attente part déjà
      // à son nom.
      if (!entreprise) {
        store.agirPour(a);
        rewards.agirPour(a);
      }
      setActeur(a);
    },
    [entreprise, store, rewards],
  );
  // Agir à son nom : si personne n'a encore dit qui il est, on le demande,
  // puis l'action part. `faire(acteur)` reçoit la session (en entreprise,
  // son code signe l'action).
  const [enAttente, setEnAttente] = useState(null);
  const exiger = useCallback(
    (faire) => {
      if (!sessions || acteur) {
        faire(acteur);
        return;
      }
      setEnAttente({ faire });
    },
    [sessions, acteur],
  );
  // Sans session sur un téléphone partagé : Cerveau, Bilan et Mon compte
  // demandent d'abord qui l'on est.
  const anonyme = sessions && !acteur;
  // Qui agit, tel que les points le comptent.
  const moi = famille ? famille.id : userId;
  // Mon compte reste au compte du téléphone : un enfant, ou un autre adulte
  // venu ouvrir sa session ici, n'y touche pas.
  const avecCompte = !famille || (famille.compte === userId && !famille.proche);
  // Sans session, Mon compte demande le code du titulaire, s'il en a un.
  const compteVerrouille =
    anonyme && !entreprise && (rewards.avecCode || []).includes(userId);
  // Rejoindre un compte pro : la demande se suit d'ici, quel que soit
  // l'onglet, pour annoncer la réponse dès qu'elle arrive.
  const acces = useAcces(userId);

  // L'annonce du combo vit ici, et pas dans la tâche : elle s'affiche au
  // milieu de l'écran, au-dessus de tout. La clé la fait rejouer quand deux
  // coches se suivent de près.
  const [combo, setCombo] = useState(null);
  const annoncerCombo = useCallback(
    (n) => setCombo({ n, cle: Date.now() }),
    [],
  );
  const finCombo = useCallback(() => setCombo(null), []);

  // Une mise à jour, un cache vidé ou une réinstallation peuvent emporter
  // l'abonnement aux notifications. On le rétablit en silence au démarrage et
  // à chaque retour sur l'application, pour que l'option reste sur « on ».
  useEffect(() => {
    const heal = () => {
      syncPush(userId, householdId).catch(() => {});
    };
    heal();
    const onVisible = () => {
      if (document.visibilityState === 'visible') heal();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [userId, householdId]);

  const todoThisMonth = useMemo(
    () =>
      tasksVisibleIn(
        famille && famille.enfant ? store.tasks.filter(estTacheEnfants) : store.tasks,
        currentMonth,
        currentMonth,
      ).filter((t) => !t.done).length,
    [store.tasks, currentMonth, famille],
  );

  // Les points vont à qui a fait : un enfant sans compte qui coche sur ce
  // téléphone, c'est à lui (famille.js).
  const tachesC = useMemo(() => creditees(store.tasks), [store.tasks]);
  const bonsC = useMemo(() => bonsCredites(rewards.claims), [rewards.claims]);
  const nomsC = useMemo(() => tousLesNoms(rewards.names, rewards.proches), [rewards.names, rewards.proches]);

  // Pastille sur l'onglet Cerveau : combien de récompenses sont à portée.
  const myPoints = pointsAvailable(tachesC, bonsC, moi);
  const readyCount = affordable(rewards.rewards, myPoints).length;

  const quiEsTu = (props = {}) => (
    <QuiEsTu
      userId={userId}
      rewards={rewards}
      equipe={entreprise ? equipe : null}
      onOuvrir={ouvrir}
      {...props}
    />
  );

  return (
    <div className={`screen has-tabbar ${entreprise ? 'screen-entreprise' : ''}`}>
      <Header
        accroche={tab === 'liste' ? headline(todoThisMonth) : null}
        onRetour={tab === 'liste' && plusieursComptes() ? onChangerCompte : undefined}
        session={acteur ? acteur.nom || '' : null}
        onFermerSession={fermer}
        online={store.online}
        pending={store.pending}
      />

      <>

      {tab === 'liste' &&
        (store.loading && store.tasks.length === 0 ? (
          <p className="notice">{t('app.chargement')}</p>
        ) : (
          <TaskList
            store={store}
            currentMonth={currentMonth}
            onCombo={annoncerCombo}
            names={nomsC}
            equipe={entreprise ? equipe : null}
            enfant={Boolean(famille && famille.enfant)}
            exiger={exiger}
            libre={anonyme}
            onCodePerime={fermer}
          />
        ))}
      {tab === 'cerveau' &&
        (entreprise ? (
          <EquipeView tasks={store.tasks} equipe={equipe} />
        ) : (
          <BrainView
            key={moi}
            tasks={store.tasks}
            userId={userId}
            rewards={rewards}
            acteur={famille}
            serrure={anonyme ? quiEsTu() : null}
          />
        ))}
      {tab === 'bilan' &&
        (anonyme ? quiEsTu() : <BilanView tasks={tachesC} claims={bonsC} userId={moi} />)}
      {tab === 'compte' && avecCompte && compteVerrouille && quiEsTu({ seuls: [userId] })}
      {tab === 'compte' && avecCompte && !compteVerrouille && (
        <Account
          account={account}
          rewards={rewards}
          equipe={entreprise ? equipe : null}
          acces={acces}
        />
      )}
      {tab === 'admin' && admin.isAdmin && avecCompte && !compteVerrouille && <AdminView admin={admin} />}
      </>

      <TabBar
        tab={tab}
        onChange={setTab}
        honourCount={entreprise ? 0 : readyCount}
        admin={admin.isAdmin && avecCompte}
        entreprise={entreprise}
        compte={avecCompte}
      />

      {combo && <Combo n={combo.n} cle={combo.cle} onFini={finCombo} />}

      <AccesAnnonce annonce={acces.annonce} onFini={acces.finAnnonce} />

      {/* Ce que l'autre a coché depuis la dernière fois, une tâche à la fois.
          Pas pendant le chargement : la liste vide ne dirait rien. */}
      {/* Sur un téléphone partagé, seulement une fois qu'on sait qui regarde :
          ce sont SES nouvelles. */}
      {!store.loading && !anonyme && (
        <Nouvelles
          key={moi}
          tasks={!famille ? store.tasks : famille.enfant ? tachesC.filter(estTacheEnfants) : tachesC}
          names={nomsC}
          userId={moi}
        />
      )}

      {/* Quel que soit l'onglet ouvert : un bon utilisé par l'autre passe
          devant tout le reste. */}
      <BonsAHonorer
        key={`bons-${moi}`}
        claims={bonsC}
        rewards={rewards.rewards}
        names={nomsC}
        userId={moi}
        proches={famille ? [] : rewards.proches}
      />

      {/* Une action à son nom, sans session ouverte : qui es-tu ? */}
      {enAttente &&
        quiEsTu({
          fenetre: true,
          onFermer: () => setEnAttente(null),
          onOuvrir: (a) => {
            const { faire } = enAttente;
            setEnAttente(null);
            ouvrir(a);
            faire(a);
          },
        })}
    </div>
  );
}
