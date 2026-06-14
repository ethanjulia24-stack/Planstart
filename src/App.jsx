import { useState, useEffect, useRef } from "react";

// Transforme les URL d'un texte en liens cliquables ENTIERS (jamais d'astérisque).
// Version écran (renvoie du JSX).
const linkify = (text) => {
  const parts = String(text || "").split(/(https?:\/\/[^\s)]+)/g);
  return parts.map((part, i) => {
    if (/^https?:\/\//.test(part)) {
      // Retire la ponctuation finale collée à l'URL (virgule, point, etc.) qui casse le lien
      const m = part.match(/^(.*?)([.,;:!?）)\]]*)$/);
      const url = m ? m[1] : part;
      const trail = m ? m[2] : "";
      return <span key={i}><a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "#0a58ca", wordBreak: "break-all" }}>{url}</a>{trail}</span>;
    }
    return part;
  });
};
// Version PDF : prend du texte DÉJÀ échappé et enrobe les URL dans des <a> (ponctuation finale exclue).
const linkifyHtml = (escaped) =>
  String(escaped).replace(/(https?:\/\/[^\s)<]*?)([.,;:!?）)\]]*)(?=\s|<|$)/g, '<a href="$1" style="color:#0a58ca;word-break:break-all;">$1</a>$2');

// ─── CONSTANTES ───────────────────────────────────────────────────────────────

const FIRST_QUESTION = {
  label: "01",
  bloc: "TON PROJET",
  question: "Qu'est-ce que tu veux créer ?",
  placeholder: "Ex: une barber shop dans mon quartier, une boutique en ligne de vêtements, un service de livraison de repas healthy...",
  examples: ["Une barber shop", "Un restaurant", "Une boutique en ligne", "Un service à domicile"]
};

const TOTAL_QUESTIONS = 10;
const BLOCS = ["TON PROJET", "TON PROJET", "TON PROJET", "TOI", "TOI", "TOI", "TON MARCHÉ", "TON MARCHÉ", "TON AMBITION", "TON AMBITION"];
const MAX_INPUT_LENGTH = 500;

const IMAGES = [
  "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=1200&q=80",
  "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1200&q=80",
  "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200&q=80",
];

// Photo de couverture du business plan généré (homme pensif, ambiance sombre/chaude)
const COVER_IMAGE = "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=1400&q=80";



const LOADING_STEPS = [
  { label: "LECTURE DE TES RÉPONSES", duration: 6000 },
  { label: "RECHERCHE DE DONNÉES RÉELLES", duration: 32000 },
  { label: "ANALYSE DU MARCHÉ", duration: 22000 },
  { label: "CALCUL DU MODÈLE ÉCONOMIQUE", duration: 22000 },
  { label: "CONSTRUCTION DE TA STRATÉGIE", duration: 18000 },
  { label: "RÉDACTION DU PLAN D'ACTION", duration: 18000 },
  { label: "DÉMARCHES LÉGALES & RISQUES", duration: 22000 },
  { label: "FINALISATION DU DOSSIER", duration: 10000 },
];

// Messages qui défilent — décrivent le VRAI travail effectué, sans rien inventer.
const ROTATING_MESSAGES = [
  "On lit attentivement tes réponses…",
  "On recherche des données réelles sur le web…",
  "On vérifie les aides et seuils légaux à jour…",
  "On analyse ton marché et tes concurrents…",
  "On calcule ton modèle économique…",
  "On construit ta stratégie marketing…",
  "On rédige ton plan d'action sur mesure…",
  "On rassemble les démarches légales…",
  "On met en forme ton dossier…",
];

// ─── LOADING SCREEN ────────────────────────────────────────────────────────────

function LoadingScreen({ isOrange }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [msgIndex, setMsgIndex] = useState(0);
  const isMobile = window.innerWidth < 768;
  const ACC = isOrange ? "#ff7a2e" : "#fff";
  const ACC_GRAD = isOrange ? "linear-gradient(90deg,#ff9d3d,#ff5e3a)" : "#fff";

  useEffect(() => {
    const timer = setInterval(() => setElapsed(e => e + 1), 1000);
    const msgTimer = setInterval(() => setMsgIndex(i => (i + 1) % ROTATING_MESSAGES.length), 6000);
    let cumulative = 0;
    const timers = LOADING_STEPS.slice(0, -1).map((step, i) => {
      cumulative += step.duration;
      return setTimeout(() => setStepIndex(i + 1), cumulative);
    });
    return () => { clearInterval(timer); clearInterval(msgTimer); timers.forEach(clearTimeout); };
  }, []);

  // Progression asymptotique : avance vite au début puis ralentit, sans jamais
  // se figer ni atteindre 100%. Elle ne ment pas sur un temps précis — c'est la
  // vraie fin de génération (loading=false) qui fait disparaître cet écran.
  // ~63% à 60s, ~86% à 150s, tend vers 96% sans l'atteindre.
  const globalProgress = Math.min(96 * (1 - Math.exp(-elapsed / 75)), 96);
  const formatTime = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div style={{ minHeight: "100vh", background: "#000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse3 { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>

      <div style={{ width: "100%", maxWidth: 520, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, background: "rgba(255,255,255,0.025)", padding: isMobile ? "40px 24px" : "52px 48px", display: "flex", flexDirection: "column", alignItems: "center" }}>

      <div style={{ marginBottom: 48, textAlign: "center" }}>
        <div style={{ fontSize: 10, letterSpacing: "0.3em", color: "rgba(255,255,255,0.25)", marginBottom: 8, fontWeight: 900 }}>PLANSTART</div>
        <div style={{ fontSize: isMobile ? 13 : 15, letterSpacing: "0.15em", color: "rgba(255,255,255,0.5)", fontWeight: 900 }}>GÉNÉRATION DE TON BUSINESS PLAN</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 40 }}>
        <div style={{ width: 32, height: 32, border: "3px solid rgba(255,255,255,0.1)", borderTop: `3px solid ${ACC}`, borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: isMobile ? 13 : 16, fontWeight: 900, color: "#fff", letterSpacing: "0.05em" }}>{LOADING_STEPS[stepIndex].label}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 4, fontFamily: "Arial, sans-serif" }}>Étape {stepIndex + 1} sur {LOADING_STEPS.length}</div>
        </div>
      </div>

      <div style={{ width: "100%", maxWidth: 440, marginBottom: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 900, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em" }}>PROGRESSION</span>
          <span style={{ fontSize: 10, fontWeight: 900, color: isOrange ? "#ff7a2e" : "rgba(255,255,255,0.3)" }}>{Math.round(globalProgress)}%</span>
        </div>
        <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2 }}>
          <div style={{ height: "100%", width: `${globalProgress}%`, background: ACC_GRAD, borderRadius: 2, transition: "width 1s ease" }} />
        </div>
      </div>

      <div style={{ width: "100%", maxWidth: 440 }}>
        {LOADING_STEPS.map((step, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "9px 0", borderBottom: i < LOADING_STEPS.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", opacity: i > stepIndex ? 0.2 : 1, transition: "opacity 0.3s" }}>
            <div style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, background: i < stepIndex ? ACC : "transparent", border: i < stepIndex ? "none" : i === stepIndex ? `2px solid ${ACC}` : "2px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {i < stepIndex && <span style={{ fontSize: 9, color: isOrange ? "#fff" : "#000", fontWeight: 900 }}>✓</span>}
              {i === stepIndex && <div style={{ width: 5, height: 5, borderRadius: "50%", background: ACC, animation: "pulse3 1.2s infinite" }} />}
            </div>
            <span style={{ fontSize: 11, fontWeight: 900, color: i <= stepIndex ? "#fff" : "rgba(255,255,255,0.2)", letterSpacing: "0.08em" }}>{step.label}</span>
          </div>
        ))}
      </div>

      {/* Message vivant qui défile */}
      <div style={{ marginTop: 36, minHeight: 20, fontSize: isMobile ? 13 : 14, color: "rgba(255,255,255,0.6)", fontFamily: "Arial, sans-serif", textAlign: "center", transition: "opacity 0.4s" }}>
        {ROTATING_MESSAGES[msgIndex]}
      </div>

      {/* Temps bien visible */}
      <div style={{ marginTop: 20, textAlign: "center" }}>
        <div style={{ fontSize: isMobile ? 32 : 40, fontWeight: 900, color: "#fff", letterSpacing: "0.02em", lineHeight: 1 }}>{formatTime(elapsed)}</div>
        <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.18em", color: "rgba(255,255,255,0.35)", marginTop: 6 }}>TEMPS ÉCOULÉ</div>
      </div>

      {/* Mention honnête : pourquoi c'est long */}
      <div style={{ marginTop: 24, fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "Arial, sans-serif", textAlign: "center", lineHeight: 1.5, maxWidth: 380 }}>
        La génération prend environ 2 minutes : on recherche de vraies données sur le web pour ton projet. Ne quitte pas cette page.
      </div>

      </div>
    </div>
  );
}

