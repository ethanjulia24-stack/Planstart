// /api/generate.js — 2 appels API pour 7 sections complètes

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
      currentSection.intro = line.replace("INTRO:", "").trim();
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
      max_tokens: 4000,
      system: "Tu es un expert en création d'entreprise. Réponds UNIQUEMENT dans le format texte demandé. JAMAIS de section ---DETAIL---. Chaque point : 2-3 lignes max.",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) throw new Error("Anthropic error");
  const data = await response.json();
  return data.content.map(i => i.text || "").join("");
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
- Réponds en format texte.
- JAMAIS de ---DETAIL---.
- 2 à 3 lignes maximum par point.
- Tous les montants doivent être exprimés sous forme de fourchettes.
- Si un chiffre n'est pas certain, préciser "(estimation indicative)".
- Ne jamais donner de prix unique.
- Ne jamais présenter une estimation comme une certitude.
- Les données marché doivent être présentées comme des ordres de grandeur.
- Privilégier la prudence plutôt que la précision.
- Ton professionnel et bienveillant.`;

  try {
    // APPEL 1 : Infos de base + sections 1, 2, 3, 4
    const prompt1 = `${contexte}

Génère la PARTIE 1 du business plan dans ce format exact :

NOM: [Nom du business, 2-3 mots]
SLOGAN: [Slogan court]
SCORE: [50 à 90]
SCORE_EXPLICATION: [1 phrase]
SCORE_CRITERES:
- Experience: [note /10] — [1 phrase]
- Marche: [note /10] — [1 phrase]
- Differenciation: [note /10] — [1 phrase]
- Budget: [note /10] — [1 phrase]
- Clarte: [note /10] — [1 phrase]
- Timing: [note /10] — [1 phrase]

## PORTRAIT DU PROJET
INTRO: [1 phrase d'accroche]
- **Profil :** [Description du porteur de projet et ses atouts]
- **Projet :** [Ce qu'il veut créer concrètement]
- **Différence :** [Ce qui le distingue de la concurrence]
- **Défi principal :** [Le vrai obstacle à surmonter]
- **Verdict :** [Évaluation honnête et encourageante]

## ANALYSE DU MARCHÉ
INTRO: [1 phrase sur l'opportunité]
- **Marché :** [Taille estimée en France et croissance annuelle]
- **Tendances :** [2-3 tendances favorables avec données]
- **Concurrents :** [Analyse des concurrents et leurs faiblesses]
- **Positionnement :** [Comment se différencier concrètement]
- **Opportunité :** [Le créneau précis à saisir maintenant]

## MODÈLE ÉCONOMIQUE
INTRO: [1 phrase sur la logique économique]
- **Services et prix :** [Offres avec fourchettes de prix recommandées]
- **Coûts fixes :** [Liste des charges mensuelles, total estimé]
- **Investissement initial :** [Ce qu'il faut mobiliser pour démarrer]
- **Seuil de rentabilité :** [Nombre de clients ou CA nécessaire par mois]
- **Projections :** [CA estimé mois 3, mois 6, mois 12]

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

- **Immatriculation :**
[Site officiel complet avec URL visible]
[Documents nécessaires]
[Délai]
[Coût estimatif]

- **Aides disponibles :**
[Nom de l'aide]
[Montant ou avantage]
[Conditions]
[URL officielle complète]

- **Obligations sectorielles :**
[Diplômes, licences ou certifications]
[URL officielle complète si applicable]

- **Assurances :**
[Assurances obligatoires]
[Fourchette de prix]

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

    // Parser les sections des 2 parties
    const sections1 = parseSections(text1);
    const sections2 = parseSections(text2);
    result.sections = [...sections1, ...sections2];

    if (!result.nom || result.sections.length < 6) {
      console.error("Plan incomplet:", result.sections.length, "sections. Nom:", result.nom);
      return res.status(500).json({ error: "Plan incomplet — réessaie" });
    }

    return res.status(200).json(result);

  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({ error: "Erreur serveur — réessaie" });
  }
}
