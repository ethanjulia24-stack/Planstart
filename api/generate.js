// /api/generate.js — Vercel Serverless Function

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

function parseStructuredText(text) {
  const result = { nom: "", slogan: "", score: 70, scoreExplication: "", sections: [], sectionsDetaillees: [] };
  const lines = text.split("\n").map(l => l.trim()).filter(l => l);

  let currentSection = null;
  let currentPoints = [];
  let currentPointsDetail = [];
  let inDetail = false;

  for (const line of lines) {
    if (line.startsWith("NOM:")) result.nom = line.replace("NOM:", "").trim();
    else if (line.startsWith("SLOGAN:")) result.slogan = line.replace("SLOGAN:", "").trim();
    else if (line.startsWith("SCORE:")) result.score = parseInt(line.replace("SCORE:", "").trim()) || 70;
    else if (line.startsWith("SCORE_EXPLICATION:")) result.scoreExplication = line.replace("SCORE_EXPLICATION:", "").trim();
    else if (line.startsWith("##")) {
      if (currentSection) {
        result.sections.push({ titre: currentSection.titre, intro: currentSection.intro, points: currentPoints });
        result.sectionsDetaillees.push({ titre: currentSection.titre, intro: currentSection.intro, points: currentPointsDetail });
      }
      currentSection = { titre: line.replace("##", "").trim(), intro: "" };
      currentPoints = [];
      currentPointsDetail = [];
      inDetail = false;
    }
    else if (line === "---DETAIL---") inDetail = true;
    else if (line.startsWith("INTRO:") && currentSection) currentSection.intro = line.replace("INTRO:", "").trim();
    else if (line.startsWith("-") && currentSection) {
      const point = line.replace(/^-\s*/, "").trim();
      if (!inDetail) currentPoints.push(point);
      else currentPointsDetail.push(point);
    }
  }

  if (currentSection) {
    result.sections.push({ titre: currentSection.titre, intro: currentSection.intro, points: currentPoints });
    result.sectionsDetaillees.push({ titre: currentSection.titre, intro: currentSection.intro, points: currentPointsDetail });
  }

  return result;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "https://planstart.fr");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || "unknown";
  const rateLimit = getRateLimit(ip);
  if (!rateLimit.allowed) return res.status(429).json({ error: "Trop de générations. Réessaie dans 1 heure." });

  const { answers, questions } = req.body;
  if (!answers || typeof answers !== "object") return res.status(400).json({ error: "Données invalides" });
  if (detectPromptInjection(answers)) return res.status(400).json({ error: "Contenu non autorisé" });

  const sanitizedAnswers = {};
  for (const [key, value] of Object.entries(answers)) sanitizedAnswers[key] = sanitizeInput(value);

  const qaContext = Object.entries(sanitizedAnswers)
    .map(([i, answer]) => {
      const q = questions?.[parseInt(i)];
      return `Q${parseInt(i) + 1}${q ? ` (${q.question})` : ""} : ${answer}`;
    }).join("\n");

  const prompt = `Tu es un consultant expert en création d'entreprise en France. Génère un business plan basé sur cet entretien :

${qaContext}

Réponds UNIQUEMENT dans ce format exact. Chaque section a deux niveaux :
- Les points RÉSUMÉ (courts, 1-2 phrases) affichés sur le site
- Les points DÉTAIL (complets, 4-6 phrases) pour le dossier PDF téléchargeable

NOM: [Nom du business, 2-3 mots]
SLOGAN: [Slogan court et percutant]
SCORE: [Note entre 50 et 90]
SCORE_EXPLICATION: [1 phrase sur la viabilité]

## PORTRAIT DU PROJET
INTRO: [1 phrase d'accroche personnalisée]
- **Profil :** [1-2 phrases résumé]
- **Projet :** [1-2 phrases résumé]
- **Différence :** [1-2 phrases résumé]
- **Défi :** [1-2 phrases résumé]
- **Verdict :** [1-2 phrases résumé]
---DETAIL---
- **Profil :** [Portrait complet du porteur de projet — parcours, compétences, expérience, pourquoi il est la bonne personne]
- **Projet :** [Description détaillée — concept, service, fonctionnement de A à Z, expérience client]
- **Différence :** [Analyse complète de la différenciation — avantages concurrentiels précis]
- **Défi :** [Analyse honnête des obstacles avec stratégie concrète pour chacun]
- **Verdict :** [Évaluation professionnelle complète — potentiel, conditions de réussite, recommandations]

## ANALYSE DU MARCHÉ
INTRO: [1 phrase sur l'opportunité]
- **Marché :** [1-2 phrases résumé]
- **Tendances :** [1-2 phrases résumé]
- **Concurrents :** [1-2 phrases résumé]
- **Positionnement :** [1-2 phrases résumé]
- **Opportunité :** [1-2 phrases résumé]
---DETAIL---
- **Marché :** [Taille précise du marché en France, croissance annuelle, segments porteurs]
- **Tendances :** [3-4 tendances favorables avec données chiffrées et impact direct sur le projet]
- **Concurrents :** [Analyse détaillée de chaque concurrent — positionnement, prix, forces, faiblesses exploitables]
- **Positionnement :** [Stratégie de positionnement précise et comment la défendre dans le temps]
- **Opportunité :** [Le créneau exact, pourquoi maintenant, ce qui change si on attend]

## MODÈLE ÉCONOMIQUE
INTRO: [1 phrase sur la logique économique]
- **Prix :** [1-2 phrases résumé]
- **Coûts :** [1-2 phrases résumé]
- **Investissement :** [1-2 phrases résumé]
- **Rentabilité :** [1-2 phrases résumé]
- **Projections :** [1-2 phrases résumé]
---DETAIL---
- **Prix :** [Liste complète des services avec prix, justification marché, marge brute estimée pour chacun]
- **Coûts :** [Liste exhaustive des coûts fixes mensuels avec montants — loyer, charges, assurances, outils, comptable]
- **Investissement :** [Liste détaillée de l'investissement initial — matériel, travaux, stock, frais création, fonds de roulement]
- **Rentabilité :** [Calcul précis du seuil de rentabilité — nombre de clients, CA minimum, date prévisionnelle]
- **Projections :** [Projections réalistes mois par mois sur 12 mois — CA, charges, résultat net]

## STRATÉGIE MARKETING
INTRO: [1 phrase sur la stratégie]
- **Client idéal :** [1-2 phrases résumé]
- **Canal #1 :** [1-2 phrases résumé]
- **Canal #2 :** [1-2 phrases résumé]
- **Réseaux sociaux :** [1-2 phrases résumé]
- **Lancement :** [1-2 phrases résumé]
---DETAIL---
- **Client idéal :** [Portrait complet — âge, situation, revenus, comportements, motivations, objections, où le trouver]
- **Canal #1 :** [Stratégie complète — pourquoi ce canal, comment l'utiliser, message, budget, résultats attendus]
- **Canal #2 :** [Même niveau de détail pour le canal secondaire]
- **Réseaux sociaux :** [Plateforme, type de contenu, fréquence, stratégie croissance, conversion en clients]
- **Lancement :** [Plan semaine par semaine pour les 30 premiers jours — actions concrètes et objectifs]

## PLAN D'ACTION 90 JOURS
INTRO: [1 phrase sur les priorités]
- **Semaine 1-2 :** [1-2 phrases résumé]
- **Semaine 3-4 :** [1-2 phrases résumé]
- **Mois 1 :** [1-2 phrases résumé]
- **Mois 2 :** [1-2 phrases résumé]
- **Mois 3 :** [1-2 phrases résumé]
---DETAIL---
- **Semaine 1-2 :** [3-4 actions très précises avec comment, délai, résultat attendu]
- **Semaine 3-4 :** [3-4 actions très précises]
- **Mois 1 :** [Comment lancer officiellement, obtenir les premiers clients, objectifs précis]
- **Mois 2 :** [Actions de croissance, partenariats, optimisation]
- **Mois 3 :** [Consolidation, bilan, décisions pour la suite]

## DÉMARCHES LÉGALES
INTRO: [1 phrase sur les obligations]
- **Statut :** [1-2 phrases résumé]
- **Immatriculation :** [1-2 phrases résumé]
- **Aides :** [1-2 phrases résumé]
- **Obligations :** [1-2 phrases résumé]
- **Assurances :** [1-2 phrases résumé]
---DETAIL---
- **Statut :** [Comparaison Micro-entrepreneur vs SASU vs EURL — recommandation précise avec justification]
- **Immatriculation :** [Site exact, documents nécessaires, délai, coût, ce qu'on reçoit]
- **Aides :** [Chaque aide applicable — ACRE, NACRE, ARE, BPI — montant précis, conditions, comment faire la demande]
- **Obligations :** [Diplômes, certifications, licences obligatoires dans ce secteur avec comment les obtenir]
- **Assurances :** [Liste complète des assurances obligatoires et recommandées avec fourchette de prix]

## RISQUES ET SOLUTIONS
INTRO: [1 phrase sur l'importance d'anticiper]
- **Risque #1 :** [1-2 phrases résumé]
- **Risque #2 :** [1-2 phrases résumé]
- **Risque #3 :** [1-2 phrases résumé]
- **Trésorerie :** [1-2 phrases résumé]
- **Conseil final :** [1-2 phrases résumé]
---DETAIL---
- **Risque #1 :** [Description complète, probabilité, impact financier, signaux d'alerte, plan d'action]
- **Risque #2 :** [Même niveau de détail]
- **Risque #3 :** [Même niveau de détail]
- **Trésorerie :** [Montant exact à prévoir, comment constituer la réserve, règles pour y toucher]
- **Conseil final :** [Le conseil le plus important personnalisé — erreur classique du secteur à éviter, clé du succès]`;

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
        max_tokens: 8000,
        system: "Tu es un expert en création d'entreprise. Tu réponds TOUJOURS dans le format texte demandé, sans rien ajouter avant ou après. Jamais de JSON. Jamais de backticks.",
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

    if (!text || text.length < 200) return res.status(500).json({ error: "Réponse vide" });

    const parsed = parseStructuredText(text);

    if (!parsed.nom || parsed.sections.length < 5) {
      console.error("Plan incomplet:", parsed.sections.length, "sections");
      return res.status(500).json({ error: "Plan incomplet — réessaie" });
    }

    return res.status(200).json(parsed);

  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}
