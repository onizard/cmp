// Français — dictionnaire de référence. Toute clé absente d'une autre langue
// retombe ici, pour qu'un trou de traduction ne montre jamais une clé nue.
export default {
  app: { tagline: 'plus léger·e·s ensemble', horsLigne: 'hors ligne', synchro: 'synchronisation…', enAttente: '{n} en attente',
    titre: 'charge mentale partagée',
    accroche: 'La liste des choses à porter, à deux.',
    instant: 'Un instant…',
    chargement: 'Chargement…',
    annuler: 'Annuler',
    enregistrer: 'Enregistrer',
    enregistre: 'Enregistré ✓',
    revenir: 'Revenir',
    nonConfigure:
      "L'application n'est pas encore reliée à sa base de données.",
  },

  tabs: {
    taches: 'Tâches',
    cerveau: 'Cerveau',
    compte: 'Mon compte',
    bord: 'Bord',
  },

  auth: {
    connexion: 'Se connecter.',
    connexionAide: 'Ton e-mail et ton mot de passe.',
    creation: 'Créer ton compte.',
    creationAide: 'Deux champs, et tu entres. Aucun mail à aller chercher.',
    oubli: 'Mot de passe oublié.',
    oubliAide: 'On t’envoie un lien pour rentrer et en choisir un nouveau.',
    email: 'Ton adresse e-mail',
    emailPlaceholder: 'prenom@exemple.fr',
    motDePasse: 'Ton mot de passe',
    motDePassePlaceholder: '8 caractères au minimum',
    seConnecter: 'Se connecter',
    creerMonCompte: 'Créer mon compte',
    recevoirLien: 'Recevoir le lien',
    lienEnvoye: 'Regarde tes mails.',
    lienEnvoyeAide:
      'On t’a envoyé un lien à {email}. Ouvre-le pour entrer, puis choisis un nouveau mot de passe dans « Mon compte ».',
    oublieLien: 'Mot de passe oublié ?',
    creerLien: 'Créer un compte',
    retourConnexion: 'Revenir à la connexion',
    identifiantsFaux: 'E-mail ou mot de passe incorrect.',
    dejaInscrit: 'Un compte existe déjà avec cet e-mail. Connecte-toi.',
    motDePasseCourt: 'Le mot de passe doit faire au moins 8 caractères.',
    confirmationRequise:
      'Compte créé. Vérifie tes mails pour confirmer, puis connecte-toi.',
    deconnexion: 'Se déconnecter',
  },

  foyer: { perduTitre: 'Connexion perdue.', perduTexte: 'On n’a pas pu vérifier ton foyer. Ne crée surtout pas de nouveau foyer : le tien est intact, il suffit de réessayer.', reessayer: 'Réessayer',
    rejoindre: 'Rejoindre le foyer.',
    rejoindreAide:
      'Si l’autre personne t’a envoyé un code d’invitation, colle-le ici.',
    inviteReconnue: 'Ton invitation est reconnue. Il ne reste qu’à confirmer.',
    code: 'Code d’invitation',
    codePlaceholder: 'colle le code ici',
    bouton: 'Rejoindre',
    premiereFois: 'Tu installes la maison pour la première fois ?',
    creer: 'Créer un nouveau foyer',
    codeInvalide: 'Ce code d’invitation n’est pas valide.',
    codeInconnu: 'Aucun foyer ne correspond à ce code.',
    codeSansFoyer: 'Ce code d’invitation ne mène à aucun foyer.',
    quitter: 'Quitter le foyer',
    quitterSur: 'Quitter vraiment le foyer ?',
    quitterOui: 'oui, quitter',
  },

  taches: { decocheInterdite: 'Seule la personne qui l’a cochée peut la décocher.',
    ajouter: 'ajoute une tâche',
    boutonAjouter: 'Ajouter',
    cocher: 'Cocher',
    decocher: 'Décocher',
    modifier: 'Modifier',
    supprimer: 'Supprimer',
    actions: 'Actions',
    depuis: 'depuis {mois}',
    aFaire: '{n} à faire',
    termine: 'terminé',
    rien: 'rien',
    accroche: {
      un: '1 chose en tête ce mois-ci.',
      autre: '{n} choses en tête ce mois-ci.',
    },
    accrocheVide: 'Rien en tête ce mois-ci.',
  },

  echeance: {
    titre: 'Échéance',
    ajouter: 'Ajouter une échéance',
    jour: 'Jour',
    heure: 'Heure (facultative)',
    aide:
      'Sans heure, l’échéance tombe en fin de journée. Les rappels se resserrent à mesure qu’elle approche.',
    retirer: 'Retirer',
    recap: 'Échéance : {quand}',
    fait: 'fait',
    maintenant: 'maintenant',
    alInstant: 'à l’instant',
    dansMin: 'dans {n} min',
    dansH: 'dans {n} h',
    dansJ: 'dans {n} j',
    retardMin: 'en retard de {n} min',
    retardH: 'en retard de {n} h',
    retardJ: 'en retard de {n} j',
    a: '{jour} à {heure}',
  },

  cerveau: {
    lede: 'Ce que chacun·e a porté. 💛',
    toi: 'Toi',
    binome: 'Ton binôme',
    pts: 'pts',
    detail: '{ajoutees} ajoutée(s) · {faites} faite(s) · {autres} pour l’autre',
    bareme: 'barème',
    baremeAjouter: 'Ajouter une tâche',
    baremeSienne: 'Cocher sa propre tâche',
    baremeAutre: 'Cocher la tâche de l’autre',
    baremeNote:
      'Les points se cumulent sans limite. Dépense-les quand tu veux, ou épargne pour une récompense plus forte.',
    pt: 'pt',
    prochaine: 'Prochaine récompense : {nom}',
    manque: 'Encore {n} pts pour te l’offrir.',
    rempliA: 'Rempli à {n} %',
  },

  recompenses: {
    titre: 'Les récompenses',
    vide: 'Le catalogue est vide pour l’instant.',
    prendre: 'Prendre',
    dejaOffert: 'Déjà offert',
    annuler: 'Annuler',
    surMesure: 'Récompense sur mesure',
    surMesureBadge: 'sur mesure',
    surMesureAttente:
      'À {n} points, tu demandes ce que tu veux, obtenu sur-le-champ.',
    surMesureEncore: 'Encore {n} points.',
    surMesurePrete:
      'Tu as tes {n} points. Demande ce que tu veux, sans passer par le catalogue.',
    surMesureBouton: 'Demander ma récompense',
    surMesureInvite: 'Dis ce que tu veux. Tu l’obtiens tout de suite.',
    surMesureChamp: 'Ta demande',
    surMesurePlaceholder: 'Un week-end à deux…',
    surMesureObtenir: 'Obtenir ({n} pts)',
    surMesureVide: 'Dis ce que tu demandes.',
  },

  inventaire: {
    titre: 'Mes bons',
    vide: 'Aucun bon pour l’instant. Prends une récompense et elle arrivera ici.',
    utiliser: 'Utiliser',
    rendre: 'Rendre',
    poinconne: 'UTILISÉ',
    obtenuLe: 'obtenu le {quand}',
    utiliseLe: 'utilisé le {quand}',
  },

  suppression: {
    titre: 'Supprimer mon compte',
    bouton: 'Supprimer définitivement mon compte',
    avertissement: 'Ton compte, tes points, tes bons et tes réglages disparaissent. Si tu es seul·e dans ton foyer, ses tâches partent avec. Si vous êtes deux, elles restent à l’autre. C’est immédiat et sans retour.',
    oui: 'Oui, tout supprimer',
    non: 'Je me suis trompé·e',
    erreur: 'La suppression n’a pas abouti.',
  },

  compte: {
    titre: 'Mon compte',
    profil: 'Profil',
    prenom: 'Prénom',
    prenomPlaceholder: 'Ton prénom',
    email: 'Email',
    prenomErreur: 'Le prénom n’a pas pu être enregistré.',
    motDePasse: 'Mot de passe',
    motDePasseAide:
      'Pose-toi un mot de passe : tu te reconnecteras sans passer par ta boîte mail, même après une réinstallation.',
    nouveauMotDePasse: 'Nouveau mot de passe',
    enregistrerMotDePasse: 'Enregistrer le mot de passe',
    motDePasseErreur: 'Le mot de passe n’a pas pu être enregistré.',
    langue: 'Langue',
    contact:
      'Une idée, une question, quelque chose qui cloche ? {lien}.',
    contactLien: 'Écris-nous',
  },

  notifications: { binome: 'Rappel « invite ta moitié »', binomeAide: 'Tu es seul·e dans ce foyer. On te le rappelle une fois par semaine, quatre fois au plus. Coupe-le si tu préfères l’utiliser seul·e.',
    titre: 'Notifications',
    quandLautreAgit: 'Quand l’autre agit',
    quandLautreAide:
      'Une notification quand ta moitié ajoute ou coche une chose.',
    rappel: 'Rappel matin et soir',
    rappelAide:
      'Vers 8 h et 20 h, la tâche qui attend depuis le plus longtemps.',
    nonGere:
      'Ce navigateur ne gère pas les notifications. Installe l’application sur l’écran d’accueil pour en profiter.',
    refusees:
      'Notifications refusées. Autorise-les dans les réglages du téléphone.',
    sansCle: 'Cette version de l’application n’a pas la clé de notification.',
    pasPrete: 'L’application n’est pas encore prête, réessaie dans un instant.',
  },

  partage: {
    titre: 'Partager',
    inviter: 'Inviter ma moitié',
    partagerAppli: 'Partager l’application',
    copie: 'Lien copié ✓',
    qrAfficher: 'Afficher le QR d’invitation',
    qrMasquer: 'Masquer le QR d’invitation',
    qrAlt: 'QR code d’invitation',
    codeFoyer: 'Code du foyer : {code}',
    messageInvitation:
      '{prenom} t’invite à partager la charge mentale. Rejoins notre foyer :',
    messageInvitationNeutre:
      'Rejoins notre foyer sur « charge mentale partagée » :',
    messageDecouverte:
      'Charge mentale partagée — la liste des choses à porter, à deux.',
  },

  donnees: {
    titre: 'Tes données',
    foyerSeul:
      'Personne d’autre que ton foyer ne voit tes tâches. La base de données le refuse, ce n’est pas qu’une question d’affichage.',
    rienVendu:
      'Rien n’est vendu, rien n’est transmis. Aucune publicité, aucun traçage, aucun outil de mesure extérieur.',
    heberge:
      'Tout est hébergé sur un serveur privé, en France, pas chez un géant du nuage.',
    chiffre:
      'Le texte des notifications est chiffré avant de partir : ni Google ni Apple ne peuvent le lire au passage.',
    effacer:
      'Tu veux que tout disparaisse ? Écris-nous, ton compte et tes données sont effacés.',
  },

  installation: {
    titre: 'Garde-la sous la main',
    texte:
      'Installe l’application sur ton écran d’accueil : elle s’ouvre en plein écran et peut t’envoyer des notifications.',
    bouton: 'Installer l’application',
    iosTitre: 'Sur iPhone, en deux gestes',
    iosPartager: 'Touche Partager en bas de l’écran (le carré avec la flèche vers le haut).',
    iosEcran: 'Fais défiler, puis choisis Sur l’écran d’accueil.',
    iosAjouter: 'Touche Ajouter en haut à droite.',
    iosAutre:
      'Ce navigateur ne sait pas toujours le faire. Le plus sûr : rouvre cette page dans Safari.',
    iosRien:
      'Il n’y a rien à télécharger : l’icône se pose directement sur l’écran d’accueil.',
    bloqueTitre: 'Ouvre d’abord cette page dans Safari',
    bloqueTexte:
      'Tu es dans le navigateur intégré{hote}, qui ne sait pas installer d’application.',
    bloqueA: ' à {hote}',
    bloqueSansNom: ' de ton application',
    bloque1: 'Touche ••• (ou l’icône de partage) en bas à droite de l’écran.',
    bloque2: 'Choisis Ouvrir dans Safari.',
    bloque3: 'La marche à suivre s’affichera alors ici même.',
  },

  maj: {
    prete: 'Une nouvelle version est prête.',
    bouton: 'Mettre à jour',
  },

  admin: { foyersDetail: 'Les foyers', membresN: '{n} membre(s)', tachesN: '{n} tâche(s)', restantesN: '{n} en attente', sansPrenom: 'sans prénom', vuLe: 'vu le {quand}', jamaisVenu: 'jamais revenu',
    titre: 'Tableau de bord',
    rien: 'Rien à afficher.',
    actualiser: 'Actualiser',
    actualisation: 'Actualisation…',
    gens: 'Les gens',
    comptes: 'comptes',
    cetteSemaine: '+{n} cette semaine',
    actifs7: 'actifs 7 j',
    sur30: '{n} sur 30 j',
    foyers: 'foyers',
    aDeux: '{n} à deux',
    notifs: 'notifications',
    appareils: 'appareils abonnés',
    usage: 'L’usage',
    activation: 'Comptes qui ont créé une tâche',
    activationAide:
      'Le vrai taux d’activation : combien vont au-delà de l’inscription.',
    retour: 'Comptes revenus dans les 7 jours',
    retourAide: 'Ce chiffre-là dit si l’application tient dans la durée.',
    foyersADeux: 'Foyers à deux',
    foyersADeuxAide: 'Seul, l’intérêt de l’application s’effondre.',
    foyersActifs: 'Foyers actifs sur 30 jours',
    quoi: 'Ce qu’ils en font',
    taches: 'tâches',
    cochees: 'cochées 7 j',
    echeances: 'échéances',
    recompenses: 'récompenses prises',
    courbe: 'Inscriptions · 30 derniers jours',
    courbeTete: '{n} comptes créés · pointe à {max} par jour',
    ilYa30: 'il y a 30 j',
    aujourdhui: 'aujourd’hui',
    agrege:
      'Chiffres agrégés. Aucune tâche, aucun contenu de foyer n’est lisible ici.',
  },
};
