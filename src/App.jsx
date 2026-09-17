import { useEffect, useMemo, useState } from 'react';
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
import UpdateBanner from './components/UpdateBanner.jsx';
import { syncPush } from './lib/push.js';

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

  if (!account.household) return <Onboarding account={account} />;

  return (
    <>
      <UpdateBanner />
      <Home account={account} currentMonth={currentMonth} />
    </>
  );
}

function Home({ account, currentMonth }) {
  const userId = account.session.user.id;
  const store = useTasks(account.household.id, userId);
  const rewards = useRewards(account.household.id, userId);
  const admin = useAdmin();
  const [tab, setTab] = useState('liste');
  const householdId = account.household.id;

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
    <div className="screen has-tabbar">
      <Header
        accroche={tab === 'liste' ? headline(todoThisMonth) : null}
        online={store.online}
        pending={store.pending}
      />

      {tab === 'liste' &&
        (store.loading && store.tasks.length === 0 ? (
          <p className="notice">{t('app.chargement')}</p>
        ) : (
          <TaskList store={store} currentMonth={currentMonth} />
        ))}
      {tab === 'cerveau' && (
        <BrainView tasks={store.tasks} userId={userId} rewards={rewards} />
      )}
      {tab === 'compte' && <Account account={account} />}
      {tab === 'admin' && admin.isAdmin && <AdminView admin={admin} />}

      <TabBar
        tab={tab}
        onChange={setTab}
        honourCount={readyCount}
        admin={admin.isAdmin}
      />
    </div>
  );
}
