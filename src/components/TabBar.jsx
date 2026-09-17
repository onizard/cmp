// Barre d'onglets en bas : les tâches, le cerveau, le compte.

const ListIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);

const BrainIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5a3 3 0 0 0-6 .5A3 3 0 0 0 4 8a3 3 0 0 0 1.5 2.6A3 3 0 0 0 7 16a3 3 0 0 0 5 1 3 3 0 0 0 5-1 3 3 0 0 0 1.5-5.4A3 3 0 0 0 20 8a3 3 0 0 0-2-2.5A3 3 0 0 0 12 5z" />
    <path d="M12 5v14" />
  </svg>
);

const ChartIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21h18" />
    <rect x="5" y="12" width="3.4" height="6" rx="1.2" />
    <rect x="10.3" y="8" width="3.4" height="10" rx="1.2" />
    <rect x="15.6" y="4" width="3.4" height="14" rx="1.2" />
  </svg>
);

const UserIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
  </svg>
);

export default function TabBar({ tab, onChange, honourCount = 0, admin = false }) {
  const tabs = [
    { id: 'liste', label: 'Tâches', Icon: ListIcon },
    { id: 'cerveau', label: 'Cerveau', Icon: BrainIcon },
    { id: 'compte', label: 'Mon compte', Icon: UserIcon },
  ];
  // L'onglet n'apparaît que pour un administrateur. Ce n'est qu'un confort :
  // c'est la base qui refuse les chiffres à tout autre appelant.
  if (admin) {
    tabs.push({ id: 'admin', label: 'Bord', Icon: ChartIcon });
  }
  return (
    <nav className="tabbar" role="tablist" aria-label="Sections">
      {tabs.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={tab === id}
          className={`tab ${tab === id ? 'active' : ''}`}
          onClick={() => onChange(id)}
        >
          <span className="tab-icon">
            <Icon />
            {id === 'cerveau' && honourCount > 0 && (
              <span className="tab-badge">{honourCount}</span>
            )}
          </span>
          <span className="tab-label">{label}</span>
        </button>
      ))}
    </nav>
  );
}
