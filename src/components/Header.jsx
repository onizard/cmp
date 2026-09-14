export default function Header({ accroche, online = true, pending = 0 }) {
  return (
    <header className="header">
      <div className="brand">
        <span className="sigle">CMP</span>
        <span className="baseline">charge mentale partagée</span>
      </div>
      {accroche && <p className="accroche">{accroche}</p>}
      {(!online || pending > 0) && (
        <p className="sync" role="status">
          {!online ? 'hors ligne' : 'synchronisation…'}
          {pending > 0 ? ` · ${pending} en attente` : ''}
        </p>
      )}
    </header>
  );
}