// ─── APP PRINCIPAL ─────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState("home");
  const [theme, setTheme] = useState("bw"); // "bw" (noir/blanc) ou "orange"
  const [introStep, setIntroStep] = useState(0);
  const [introLetters, setIntroLetters] = useState("");
  const [slideIndex, setSlideIndex] = useState(0);
  const [qIndex, setQIndex] = useState(0);
  const [questions, setQuestions] = useState([FIRST_QUESTION]);
  const [answers, setAnswers] = useState({});
  const [current, setCurrent] = useState("");
  const [blocTransition, setBlocTransition] = useState(false);
  const [showBloc, setShowBloc] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [loading, setLoading] = useState(false);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [shareToast, setShareToast] = useState(false);
  const inputRef = useRef(null);

  // ─── THÈME : accent orange ou noir/blanc ───
  const isOrange = theme === "orange";
  const ACCENT = isOrange ? "#ff7a2e" : "#000";
  const ACCENT_GRAD = isOrange ? "linear-gradient(90deg,#ff9d3d,#ff5e3a)" : "#fff";
  const NOW_COLOR = isOrange ? "#ff7a2e" : "rgba(255,255,255,0.72)";
  const ACCENT_ON_DARK = isOrange ? "#ff7a2e" : "#fff"; // accents sur fond sombre (quiz)
  const CREAM = "#faf8f5";        // fond clair principal (blanc cassé très léger)
  const CREAM_ALT = "#f4f1ec";    // fond clair secondaire (sections / cartes décalées)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Sauvegarder les réponses dans sessionStorage
  useEffect(() => {
    if (Object.keys(answers).length > 0) {
      sessionStorage.setItem("planstart_answers", JSON.stringify(answers));
      sessionStorage.setItem("planstart_questions", JSON.stringify(questions));
    }
  }, [answers, questions]);

  useEffect(() => {
    if (screen !== "intro") return;
    const word = "PLANSTART";
    let i = 0;
    const t = setInterval(() => { i++; setIntroLetters(word.slice(0, i)); if (i >= word.length) clearInterval(t); }, 100);
    const timers = [
      setTimeout(() => setIntroStep(1), 100),
      setTimeout(() => setIntroStep(2), 1200),
      setTimeout(() => setIntroStep(3), 1900),
      setTimeout(() => setIntroStep(4), 2600),
    ];
    return () => { clearInterval(t); timers.forEach(clearTimeout); };
  }, [screen]);

  useEffect(() => {
    if (screen !== "home") return;
    const t = setInterval(() => setSlideIndex(i => (i + 1) % IMAGES.length), 5000);
    return () => clearInterval(t);
  }, [screen]);

  useEffect(() => {
    if (screen === "quiz" && inputRef.current) inputRef.current.focus();
  }, [screen, qIndex]);

  // ─── API CALLS (vers le backend sécurisé) ────────────────────────────────────

  const generateNextQuestion = async (currentAnswers, currentQuestions) => {
    setLoadingQuestion(true);
    try {
      const history = currentQuestions.map((q, i) => ({
        question: q.question,
        reponse: (currentAnswers[i] || "").slice(0, MAX_INPUT_LENGTH),
      })).filter(q => q.reponse);

      const nextNum = currentQuestions.length + 1;
      const bloc = BLOCS[currentQuestions.length] || "TON AMBITION";

      const response = await fetch("/api/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history, nextNum, bloc }),
      });

      if (!response.ok) throw new Error("API error");
      const parsed = await response.json();

      setQuestions(prev => [...prev, {
        label: String(nextNum).padStart(2, "0"),
        bloc,
        question: parsed.question,
        placeholder: parsed.placeholder,
        examples: parsed.examples || [],
      }]);
    } catch (err) {
      console.error(err);
      const fallbacks = [
        { question: "Quel problème concret tu règles pour tes clients ?", placeholder: "Ex: il n'y a pas de service adapté dans ma ville..." },
        { question: "Qu'est-ce qui rend ton projet différent de ce qui existe ?", placeholder: "Ex: je propose quelque chose que personne ne fait encore..." },
        { question: "Parle-moi de ton parcours et tes compétences", placeholder: "Ex: 5 ans d'expérience dans ce domaine..." },
        { question: "Quelle est ta situation actuelle et pourquoi tu veux te lancer ?", placeholder: "Ex: je suis salarié mais je veux mon indépendance..." },
        { question: "Quelles ressources as-tu disponibles ?", placeholder: "Ex: 5000€ d'économies, je peux y consacrer mes weekends..." },
        { question: "Décris précisément tes clients idéaux", placeholder: "Ex: des hommes de 25-45 ans dans ma ville..." },
        { question: "Qui sont tes concurrents et quelles sont leurs faiblesses ?", placeholder: "Ex: 3 concurrents mais ils sont chers et peu accueillants..." },
        { question: "Quel est ton budget de départ et comment tu peux le financer ?", placeholder: "Ex: 3000€ d'économies + prêt famille de 5000€..." },
        { question: "Dans 12 mois, à quoi ressemble le succès pour toi ?", placeholder: "Ex: 2500€ nets par mois et avoir quitté mon emploi..." },
      ];
      const fallback = fallbacks[Math.min(questions.length - 1, fallbacks.length - 1)];
      setQuestions(prev => [...prev, {
        label: String(prev.length + 1).padStart(2, "0"),
        bloc: BLOCS[prev.length] || "TON AMBITION",
        question: fallback.question,
        placeholder: fallback.placeholder,
        examples: [],
      }]);
    } finally {
      setLoadingQuestion(false);
    }
  };

  const generatePlan = async (finalAnswers) => {
    setLoading(true);
    setScreen("result");
    setError(null);
    try {
      const sanitized = {};
      for (const [k, v] of Object.entries(finalAnswers)) {
        sanitized[k] = (v || "").slice(0, MAX_INPUT_LENGTH);
      }

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: sanitized,
          questions: questions.map(q => ({ question: q.question })),
        }),
      });

      if (response.status === 429) {
        throw new Error("Trop de générations. Réessaie dans 1 heure.");
      }
      if (!response.ok) throw new Error("Erreur lors de la génération");

      const parsed = await response.json();
      setResult(parsed);
      sessionStorage.removeItem("planstart_answers");
      sessionStorage.removeItem("planstart_questions");
    } catch (err) {
      console.error(err);
      setError(err.message || "Une erreur est survenue. Réessaie.");
    } finally {
      setLoading(false);
    }
  };

  // ─── NAVIGATION ───────────────────────────────────────────────────────────────

  const handleNext = async () => {
    const newAnswers = { ...answers, [qIndex]: current.slice(0, MAX_INPUT_LENGTH) };
    setAnswers(newAnswers);
    const nextIndex = qIndex + 1;

    if (nextIndex >= TOTAL_QUESTIONS) {
      generatePlan(newAnswers);
      return;
    }

    const currentBloc = questions[qIndex]?.bloc;
    const nextBloc = BLOCS[nextIndex];
    if (nextBloc !== currentBloc) {
      setBlocTransition(true);
      setShowBloc(nextBloc);
      setTimeout(() => setBlocTransition(false), 1800);
    }

    if (!questions[nextIndex]) {
      await generateNextQuestion(newAnswers, questions);
    }

    setCurrent(answers[nextIndex] || "");
    setQIndex(nextIndex);
  };

  const handleBack = () => {
    if (qIndex > 0) { setAnswers({ ...answers, [qIndex]: current }); setQIndex(qIndex - 1); setCurrent(answers[qIndex - 1] || ""); }
    else setScreen("home");
  };

  const restart = () => {
    setScreen("home"); setQIndex(0); setAnswers({}); setCurrent("");
    setBlocTransition(false); setQuestions([FIRST_QUESTION]); setResult(null); setError(null);
  };

  // ─── SHARE ────────────────────────────────────────────────────────────────────

  const handleShare = () => {
    const text = `J'ai obtenu ${result?.score}/100 sur mon projet "${result?.nom}" avec PLANSTART 🚀 Génère ton business plan gratuitement → planstart.fr`;
    if (navigator.share) {
      navigator.share({ title: "Mon Business Plan PLANSTART", text, url: "https://planstart.fr" });
    } else {
      navigator.clipboard.writeText(text);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 3000);
    }
  };

  // ─── PDF ──────────────────────────────────────────────────────────────────────

  const downloadPDF = async (data) => {
    const date = new Date().toLocaleDateString("fr-FR");
    const escape = str => (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const sections = data.sections || [];
    const CRIT_FR = { Experience: "Expérience", Marche: "Marché", Differenciation: "Différenciation", Budget: "Budget", Clarte: "Clarté", Timing: "Timing" };
    const critHTML = (data.scoreCriteres || []).map(c => {
      const m = c.match(/^(.+?):\s*(\d+)\/10/);
      if (!m) return "";
      const label = CRIT_FR[m[1].trim()] || m[1].trim();
      const n = parseInt(m[2]);
      const col = n >= 7 ? "#4ade80" : n >= 5 ? "#facc15" : "#f87171";
      return `<tr><td>${label}</td><td style="padding-left:14px;padding-right:14px;"><div class="cover-crit-bar-bg"><div class="cover-crit-bar" style="width:${n * 10}%;background:${col};"></div></div></td><td>${n}/10</td></tr>`;
    }).join("");

    // Ligne des 6 critères en bas de couverture (cellules)
    const critCellsHTML = (data.scoreCriteres || []).map(c => {
      const m = c.match(/^(.+?):\s*(\d+)\/10/);
      if (!m) return "";
      const label = (CRIT_FR[m[1].trim()] || m[1].trim()).toUpperCase();
      const n = parseInt(m[2]);
      return `<div class="cover-crit-cell"><div class="cl">${label}</div><div class="cv">${n}/10</div></div>`;
    }).join("");
    // Thème du document : suit le thème actif du site (à brancher plus tard). Défaut = N&B.
    const themeClass = theme === "orange" ? "theme-orange" : "";

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Business Plan — ${escape(data.nom)}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:Arial,sans-serif; color:#1a1a1a; background:#fff; font-size:13px; line-height:1.6; word-wrap:break-word; overflow-wrap:break-word; }
  @page { size:A4; margin:0; }
  @media print {
    html, body { margin:0 !important; padding:0 !important; }
    body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .cover { page-break-after:always; break-after:page; }
    .toc { page-break-after:always; break-after:page; }
    .section { page-break-before:always; break-before:page; }
    .point { page-break-inside:avoid; break-inside:avoid; }
    .section-title, .section-intro, .section-num { page-break-after:avoid; break-after:avoid; }
    .section { padding-top:60px; }
  }
  .theme-orange .section-title { border-bottom-color:#ff7a2e; }
  .theme-orange .section-intro { border-left-color:#ff7a2e; }
  .theme-orange .section-num { color:#ff7a2e; }
  .theme-orange .toc-num { color:#ff7a2e; }
  a { color:#0a58ca; word-break:break-all; }

  /* COUVERTURE */
  .cover { position:relative; min-height:297mm; background:#000; color:#fff; display:flex; flex-direction:column; justify-content:space-between; padding:60px; box-sizing:border-box; overflow:hidden; }
  .cover-photo { position:absolute; inset:0; background-image:url('${COVER_IMAGE}'); background-size:cover; background-position:72% center; z-index:0; }
  .cover-veil { position:absolute; inset:0; z-index:1; background:linear-gradient(90deg, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.82) 42%, rgba(0,0,0,0.4) 70%, rgba(0,0,0,0.15) 100%); }
  .cover > div { position:relative; z-index:2; }
  .cover-brand { font-size:15px; font-weight:900; letter-spacing:0.04em; color:#fff; margin-bottom:4px; }
  .cover-brand .s { color:#fff; }
  .cover-label { font-size:10px; font-weight:900; letter-spacing:0.22em; color:rgba(255,255,255,0.55); margin-bottom:18px; }
  .cover-bar { width:42px; height:4px; background:#fff; margin-bottom:44px; }
  .cover-activite { font-size:46px; font-weight:900; letter-spacing:-0.02em; line-height:1.0; margin-bottom:18px; color:#fff; text-transform:uppercase; }
  .cover-now { color:#9a9a9a; font-style:italic; }
  .cover-expl { max-width:480px; color:rgba(255,255,255,0.6); font-size:13px; line-height:1.7; margin-bottom:30px; padding-left:16px; border-left:3px solid rgba(255,255,255,0.25); }
  .cover-crit-lbl { font-size:12px; font-weight:900; letter-spacing:0.04em; color:#fff; margin-bottom:14px; }
  .cover-crit-box { border:1px solid rgba(255,255,255,0.2); border-radius:10px; padding:18px 22px; width:480px; max-width:62%; background:rgba(0,0,0,0.35); margin-bottom:30px; }
  .cover-crit-inner-lbl { font-size:8px; font-weight:900; letter-spacing:0.14em; color:rgba(255,255,255,0.5); margin-bottom:12px; }
  .cover-crit-table { border-collapse:collapse; width:100%; table-layout:fixed; }
  .cover-crit-table td { padding:7px 0; font-size:11px; vertical-align:middle; }
  .cover-crit-table td:first-child { color:rgba(255,255,255,0.75); width:120px; }
  .cover-crit-bar-bg { width:100%; height:5px; background:rgba(255,255,255,0.14); border-radius:3px; }
  .cover-crit-bar { height:5px; border-radius:3px; }
  .cover-crit-table td:last-child { font-weight:900; color:#fff; text-align:right; padding-left:14px; width:42px; }
  .cover-crit-row { display:flex; justify-content:space-between; margin-bottom:26px; gap:0; }
  .cover-crit-cell { flex:1; text-align:center; padding:0 4px; border-left:1px solid rgba(255,255,255,0.18); }
  .cover-crit-cell:first-child { border-left:none; }
  .cover-crit-cell .cl { font-size:8px; font-weight:900; letter-spacing:0.05em; color:rgba(255,255,255,0.6); }
  .cover-crit-cell .cv { font-size:15px; font-weight:900; color:#fff; margin-top:4px; }
  .cover-disclaimer { font-size:10px; color:rgba(255,255,255,0.3); line-height:1.55; max-width:480px; padding-top:18px; border-top:1px solid rgba(255,255,255,0.12); margin-bottom:24px; }
  .cover-footer { display:flex; justify-content:space-between; align-items:flex-end; border-top:1px solid rgba(255,255,255,0.15); padding-top:18px; font-size:11px; color:rgba(255,255,255,0.45); }
  .cover-footer .web { color:#fff; font-weight:900; }

  /* ACCENTS ORANGE (si thème orange) */
  .theme-orange .cover-brand .s { color:#ff7a2e; }
  .theme-orange .cover-bar { background:#ff7a2e; }
  .theme-orange .cover-now { color:#ff7a2e; }
  .theme-orange .cover-crit-box { border-color:#ff7a2e; }
  .theme-orange .cover-crit-cell .cv { color:#ff7a2e; }
  .theme-orange .cover-footer .web { color:#ff7a2e; }
  .theme-orange .cover-footer { border-top-color:rgba(255,122,46,0.5); }

  /* SOMMAIRE */
  .toc { padding:60px; }
  .toc-title { font-size:9px; font-weight:900; letter-spacing:0.25em; color:rgba(0,0,0,0.25); margin-bottom:36px; }
  .toc-item { display:flex; justify-content:space-between; align-items:center; padding:14px 0; border-bottom:1px solid #f0f0f0; }
  .toc-num { font-size:10px; font-weight:900; color:rgba(0,0,0,0.2); min-width:28px; }
  .toc-name { font-size:14px; font-weight:900; flex:1; }
  .toc-pg { font-size:11px; color:rgba(0,0,0,0.3); }

  /* SECTIONS */
  .section { padding:56px 52px; }
  .section-num { font-size:9px; font-weight:900; letter-spacing:0.2em; color:rgba(0,0,0,0.2); margin-bottom:6px; }
  .section-title { font-size:22px; font-weight:900; letter-spacing:-0.01em; border-bottom:3px solid #000; padding-bottom:14px; margin-bottom:20px; }
  .section-intro { font-size:13px; color:rgba(0,0,0,0.55); font-style:italic; line-height:1.6; margin-bottom:28px; border-left:3px solid #000; padding-left:14px; }
  .point { display:flex; flex-wrap:wrap; gap:8px 16px; padding:13px 0; border-bottom:1px solid #f5f5f5; page-break-inside:avoid; }
  .point-label { font-size:12px; font-weight:900; min-width:140px; max-width:180px; color:#000; flex-shrink:0; word-break:break-word; }
  .point-text { font-size:13px; color:rgba(0,0,0,0.65); line-height:1.65; flex:1; min-width:200px; overflow-wrap:break-word; word-break:break-word; }

  /* FOOTER */
  .pg-footer { text-align:center; font-size:9px; color:rgba(0,0,0,0.2); font-weight:900; letter-spacing:0.1em; border-top:1px solid #e5e5e5; padding-top:14px; margin-top:36px; }
</style>
</head>
<body class="${themeClass}">

<div class="cover">
  <div class="cover-photo"></div>
  <div class="cover-veil"></div>
  <div>
    <div class="cover-brand">PLAN<span class="s">START</span></div>
    <div class="cover-label">BUSINESS PLAN PROFESSIONNEL</div>
    <div class="cover-bar"></div>
    <div class="cover-activite">${escape(data.titre || data.nom || data.activite || "Mon projet")}<br><span class="cover-now">Maintenant.</span></div>
    ${data.scoreExplication ? `<div class="cover-expl">${escape(data.scoreExplication)}</div>` : ""}
    ${critHTML ? `<div class="cover-crit-lbl">POTENTIEL DU PROJET</div><div class="cover-crit-box"><div class="cover-crit-inner-lbl">ANALYSE DE TON PROJET</div><table class="cover-crit-table">${critHTML}</table></div>` : ""}
    ${critCellsHTML ? `<div class="cover-crit-row">${critCellsHTML}</div>` : ""}
    <div class="cover-disclaimer">Ce business plan a été généré par intelligence artificielle à partir de tes réponses. Il est fourni à titre indicatif et peut contenir des erreurs ou imprécisions. Les montants chiffrés (loyers, charges, projections) sont des estimations à confirmer auprès de sources officielles avant de te lancer.</div>
  </div>
  <div class="cover-footer">
    <div>Document confidentiel<br>Généré le ${date}</div>
    <div style="text-align:right" class="web">planstart.fr</div>
  </div>
</div>

<div class="toc">
  <div class="toc-title">SOMMAIRE</div>
  ${sections.map((s, i) => `
  <div class="toc-item">
    <span class="toc-num">${String(i + 1).padStart(2, "0")}</span>
    <span class="toc-name">${escape(s.titre)}</span>
    <span class="toc-pg">Page ${i + 3}</span>
  </div>`).join("")}
</div>

${sections.map((s, i) => {
  const points = s.points || [];
  return `
<div class="section">
  <div class="section-num">SECTION ${String(i + 1).padStart(2, "0")} / ${String(sections.length).padStart(2, "0")}</div>
  <div class="section-title">${escape(s.titre)}</div>
  ${s.intro ? `<div class="section-intro">${escape(s.intro)}</div>` : ""}
  ${points.map(p => {
    const m = (p || "").match(/^\*\*(.+?)\*\*\s*:?\s*([\s\S]*)/);
    if (m) return `<div class="point"><div class="point-label">${escape(m[1])}</div><div class="point-text">${linkifyHtml(escape(m[2].replace(/\*\*/g, "")))}</div></div>`;
    return `<div class="point"><div class="point-text">${linkifyHtml(escape(p.replace(/\*\*/g, "")))}</div></div>`;
  }).join("")}
  <div class="pg-footer">PLANSTART — ${escape(data.nom)} — Page ${i + 3}</div>
</div>`;
}).join("")}

</body>
</html>`;

    const filename = `${(data.titre || data.nom || "BusinessPlan").replace(/[^\wÀ-ÿ]+/g, "_").replace(/^_+|_+$/g, "")}_PLANSTART.html`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    if (isIOS) {
      // Sur iOS, Safari ignore l'attribut "download". On ouvre le fichier dans un
      // nouvel onglet : l'utilisateur fait Partager → "Enregistrer dans Fichiers".
      setShowIosHint(true);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return;
    }

    // PC / Android : téléchargement direct du fichier HTML.
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // ─── STYLES ───────────────────────────────────────────────────────────────────

  const sectionPad = isMobile ? "56px 20px" : "96px 60px";

  return (
    <div style={{ background: CREAM, minHeight: "100vh", fontFamily: "'Arial Black', Arial, sans-serif", color: "#000", overflowX: "hidden" }}>
      <style>{`
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(40px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideDown { from{opacity:0;transform:translateY(-20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes barGrow { from{width:0} to{width:100%} }
        @keyframes scaleIn { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }
        @keyframes pulse2 { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes spinQ { to{transform:rotate(360deg)} }
        * { box-sizing:border-box; margin:0; padding:0; }
        textarea,input { outline:none; }
        button { cursor:pointer; font-family:'Arial Black',Arial,sans-serif; }
        ::placeholder { color:rgba(255,255,255,0.3); font-family:Arial,sans-serif; font-weight:400; }
        .input-light::placeholder { color:rgba(0,0,0,0.3); }
        .example-pill:hover { border-color:#fff!important; color:#fff!important; }
      `}</style>

      {/* ── INTRO ── */}
      {screen === "intro" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${IMAGES[0]})`, backgroundSize: "cover", backgroundPosition: "center", opacity: introStep >= 1 ? 1 : 0, transition: "opacity 1.2s ease", filter: "brightness(0.35)" }} />
          <div style={{ position: "relative", textAlign: "center", padding: "0 32px" }}>
            <div style={{ fontSize: isMobile ? "clamp(64px,18vw,100px)" : "clamp(80px,12vw,140px)", fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", lineHeight: 0.85, marginBottom: 32 }}>
              {introLetters.slice(0, 4)}{introLetters.length > 4 && <br />}{introLetters.slice(4)}
            </div>
            <div style={{ marginBottom: 48 }}>
              {[{ text: "TON IDÉE MÉRITE D'EXISTER.", step: 2 }, { text: "ON T'AIDE À LA STRUCTURER.", step: 3 }].map((line, i) => (
                <div key={i} style={{ fontSize: isMobile ? 13 : 15, color: "rgba(255,255,255,0.75)", fontWeight: 900, letterSpacing: "0.08em", marginBottom: 8, opacity: introStep >= line.step ? 1 : 0, transform: introStep >= line.step ? "translateY(0)" : "translateY(10px)", transition: `all 0.6s ease ${i * 0.2}s` }}>{line.text}</div>
              ))}
            </div>
            <button onClick={() => setScreen("home")} style={{ opacity: introStep >= 4 ? 1 : 0, transform: introStep >= 4 ? "translateY(0)" : "translateY(10px)", transition: "all 0.6s ease", background: "#fff", color: "#000", border: "none", padding: isMobile ? "16px 48px" : "18px 56px", fontSize: 13, fontWeight: 900, letterSpacing: "0.15em" }}>ENTRER →</button>
          </div>
        </div>
      )}

      {/* ── NAV ── */}
      {screen !== "intro" && (
        <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: screen === "quiz" ? "rgba(0,0,0,0.95)" : "rgba(250,248,245,0.97)", backdropFilter: "blur(10px)", borderBottom: `1px solid ${screen === "quiz" ? "rgba(255,255,255,0.1)" : "#ebe7e0"}`, padding: `0 ${isMobile ? "20px" : "60px"}`, height: 60, display: "flex", justifyContent: "space-between", alignItems: "center", animation: "fadeIn 0.4s ease both" }}>
          <button onClick={restart} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: screen === "quiz" ? "#fff" : "#000", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ color: screen === "quiz" ? "#000" : "#fff", fontSize: 11, fontWeight: 900 }}>PS</span>
            </div>
            <span style={{ fontSize: isMobile ? 15 : 18, fontWeight: 900, color: screen === "quiz" ? "#fff" : "#000" }}>PLAN<span style={{ color: isOrange ? "#ff7a2e" : (screen === "quiz" ? "#fff" : "#000") }}>START</span></span>
          </button>
          {screen !== "quiz" && (
            <div style={{ display: "flex", gap: isMobile ? 12 : 32, alignItems: "center" }}>
              <a href="#comment" style={{ fontSize: isMobile ? 10 : 11, fontWeight: 900, letterSpacing: "0.08em", color: "rgba(0,0,0,0.5)", textDecoration: "none", whiteSpace: "nowrap" }}>COMMENT ÇA MARCHE</a>
              <a href="#apropos" style={{ fontSize: isMobile ? 10 : 11, fontWeight: 900, letterSpacing: "0.08em", color: "rgba(0,0,0,0.5)", textDecoration: "none", whiteSpace: "nowrap" }}>À PROPOS</a>
            </div>
          )}
        </nav>
      )}

      {/* ── HOME ── */}
      {screen === "home" && (
        <div style={{ animation: "fadeIn 0.5s ease both" }}>

          {/* SWITCH DE THÈME — flottant en bas, home uniquement */}
          <div style={{ position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)", zIndex: 200, display: "flex", gap: 6, background: "rgba(20,20,22,0.92)", backdropFilter: "blur(8px)", padding: 6, borderRadius: 40, border: "1px solid rgba(255,255,255,0.15)", boxShadow: "0 8px 30px rgba(0,0,0,0.4)" }}>
            <button onClick={() => setTheme("bw")} style={{ fontFamily: "Arial, sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: "0.05em", padding: "10px 16px", borderRadius: 30, border: "none", background: !isOrange ? "#fff" : "transparent", color: !isOrange ? "#000" : "#fff", whiteSpace: "nowrap" }}>NOIR / BLANC</button>
            <button onClick={() => setTheme("orange")} style={{ fontFamily: "Arial, sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: "0.05em", padding: "10px 16px", borderRadius: 30, border: "none", background: isOrange ? "linear-gradient(90deg,#ff9d3d,#ff5e3a)" : "transparent", color: "#fff", whiteSpace: "nowrap" }}>ORANGE / NOIR</button>
          </div>

          {/* HERO */}
          <div style={{ height: "100vh", position: "relative", overflow: "hidden" }}>
            {IMAGES.map((img, i) => (
              <div key={i} style={{ position: "absolute", inset: 0, backgroundImage: `url(${img})`, backgroundSize: "cover", backgroundPosition: "center", opacity: i === slideIndex ? 1 : 0, transition: "opacity 1.5s ease" }} />
            ))}
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.52)" }} />
            <div style={{ position: "absolute", inset: 0, zIndex: 2, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", padding: isMobile ? "80px 24px 40px" : "100px 60px 60px", animation: "slideUp 0.8s ease 0.2s both" }}>
              <div style={{ fontSize: isMobile ? 12 : 14, color: "rgba(255,255,255,0.7)", fontWeight: 900, letterSpacing: "0.06em", marginBottom: 18, fontFamily: "Arial, sans-serif" }}>Ton idée mérite d'exister. On t'aide à la structurer.</div>
              <h1 style={{ fontSize: isMobile ? "clamp(44px,13vw,72px)" : "clamp(72px,9vw,120px)", fontWeight: 900, lineHeight: 0.9, letterSpacing: "-0.03em", color: "#fff", marginBottom: 20, textTransform: "uppercase" }}>
                TON PROJET.<br />TON PLAN.<br /><span style={{ color: NOW_COLOR, fontStyle: "italic" }}>MAINTENANT.</span>
              </h1>
              <p style={{ fontSize: isMobile ? 14 : 16, color: "rgba(255,255,255,0.6)", fontWeight: 400, marginBottom: 36, fontFamily: "Arial, sans-serif", maxWidth: 500 }}>Tu as une idée d'entreprise ? Réponds à 10 questions et obtiens un business plan personnalisé en quelques minutes. Gratuit et sans compte.</p>
              <button onClick={() => setScreen("quiz")} style={{ background: ACCENT_GRAD, color: isOrange ? "#fff" : "#000", border: "none", padding: isMobile ? "16px 40px" : "18px 48px", fontSize: 13, fontWeight: 900, letterSpacing: "0.12em", borderRadius: 14, boxShadow: isOrange ? "0 10px 30px rgba(255,94,58,0.35)" : "none" }}>CRÉER MON PLAN →</button>
            </div>
            <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 8, zIndex: 1 }}>
              {IMAGES.map((_, i) => (<div key={i} onClick={() => setSlideIndex(i)} style={{ width: i === slideIndex ? 32 : 8, height: 2, background: i === slideIndex ? (isOrange ? "#ff7a2e" : "#fff") : "rgba(255,255,255,0.3)", cursor: "pointer", transition: "all 0.4s ease" }} />))}
            </div>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "rgba(255,255,255,0.1)", zIndex: 1 }}>
              <div key={slideIndex} style={{ height: "100%", background: isOrange ? "#ff7a2e" : "#fff", animation: "barGrow 5s linear both" }} />
            </div>
          </div>

          {/* STATS */}
          <div style={{ display: "flex", borderBottom: "2px solid #000", borderTop: "2px solid #000" }}>
            {[{ n: "SIMPLE ET RAPIDE", label: "Pour structurer ton projet" }, { n: "10 QUESTIONS", label: "Personnalisées pour toi" }, { n: "SANS COMPTE", label: "Aucune inscription" }].map((s, i) => (
              <div key={i} style={{ flex: 1, padding: isMobile ? "20px 12px" : "32px 40px", borderRight: i < 2 ? "2px solid #000" : "none" }}>
                <div style={{ fontSize: isMobile ? "clamp(11px,3vw,16px)" : "clamp(16px,2vw,22px)", fontWeight: 900 }}>{s.n}</div>
                <div style={{ fontSize: isMobile ? 10 : 12, color: "rgba(0,0,0,0.45)", marginTop: 4, fontFamily: "Arial, sans-serif" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* CE QUE TU OBTIENS */}
          <div style={{ borderTop: "2px solid #000" }}>
            {isMobile ? (
              <div>
                <div style={{ height: 220, backgroundImage: "url(https://images.unsplash.com/photo-1664575602276-acd073f104c1?w=800&q=80)", backgroundSize: "cover", backgroundPosition: "center" }} />
                <div style={{ background: "#000", color: "#fff", padding: "48px 20px" }}>
                  <div style={{ fontSize: 13, letterSpacing: "0.2em", color: isOrange ? "#ff7a2e" : "rgba(255,255,255,0.5)", marginBottom: 32, fontWeight: 900 }}>CE QUE TU OBTIENS</div>
                  {["ANALYSE DE MARCHÉ", "PROJECTIONS FINANCIÈRES", "STRATÉGIE MARKETING", "PLAN D'ACTION 90 JOURS", "DÉMARCHES LÉGALES", "GESTION DES RISQUES"].map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                      <span style={{ fontSize: 13, color: isOrange ? "#ff7a2e" : "#fff", minWidth: 28, fontWeight: 900, opacity: isOrange ? 1 : 0.4 }}>{String(i + 1).padStart(2, "0")}</span>
                      <span style={{ fontSize: 14, fontWeight: 900 }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: 500 }}>
                <div style={{ backgroundImage: "url(https://images.unsplash.com/photo-1664575602276-acd073f104c1?w=800&q=80)", backgroundSize: "cover", backgroundPosition: "center" }} />
                <div style={{ background: "#000", color: "#fff", padding: "60px 48px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <div style={{ fontSize: 13, letterSpacing: "0.2em", color: isOrange ? "#ff7a2e" : "rgba(255,255,255,0.5)", marginBottom: 36, fontWeight: 900 }}>CE QUE TU OBTIENS</div>
                  {["ANALYSE DE MARCHÉ", "PROJECTIONS FINANCIÈRES", "STRATÉGIE MARKETING", "PLAN D'ACTION 90 JOURS", "DÉMARCHES LÉGALES", "GESTION DES RISQUES"].map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 20, padding: "16px 0", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                      <span style={{ fontSize: 13, color: isOrange ? "#ff7a2e" : "#fff", minWidth: 32, fontWeight: 900, opacity: isOrange ? 1 : 0.4 }}>{String(i + 1).padStart(2, "0")}</span>
                      <span style={{ fontSize: 15, fontWeight: 900 }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* POUR QUI */}
          <div style={{ background: CREAM, padding: sectionPad, borderTop: "2px solid #000" }}>
            <div style={{ maxWidth: 900, margin: "0 auto" }}>
              <div style={{ fontSize: 13, letterSpacing: "0.2em", color: isOrange ? "#ff7a2e" : "#000", marginBottom: 40, fontWeight: 900 }}>FAIT POUR TOI SI —</div>
              {["TU AS UNE IDÉE MAIS TU NE SAIS PAS PAR OÙ COMMENCER", "TU VEUX SAVOIR SI TON IDÉE EST VIABLE", "TU VEUX STRUCTURER TON PROJET RAPIDEMENT", "TU VEUX TE METTRE À TON COMPTE", "TU VEUX CRÉER TON ENTREPRISE AVEC UN PLAN CLAIR", "TU CHERCHES UN BUSINESS PLAN SIMPLE ET PERSONNALISÉ"].map((item, i) => (
                <div key={i} style={{ borderBottom: "1px solid #e5e5e5", padding: "20px 0", display: "flex", alignItems: "flex-start", gap: 20 }}>
                  <span style={{ fontSize: 13, color: isOrange ? "#ff7a2e" : "#000", minWidth: 30, fontWeight: 900, paddingTop: 2, opacity: isOrange ? 1 : 0.4 }}>{String(i + 1).padStart(2, "0")}</span>
                  <span style={{ fontSize: isMobile ? 15 : 20, fontWeight: 900, lineHeight: 1.3 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* COMMENT ÇA MARCHE */}
          <div id="comment" style={{ background: CREAM_ALT, padding: sectionPad, borderTop: "2px solid #000" }}>
            <div style={{ maxWidth: 900, margin: "0 auto" }}>
              <div style={{ fontSize: 13, letterSpacing: "0.2em", color: isOrange ? "#ff7a2e" : "#000", marginBottom: 48, fontWeight: 900 }}>COMMENT ÇA MARCHE</div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: isMobile ? 32 : 2 }}>
                {[
                  { n: "01", titre: "TU RÉPONDS", desc: "Réponds à 10 questions simples sur ton projet, ton expérience et tes objectifs. Chaque question s'adapte à tes réponses pour comprendre précisément ton idée." },
                  { n: "02", titre: "ON CONSTRUIT TON PLAN", desc: "À partir de tes réponses, notre IA structure ton projet et génère une analyse complète : marché, stratégie, finances, plan d'action et démarches essentielles." },
                  { n: "03", titre: "TU TÉLÉCHARGES", desc: "Récupère un business plan complet, personnalisé et prêt à t'aider à lancer ton activité." },
                ].map((step, i) => (
                  <div key={i} style={{ padding: isMobile ? "0" : "0 40px 0 0", borderRight: !isMobile && i < 2 ? "1px solid #e5e5e5" : "none" }}>
                    <div style={{ fontSize: 48, fontWeight: 900, color: isOrange ? "#ff7a2e" : "#e5e5e5", lineHeight: 1, marginBottom: 16, opacity: isOrange ? 0.9 : 1 }}>{step.n}</div>
                    <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 12 }}>{step.titre}</div>
                    <div style={{ fontSize: 14, color: "rgba(0,0,0,0.5)", lineHeight: 1.7, fontFamily: "Arial, sans-serif" }}>{step.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* REJOINS LES PREMIERS UTILISATEURS */}
          <div style={{ background: "#000", padding: sectionPad, borderTop: "2px solid #000", textAlign: "center" }}>
            <div style={{ maxWidth: 600, margin: "0 auto" }}>
              <div style={{ fontSize: 13, letterSpacing: "0.2em", color: isOrange ? "#ff7a2e" : "rgba(255,255,255,0.4)", marginBottom: 24, fontWeight: 900 }}>REJOINS LES PREMIERS UTILISATEURS</div>
              <h2 style={{ fontSize: isMobile ? 28 : 40, fontWeight: 900, color: "#fff", lineHeight: 1.1, marginBottom: 20, letterSpacing: "-0.02em" }}>
                ACCÈDE GRATUITEMENT, PARTAGE TON AVIS, INFLUENCE LA SUITE !
              </h2>
              <p style={{ fontSize: 16, color: "rgba(255,255,255,0.5)", fontFamily: "Arial, sans-serif", lineHeight: 1.7, marginBottom: 40 }}>
                Génère ton business plan gratuitement et aide-nous à améliorer la plateforme. Ton avis nous aidera à rendre l'outil encore plus utile.
              </p>
              <button onClick={() => setScreen("quiz")} style={{ background: isOrange ? "linear-gradient(90deg,#ff9d3d,#ff5e3a)" : "#fff", color: isOrange ? "#fff" : "#000", border: "none", padding: isMobile ? "16px 40px" : "18px 48px", fontSize: 13, fontWeight: 900, letterSpacing: "0.12em", borderRadius: 14 }}>
                CRÉER MON PLAN →
              </button>
            </div>
          </div>

          {/* À PROPOS */}
          <div id="apropos" style={{ background: CREAM_ALT, padding: sectionPad, borderTop: "2px solid #000" }}>
            <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 32 : 80, alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, letterSpacing: "0.2em", color: isOrange ? "#ff7a2e" : "#000", marginBottom: 32, fontWeight: 900 }}>À PROPOS</div>
                <h2 style={{ fontSize: isMobile ? 24 : 32, fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: 20 }}>PLANSTART C'EST POUR CEUX QUI PASSENT À L'ACTION.</h2>
                <p style={{ fontSize: 15, color: "rgba(0,0,0,0.6)", lineHeight: 1.7, fontFamily: "Arial, sans-serif", marginBottom: 16 }}>J'ai créé PLANSTART parce que beaucoup de personnes ont une idée de projet mais ne savent pas comment la transformer en quelque chose de concret.</p>
                <p style={{ fontSize: 15, color: "rgba(0,0,0,0.6)", lineHeight: 1.7, fontFamily: "Arial, sans-serif" }}>L'objectif est simple : rendre la création d'entreprise plus accessible en permettant à chacun d'obtenir un business plan structuré, sans connaissances particulières et sans dépenser des milliers d'euros.</p>
              </div>
              <div style={{ background: "#000", padding: "40px 32px" }}>
                {[{ n: "100% GRATUIT", label: "" }, { n: "7 SECTIONS", label: "" }, { n: "10 QUESTIONS", label: "" }].map((stat, i) => (
                  <div key={i} style={{ padding: "18px 0", borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.1)" : "none" }}>
                    <div style={{ fontSize: isMobile ? 20 : 32, fontWeight: 900, color: isOrange ? "#ff7a2e" : "#fff", lineHeight: 1 }}>{stat.n}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "Arial, sans-serif", marginTop: 4, letterSpacing: "0.05em" }}>{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CTA FINAL */}
          <div style={{ background: "#000", padding: isMobile ? "80px 24px" : "120px 60px", textAlign: "center" }}>
            <h2 style={{ fontSize: isMobile ? "clamp(48px,14vw,80px)" : "clamp(64px,10vw,110px)", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 0.9, marginBottom: 40, color: "#fff", textTransform: "uppercase" }}>
              PRÊT À<br /><span style={{ color: isOrange ? "#ff7a2e" : "rgba(255,255,255,0.2)" }}>TE LANCER ?</span>
            </h2>
            <button onClick={() => setScreen("quiz")} style={{ background: isOrange ? "linear-gradient(90deg,#ff9d3d,#ff5e3a)" : "#fff", color: isOrange ? "#fff" : "#000", border: "none", padding: isMobile ? "16px 40px" : "20px 60px", fontSize: isMobile ? 13 : 14, fontWeight: 900, letterSpacing: "0.15em", borderRadius: 14 }}>C'EST PARTI →</button>
          </div>

          {/* FOOTER LÉGAL */}
          <div style={{ background: CREAM, borderTop: "1px solid #ebe7e0", padding: isMobile ? "24px 20px" : "24px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <span style={{ fontSize: 11, color: "rgba(0,0,0,0.3)", fontFamily: "Arial, sans-serif" }}>© 2025-2026 PLANSTART — Tous droits réservés</span>
            <div style={{ display: "flex", gap: 24 }}>
              {[["Mentions légales", "/mentions-legales"], ["Confidentialité", "/confidentialite"], ["CGU", "/cgu"]].map(([label, href]) => (
                <a key={href} href={href} style={{ fontSize: 11, color: "rgba(0,0,0,0.4)", textDecoration: "none", fontFamily: "Arial, sans-serif" }}>{label}</a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── QUIZ ── */}
      {screen === "quiz" && (
        <div style={{ minHeight: "100vh", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "fixed", inset: 0, background: "#0a0a0a" }} />
          <div style={{ position: "fixed", inset: 0, backgroundImage: `url(${IMAGES[1]})`, backgroundSize: "cover", backgroundPosition: "center", opacity: 0.08 }} />

          {blocTransition && (
            <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn 0.3s ease both" }}>
              <div style={{ textAlign: "center", animation: "scaleIn 0.5s ease both" }}>
                <div style={{ fontSize: 10, letterSpacing: "0.3em", color: isOrange ? "#ff7a2e" : "rgba(255,255,255,0.3)", marginBottom: 16, fontWeight: 900 }}>PARTIE SUIVANTE</div>
                <div style={{ fontSize: isMobile ? "clamp(40px,12vw,72px)" : "clamp(56px,8vw,96px)", fontWeight: 900, color: "#fff" }}>{showBloc}</div>
                <div style={{ width: 60, height: 4, background: isOrange ? "#ff7a2e" : "#fff", margin: "20px auto 0", borderRadius: 2 }} />
              </div>
            </div>
          )}

          <div style={{ position: "relative", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", padding: isMobile ? "90px 24px 60px" : "100px 60px 60px", maxWidth: 720, margin: "0 auto", animation: "slideUp 0.5s ease both" }}>

            {/* Blocs + Progress */}
            <div style={{ marginBottom: 48 }}>
              <div style={{ display: "flex", gap: isMobile ? 6 : 12, marginBottom: 16 }}>
                {["TON PROJET", "TOI", "TON MARCHÉ", "TON AMBITION"].map((bloc, i) => {
                  const currentBlocIndex = ["TON PROJET", "TOI", "TON MARCHÉ", "TON AMBITION"].indexOf(questions[qIndex]?.bloc || "TON PROJET");
                  const isActive = i === currentBlocIndex;
                  const isDone = i < currentBlocIndex;
                  return (
                    <div key={i} style={{ flex: 1 }}>
                      <div style={{ height: 3, background: isActive ? ACCENT_ON_DARK : isDone ? (isOrange ? "rgba(255,122,46,0.55)" : "rgba(255,255,255,0.6)") : "rgba(255,255,255,0.15)", marginBottom: 8, borderRadius: 2, transition: "background 0.3s" }} />
                      <div style={{ fontSize: isMobile ? 7 : 9, color: isActive ? "#fff" : isDone ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)", fontWeight: 900, letterSpacing: "0.08em" }}>{bloc}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.15em", color: isOrange ? "#ff7a2e" : "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.1)", padding: "4px 12px", borderRadius: 20 }}>
                  {questions[qIndex]?.label || "01"} / 10
                </span>
                <span style={{ fontSize: 12, fontWeight: 900, color: isOrange ? "#ff7a2e" : "rgba(255,255,255,0.4)" }}>
                  {Math.round(((qIndex + 1) / TOTAL_QUESTIONS) * 100)}%
                </span>
              </div>
            </div>

            {/* Question */}
            <h2 style={{ fontSize: isMobile ? "20px" : "28px", fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.4, marginBottom: 32, color: "#fff", maxWidth: 650, animation: "slideDown 0.4s ease both" }}>
              {questions[qIndex]?.question || "Chargement..."}
            </h2>

            {/* Exemples cliquables — restent visibles même quand on écrit */}
            {questions[qIndex]?.examples?.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                {questions[qIndex].examples.slice(0, 4).map((ex, i) => {
                  const isPicked = current.toLowerCase().includes(ex.toLowerCase());
                  return (
                    <button key={i} className="example-pill" onClick={() => {
                      // Ajoute l'exemple à la réponse au lieu de l'écraser (permet d'en combiner)
                      setCurrent(prev => {
                        const base = prev.trim();
                        if (!base) return ex;
                        if (base.toLowerCase().includes(ex.toLowerCase())) return base;
                        return base + ", " + ex.charAt(0).toLowerCase() + ex.slice(1);
                      });
                      if (inputRef.current) inputRef.current.focus();
                    }} style={{ background: isPicked ? (isOrange ? "rgba(255,122,46,0.25)" : "rgba(255,255,255,0.25)") : "rgba(255,255,255,0.08)", border: `1px solid ${isPicked ? (isOrange ? "#ff7a2e" : "#fff") : "rgba(255,255,255,0.2)"}`, color: isPicked ? "#fff" : "rgba(255,255,255,0.7)", padding: "8px 16px", fontSize: 12, fontFamily: "Arial, sans-serif", borderRadius: 20, transition: "all 0.2s", cursor: "pointer" }}>
                      <span style={{ color: isOrange ? "#ff7a2e" : "inherit", fontWeight: 900 }}>{isPicked ? "✓" : "+"}</span> {ex}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Zone de saisie */}
            <div style={{ background: "rgba(255,255,255,0.08)", border: "2px solid rgba(255,255,255,0.2)", borderRadius: 4, padding: "20px", marginBottom: 16 }}>
              <textarea
                ref={inputRef}
                value={current}
                onChange={e => setCurrent(e.target.value.slice(0, MAX_INPUT_LENGTH))}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && current.trim() && !loadingQuestion) { e.preventDefault(); handleNext(); } }}
                placeholder={questions[qIndex]?.placeholder || "Décris ta réponse..."}
                rows={2}
                style={{ width: "100%", background: "transparent", border: "none", fontSize: 16, fontFamily: "Arial, sans-serif", color: "#fff", resize: "none", lineHeight: 1.6 }}
              />
              <div style={{ textAlign: "right", fontSize: 10, color: current.length > MAX_INPUT_LENGTH * 0.8 ? "rgba(255,200,100,0.7)" : "rgba(255,255,255,0.2)", marginTop: 4 }}>
                {current.length}/{MAX_INPUT_LENGTH}
              </div>
            </div>

            {/* Encourage des réponses détaillées */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, fontSize: isMobile ? 11 : 12, color: "rgba(255,255,255,0.45)", fontFamily: "Arial, sans-serif", lineHeight: 1.5 }}>
              <span style={{ fontSize: 13, flexShrink: 0, color: isOrange ? "#ff7a2e" : "inherit" }}>✦</span>
              <span>Plus ta réponse est précise et détaillée, plus ton business plan sera personnalisé et pertinent.</span>
            </div>

            {/* Loading question */}
            {loadingQuestion && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, color: "rgba(255,255,255,0.5)" }}>
                <div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.2)", borderTop: "2px solid #fff", borderRadius: "50%", animation: "spinQ 0.8s linear infinite", flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.08em" }}>ANALYSE DE TA RÉPONSE...</span>
              </div>
            )}

            {/* Boutons */}
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={handleBack} style={{ flex: 1, background: "rgba(255,255,255,0.08)", border: `2px solid ${isOrange ? "rgba(255,122,46,0.6)" : "rgba(255,255,255,0.2)"}`, color: isOrange ? "#ff7a2e" : "#fff", fontSize: 12, fontWeight: 900, letterSpacing: "0.12em", padding: "16px", borderRadius: 10, cursor: "pointer" }}>← RETOUR</button>
              <button onClick={handleNext} disabled={!current.trim() || loadingQuestion} style={{ flex: 2, background: current.trim() && !loadingQuestion ? (isOrange ? "linear-gradient(90deg,#ff9d3d,#ff5e3a)" : "#fff") : "rgba(255,255,255,0.08)", border: `2px solid ${current.trim() && !loadingQuestion ? (isOrange ? "transparent" : "#fff") : "rgba(255,255,255,0.2)"}`, color: current.trim() && !loadingQuestion ? (isOrange ? "#fff" : "#000") : "rgba(255,255,255,0.3)", fontSize: 12, fontWeight: 900, letterSpacing: "0.12em", padding: "16px", borderRadius: 10, transition: "all 0.2s", cursor: current.trim() && !loadingQuestion ? "pointer" : "not-allowed" }}>
                {loadingQuestion ? "..." : qIndex === TOTAL_QUESTIONS - 1 ? "GÉNÉRER MON PLAN →" : "SUIVANT →"}
              </button>
            </div>

            {!isMobile && <p style={{ marginTop: 12, fontSize: 10, color: "rgba(255,255,255,0.2)", textAlign: "right", letterSpacing: "0.05em" }}>ENTRÉE POUR CONTINUER</p>}
          </div>
        </div>
      )}

      {/* ── RESULT ── */}
      {screen === "result" && (
        <div style={{ animation: "fadeIn 0.6s ease both" }}>

          {loading && <LoadingScreen isOrange={isOrange} />}

          {!loading && error && (
            <div style={{ minHeight: "100vh", background: "#000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 40px" }}>
              <div style={{ fontSize: 40, marginBottom: 24 }}>⚠️</div>
              <h2 style={{ color: "#fff", fontWeight: 900, fontSize: 24, marginBottom: 16 }}>Une erreur est survenue</h2>
              <p style={{ color: "rgba(255,255,255,0.5)", fontFamily: "Arial, sans-serif", marginBottom: 32, maxWidth: 400 }}>{error}</p>
              <button onClick={restart} style={{ background: "#fff", color: "#000", border: "none", padding: "16px 40px", fontSize: 13, fontWeight: 900, letterSpacing: "0.1em" }}>← RECOMMENCER</button>
            </div>
          )}

          {!loading && result && (
            <>
              {/* Header résultat — cover (identique à la maquette) */}
              <div style={{ position: "relative", background: "#000", padding: isMobile ? "92px 22px 44px" : "110px 60px 56px", overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${COVER_IMAGE})`, backgroundSize: "cover", backgroundPosition: "72% center" }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.82) 45%, rgba(0,0,0,0.45) 72%, rgba(0,0,0,0.2) 100%)" }} />
                <div style={{ position: "relative", zIndex: 2, maxWidth: 900, margin: "0 auto" }}>

                  {/* En-tête marque */}
                  <div style={{ fontSize: isMobile ? 15 : 18, fontWeight: 900, letterSpacing: "0.04em", color: "#fff" }}>PLAN<span style={{ color: isOrange ? "#ff7a2e" : "#fff" }}>START</span></div>
                  <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.22em", color: "rgba(255,255,255,0.55)", marginTop: 4 }}>BUSINESS PLAN PROFESSIONNEL</div>
                  <div style={{ width: 42, height: 4, background: isOrange ? "#ff7a2e" : "#fff", margin: "18px 0 32px" }} />

                  {/* Titre projet + Maintenant */}
                  <h1 style={{ fontSize: isMobile ? "clamp(34px,10vw,52px)" : "clamp(48px,6vw,72px)", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 0.98, color: "#fff", marginBottom: 16, textTransform: "uppercase" }}>
                    {result.titre || result.nom || result.activite || "Ton business plan"}<br />
                    <span style={{ color: isOrange ? "#ff7a2e" : "rgba(255,255,255,0.4)", fontStyle: "italic" }}>Maintenant.</span>
                  </h1>

                  {result.scoreExplication && (
                    <div style={{ maxWidth: 540, margin: "0 0 30px", padding: "14px 20px", borderLeft: `3px solid ${isOrange ? "#ff7a2e" : "rgba(255,255,255,0.25)"}` }}>
                      <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 14, fontFamily: "Arial, sans-serif", lineHeight: 1.6 }}>{result.scoreExplication}</p>
                    </div>
                  )}

                  {result.scoreCriteres && result.scoreCriteres.length > 0 && (() => {
                    const CRIT_FR = { Experience: "Expérience", Marche: "Marché", Differenciation: "Différenciation", Budget: "Budget", Clarte: "Clarté", Timing: "Timing" };
                    const parsed = result.scoreCriteres.map(c => {
                      const m = c.match(/^(.+?):\s*(\d+)\/10/);
                      if (!m) return null;
                      return { label: CRIT_FR[m[1].trim()] || m[1].trim(), note: parseInt(m[2]) };
                    }).filter(Boolean);
                    return (
                      <>
                        <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.04em", color: "#fff", marginBottom: 14 }}>POTENTIEL DU PROJET</div>
                        <div style={{ maxWidth: 540, background: "rgba(0,0,0,0.4)", border: `1px solid ${isOrange ? "#ff7a2e" : "rgba(255,255,255,0.2)"}`, padding: isMobile ? "16px 18px" : "20px 24px", borderRadius: 10, marginBottom: 28 }}>
                          <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.14em", color: "rgba(255,255,255,0.5)", marginBottom: 14 }}>ANALYSE DE TON PROJET</div>
                          {parsed.map((c, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "7px 0" }}>
                              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", minWidth: 110, fontFamily: "Arial, sans-serif" }}>{c.label}</span>
                              <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,0.14)", borderRadius: 3 }}>
                                <div style={{ height: "100%", width: `${c.note * 10}%`, background: c.note >= 7 ? "#4ade80" : c.note >= 5 ? "#facc15" : "#f87171", borderRadius: 3 }} />
                              </div>
                              <span style={{ fontSize: 11, fontWeight: 900, color: "#fff", minWidth: 32, textAlign: "right" }}>{c.note}/10</span>
                            </div>
                          ))}
                        </div>

                        {/* Ligne des 6 critères en cellules */}
                        <div style={{ display: "flex", justifyContent: "space-between", maxWidth: 600, marginBottom: 28, flexWrap: isMobile ? "wrap" : "nowrap", gap: isMobile ? 12 : 0 }}>
                          {parsed.map((c, i) => (
                            <div key={i} style={{ flex: isMobile ? "0 0 30%" : 1, textAlign: "center", padding: "0 4px", borderLeft: !isMobile && i > 0 ? "1px solid rgba(255,255,255,0.18)" : "none" }}>
                              <div style={{ fontSize: 8, fontWeight: 900, letterSpacing: "0.05em", color: "rgba(255,255,255,0.6)", textTransform: "uppercase" }}>{c.label}</div>
                              <div style={{ fontSize: 15, fontWeight: 900, color: isOrange ? "#ff7a2e" : "#fff", marginTop: 4 }}>{c.note}/10</div>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}

                  <div style={{ maxWidth: 540, padding: "16px 0 0", borderTop: `1px solid ${isOrange ? "rgba(255,122,46,0.4)" : "rgba(255,255,255,0.1)"}` }}>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "Arial, sans-serif", lineHeight: 1.55 }}>
                      Ce plan est généré par IA à titre indicatif. Les montants chiffrés sont des estimations à confirmer auprès de sources officielles avant de te lancer.
                    </p>
                  </div>
                </div>
              </div>

              {/* Sections */}
              <div style={{ maxWidth: 800, margin: "0 auto", padding: isMobile ? "32px 16px 60px" : "48px 40px 80px", background: CREAM_ALT }}>
                {(result.sections || []).map((s, i) => (
                  <div key={i} style={{ background: "#fffefb", borderRadius: 6, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", padding: isMobile ? "28px 22px" : "48px 44px", marginBottom: isMobile ? 20 : 28 }}>
                    <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.2em", color: isOrange ? "#ff7a2e" : "rgba(0,0,0,0.3)", marginBottom: 10 }}>SECTION {String(i + 1).padStart(2, "0")} / {String((result.sections || []).length).padStart(2, "0")}</div>
                    <div style={{ display: "flex", gap: 16, marginBottom: 16, alignItems: "baseline", borderBottom: `3px solid ${isOrange ? "#ff7a2e" : "#000"}`, paddingBottom: 14 }}>
                      <span style={{ fontSize: 13, fontWeight: 900, color: isOrange ? "#ff7a2e" : "rgba(0,0,0,0.25)", minWidth: 24 }}>{String(i + 1).padStart(2, "0")}</span>
                      <h3 style={{ fontSize: isMobile ? 17 : 22, fontWeight: 900, letterSpacing: "-0.01em" }}>{s.titre}</h3>
                    </div>
                    {s.intro && (
                      <p style={{ fontSize: 14, color: "rgba(0,0,0,0.5)", fontStyle: "italic", lineHeight: 1.6, marginBottom: 20, paddingLeft: 16, borderLeft: `3px solid ${isOrange ? "#ff7a2e" : "#000"}` }}>{s.intro}</p>
                    )}
                    <div style={{ paddingLeft: 0 }}>
                      {(s.points || []).map((point, j) => {
                        const m = (point || "").match(/^\*\*(.+?)\*\*\s*:?\s*([\s\S]*)/);
                        return (
                          <div key={j} style={{ display: "flex", padding: "12px 0", borderBottom: "1px solid #f5f5f5", flexDirection: isMobile && m ? "column" : "row", gap: isMobile && m ? 4 : 16 }}>
                            {m ? (
                              <>
                                <span style={{ fontSize: 13, fontWeight: 900, minWidth: isMobile ? "auto" : 180, color: "#000", flexShrink: 0 }}>{m[1]}</span>
                                <span style={{ fontSize: 14, color: "rgba(0,0,0,0.65)", lineHeight: 1.65, fontFamily: "Arial, sans-serif" }}>{linkify(m[2].replace(/\*\*/g, ""))}</span>
                              </>
                            ) : (
                              <span style={{ fontSize: 14, color: "rgba(0,0,0,0.65)", lineHeight: 1.65, fontFamily: "Arial, sans-serif" }}>{linkify(point.replace(/\*\*/g, ""))}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* CTA PDF */}
                <div style={{ marginTop: 48, padding: isMobile ? 24 : 40, background: "#000", textAlign: "center" }}>
                  <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.2em", color: "rgba(255,255,255,0.4)", marginBottom: 16 }}>BUSINESS PLAN COMPLET</p>
                  <h3 style={{ fontSize: isMobile ? 18 : 24, fontWeight: 900, color: "#fff", marginBottom: 12, lineHeight: 1.2 }}>TÉLÉCHARGER MON PLAN</h3>
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 28, fontFamily: "Arial, sans-serif" }}>
                    Analyse de marché · Modèle économique · Plan marketing · Plan d'action
                  </p>
                  <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                    <button onClick={() => downloadPDF(result)} style={{ background: "#fff", color: "#000", border: "none", padding: isMobile ? "14px 28px" : "16px 40px", fontSize: 13, fontWeight: 900, letterSpacing: "0.1em", cursor: "pointer" }}>
                      ↓ TÉLÉCHARGER MON PLAN
                    </button>
                  </div>
                  {showIosHint && (
                    <div style={{ marginTop: 20, padding: "14px 18px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, maxWidth: 420, margin: "20px auto 0" }}>
                      <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontFamily: "Arial, sans-serif", lineHeight: 1.5 }}>
                        📄 Ton plan s'est ouvert dans un nouvel onglet.<br />
                        Pour l'enregistrer : appuie sur <strong>Partager</strong> <span style={{ fontFamily: "Arial" }}>(en bas)</span> → <strong>Enregistrer dans Fichiers</strong>.
                      </p>
                    </div>
                  )}
                </div>

                <button onClick={restart} style={{ background: "transparent", border: "none", color: "rgba(0,0,0,0.3)", fontSize: 11, fontWeight: 900, letterSpacing: "0.1em", marginTop: 32, padding: 0, cursor: "pointer" }}>← NOUVELLE IDÉE</button>
              </div>

              {/* Footer */}
              <div style={{ background: CREAM, borderTop: "1px solid #ebe7e0", padding: isMobile ? "24px 20px" : "24px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <span style={{ fontSize: 11, color: "rgba(0,0,0,0.3)", fontFamily: "Arial, sans-serif" }}>© 2025-2026 PLANSTART</span>
                <div style={{ display: "flex", gap: 24 }}>
                  {[["Mentions légales", "/mentions-legales"], ["Confidentialité", "/confidentialite"], ["CGU", "/cgu"]].map(([label, href]) => (
                    <a key={href} href={href} style={{ fontSize: 11, color: "rgba(0,0,0,0.4)", textDecoration: "none", fontFamily: "Arial, sans-serif" }}>{label}</a>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
