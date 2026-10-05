/**
 * Les catégories déjà employées qui commencent comme ce qu'on tape, la plus
 * probable en tête : un toucher la choisit. Le pointeur ne vole pas le focus
 * du champ (on garde le clavier ouvert sur téléphone).
 */
export default function Suggestions({ noms, onChoisir, label }) {
  if (!noms || noms.length === 0) return null;
  return (
    <ul className="suggestions" aria-label={label}>
      {noms.map((nom) => (
        <li key={nom}>
          <button
            type="button"
            className="suggestion"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => onChoisir(nom)}
          >
            #{nom}
          </button>
        </li>
      ))}
    </ul>
  );
}
