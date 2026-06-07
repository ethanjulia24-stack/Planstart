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
      currentPoints.push(line.replace(/^-\s*/, "").trim());
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
      max_tokens: 8000,
      system: "Tu es un consultant senior expert en création d'entreprise en France. Tu as accès à la recherche web : utilise-la pour VÉRIFIER les chiffres clés (montants des aides, seuils légaux, taille et tendances du marché, loyers et concurrents locaux) AVANT de les écrire, puis cite la source réelle. Réponds UNIQUEMENT dans le format texte demandé. JAMAIS de section ---DETAIL---.",
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) throw new Error("Anthropic error");
  const data = await response.json();
  // La réponse peut contenir plusieurs blocs (recherche web + texte).
  // On garde le texte ET on rattache les sources réellement citées (sécurité si le modèle ne les écrit pas lui-même).
  return data.content.map(i => {
    if (i.type !== "text") return "";
    let t = i.text || "";
    if (Array.isArray(i.citations) && i.citations.length) {
      const urls = [...new Set(i.citations.map(c => c && c.url).filter(Boolean))];
      if (urls.length) t += ` (Source : ${urls.join(" ; ")})`;
    }
    return t;
  }).join("\n");
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

  const contexte = `Tu es un consultant expert en création d'entreprise en France.
Voici l'entretien avec l'entrepreneur :
${qaContext}

RÈGLES :
- Réponds en format texte. JAMAIS de ---DETAIL---. Ton bienveillant. Chaque point fait 3 à 5 lignes DENSES et utiles : donne le POURQUOI, le COMMENT et le COMBIEN (chiffres concrets) chaque fois que c'est pertinent. Bannis les phrases creuses valables pour n'importe quel métier ("créer une expérience unique", "fidéliser les clients") : sois spécifique et actionnable.
- PERSONNALISATION MAXIMALE : ce plan parle du projet PRÉCIS de l'entrepreneur, pas du métier en général. Réutilise explicitement SES réponses (son budget exact, sa ville, son quartier, son expérience, ses objectifs, ses horaires). Écris "avec ton budget de X €", "dans ton quartier Y", "avec tes Z clients/jour" — jamais "un commerce type".
- Tutoie TOUJOURS l'entrepreneur (tu, toi, ton, ta, tes). N'emploie JAMAIS "vous" ni "votre".
- RECHERCHE ET SOURCES (ÉTAPE OBLIGATOIRE) : tu as accès à la recherche web. AVANT DE RÉDIGER QUOI QUE CE SOIT, effectue d'abord plusieurs recherches web sur : (1) le montant À JOUR des aides (ACRE, ARCE France Travail), (2) les loyers commerciaux de sa ville, (3) les concurrents réels de son secteur dans sa ville, (4) la réglementation à jour de son secteur. Ne rédige le plan qu'APRÈS ces recherches. Pour TOUT chiffre important, cite la source juste après, EN TEXTE BRUT que tu écris toi-même, au format "(Source : Nom — URL)" — ne te contente pas d'une citation automatique. N'écris JAMAIS un chiffre officiel de mémoire et n'invente JAMAIS de source : si une recherche ne donne rien de fiable, écris "(≈ à vérifier)" sans fausse source.
- ANCRAGE LOCAL : raisonne à l'échelle du LIEU PRÉCIS indiqué (sa ville/quartier). Privilégie le local et le raisonnement bottom-up (à partir de SES chiffres). N'utilise une statistique nationale QUE si elle est sourcée par recherche web ET reliée à une conséquence concrète pour son projet — jamais une stat creuse isolée.
- PROFONDEUR SECTORIELLE : creuse les obligations et spécificités RÉELLES de SON secteur précis (ex : restaurant → licence III/IV, ERP, accessibilité PMR, sécurité incendie, extraction, commission de sécurité, HACCP ; commerce alimentaire → DDPP ; e-commerce → RGPD, droit de rétractation ; métier réglementé → diplôme/qualification obligatoire). Vérifie les obligations à jour par recherche web. Ne reste pas générique.`;

  try {
    // APPEL 1 : Infos de base + sections 1, 2, 3, 4
    const prompt1 = `${contexte}

Génère la PARTIE 1 du business plan dans ce format exact :

NOM: [Nom du business, 2-3 mots]
SLOGAN: [Slogan court]
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
- **Concurrents :** [Concurrents RÉELS identifiés par recherche web dans sa ville/son quartier : noms, positionnement, prix, points faibles. Si la recherche ne donne rien de fiable, dis-le et explique comment les repérer.]
- **Positionnement :** [Comment SE différencier concrètement d'EUX, vu ses atouts à lui]
- **Opportunité :** [Le créneau précis à saisir maintenant, dans SON quartier]

## MODÈLE ÉCONOMIQUE
INTRO: [1 phrase sur la logique économique, ancrée sur SON budget et SA ville]
- **Services et prix :** [Offres avec fourchettes de prix alignées sur les prix RÉELS pratiqués dans sa ville (vérifie par recherche web, cite la source)]
- **Coûts fixes :** [Charges mensuelles détaillées et chiffrées, total estimé, avec le loyer réel de son quartier vérifié par recherche web (Source — URL)]
- **Investissement de départ (3 niveaux) :** [MINIMUM pour démarrer / CONFORTABLE / IDÉAL — un montant chiffré pour chacun, adapté à son budget réel annoncé]
- **Seuil de rentabilité :** [Calcul EXPLICITE : charges ÷ panier moyen = nombre de clients/mois, puis par jour, à partir de SES chiffres réels]
- **3 scénarios chiffrés :** [PESSIMISTE / RÉALISTE / OPTIMISTE en nombre de clients/jour réaliste pour lui — pour chacun : CA mensuel, charges, et reste à vivre]
- **Projections :** [CA estimé mois 3, mois 6, mois 12, avec l'hypothèse de fréquentation derrière chaque chiffre]

## STRATÉGIE MARKETING
INTRO: [1 phrase sur la stratégie globale]
- **Client idéal :** [Profil précis — âge, situation, motivations]
- **Canal principal :** [Tactique concrète avec budget estimé]
- **Canal secondaire :** [Deuxième tactique avec résultats attendus]
- **Réseaux sociaux :** [Quelle plateforme, quel contenu, quelle fréquence]
- **Lancement :** [Actions concrètes pour les 30 premiers jours]`;

    // APPEL 2 : Sections 5, 6, 7
    const prompt2 = `${contexte}

Génère la PARTIE 2 du business plan dans ce format exact :

## PLAN D'ACTION 90 JOURS
INTRO: [1 phrase sur les priorités des 90 premiers jours]
- **Semaine 1-2 :** [Actions administratives et fondations]
- **Semaine 3-4 :** [Préparation concrète au lancement]
- **Mois 1 — Lancement :** [Comment obtenir les premiers clients]
- **Mois 2 :** [Actions de croissance et marketing]
- **Mois 3 :** [Consolidation, bilan et cap sur mois 4]

## DÉMARCHES LÉGALES
INTRO: [1 phrase sur les obligations légales]
- **Statut recommandé :** [Micro-entrepreneur, SASU ou autre avec justification]
- **Immatriculation :** [Site exact, documents, délai et coût]
- **Aides disponibles :** [ACRE, ARE/ARCE France Travail, prêts d'honneur — montants EXACTS et conditions, VÉRIFIÉS par recherche web, avec source (Nom — URL)]
- **Obligations sectorielles :** [TOUTES les obligations RÉELLES propres à ce secteur précis : diplômes/qualifications obligatoires, licences (ex : licence III/IV pour l'alcool), classement ERP, accessibilité PMR, sécurité incendie, extraction/ventilation, commission de sécurité, déclarations spécifiques (DDPP…), normes d'hygiène. Sois précis et exhaustif pour CE métier.]
- **Assurances :** [Assurances obligatoires avec fourchette de prix]

## RISQUES ET SOLUTIONS
INTRO: [1 phrase sur l'importance d'anticiper les obstacles]
- **Risque principal :** [Le risque numéro 1 avec solution concrète]
- **Risque financier :** [Sous-capitalisation et comment l'éviter]
- **Risque marché :** [Risque lié aux clients ou concurrents]
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
      sections: []
    };

    const cleanText1 = text1.replace(/\*\*/g, "");
    const lines1 = cleanText1.split("\n").map(l => l.trim()).filter(l => l);
    let inScoreCriteres = false;

    for (const line of lines1) {
      if (line.startsWith("NOM:")) result.nom = line.replace("NOM:", "").trim();
      else if (line.startsWith("SLOGAN:")) result.slogan = line.replace("SLOGAN:", "").trim();
      else if (line.startsWith("SCORE:") && !line.startsWith("SCORE_")) result.score = parseInt(line.replace("SCORE:", "").trim()) || 70;
      else if (line.startsWith("SCORE_EXPLICATION:")) result.scoreExplication = line.replace("SCORE_EXPLICATION:", "").trim();
      else if (line.startsWith("SCORE_CRITERES:")) inScoreCriteres = true;
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

    if (!result.nom || result.sections.length < 6) {
      console.error("Plan incomplet:", result.sections.length, "sections. Nom:", result.nom);
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
