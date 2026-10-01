import { useEffect, useMemo, useState } from 'react';
import { useT } from '../i18n/index.js';
import {
  monthName,
  tasksVisibleIn,
  sortForMonth,
  monthSummary,
  faitesDuMois,
} from '../lib/visibility.js';
import TaskItem from './TaskItem.jsx';
import AddTask from './AddTask.jsx';
import CodeOperateur from './CodeOperateur.jsx';
import { doublonAFaire } from '../lib/store.js';

/**
 * La liste, c'est le mois en cours : rien avant, rien après.
 *
 * Ce qui n'a pas été fait les mois passés est reporté ici ; pour prévoir à
 * l'avance, on l'ajoute au mois même. La carte est toujours ouverte. Une
 * tâche cochée quitte la liste et rejoint le tiroir « Faites », au bas, qui
 * ne garde que celles du mois ; on peut toujours y décocher ce qu'on a coché
 * par erreur. Rien n'est effacé : les points et le bilan comptent tout.
 */
export default function TaskList({ store, currentMonth, onCombo, names = {}, equipe = null }) {
  const t = useT();
  const currentYear = currentMonth.slice(0, 4);
  const [tiroirOuvert, setTiroirOuvert] = useState(false);
  // La tâche qu'on vient d'ajouter, ou celle qui existait déjà : on descend
  // jusqu'à elle et elle brille un instant. Sans ça, une tâche ajoutée en tête
  // de mois atterrit plus bas, hors de vue, et on la ressaisit.
  const [eclat, setEclat] = useState(null);

  useEffect(() => {
    if (!eclat) return undefined;
    const el = document.querySelector(
      `[data-mois="${eclat.mois}"] [data-tache="${eclat.id}"]`,
    );
    const calme = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el?.scrollIntoView({ behavior: calme ? 'auto' : 'smooth', block: 'center' });
    const fin = setTimeout(() => setEclat(null), 1800);
    return () => clearTimeout(fin);
  }, [eclat]);

  // Mode entreprise : l'action attend un code opérateur. `demande` tient la
  // fenêtre ouverte : son titre, le texte de la tâche, et ce qu'il faut faire
  // une fois le code saisi.
  const [demande, setDemande] = useState(null);
  const signer = equipe
    ? (titre, detail, faire) => setDemande({ titre, detail, faire })
    : null;
  const valider = async (code) => {
    const r = await demande.faire(code);
    if (r && r.erreur) {
      if (r.erreur === 'code') return t('entreprise.codeInconnu');
      if (r.erreur === 'horsLigne') return t('entreprise.horsLigne');
      return r.erreur;
    }
    setDemande(null);
    return null;
  };

  const ajouter = (mois, text) => {
    if (equipe) {
      // Le doublon se dit tout de suite, sans demander de code pour rien.
      const deja = doublonAFaire(store.tasks, mois, text.trim());
      if (deja) {
        setEclat({ mois, id: deja.id, cle: Date.now() });
        return { doublon: deja.id };
      }
      signer(t('entreprise.quiCree'), text.trim(), async (code) => {
        const r = await store.creerOp(mois, text, code);
        if (r.id) setEclat({ mois, id: r.id, cle: Date.now() });
        return r;
      });
      return { id: null };
    }
    const r = store.addTask(mois, text);
    const id = r && (r.id || r.doublon);
    if (id) setEclat({ mois, id, cle: Date.now() });
    return r;
  };

  const faites = useMemo(
    () => faitesDuMois(store.tasks, currentMonth),
    [store.tasks, currentMonth],
  );

  // Les tâches à faire du mois — reportées comprises. Le résumé, lui, se
  // calcule sur TOUT ce que le mois contient : sans les cochées, un mois
  // entièrement bouclé afficherait « rien » au lieu de « terminé ».
  const { aFaire, resume } = useMemo(() => {
    const tout = sortForMonth(tasksVisibleIn(store.tasks, currentMonth, currentMonth));
    return { aFaire: tout.filter((x) => !x.done), resume: monthSummary(tout) };
  }, [store.tasks, currentMonth]);

  const tiroir = (
    <div className="tiroir">
      <button
        type="button"
        className="tiroir-tete"
        aria-expanded={tiroirOuvert}
        onClick={() => setTiroirOuvert((v) => !v)}
      >
        <span className="tiroir-nom">{t('taches.faitesTiroir')}</span>
        <span className="tiroir-compte">{faites.length}</span>
      </button>
      {tiroirOuvert && (
        <div className="tiroir-corps">
          {faites.length === 0 ? (
            <p className="tiroir-vide">{t('taches.aucuneFaite')}</p>
          ) : (
            <ul className="tasks">
              {faites.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  month={task.doneMonth || task.month}
                  currentMonth={currentMonth}
                  store={store}
                  onCombo={onCombo}
                  names={names}
                  signer={signer}
                  noms={equipe ? equipe.noms : {}}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );

  const m = currentMonth;
  return (
    <main className="list">
      <div className="year-head year-fixe">
        <span className="year-num">{currentYear}</span>
      </div>
      <section className="month open month-fixe" data-mois={m}>
        <div className="month-head">
          <span className="month-name">{monthName(m)}</span>
          <span className="month-count">{resume}</span>
        </div>
        <div className="month-body">
          {/* En tete : ajouter est le geste le plus frequent, il ne doit pas
              se meriter au bas d'une liste. */}
          <AddTask onAdd={(text) => ajouter(m, text)} />
          <ul className="tasks">
            {aFaire.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                eclat={eclat && eclat.id === task.id && eclat.mois === m}
                month={m}
                currentMonth={currentMonth}
                store={store}
                onCombo={onCombo}
                names={names}
                signer={signer}
                noms={equipe ? equipe.noms : {}}
              />
            ))}
          </ul>
          {tiroir}
        </div>
      </section>
      {demande && (
        <CodeOperateur
          titre={demande.titre}
          detail={demande.detail}
          onValider={valider}
          onFermer={() => setDemande(null)}
        />
      )}
    </main>
  );
}
