import { useMemo, useState } from 'react';
import { useAccount } from './lib/account.js';
import { useTasks } from './lib/store.js';
import { useRewards } from './lib/rewards.js';
import { monthKey, tasksVisibleIn, headline } from './lib/visibility.js';
import { pointsAvailable, affordable } from './lib/gamify.js';
import Header from './components/Header.jsx';
import Auth from './components/Auth.jsx';
import Onboarding from './components/Onboarding.jsx';
import TaskList from './components/TaskList.jsx';
import TabBar from './components/TabBar.jsx';
import BrainView from './components/BrainView.jsx';
import Account from './components/Account.jsx';
import UpdateBanner from './components/UpdateBanner.jsx';

function NotConfigured() {
  return (
    <div className="screen">
      <Header />
      <p className="notice">
        L'application n'est pas encore reliée à sa base de données. Les clés
        Supabase doivent être fournies au moment de la compilation
        (<code>VITE_SUPABASE_URL</code> et <code>VITE_SUPABASE_ANON_KEY</code>).
      </p>
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
        <p className="notice">Un instant…</p>
      </div>
    );
  }

  if (!account.session) return <Auth account={account} />;
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
  const [tab, setTab] = useState('liste');

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
          <p className="notice">Chargement…</p>
        ) : (
          <TaskList store={store} currentMonth={currentMonth} />
        ))}
      {tab === 'cerveau' && (
        <BrainView tasks={store.tasks} userId={userId} rewards={rewards} />
      )}
      {tab === 'compte' && <Account account={account} />}

      <TabBar tab={tab} onChange={setTab} honourCount={readyCount} />
    </div>
  );
}
