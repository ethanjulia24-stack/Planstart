// /api/generate.js — Vercel Serverless Function
// COPIER dans /api/generate.js à la racine du projet

const RATE_LIMIT = new Map();

function getRateLimit(ip) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const maxRequests = 3;
  if (!RATE_LIMIT.has(ip)) {
    RATE_LIMIT.set(ip, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }
  const record = RATE_LIMIT.get(ip);
  if (now > record.resetAt) {
    RATE_LIMIT.set(ip, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }
  if (record.count >= maxRequests) return { allowed: false, remaining: 0, resetAt: record.resetAt };
  record.count++;
  return { allowed: true, remaining: maxRequests - record.count };
}

function sanitizeInput(str) {
  if (typeof str !== "string") return "";
  return str.slice(0, 500).replace(/<[^>]*>/g, "").trim();
}

function detectPromptInjection(answers) {
  const dangerousPatterns = [/ignore.{0,20}instruction/i, /forget.{0,20}previous/i, /system.{0,20}prompt/i, /révèle.{0,20}prompt/i, /act as/i, /jailbreak/i];
  for (const answer of Object.values(answers)) {
    if (typeof answer === "string") {
      for (const pattern of dangerousPatterns) {
        if (pattern.test(answer)) return true;
      }
    }
  }
  return false;
}

// Convertit le texte structuré en objet JSON
function parseStructuredText(text) {
  const result = {
    nom: "",
    slogan: "",
    score: 70,
    scoreExplication: "",
    sections: []
  };

  const lines = text.split("\n").map(l => l.trim()).filter(l => l);
  
  let currentSection = null;
  let currentPoints = [];

  for (const line of lines) {
    if (line.startsWith("NOM:")) {
      result.nom = line.replace("NOM:", "").trim();
    } else if (line.startsWith("SLOGAN:")) {
      result.slogan = line.replace("SLOGAN:", "").trim();
    } else if (line.startsWith("SCORE:")) {
      result.score = parseInt(line.replace("SCORE:", "").trim()) || 70;
    } else if (line.startsWith("SCORE_EXPLICATION:")) {
      result.scoreExplication = line.replace("SCORE_EXPLICATION:", "").trim();
    } else if (line.startsWith("##")) {
      // Nouvelle section
      if (currentSection && currentPoints.length > 0) {
        result.sections.push({
          titre: currentSection.titre,
          intro: currentSection.intro,
          points: currentPoints
        });
      }
      currentSection = { titre: line.replace("##", "").trim(), intro: "" };
      currentPoints = [];
    } else if (line.startsWith("INTRO:") && currentSection) {
      currentSection.intro = line.replace("INTRO:", "").trim();
    } else if (line.startsWith("-") && currentSection) {
      currentPoints.push(line.replace(/^-\s*/, "").trim());
    }
  }

  // Ajouter la dernière section
  if (currentSection && currentPoints.length > 0) {
    result.sections.push({
      titre: currentSection.titre,
      intro: currentSection.intro,
      points: currentPoints
    });
  }

  return result;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "https://planstart.fr");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket?.remoteAddress || "unknown";
  const rateLimit = getRateLimit(ip);
  res.setHeader("X-RateLimit-Remaining", rateLimit.remaining);
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: "Trop de générations. Réessaie dans 1 heure.", resetAt: rateLimit.resetAt });
  }

  const { answers, questions } = req.body;
  if (!answers || typeof answers !== "object") return res.status(400).json({ error: "Données invalides" });
  if (detectPromptInjection(answers)) return res.status(400).json({ error: "Contenu non autorisé détecté" });

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

  const prompt = `Tu es un consultant expert en création d'entreprise en France. Génère un business plan personnalisé basé sur cet entretien :

${qaContext}

Réponds UNIQUEMENT dans ce format texte exact, sans rien ajouter avant ou après :

NOM: [Nom du business, 2-3 mots max]
SLOGAN: [Slogan court et percutant]
SCORE: [Note entre 50 et 90]
SCORE_EXPLICATION: [1 phrase expliquant le score]

## PORTRAIT DU PROJET
INTRO: [1 phrase d'accroche]
- **Profil :** [Description du porteur de projet et ses atouts]
- **Projet :** [Ce qu'il veut créer concrètement]
- **Différence :** [Ce qui le distingue de la concurrence]
- **Défi principal :** [Le vrai obstacle à surmonter]
- **Verdict :** [Évaluation honnête et encourageante]

## ANALYSE DU MARCHÉ
INTRO: [1 phrase sur l'opportunité]
- **Taille du marché :** [Estimation du marché en France]
- **Tendances :** [2-3 tendances favorables]
- **Concurrents :** [Analyse des concurrents et leurs faiblesses]
- **Positionnement :** [Comment se différencier]
- **Opportunité :** [Le créneau à saisir maintenant]

## MODÈLE ÉCONOMIQUE
INTRO: [1 phrase sur la logique économique]
- **Services et prix :** [Liste des offres avec prix recommandés]
- **Coûts fixes :** [Loyer, charges, assurances — total mensuel estimé]
- **Investissement initial :** [Ce qu'il faut mobiliser pour démarrer]
- **Seuil de rentabilité :** [Nombre de clients ou CA nécessaire]
- **Projections :** [Revenus estimés mois 3, mois 6, mois 12]

## STRATÉGIE MARKETING
INTRO: [1 phrase sur la stratégie globale]
- **Client idéal :** [Profil précis du client cible]
- **Canal principal :** [Le canal d'acquisition prioritaire avec tactique]
- **Canal secondaire :** [Deuxième canal avec tactique]
- **Réseaux sociaux :** [Quelle plateforme, quel contenu, quelle fréquence]
- **Lancement :** [Actions concrètes pour les 30 premiers jours]

## PLAN D'ACTION 90 JOURS
INTRO: [1 phrase sur les priorités]
- **Semaine 1-2 :** [Actions administratives et fondations]
- **Semaine 3-4 :** [Préparation au lancement]
- **Mois 1 — Lancement :** [Comment obtenir les premiers clients]
- **Mois 2 :** [Actions de croissance]
- **Mois 3 :** [Consolidation et bilan]

## DÉMARCHES LÉGALES
INTRO: [1 phrase sur les obligations]
- **Statut recommandé :** [Micro-entrepreneur, SASU ou autre avec justification]
- **Immatriculation :** [Site exact, délai et coût]
- **Aides disponibles :** [ACRE, NACRE, ARE — montants et conditions]
- **Obligations sectorielles :** [Diplômes, licences ou certifications obligatoires]
- **Assurances :** [Assurances obligatoires avec fourchette de prix]

## RISQUES ET SOLUTIONS
INTRO: [1 phrase sur l'importance d'anticiper]
- **Risque principal :** [Le risque numéro 1 avec solution concrète]
- **Risque financier :** [Sous-capitalisation et comment l'éviter]
- **Risque marché :** [Risque lié aux clients ou concurrents]
- **Trésorerie de sécurité :** [Combien prévoir et comment]
- **Conseil final :** [Le conseil le plus important pour réussir]`;

  try {
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
        system: "Tu es un expert en création d'entreprise. Tu réponds TOUJOURS dans le format texte demandé, sans rien ajouter avant ou après. Jamais de JSON. Jamais de backticks. Jamais de markdown superflu.",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      console.error("Anthropic error:", err);
      return res.status(500).json({ error: "Erreur lors de la génération" });
    }

    const data = await response.json();
    const text = data.content.map(i => i.text || "").join("");
    
    if (!text || text.length < 100) {
      return res.status(500).json({ error: "Réponse vide ou trop courte" });
    }

    const parsed = parseStructuredText(text);

    // Validation
    if (!parsed.nom || parsed.sections.length < 7) {
      console.error("Plan incomplet — sections:", parsed.sections.length, "nom:", parsed.nom);
      console.error("Raw text:", text.slice(0, 500));
      return res.status(500).json({ error: "Plan incomplet — réessaie" });
    }

    return res.status(200).json(parsed);

  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}
