import { useMemo, useState } from 'react';
import { useAccount } from './lib/account.js';
import { useTasks } from './lib/store.js';
import { useGages } from './lib/gages.js';
import { monthKey, tasksVisibleIn, headline } from './lib/visibility.js';
import { gagesToHonour } from './lib/gamify.js';
import Header from './components/Header.jsx';
import Auth from './components/Auth.jsx';
import Onboarding from './components/Onboarding.jsx';
import TaskList from './components/TaskList.jsx';
import Household from './components/Household.jsx';
import TabBar from './components/TabBar.jsx';
import BrainView from './components/BrainView.jsx';

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

  if (account.loading && !account.session) {
    return (
      <div className="screen">
        <Header />
        <p className="notice">Un instant…</p>
      </div>
    );
  }

  if (!account.session) return <Auth account={account} />;
  if (!account.household) return <Onboarding account={account} />;

  return <Home account={account} currentMonth={currentMonth} />;
}

function Home({ account, currentMonth }) {
  const userId = account.session.user.id;
  const store = useTasks(account.household.id, userId);
  const gages = useGages(account.household.id, userId);
  const [tab, setTab] = useState('liste');

  const todoThisMonth = useMemo(
    () =>
      tasksVisibleIn(store.tasks, currentMonth, currentMonth).filter(
        (t) => !t.done,
      ).length,
    [store.tasks, currentMonth],
  );

  const honourCount = gagesToHonour(gages.gages, userId).length;

  return (
    <div className="screen has-tabbar">
      <Header
        accroche={tab === 'liste' ? headline(todoThisMonth) : null}
        online={store.online}
        pending={store.pending}
      />

      {tab === 'liste' ? (
        <>
          {store.loading && store.tasks.length === 0 ? (
            <p className="notice">Chargement…</p>
          ) : (
            <TaskList store={store} currentMonth={currentMonth} />
          )}
          <Household account={account} />
        </>
      ) : (
        <BrainView tasks={store.tasks} userId={userId} gages={gages} />
      )}

      <TabBar tab={tab} onChange={setTab} honourCount={honourCount} />
    </div>
  );
}
