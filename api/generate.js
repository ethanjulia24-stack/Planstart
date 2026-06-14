// /api/generate.js — 2 appels API pour 7 sections complètes

// Vercel Pro : autorise jusqu'à 300s (la recherche web prend du temps).
export const maxDuration = 300;

const RATE_LIMIT = new Map();

function getRateLimit(ip) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const maxRequests = 3;
  if (!RATE_LIMIT.has(ip)) {
    RATE_LIMIT.set(ip, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  const record = RATE_LIMIT.get(ip);
  if (now > record.resetAt) {
    RATE_LIMIT.set(ip, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  if (record.count >= maxRequests) return { allowed: false };
  record.count++;
  return { allowed: true };
}

function sanitizeInput(str) {
  if (typeof str !== "string") return "";
  return str.slice(0, 500).replace(/<[^>]*>/g, "").trim();
}

function detectPromptInjection(answers) {
  const dangerousPatterns = [/ignore.{0,20}instruction/i, /forget.{0,20}previous/i, /system.{0,20}prompt/i, /act as/i, /jailbreak/i];
  for (const answer of Object.values(answers)) {
    if (typeof answer === "string") {
      for (const pattern of dangerousPatterns) {
        if (pattern.test(answer)) return true;
      }
    }
  }
  return false;
}

function parseSections(text) {
  const sections = [];
  // Nettoyer les # de titre mais garder les ** dans les points
  const lines = text.split("\n").map(l => l.trim()).filter(l => l);
  let currentSection = null;
  let currentPoints = [];
  let skipDetail = false;

  for (const line of lines) {
    if (line.startsWith("---")) { skipDetail = true; continue; }
    if (line.startsWith("#")) { skipDetail = false; }
    if (skipDetail) continue;

    if (line.startsWith("## ") || line.startsWith("# ")) {
      // Ignorer les titres globaux comme "# BUSINESS PLAN - PARTIE 1"
      const titre = line.replace(/^#+\s*/, "").trim();
      if (titre.includes("BUSINESS PLAN") || titre.includes("PARTIE")) continue;
      if (currentSection && currentPoints.length > 0) {
        sections.push({ titre: currentSection.titre, intro: currentSection.intro, points: currentPoints });
      }
      currentSection = { titre: titre, intro: "" };
      currentPoints = [];
    } else if (line.startsWith("INTRO:") && currentSection) {
      currentSection.intro = line.replace("INTRO:", "").trim().replace(/\*\*/g, "");
    } else if ((line.startsWith("- ") || line.startsWith("-**")) && currentSection) {
      const pt = line.replace(/^-\s*/, "").trim();
      // Ignore les puces "label seul" sans contenu (ex : "**Aides disponibles :**" suivi de sous-puces) qui s'afficheraient vides.
      if (!/^\*\*[^*]+\*\*\s*:?\s*$/.test(pt)) currentPoints.push(pt);
    }
  }

  if (currentSection && currentPoints.length > 0) {
    sections.push({ titre: currentSection.titre, intro: currentSection.intro, points: currentPoints });
  }

  return sections;
}

async function callClaude(prompt) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 10000,
      system: "Tu es un consultant senior expert en création d'entreprise en France. Tu as accès à la recherche web : utilise-la pour VÉRIFIER les chiffres clés (montants des aides, seuils légaux, taille et tendances du marché, loyers et concurrents locaux) AVANT de les écrire, puis cite la source réelle. Réponds UNIQUEMENT dans le format texte demandé. JAMAIS de section ---DETAIL---.",
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) throw new Error("Anthropic error");
  const data = await response.json();
  // La réponse peut être découpée en plusieurs blocs de texte autour des recherches web.
  // On les recolle SANS rien insérer pour reconstituer le texte d'origine (sinon les phrases coupées par une recherche sont brisées).
  const blocks = data.content.filter(i => i.type === "text");
  const text = blocks.map(i => i.text || "").join("");
  // Filet de sécurité : si des recherches ont eu lieu mais que le modèle n'a écrit aucune source,
  // on rattache UNIQUEMENT les liens de confiance consultés (jamais les sites douteux).
  const TRUSTED = /(\.gouv\.fr|insee\.fr|urssaf\.fr|service-public|francetravail\.fr|bpifrance|\.cci\.fr|cma\.fr|cnil\.fr|banque-france\.fr|jll\.|cbre\.)/i;
  const urls = [...new Set(
    blocks.flatMap(i => (Array.isArray(i.citations) ? i.citations.map(c => c && c.url) : [])).filter(Boolean)
  )].filter(u => TRUSTED.test(u));
  if (urls.length && !/Source\s*:/i.test(text)) {
    return `${text}\n- **Sources consultées :** ${urls.join(" ; ")}`;
  }
  return text;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "https://planstart.fr");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || "unknown";
  if (!getRateLimit(ip).allowed) {
    return res.status(429).json({ error: "Trop de générations. Réessaie dans 1 heure." });
  }

  const { answers, questions } = req.body;
  if (!answers) return res.status(400).json({ error: "Données invalides" });
  if (detectPromptInjection(answers)) return res.status(400).json({ error: "Contenu non autorisé" });

  const sanitizedAnswers = {};
  for (const [key, value] of Object.entries(answers)) {
    sanitizedAnswers[key] = sanitizeInput(value);
  }

  const qaContext = Object.entries(sanitizedAnswers)
    .map(([i, answer]) => {
      const q = questions?.[parseInt(i)];
      return `Q${parseInt(i) + 1}${q ? ` (${q.question})` : ""} : ${answer}`;
    })
    .join("\n");

  const dateJour = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  const contexte = `Tu es un consultant expert en création d'entreprise en France.
Date du jour : ${dateJour}. Raisonne toujours par rapport à cette date.
Voici l'entretien avec l'entrepreneur :
${qaContext}

RÈGLES :
- Réponds en format texte. JAMAIS de ---DETAIL---. Ton bienveillant mais DIRECT. Chaque point : 2 à 3 phrases MAXIMUM, denses et concrètes (le COMMENT et le COMBIEN priment). Coupe le superflu, les redites et les phrases d'ambiance — un lecteur pressé doit tout saisir en survolant. Vise 80% d'utile concret, 20% d'inspiration, jamais l'inverse. Bannis les phrases creuses valables pour n'importe quel métier ("créer une expérience unique", "fidéliser les clients") : sois spécifique et actionnable.
- PERSONNALISATION MAXIMALE : ce plan parle du projet PRÉCIS de l'entrepreneur, pas du métier en général. Réutilise explicitement SES réponses (son budget exact, sa ville, son quartier, son expérience, ses objectifs, ses horaires). Écris "avec ton budget de X €", "dans ton quartier Y", "avec tes Z clients/jour" — jamais "un commerce type".
- Tutoie TOUJOURS l'entrepreneur (tu, toi, ton, ta, tes). N'emploie JAMAIS "vous" ni "votre".
- RECHERCHE ET SOURCES (ÉTAPE OBLIGATOIRE) : tu as accès à la recherche web. AVANT DE RÉDIGER QUOI QUE CE SOIT, effectue d'abord plusieurs recherches web sur : (1) le montant À JOUR des aides (ACRE, ARCE France Travail), (2) selon le type d'activité : les loyers commerciaux de sa ville SI c'est un commerce physique, sinon les coûts pertinents de son modèle (outils, hébergement, pub…), (3) les VRAIS concurrents — pour un commerce physique : dans sa ville ; pour un outil en ligne/SaaS/produit digital : par CATÉGORIE DE PRODUIT exacte au niveau national (ex : recherche "générateur business plan IA français" et PAS "outils IA"), et vérifie que chacun fait bien la même chose avant de le retenir, (4) la réglementation à jour de son secteur. Ne rédige le plan qu'APRÈS ces recherches. Pour TOUT chiffre important, cite la source juste après, EN TEXTE BRUT que tu écris toi-même, au format "(Source : Nom — URL)" — ne te contente pas d'une citation automatique. N'écris JAMAIS un chiffre officiel de mémoire et n'invente JAMAIS de source : si une recherche ne donne rien de fiable, écris "(≈ à vérifier)" sans fausse source.
- ANCRAGE LOCAL : raisonne à l'échelle du LIEU PRÉCIS indiqué (sa ville/quartier). Privilégie le local et le raisonnement bottom-up (à partir de SES chiffres). N'utilise une statistique nationale QUE si elle est sourcée par recherche web ET reliée à une conséquence concrète pour son projet — jamais une stat creuse isolée.
- PROFONDEUR SECTORIELLE : creuse les obligations et spécificités RÉELLES de SON secteur précis (ex : restaurant → licence III/IV, ERP, accessibilité PMR, sécurité incendie, extraction, commission de sécurité, HACCP ; commerce alimentaire → DDPP ; e-commerce → RGPD, droit de rétractation ; métier réglementé → diplôme/qualification obligatoire). Vérifie les obligations à jour par recherche web. Ne reste pas générique.
- QUALITÉ DES SOURCES (RÈGLE STRICTE ET PRIORITAIRE) : tu ne cites une source QUE si elle vient d'une institution ou d'un organisme reconnu — sites en .gouv.fr, INSEE, URSSAF, service-public, France Travail, Bpifrance, CCI/CMA, CNIL, Banque de France, ministères, fédérations professionnelles officielles, ou un grand cabinet immobilier reconnu pour un loyer (ex : JLL, CBRE). INTERDIT formellement comme source : blogs SEO, sites marchands ou de vendeurs, revendeurs de rapports payants, comparateurs, agrégateurs, sites d'actualité ou de sorties — exemples à NE JAMAIS citer : tool-advisor.fr, loyer-commerce.com, modelesdebusinessplan.com, optigestplus.org, hostinger, dpo-partage.fr, legalstart, pantheonconseil.com, legalplace.fr, revue-juridique.fr, mana-sys.fr. INTERDIT ÉGALEMENT : utiliser un concurrent commercial ou un outil SaaS (ex : Propulse by CA, Plania, Visme, Venngage) comme source de données de marché ou de tendances — ce sont des sources intéressées, pas officielles. Si le seul résultat disponible vient d'un tel site, NE METS AUCUN lien : écris "(≈ à vérifier)". Mieux vaut zéro source qu'une source douteuse.
- PRUDENCE SUR LES AFFIRMATIONS : n'avance JAMAIS de statistique choc non sourçable (ex : "80% des boutiques ferment en 18 mois"). Formule prudemment et qualitativement ("beaucoup d'e-commerces échouent dans leurs premières années"). Aucun chiffre précis sans source officielle réelle.
- PLAFOND MICRO-ENTREPRENEUR : le plafond annuel de CA pour les prestations de services (BIC ou BNC) est de 77 700 € en 2026 — utilise TOUJOURS ce chiffre, jamais 83 600€ (qui correspond aux activités commerciales/hébergement).
- TAUX/SEUILS À JOUR (TRÈS IMPORTANT) : pour toute aide, taux ou seuil susceptible de changer (ACRE, ARCE, plafonds, cotisations…), donne la valeur EN VIGUEUR à la date du jour indiquée plus haut. Ne présente JAMAIS un taux futur comme s'il était le taux actuel. EXEMPLE OBLIGATOIRE À RESPECTER : l'exonération ACRE des micro-entrepreneurs est de **50%** jusqu'au 30 juin 2026 inclus (donc AUJOURD'HUI si la date du jour est avant le 1er juillet 2026), et seulement 25% pour les créations à compter du 1er juillet 2026. Si la date du jour est avant le 1er juillet 2026, tu DOIS écrire "50%" (pas 25%). Vérifie toujours par recherche web avant d'écrire un taux.
- OBLIGATOIRE vs RECOMMANDÉ : distingue rigoureusement ce qui est légalement OBLIGATOIRE de ce qui est seulement RECOMMANDÉ. N'écris "obligatoire" que si ça l'est vraiment. Ex : les premiers secours (PSC1/SST) et la RC Pro pour une activité non réglementée sont RECOMMANDÉS, pas obligatoires. En cas de doute, écris "recommandé" ou "à vérifier".
- AUCUNE RÉFÉRENCE INVENTÉE : n'invente JAMAIS une date d'entrée en vigueur, un numéro de loi/décret/ordonnance, ni un "depuis 2026". Si tu n'as pas vérifié une date ou une référence juridique par recherche web, ne la cite pas.
- CONCURRENTS DANS TOUTES LES SECTIONS : MyMap.AI, Venngage, Visme, Canva, Miro ne sont JAMAIS des concurrents d'un générateur de business plan. Ne les cite DANS AUCUNE section (Portrait, Risques, ou autre). Ils font des cartes mentales ou du design, pas des BP.
- COHÉRENCE INTERNE : une même donnée (surface du local, budget, panier moyen, nombre de clients…) doit garder la MÊME valeur dans tout le plan. Ne change pas la surface ou le budget d'une section à l'autre.
- MODÈLE DE REVENUS : ne propose JAMAIS un modèle payant (freemium, abonnement, prix par unité) si l'entrepreneur n'a pas explicitement mentionné vouloir vendre quelque chose. Si l'outil ou le service est décrit comme gratuit, traite-le comme gratuit et construis un modèle économique cohérent (monétisation indirecte, affiliation, etc.) sans inventer de tarification.
- FORMAT DES POINTS : respecte EXACTEMENT la liste de points demandée pour chaque section. Mets TOUT le contenu d'un point sur la MÊME ligne que son label (juste après les "**"). Ne crée JAMAIS de sous-puces, ni de label vide : chaque "- **Label :**" doit être immédiatement suivi de son contenu. Si un point a beaucoup d'infos (ex : plusieurs aides), enchaîne-les dans la même ligne en les séparant par des points-virgules, pas en puces enfants.
- "À VÉRIFIER" — UNE SEULE FOIS : n'écris JAMAIS "(≈ à vérifier)" à répétition dans le corps du texte (ça décrédibilise). Quand un chiffre n'est pas sourçable de façon fiable, donne-le simplement comme une estimation prudente SANS la mention entre parenthèses. Le document affiche déjà une note de bas de page indiquant que les montants sont des estimations à confirmer — tu n'as donc pas besoin de le répéter ligne par ligne. Au maximum UNE mention "(estimation à confirmer)" par section, et seulement si c'est vraiment critique.
- LIENS PROPRES (RÈGLE STRICTE) : quand tu écris une URL, ne colle JAMAIS de ponctuation (virgule, point, point-virgule, parenthèse) directement à la fin de l'URL — ça casse le lien. Termine toujours l'URL par un espace ou un retour avant toute ponctuation. Vérifie que chaque lien est cliquable et complet (commence par https://).
- SOURCES EN FRANÇAIS : pour toute donnée française (population, démographie, statistiques locales), cite TOUJOURS la version française de la source (fr.wikipedia.org, et non en.wikipedia.org ; INSEE plutôt que des sources étrangères). Ne pointe JAMAIS vers une page Wikipedia en anglais pour une donnée sur une ville française.
- QUALIFICATION/DIPLÔME — NUANCE OBLIGATOIRE : pour les métiers où un diplôme existe (coiffure, barbier, esthétique, métiers de bouche, bâtiment…), n'écris JAMAIS qu'un diplôme (ex : CAP) est "obligatoire" de façon absolue SANS mentionner les équivalences. En France, ces activités exigent une QUALIFICATION PROFESSIONNELLE qui peut s'obtenir SOIT par le diplôme (CAP/BEP), SOIT par une expérience professionnelle validée (généralement 3 ans comme dirigeant ou salarié qualifié). Formule toujours : "tu dois justifier d'une qualification professionnelle : CAP/BEP du métier OU une expérience d'au moins 3 ans dans le domaine". Vérifie la règle exacte du métier par recherche web avant d'écrire.`;

  try {
    // APPEL 1 : Sections 1-5 (portrait, marché, modèle éco, marketing, plan d'action)
    const prompt1 = `${contexte}

Génère la PARTIE 1 du business plan dans ce format exact :

IMPORTANT : commence ta réponse DIRECTEMENT par la ligne "NOM:" ci-dessous. Aucun préambule, aucune phrase d'introduction (pas de "Voici le plan", "D'après mes recherches", etc.), même après tes recherches web.

NOM: [Nom du business, 2-3 mots]
SLOGAN: [Slogan court]
TITRE: [3 à 6 mots décrivant simplement ce projet — court, propre, sans fautes, sans jargon. Pas un nom de marque inventé, pas la réponse brute. INTERDIT : ne mets jamais le mot "IA" ni "Intelligence Artificielle" dans le titre. Exemples : "Générateur de business plan", "Salon de coiffure à Lyon", "Restaurant de cuisine locale". Doit être lisible comme titre de couverture.]
SCORE: [nombre /100 = moyenne des 6 critères ci-dessous ramenée sur 100, arrondie. Ne mets PAS un score arbitraire : il doit correspondre à la moyenne réelle des 6 notes.]
SCORE_EXPLICATION: [1 phrase HONNÊTE mais CONSTRUCTIVE : ce qui est solide + le principal levier pour progresser, jamais un simple couperet décourageant]
SCORE_CRITERES:
- Experience: [note /10] — [1 phrase]
- Marche: [note /10] — [1 phrase]
- Differenciation: [note /10] — [1 phrase]
- Budget: [note /10] — [1 phrase]
- Clarte: [note /10] — [1 phrase]
- Timing: [note /10] — [1 phrase]

RÈGLE DE NOTATION : note chaque critère justement et sans complaisance, MAIS sans pénaliser abusivement un débutant — manquer d'expérience ou de gros budget au démarrage est NORMAL et ne doit pas faire chuter tout le score. Un projet sincère et réaliste mérite une note correcte. Garde l'évaluation honnête, mais encourageante et tournée vers le progrès.

## PORTRAIT DU PROJET
INTRO: [1 phrase d'accroche]
- **Profil :** [Description du porteur de projet et ses atouts]
- **Projet :** [Ce qu'il veut créer concrètement]
- **Différence :** [Ce qui le distingue de la concurrence]
- **Défi principal :** [Le vrai obstacle à surmonter]
- **Verdict :** [Évaluation honnête et encourageante]

## ANALYSE DU MARCHÉ
INTRO: [1 phrase sur l'opportunité, ancrée sur sa ville]
- **Marché :** [Taille du marché pertinente et SOURCÉE par recherche web (Source : Nom — URL), reliée à une conséquence concrète pour lui. Privilégie une donnée locale/régionale si possible.]
- **Tendances :** [2-3 tendances favorables vérifiées par recherche web, avec source]
- **Concurrents :** [Identifie les concurrents RÉELS par recherche web. RÈGLE CRITIQUE : pour un business LOCAL, cherche dans sa ville/son quartier. Pour un OUTIL EN LIGNE / SaaS, cherche par CATÉGORIE DE PRODUIT exacte (ex : "générateur business plan IA français"). Vérifie que chaque concurrent fait VRAIMENT la même chose — interdiction formelle de citer : outils de design (Venngage, Visme, Canva), outils de mind-mapping (MyMap.AI, Miro), outils de présentation, outils généralistes de création de contenu. Ces outils ne génèrent PAS de business plans. Pour chaque concurrent retenu : nom, URL, positionnement, prix, point faible.]
- **Positionnement :** [Comment SE différencier concrètement d'EUX, vu ses atouts à lui]
- **Opportunité :** [Le créneau précis à saisir maintenant, dans SON quartier]

## MODÈLE ÉCONOMIQUE
INTRO: [1 phrase sur la logique économique, ancrée sur SON budget et SA ville]
- **Services et prix :** [Offres avec fourchettes de prix alignées sur les prix RÉELS pratiqués dans sa ville (vérifie par recherche web, cite la source)]
- **Coûts fixes :** [Charges mensuelles détaillées et chiffrées, total estimé, avec le loyer réel de son quartier vérifié par recherche web (Source — URL). Pour un SaaS : si l'outil utilise une API IA, mentionne "API IA (OpenAI, Anthropic ou équivalent)" sans imposer un fournisseur spécifique si l'entrepreneur n'en a pas mentionné un.]
- **Investissement de départ (3 niveaux) :** [MINIMUM pour démarrer / CONFORTABLE / IDÉAL — un montant chiffré pour chacun, adapté à son budget réel annoncé]
- **Seuil de rentabilité :** [Calcul EXPLICITE et logiquement cohérent : charges ÷ panier moyen = nombre de TICKETS/mois, puis ÷ jours d'ouverture = tickets/jour. Garde UNE seule unité claire (le ticket) et ne la mélange pas avec le "nombre de personnes". Pars de SES chiffres réels.]
- **3 scénarios chiffrés :** [PESSIMISTE / RÉALISTE / OPTIMISTE en nombre de clients/jour réaliste pour lui — pour chacun : CA mensuel, charges, et reste à vivre]
- **Projections :** [CA estimé mois 3, mois 6, mois 12, avec l'hypothèse de fréquentation derrière chaque chiffre]

## STRATÉGIE MARKETING
INTRO: [1 phrase sur la stratégie globale]
- **Client idéal :** [Profil précis — âge, situation, motivations, comment il découvre des solutions à son problème]
- **Canal principal :** [Le canal d'acquisition PRIORITAIRE basé sur ce que l'entrepreneur a répondu sur comment ses clients le trouvent. S'il a mentionné TikTok/Instagram/réseaux sociaux : construis la stratégie autour de ça en premier (contenu court, Reels, types de vidéos, fréquence). S'il a mentionné Google/bouche-à-oreille/autre : pars de là. Ne mets JAMAIS SEO par défaut si l'utilisateur a dit autre chose.]
- **Canal secondaire :** [Deuxième canal complémentaire avec tactique concrète]
- **Réseaux sociaux :** [Quelle plateforme en priorité, quel format de contenu, quelle fréquence, exemples de sujets de posts]
- **Lancement :** [Actions concrètes pour les 30 premiers jours, cohérentes avec le canal principal]

## PLAN D'ACTION 90 JOURS
INTRO: [1 phrase sur les priorités des 90 premiers jours]
- **Semaine 1-2 :** [Actions administratives et fondations]
- **Semaine 3-4 :** [Préparation concrète au lancement, incluant la mise en place du canal d'acquisition principal mentionné par l'entrepreneur dans ses réponses]
- **Mois 1 — Lancement :** [Comment obtenir les premiers clients via le canal principal déclaré — si TikTok/Instagram : premières vidéos, fréquence, sujets ; si autre canal : adapte]
- **Mois 2 :** [Actions de croissance sur le canal principal + développement d'un canal secondaire]
- **Mois 3 :** [Consolidation, mesure des résultats, et cap sur mois 4]`;

    // APPEL 2 : Sections 6, 7 (légal + risques — nécessitent la recherche web)
    const prompt2 = `${contexte}

Génère la PARTIE 2 du business plan dans ce format exact :

IMPORTANT : commence ta réponse DIRECTEMENT par la ligne "## DÉMARCHES LÉGALES" ci-dessous. Aucun préambule, aucune phrase d'introduction, même après tes recherches web.

## DÉMARCHES LÉGALES
INTRO: [1 phrase sur les obligations légales]
- **Statut recommandé :** [Micro-entrepreneur, SASU ou autre avec justification]
- **Immatriculation :** [Site exact, documents, délai et coût]
- **Aides disponibles :** [ACRE, ARE/ARCE France Travail, prêts d'honneur — montants EXACTS et conditions, VÉRIFIÉS par recherche web, avec source (Nom — URL)]
- **Obligations sectorielles :** [TOUTES les obligations RÉELLES propres à ce secteur précis : diplômes/qualifications obligatoires, licences (ex : licence III/IV pour l'alcool), classement ERP, accessibilité PMR, sécurité incendie, extraction/ventilation, commission de sécurité, déclarations spécifiques (DDPP…), normes d'hygiène. Pour un outil SaaS/numérique : RGPD détaillé (politique de confidentialité, registre des traitements, droits utilisateurs, notification CNIL sous 72h) — SOURCE RGPD : utilise EXCLUSIVEMENT cnil.fr ou francenum.gouv.fr, jamais un site de conseil DPO commercial. Sois précis et exhaustif pour CE métier.]
- **Assurances :** [Assurances obligatoires avec fourchette de prix]

## RISQUES ET SOLUTIONS
INTRO: [1 phrase sur l'importance d'anticiper les obstacles]
- **Risque principal :** [Le risque numéro 1 avec solution concrète]
- **Risque financier :** [Sous-capitalisation et comment l'éviter]
- **Risque marché :** [Risque lié aux clients ou concurrents. INTERDICTION ABSOLUE de citer MyMap.AI, Venngage, Visme, Canva ou Miro comme concurrents — ce sont des outils de design/mind-mapping, pas des générateurs de business plan. Ne cite QUE des outils qui génèrent vraiment des business plans complets.]
- **Trésorerie de sécurité :** [Montant à prévoir et comment le constituer]
- **Conseil final :** [Le conseil le plus important pour réussir]`;

    // Lancer les 2 appels en parallèle
    const [text1, text2] = await Promise.all([
      callClaude(prompt1),
      callClaude(prompt2)
    ]);

    // Parser la partie 1 pour les infos de base
    const result = {
      nom: "",
      slogan: "",
      score: 70,
      scoreExplication: "",
      scoreCriteres: [],
      sections: [],
      activite: Object.values(sanitizedAnswers)[0]?.slice(0, 90) || "",
      titre: ""
    };

    const cleanText1 = text1.replace(/\*\*/g, "");
    const lines1 = cleanText1.split("\n").map(l => l.trim()).filter(l => l);
    let inScoreCriteres = false;

    for (const line of lines1) {
      let m;
      if ((m = line.match(/^NOM\s*:\s*(.+)/i))) result.nom = m[1].trim();
      else if ((m = line.match(/^TITRE\s*:\s*(.+)/i))) result.titre = m[1].trim();
      else if ((m = line.match(/^SLOGAN\s*:\s*(.+)/i))) result.slogan = m[1].trim();
      else if (!/^SCORE_/i.test(line) && (m = line.match(/^SCORE\s*:\s*(\d+)/i))) result.score = parseInt(m[1]) || 70;
      else if ((m = line.match(/^SCORE_EXPLICATION\s*:\s*(.+)/i))) result.scoreExplication = m[1].trim();
      else if (/^SCORE_CRITERES\s*:/i.test(line)) inScoreCriteres = true;
      else if (inScoreCriteres && line.startsWith("-")) result.scoreCriteres.push(line.replace(/^-\s*/, "").trim());
      else if (line.startsWith("##")) inScoreCriteres = false;
    }

    // Score TRANSPARENT : on recalcule la moyenne réelle des 6 critères /10
    // (au lieu de faire confiance au nombre donné par le modèle).
    const notes = result.scoreCriteres
      .map(c => { const m = c.match(/(\d+(?:[.,]\d+)?)\s*\/\s*10/); return m ? parseFloat(m[1].replace(",", ".")) : null; })
      .filter(n => n !== null && n >= 0 && n <= 10);
    if (notes.length >= 4) {
      const moyenne = notes.reduce((a, b) => a + b, 0) / notes.length;
      result.score = Math.round(moyenne * 10);
    }

    // Parser les sections des 2 parties
    const sections1 = parseSections(text1);
    const sections2 = parseSections(text2);
    result.sections = [...sections1, ...sections2];

    // Filet : un nom manquant ne doit pas jeter un plan complet. On ne bloque que si les sections manquent.
    if (!result.nom) {
      const premiere = Object.values(sanitizedAnswers)[0] || "";
      result.nom = premiere ? premiere.slice(0, 40) : "Mon Business Plan";
    }
    if (result.sections.length < 6) {
      console.error("Plan incomplet:", result.sections.length, "sections.");
      return res.status(500).json({ error: "Plan incomplet — réessaie" });
    }

    // Ressources officielles VÉRIFIÉES (liens réels, jamais inventés, ajoutés côté serveur)
    result.sections.push({
      titre: "RESSOURCES UTILES",
      intro: "Les liens officiels pour passer à l'action.",
      points: [
        "**Immatriculer ton entreprise :** le guichet unique officiel pour toutes les formalités de création. https://formalites.entreprises.gouv.fr",
        "**Statut auto-entrepreneur :** créer ton compte, déclarer ton chiffre d'affaires et tes cotisations. https://www.autoentrepreneur.urssaf.fr",
        "**Aide ACRE (exonération de charges) :** conditions et démarche pour les créateurs. https://www.urssaf.fr/accueil/exoneration-acre-createur.html",
        "**Aides et accompagnement gratuits :** la boîte à outils Bpifrance Création pour construire ton projet. https://bpifrance-creation.fr",
        "**Tes droits et démarches :** les fiches officielles sur la création d'entreprise. https://entreprendre.service-public.gouv.fr",
        "**Aide France Travail (ARE / ARCE) :** si tu es demandeur d'emploi, les aides au lancement. https://www.francetravail.fr",
      ],
    });

    return res.status(200).json(result);

  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({ error: "Erreur serveur — réessaie" });
  }
}
