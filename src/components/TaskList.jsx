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
import AjoutCategorie from './AjoutCategorie.jsx';
import CodeOperateur from './CodeOperateur.jsx';
import useGlisser from './useGlisser.js';
import { doublonAFaire } from '../lib/store.js';
import {
  extraireCategorie,
  statsCategories,
  suggerer,
  nomConnu,
  sectionsDuMois,
  cleCategorie,
} from '../lib/categories.js';
import { rangsAuDepot } from '../lib/ordre.js';

/**
 * La liste, c'est le mois en cours : rien avant, rien après.
 *
 * Ce qui n'a pas été fait les mois passés est reporté ici ; pour prévoir à
 * l'avance, on l'ajoute au mois même. La carte est toujours ouverte. Une
 * tâche cochée quitte la liste et rejoint le tiroir « Faites », au bas, qui
 * ne garde que celles du mois ; on peut toujours y décocher ce qu'on a coché
 * par erreur. Rien n'est effacé : les points et le bilan comptent tout.
 *
 * Les tâches à faire se rangent par catégorie : d'abord celles sans
 * catégorie, puis une section par catégorie. Un appui long sur une tâche la
 * soulève : on la glisse entre ses voisines ou dans une autre section.
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

  // Tout ce qu'on sait des catégories employées : pour les suggestions.
  const stats = useMemo(
    () => statsCategories(store.tasks, store.categories || []),
    [store.tasks, store.categories],
  );

  const ajouterCategorie = (mois, nom, sections) => {
    const propre = nomConnu(stats, nom);
    if (!propre) return;
    if (sections.some((x) => x.cle === cleCategorie(propre))) return;
    store.ajouterCategorie(mois, propre);
  };

  const ajouter = (mois, saisie, sections) => {
    // « acheter du pain #dépense » : la tâche va dans « dépense », créée au
    // besoin. « #dons » tout seul crée juste la catégorie.
    const { texte: text, categorie: brute } = extraireCategorie(saisie);
    const categorie = brute ? nomConnu(stats, brute) : null;
    if (!text) {
      if (categorie) ajouterCategorie(mois, categorie, sections);
      return {};
    }
    if (equipe) {
      // Le doublon se dit tout de suite, sans demander de code pour rien.
      const deja = doublonAFaire(store.tasks, mois, text);
      if (deja) {
        setEclat({ mois, id: deja.id, cle: Date.now() });
        return { doublon: deja.id };
      }
      signer(t('entreprise.quiCree'), categorie ? `${text} · #${categorie}` : text, async (code) => {
        const r = await store.creerOp(mois, text, code, categorie);
        if (r.id) setEclat({ mois, id: r.id, cle: Date.now() });
        return r;
      });
      return { id: null };
    }
    const r = store.addTask(mois, text, categorie);
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

  const { sans, sections } = useMemo(
    () => sectionsDuMois(aFaire, store.categories || [], currentMonth),
    [aFaire, store.categories, currentMonth],
  );

  // La tâche glissée est posée : dans sa section, à sa place.
  const deposer = (id, cle, index) => {
    const task = aFaire.find((x) => x.id === id);
    if (!task) return;
    const section = cle ? sections.find((x) => x.cle === cle) : null;
    if (cle && !section) return;
    const liste = (section ? section.taches : sans).filter((x) => x.id !== id);
    const avant = (section ? section.taches : sans).findIndex((x) => x.id === id);
    if (avant === index) return; // reposée où elle était
    const rangs = rangsAuDepot(liste, index, task);
    store.placer(task, section ? section.nom : null, rangs, Boolean(equipe));
  };
  const glisser = useGlisser({ onDeposer: deposer });

  // Où la tâche glissée tomberait : un trait au-dessus ou au-dessous d'une
  // voisine, ou toute la section qui s'allume si elle est vide.
  const depot = (cle, liste) => {
    if (!glisser.glisse || !glisser.cible || glisser.cible.section !== cle) return {};
    const autres = liste.filter((x) => x.id !== glisser.glisse.id);
    if (autres.length === 0) return { section: true };
    const i = glisser.cible.index;
    return i < autres.length ? { [autres[i].id]: 'avant' } : { [autres[autres.length - 1].id]: 'apres' };
  };

  const ligne = (task, marque) => (
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
      poignee={glisser.surTache(task.id)}
      enAppui={glisser.appui === task.id}
      glissee={glisser.glisse && glisser.glisse.id === task.id ? glisser.glisse.dy : null}
      depot={marque[task.id] || null}
    />
  );

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
  const marqueSans = depot('', sans);
  return (
    <main className="list" ref={glisser.zone}>
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
          <AddTask
            onAdd={(text) => ajouter(m, text, sections)}
            suggerer={(debut) => suggerer(stats, debut)}
          />
          <div className={`categorie-sans ${marqueSans.section ? 'depot-dans' : ''}`} data-section="">
            <ul className="tasks">{sans.map((task) => ligne(task, marqueSans))}</ul>
          </div>
          {sections.map((section) => {
            const marque = depot(section.cle, section.taches);
            return (
              <section
                key={section.cle}
                className={`categorie ${marque.section ? 'depot-dans' : ''}`}
                data-section={section.cle}
                aria-label={section.nom}
              >
                <div className="categorie-tete">
                  <span className="categorie-nom">#{section.nom}</span>
                  <span className="categorie-compte">{section.taches.length}</span>
                  {section.taches.length === 0 && section.ligne && (
                    <button
                      type="button"
                      className="categorie-retirer"
                      aria-label={t('categories.retirer', { nom: section.nom })}
                      onClick={() => store.retirerCategorie(section.ligne.id)}
                    >
                      ×
                    </button>
                  )}
                </div>
                {section.taches.length === 0 ? (
                  <p className="categorie-vide">{t('categories.vide', { nom: section.nom })}</p>
                ) : (
                  <ul className="tasks">{section.taches.map((task) => ligne(task, marque))}</ul>
                )}
              </section>
            );
          })}
          {tiroir}
          <AjoutCategorie
            onAjouter={(nom) => ajouterCategorie(m, nom, sections)}
            suggerer={(debut) =>
              suggerer(stats, debut, { exclure: sections.map((x) => x.cle) })
            }
          />
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
