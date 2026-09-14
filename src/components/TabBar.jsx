// Barre d'onglets en bas : la liste et le cerveau.

const ListIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
    <path d="M8 7h11M8 12h11M8 17h11" />
    <circle cx="4" cy="7" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="4" cy="12" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="4" cy="17" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

const BrainIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5.5V19" />
    <path d="M12 6.2A3 3 0 0 0 6.6 7 2.6 2.6 0 0 0 4.7 9.8 2.7 2.7 0 0 0 4.4 14a2.7 2.7 0 0 0 1.8 3.6A2.5 2.5 0 0 0 10 19.2" />
    <path d="M12 6.2A3 3 0 0 1 17.4 7a2.6 2.6 0 0 1 1.9 2.8 2.7 2.7 0 0 1 .3 4.2 2.7 2.7 0 0 1-1.8 3.6A2.5 2.5 0 0 1 14 19.2" />
  </svg>
);

export default function TabBar({ tab, onChange, honourCount = 0 }) {
  const tabs = [
    { id: 'liste', label: 'Liste', Icon: ListIcon },
    { id: 'cerveau', label: 'Cerveau', Icon: BrainIcon },
  ];
  return (
    <nav className="tabbar" role="tablist" aria-label="Sections">
      {tabs.map(({ id, label, Icon }) => (
        <button
          key={id}
          role="tab"
          aria-selected={tab === id}
          className={`tab ${tab === id ? 'active' : ''}`}
          onClick={() => onChange(id)}
        >
          <span className="tab-icon">
            <Icon />
            {id === 'cerveau' && honourCount > 0 && <span className="tab-badge">{honourCount}</span>}
          </span>
          <span className="tab-label">{label}</span>
        </button>
      ))}
    </nav>
  );
}
