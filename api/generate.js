// /api/generate.js — Vercel Serverless Function avec Streaming
// COPIER dans /api/generate.js à la racine du projet

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

function parseStructuredText(text) {
  const result = {
    nom: "",
    slogan: "",
    score: 70,
    scoreExplication: "",
    scoreCriteres: [],
    sections: []
  };

  const lines = text.split("\n").map(l => l.trim()).filter(l => l);
  let currentSection = null;
  let currentPoints = [];
  let inScoreCriteres = false;
  let skipDetail = false;

  for (const line of lines) {
    if (line.startsWith("---")) {
      skipDetail = true;
      continue;
    }
    if (line.startsWith("##") || (line.startsWith("#") && !line.startsWith("##"))) {
      skipDetail = false;
    }
    if (skipDetail) continue;

    if (line.startsWith("NOM:")) {
      result.nom = line.replace("NOM:", "").trim();
      inScoreCriteres = false;
    } else if (line.startsWith("SLOGAN:")) {
      result.slogan = line.replace("SLOGAN:", "").trim();
    } else if (line.startsWith("SCORE:") && !line.startsWith("SCORE_")) {
      result.score = parseInt(line.replace("SCORE:", "").trim()) || 70;
    } else if (line.startsWith("SCORE_EXPLICATION:")) {
      result.scoreExplication = line.replace("SCORE_EXPLICATION:", "").trim();
    } else if (line.startsWith("SCORE_CRITERES:")) {
      inScoreCriteres = true;
    } else if (inScoreCriteres && line.startsWith("-")) {
      result.scoreCriteres.push(line.replace(/^-\s*/, "").trim());
    } else if (line.startsWith("##") || (line.startsWith("#") && !line.startsWith("##"))) {
      inScoreCriteres = false;
      if (currentSection && currentPoints.length > 0) {
        result.sections.push({ titre: currentSection.titre, intro: currentSection.intro, points: currentPoints });
      }
      currentSection = { titre: line.replace(/^#+\s*/, "").trim(), intro: "" };
      currentPoints = [];
    } else if (line.startsWith("INTRO:") && currentSection) {
      currentSection.intro = line.replace("INTRO:", "").trim();
    } else if ((line.startsWith("- ") || line.startsWith("-**")) && currentSection && !inScoreCriteres) {
      currentPoints.push(line.replace(/^-\s*/, "").trim());
    }
  }

  if (currentSection && currentPoints.length > 0) {
    result.sections.push({ titre: currentSection.titre, intro: currentSection.intro, points: currentPoints });
  }

  return result;
}

export const config = {
  runtime: "edge",
};

export default async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "https://planstart.fr",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      }
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  if (!getRateLimit(ip).allowed) {
    return new Response(JSON.stringify({ error: "Trop de générations. Réessaie dans 1 heure." }), { status: 429 });
  }

  const body = await req.json();
  const { answers, questions } = body;

  if (!answers || typeof answers !== "object") {
    return new Response(JSON.stringify({ error: "Données invalides" }), { status: 400 });
  }

  if (detectPromptInjection(answers)) {
    return new Response(JSON.stringify({ error: "Contenu non autorisé" }), { status: 400 });
  }

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

RÈGLES ABSOLUES :
- Réponds dans le format texte demandé — jamais de JSON, jamais de backticks
- Parle en "tu/toi" — ton bienveillant et professionnel
- JAMAIS de section ---DETAIL--- — chaque point UNE SEULE FOIS, 2-3 lignes max
- Tous les chiffres en fourchettes (ex: "entre 500€ et 1500€")
- Toujours "environ", "estimé à", "entre X et Y"
- Score minimum 50 : 50-60=fragile, 61-70=potentiel, 71-80=solide, 81-90=très prometteur
- Tu DOIS générer les 7 sections complètes — si tu manques de place raccourcis chaque point

Réponds dans ce format exact :

NOM: [Nom du business, 2-3 mots max]
SLOGAN: [Slogan court et percutant]
SCORE: [Note entre 50 et 90]
SCORE_EXPLICATION: [1 phrase expliquant le score]
SCORE_CRITERES:
- Experience: [note /10] — [1 phrase]
- Marche: [note /10] — [1 phrase]
- Differenciation: [note /10] — [1 phrase]
- Budget: [note /10] — [1 phrase]
- Clarte: [note /10] — [1 phrase]
- Timing: [note /10] — [1 phrase]

## PORTRAIT DU PROJET
INTRO: [1 phrase d'accroche]
- **Profil :** [Description du porteur de projet]
- **Projet :** [Ce qu'il veut créer concrètement]
- **Différence :** [Ce qui le distingue]
- **Défi principal :** [Le vrai obstacle]
- **Verdict :** [Évaluation honnête]

## ANALYSE DU MARCHÉ
INTRO: [1 phrase sur l'opportunité]
- **Marché :** [Taille estimée et croissance]
- **Tendances :** [2-3 tendances favorables]
- **Concurrents :** [Analyse et faiblesses]
- **Positionnement :** [Comment se différencier]
- **Opportunité :** [Le créneau à saisir]

## MODÈLE ÉCONOMIQUE
INTRO: [1 phrase sur la logique économique]
- **Services et prix :** [Offres avec fourchettes de prix]
- **Coûts fixes :** [Total mensuel estimé]
- **Investissement initial :** [Total à mobiliser]
- **Seuil de rentabilité :** [Clients ou CA nécessaire]
- **Projections :** [Mois 3, 6, 12 estimés]

## STRATÉGIE MARKETING
INTRO: [1 phrase sur la stratégie]
- **Client idéal :** [Profil précis]
- **Canal principal :** [Tactique concrète]
- **Canal secondaire :** [Deuxième tactique]
- **Réseaux sociaux :** [Plateforme et contenu]
- **Lancement :** [Actions 30 premiers jours]

## PLAN D'ACTION 90 JOURS
INTRO: [1 phrase sur les priorités]
- **Semaine 1-2 :** [Fondations administratives]
- **Semaine 3-4 :** [Préparation au lancement]
- **Mois 1 — Lancement :** [Premiers clients]
- **Mois 2 :** [Croissance]
- **Mois 3 :** [Consolidation et bilan]

## DÉMARCHES LÉGALES
INTRO: [1 phrase sur les obligations]
- **Statut recommandé :** [Avec justification]
- **Immatriculation :** [Site, délai et coût]
- **Aides disponibles :** [ACRE, NACRE, ARE]
- **Obligations sectorielles :** [Diplômes ou licences]
- **Assurances :** [Obligatoires avec fourchette prix]

## RISQUES ET SOLUTIONS
INTRO: [1 phrase sur l'importance d'anticiper]
- **Risque principal :** [Description et solution]
- **Risque financier :** [Sous-capitalisation et remède]
- **Risque marché :** [Clients ou concurrents]
- **Trésorerie de sécurité :** [Montant à prévoir]
- **Conseil final :** [Le conseil le plus important]`;

  // Appel Anthropic en streaming
  const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 8000,
      stream: true,
      system: "Tu es un expert en création d'entreprise. Tu réponds TOUJOURS dans le format texte demandé. JAMAIS de section ---DETAIL---. Chaque point : 2-3 lignes maximum. Tu dois absolument générer les 7 sections complètes.",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!anthropicResponse.ok) {
    const err = await anthropicResponse.json();
    console.error("Anthropic error:", err);
    return new Response(JSON.stringify({ error: "Erreur lors de la génération" }), { status: 500 });
  }

  // Stream du texte complet puis parse et envoi
  const reader = anthropicResponse.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                  fullText += parsed.delta.text;
                }
              } catch {}
            }
          }
        }

        // Log pour debug
        console.log("=== FULL TEXT LENGTH:", fullText.length);
        console.log("=== FIRST 500:", fullText.slice(0, 500));
        console.log("=== LAST 200:", fullText.slice(-200));
        
        // Une fois tout reçu — parser et envoyer le résultat
        const result = parseStructuredText(fullText);

        if (!result.nom || result.sections.length < 7) {
          console.error("Plan incomplet:", result.sections.length, "sections");
          controller.enqueue(new TextEncoder().encode(
            JSON.stringify({ error: "Plan incomplet — réessaie" })
          ));
        } else {
          controller.enqueue(new TextEncoder().encode(JSON.stringify(result)));
        }

        controller.close();
      } catch (err) {
        console.error("Stream error:", err);
        controller.enqueue(new TextEncoder().encode(
          JSON.stringify({ error: "Erreur serveur" })
        ));
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "https://planstart.fr",
    }
  });
}
