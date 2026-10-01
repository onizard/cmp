import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount } from './lib/account.js';
import { useTasks } from './lib/store.js';
import { useRewards } from './lib/rewards.js';
import { useAdmin } from './lib/admin.js';
import { t, appliquerAuDocument } from './i18n/index.js';
import { monthKey, tasksVisibleIn, headline } from './lib/visibility.js';
import { pointsAvailable, affordable } from './lib/gamify.js';
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
import { lireComptes, plusieursComptes } from './lib/comptes.js';

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
  // Passé par l'écran de connexion, on a déjà choisi.
  const deconnecte = account.ready && !account.session;
  useEffect(() => {
    if (deconnecte) setChoix(false);
  }, [deconnecte]);

  if (!account.isConfigured) return <NotConfigured />;

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
    return <ChoixCompte courant={account.session.user.id} onFini={() => setChoix(false)} />;
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
  const store = useTasks(account.household.id, userId);
  const rewards = useRewards(account.household.id, userId);
  const admin = useAdmin();
  const [tab, setTab] = useState('liste');
  const householdId = account.household.id;
  // Mode entreprise : une équipe sur ce compte, chacun avec son code.
  const entreprise = Boolean(account.household.entreprise);
  const equipe = useEquipe(householdId, entreprise);

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
      tasksVisibleIn(store.tasks, currentMonth, currentMonth).filter(
        (t) => !t.done,
      ).length,
    [store.tasks, currentMonth],
  );

  // Pastille sur l'onglet Cerveau : combien de récompenses sont à portée.
  const myPoints = pointsAvailable(store.tasks, rewards.claims, userId);
  const readyCount = affordable(rewards.rewards, myPoints).length;

  return (
    <div className={`screen has-tabbar ${entreprise ? 'screen-entreprise' : ''}`}>
      <Header
        accroche={tab === 'liste' ? headline(todoThisMonth) : null}
        onRetour={tab === 'liste' && plusieursComptes() ? onChangerCompte : undefined}
        online={store.online}
        pending={store.pending}
      />

      {tab === 'liste' &&
        (store.loading && store.tasks.length === 0 ? (
          <p className="notice">{t('app.chargement')}</p>
        ) : (
          <TaskList
            store={store}
            currentMonth={currentMonth}
            onCombo={annoncerCombo}
            names={rewards.names}
            equipe={entreprise ? equipe : null}
          />
        ))}
      {tab === 'cerveau' &&
        (entreprise ? (
          <EquipeView tasks={store.tasks} equipe={equipe} />
        ) : (
          <BrainView tasks={store.tasks} userId={userId} rewards={rewards} />
        ))}
      {tab === 'bilan' && (
        <BilanView tasks={store.tasks} claims={rewards.claims} userId={userId} />
      )}
      {tab === 'compte' && (
        <Account account={account} rewards={rewards} equipe={entreprise ? equipe : null} />
      )}
      {tab === 'admin' && admin.isAdmin && <AdminView admin={admin} />}

      <TabBar
        tab={tab}
        onChange={setTab}
        honourCount={entreprise ? 0 : readyCount}
        admin={admin.isAdmin}
        entreprise={entreprise}
      />

      {combo && <Combo n={combo.n} cle={combo.cle} onFini={finCombo} />}

      {/* Ce que l'autre a coché depuis la dernière fois, une tâche à la fois.
          Pas pendant le chargement : la liste vide ne dirait rien. */}
      {!store.loading && (
        <Nouvelles tasks={store.tasks} names={rewards.names} userId={userId} />
      )}

      {/* Quel que soit l'onglet ouvert : un bon utilisé par l'autre passe
          devant tout le reste. */}
      <BonsAHonorer
        claims={rewards.claims}
        rewards={rewards.rewards}
        names={rewards.names}
        userId={userId}
      />
    </div>
  );
}
