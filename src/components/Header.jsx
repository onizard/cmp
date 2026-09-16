export default function Header({ accroche, online = true, pending = 0 }) {
  return (
    <header className="header">
      <h1 className="brand-title">
        Charge mentale
        <br />
        partagée
      </h1>
      <div className="tag">plus léger·e·s ensemble</div>
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
