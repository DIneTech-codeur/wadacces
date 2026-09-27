/**
 * Génère le guide de déploiement WadAcces au format PDF.
 * Usage : node scripts/generate-guide-pdf.mjs
 * Sortie : GUIDE-DEPLOIEMENT-WADACCES.pdf (racine du projet)
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import fs from "node:fs";

const TEAL = [13, 148, 136];
const DARK = [15, 23, 42];
const GREY = [100, 116, 139];
const LIGHT = [241, 245, 249];
const LINE = [226, 232, 240];
const AMBER_BG = [255, 251, 235];
const AMBER = [180, 83, 9];
const M = 16;
const W = 210;
const H = 297;
const BOTTOM = H - 22;

const doc = new jsPDF({ unit: "mm", format: "a4" });
let y = 0;

const clean = (t) => String(t).replace(/[\u202f\u00a0]/g, " ");

function ensure(space) {
  if (y + space > BOTTOM) {
    doc.addPage();
    y = 20;
  }
}
function h1(text) {
  ensure(20);
  y += 4;
  doc.setFillColor(...TEAL);
  doc.roundedRect(M, y - 6, W - 2 * M, 11, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(clean(text), M + 4, y + 1.5);
  y += 13;
}
function h2(text) {
  ensure(14);
  y += 3;
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(clean(text), M, y);
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(0.5);
  doc.line(M, y + 1.5, M + doc.getTextWidth(clean(text)), y + 1.5);
  y += 7;
}
function p(text, opts = {}) {
  doc.setTextColor(...(opts.color || DARK));
  doc.setFont("helvetica", opts.bold ? "bold" : "normal");
  doc.setFontSize(opts.size || 9.5);
  const lines = doc.splitTextToSize(clean(text), W - 2 * M - (opts.indent || 0));
  for (const line of lines) {
    ensure(5);
    doc.text(line, M + (opts.indent || 0), y);
    y += 4.6;
  }
  y += opts.gap ?? 1.5;
}
function bullet(text) {
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const lines = doc.splitTextToSize(clean(text), W - 2 * M - 6);
  lines.forEach((line, i) => {
    ensure(5);
    if (i === 0) doc.text("•", M + 1.5, y);
    doc.text(line, M + 6, y);
    y += 4.6;
  });
  y += 0.8;
}
function step(n, title, lines) {
  ensure(12 + lines.length * 5);
  doc.setFillColor(...TEAL);
  doc.circle(M + 4, y - 1.2, 3.6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(String(n), M + 4, y + 0.1, { align: "center" });
  doc.setTextColor(...DARK);
  doc.setFontSize(10.5);
  doc.text(clean(title), M + 11, y);
  y += 5.5;
  for (const l of lines) {
    if (typeof l === "object" && l.code) {
      code(l.code);
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      const wrapped = doc.splitTextToSize(clean(l), W - 2 * M - 11);
      for (const line of wrapped) {
        ensure(5);
        doc.text(line, M + 11, y);
        y += 4.6;
      }
    }
  }
  y += 3;
}
function code(text) {
  const lines = clean(text).split("\n");
  const boxH = lines.length * 4.4 + 4;
  ensure(boxH + 2);
  doc.setFillColor(...LIGHT);
  doc.roundedRect(M + 11, y - 3, W - 2 * M - 11, boxH, 1.5, 1.5, "F");
  doc.setFont("courier", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...DARK);
  lines.forEach((l, i) => doc.text(l, M + 14, y + 1 + i * 4.4));
  y += boxH + 1;
  doc.setFont("helvetica", "normal");
}
function callout(title, text) {
  const body = doc.splitTextToSize(clean(text), W - 2 * M - 10);
  const boxH = body.length * 4.4 + 12;
  ensure(boxH + 2);
  doc.setFillColor(...AMBER_BG);
  doc.setDrawColor(...AMBER);
  doc.setLineWidth(0.4);
  doc.roundedRect(M, y - 3, W - 2 * M, boxH, 2, 2, "FD");
  doc.setTextColor(...AMBER);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(clean(title), M + 5, y + 2.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...DARK);
  doc.setFontSize(9);
  body.forEach((l, i) => doc.text(l, M + 5, y + 8 + i * 4.4));
  y += boxH + 2;
}
function table(head, rows, widths) {
  ensure(20);
  autoTable(doc, {
    startY: y,
    head: [head.map(clean)],
    body: rows.map((r) => r.map(clean)),
    theme: "grid",
    margin: { left: M, right: M, bottom: 22 },
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2, textColor: DARK, lineColor: LINE },
    headStyles: { fillColor: TEAL, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: widths ? Object.fromEntries(widths.map((w, i) => [i, { cellWidth: w }])) : undefined,
  });
  y = doc.lastAutoTable.finalY + 6;
}
function checklist(items) {
  for (const it of items) {
    ensure(6);
    doc.setDrawColor(...GREY);
    doc.setLineWidth(0.3);
    doc.rect(M + 1, y - 3.2, 3.6, 3.6);
    doc.setTextColor(...DARK);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    const lines = doc.splitTextToSize(clean(it), W - 2 * M - 8);
    lines.forEach((l, i) => {
      if (i > 0) ensure(5);
      doc.text(l, M + 7, y);
      y += 4.6;
    });
    y += 0.6;
  }
  y += 2;
}

/* ------------------------------------------------------------------ */
/* PAGE DE GARDE                                                        */
/* ------------------------------------------------------------------ */
doc.setFillColor(...TEAL);
doc.rect(0, 0, W, H, "F");
doc.setTextColor(255, 255, 255);
doc.setFont("helvetica", "bold");
doc.setFontSize(34);
doc.text("WadAcces", W / 2, 105, { align: "center" });
doc.setFontSize(16);
doc.setFont("helvetica", "normal");
doc.text("Guide de mise en production", W / 2, 118, { align: "center" });
doc.setFontSize(11);
doc.text("GitHub  +  Vercel  +  Neon PostgreSQL", W / 2, 130, { align: "center" });
doc.setFillColor(255, 255, 255);
doc.roundedRect(45, 150, 120, 48, 4, 4, "F");
doc.setTextColor(...DARK);
doc.setFontSize(10);
doc.setFont("helvetica", "bold");
doc.text("Ce que vous obtiendrez à la fin", W / 2, 160, { align: "center" });
doc.setFont("helvetica", "normal");
doc.setFontSize(9.5);
[
  "Une application en ligne 24h/24 en HTTPS",
  "Une adresse gratuite : https://wadacces.vercel.app",
  "Une base de données sécurisée, sauvegardée chaque nuit",
  "Une application installable sur téléphone, tablette et PC",
  "Coût total : 0 FCFA / mois",
].forEach((t, i) => doc.text(clean(t), W / 2, 168 + i * 5.5, { align: "center" }));
doc.setTextColor(255, 255, 255);
doc.setFontSize(9);
doc.text(`Version 1.0 — ${new Date().toLocaleDateString("fr-FR")}`, W / 2, 270, { align: "center" });
doc.text("Durée estimée : 45 minutes à 1 heure", W / 2, 276, { align: "center" });

/* ------------------------------------------------------------------ */
/* SOMMAIRE                                                             */
/* ------------------------------------------------------------------ */
doc.addPage();
y = 20;
h1("Sommaire");
[
  ["1", "Avant de commencer : comptes et outils", "10 min"],
  ["2", "Étape A — Mettre le code sur GitHub", "10 min"],
  ["3", "Étape B — Créer la base de données Neon", "10 min"],
  ["4", "Étape C — Déployer sur Vercel", "10 min"],
  ["5", "Étape D — Choisir l'adresse .vercel.app", "3 min"],
  ["6", "Étape E — Sauvegardes automatiques", "5 min"],
  ["7", "Étape F — Vérifier que tout fonctionne", "10 min"],
  ["8", "Étape G — Sécuriser et préparer la boutique", "10 min"],
  ["9", "Étape H — Installer sur les appareils du client", "5 min"],
  ["10", "Mettre à jour l'application plus tard", "—"],
  ["11", "En cas de problème", "—"],
  ["12", "Check-list finale de livraison", "—"],
].forEach(([n, t, d]) => {
  ensure(7);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...TEAL);
  doc.text(n, M + 2, y);
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "normal");
  doc.text(clean(t), M + 12, y);
  doc.setTextColor(...GREY);
  doc.text(clean(d), W - M, y, { align: "right" });
  y += 7;
});
y += 4;
callout(
  "Comment lire ce guide",
  "Suivez les étapes dans l'ordre, une seule fois. Les commandes à taper sont sur fond gris : recopiez-les exactement. " +
    "Chaque étape se termine par un résultat attendu : si vous ne l'obtenez pas, allez à la section « En cas de problème »."
);

/* ------------------------------------------------------------------ */
/* 1. AVANT DE COMMENCER                                                */
/* ------------------------------------------------------------------ */
doc.addPage();
y = 20;
h1("1. Avant de commencer");
h2("Les 3 comptes à créer (tous gratuits)");
table(
  ["Service", "À quoi il sert", "Adresse"],
  [
    ["GitHub", "Stocke le code de l'application, lance les sauvegardes", "github.com"],
    ["Neon", "Héberge la base de données PostgreSQL", "neon.tech"],
    ["Vercel", "Fait tourner l'application et fournit l'adresse HTTPS", "vercel.com"],
  ],
  [30, 100, 48]
);
p("Conseil : créez d'abord le compte GitHub, puis connectez-vous à Neon et Vercel avec le bouton « Continue with GitHub ». Vous n'aurez qu'un seul mot de passe à retenir.", { color: GREY });

h2("Les outils à installer sur votre ordinateur");
table(
  ["Outil", "Pourquoi", "Où le télécharger"],
  [
    ["Node.js 20 (ou plus)", "Créer les tables de la base, lancer les scripts", "nodejs.org"],
    ["Git", "Envoyer le code sur GitHub", "git-scm.com"],
    ["Terminal", "Windows : PowerShell · Mac : Terminal", "Déjà installé"],
  ],
  [42, 88, 48]
);
p("Pour vérifier que tout est installé, ouvrez un terminal et tapez :", { bold: true });
code("node --version     # doit afficher v20.x ou plus\ngit --version      # doit afficher git version 2.x");

h2("Le dossier du projet");
p("Dézippez l'archive « wadacces.zip » sur votre ordinateur, par exemple dans Documents. Toutes les commandes de ce guide se tapent depuis ce dossier :");
code("cd Documents/wadacces");

/* ------------------------------------------------------------------ */
/* ÉTAPE A — GITHUB                                                     */
/* ------------------------------------------------------------------ */
doc.addPage();
y = 20;
h1("2. Étape A — Mettre le code sur GitHub");
step(1, "Créer un dépôt vide sur GitHub", [
  "Allez sur github.com/new (connecté à votre compte).",
  "Repository name : wadacces · Visibilité : Private · Ne cochez rien d'autre.",
  "Cliquez sur « Create repository ». Laissez la page ouverte.",
]);
step(2, "Envoyer le code depuis votre ordinateur", [
  "Dans le terminal, depuis le dossier du projet (remplacez VOTRE_COMPTE par votre identifiant GitHub) :",
  {
    code:
      "git init\n" +
      "git add .\n" +
      'git commit -m "WadAcces - version initiale"\n' +
      "git branch -M main\n" +
      "git remote add origin https://github.com/VOTRE_COMPTE/wadacces.git\n" +
      "git push -u origin main",
  },
  "GitHub peut vous demander de vous identifier : suivez la fenêtre qui s'ouvre.",
]);
step(3, "Résultat attendu", ["Rechargez la page GitHub : vous voyez les dossiers src, public, scripts et le fichier DEPLOYMENT.md."]);
callout("Le fichier .env n'est jamais envoyé", "Il contient vos mots de passe. Il est exclu automatiquement par le fichier .gitignore fourni. C'est normal de ne pas le voir sur GitHub.");

/* ------------------------------------------------------------------ */
/* ÉTAPE B — NEON                                                       */
/* ------------------------------------------------------------------ */
doc.addPage();
y = 20;
h1("3. Étape B — Créer la base de données Neon");
step(1, "Créer le projet", [
  "Allez sur neon.tech → « Sign up » → « Continue with GitHub ».",
  "Cliquez sur « New Project » :",
  "   Project name : wadacces-production",
  "   Postgres version : laissez la valeur proposée",
  "   Region : Europe (Frankfurt) — la plus proche de l'Afrique de l'Ouest",
  "Cliquez sur « Create project ».",
]);
step(2, "Copier l'adresse de connexion", [
  "Sur le tableau de bord, cliquez sur « Connect » (ou « Connection string »).",
  "Choisissez « Pooled connection » si proposé, puis copiez la ligne qui commence par postgresql://",
  "Elle ressemble à :",
  { code: "postgresql://neondb_owner:AbC123xyz@ep-cool-rain-123456-pooler\n  .eu-central-1.aws.neon.tech/neondb?sslmode=require" },
  "Collez-la dans un fichier texte temporaire : vous en aurez besoin 3 fois.",
]);
step(3, "Créer les tables de WadAcces dans Neon", [
  "Dans le terminal, depuis le dossier du projet :",
  {
    code:
      "# Windows PowerShell :\n" +
      '$env:DATABASE_URL="postgresql://...votre adresse Neon..."\n' +
      "# Mac / Linux :\n" +
      'export DATABASE_URL="postgresql://...votre adresse Neon..."\n\n' +
      "npm install\n" +
      "npm run db:push",
  },
  "Résultat attendu : [✓] Changes applied",
]);
callout(
  "Gardez cette adresse secrète",
  "Elle donne accès à toutes vos données. Ne l'envoyez jamais par WhatsApp ou e-mail à quelqu'un d'autre. Si elle fuite : Neon → Settings → « Reset password » et remettez la nouvelle adresse dans Vercel (étape C)."
);

/* ------------------------------------------------------------------ */
/* ÉTAPE C — VERCEL                                                     */
/* ------------------------------------------------------------------ */
doc.addPage();
y = 20;
h1("4. Étape C — Déployer sur Vercel");
step(1, "Générer la clé secrète des sessions", [
  "Cette clé protège les connexions des utilisateurs. Tapez :",
  { code: "# Mac / Linux :\nopenssl rand -base64 48\n# Windows PowerShell :\nnode -e \"console.log(require('crypto').randomBytes(48).toString('base64'))\"" },
  "Copiez la longue chaîne affichée (environ 64 caractères).",
]);
step(2, "Importer le projet", [
  "Allez sur vercel.com → « Sign up » → « Continue with GitHub ».",
  "Cliquez sur « Add New… » → « Project » → à côté de wadacces, cliquez « Import ».",
  "Framework Preset : Next.js (détecté automatiquement). Ne changez rien d'autre.",
]);
step(3, "Renseigner les variables d'environnement", [
  "Ouvrez la section « Environment Variables » et ajoutez ces 2 lignes :",
]);
table(
  ["Name", "Value"],
  [
    ["DATABASE_URL", "l'adresse Neon copiée à l'étape B (postgresql://…sslmode=require)"],
    ["AUTH_SECRET", "la clé générée au point 1"],
  ],
  [40, 138]
);
step(4, "Lancer le déploiement", [
  "Cliquez sur « Deploy » et attendez 2 à 3 minutes.",
  "Résultat attendu : un écran « Congratulations! » avec un aperçu de la page de connexion WadAcces.",
  "Cliquez sur « Continue to Dashboard ».",
]);
callout("Déploiement automatique", "Désormais, chaque fois que vous enverrez du code sur GitHub (git push), Vercel remettra l'application à jour tout seul en 2 minutes.");

/* ------------------------------------------------------------------ */
/* ÉTAPE D — ADRESSE                                                    */
/* ------------------------------------------------------------------ */
h1("5. Étape D — Choisir l'adresse .vercel.app");
step(1, "Renommer l'adresse générée", [
  "Vercel → votre projet → « Settings » → « Domains ».",
  "L'adresse actuelle ressemble à wadacces-git-main-xxxx.vercel.app.",
  "Cliquez « Edit » sur la ligne principale et tapez : wadacces.vercel.app",
  "Si elle est déjà prise, essayez wadacces-boutique.vercel.app ou wadacces-sn.vercel.app.",
]);
step(2, "Résultat attendu", [
  "https://wadacces.vercel.app/login affiche les 3 boutons VENDRE / GESTIONNAIRE / ADMINISTRATEUR.",
  "Le cadenas HTTPS est présent dans le navigateur : c'est automatique, rien à configurer.",
]);
p("C'est cette adresse unique que vous donnerez au client. Un domaine personnalisé (payant) pourra être ajouté plus tard au même endroit, sans toucher au code.", { color: GREY });

/* ------------------------------------------------------------------ */
/* ÉTAPE E — SAUVEGARDES                                                */
/* ------------------------------------------------------------------ */
doc.addPage();
y = 20;
h1("6. Étape E — Sauvegardes automatiques");
p("Une sauvegarde complète de la base est faite chaque nuit à 2h par GitHub, et conservée 30 jours. Neon garde aussi un historique de 7 jours de son côté. Il ne reste qu'une chose à faire :");
step(1, "Donner l'adresse de la base à GitHub", [
  "GitHub → votre dépôt wadacces → « Settings » → « Secrets and variables » → « Actions ».",
  "Cliquez « New repository secret » :",
  "   Name : DATABASE_URL",
  "   Secret : l'adresse Neon (la même qu'à l'étape C)",
  "Cliquez « Add secret ».",
]);
step(2, "Lancer une première sauvegarde pour vérifier", [
  "GitHub → onglet « Actions » → « Sauvegarde quotidienne de la base » → « Run workflow » → « Run workflow ».",
  "Après 1 minute, la ligne passe au vert. Cliquez dessus : la sauvegarde est téléchargeable dans « Artifacts ».",
]);
h2("Restaurer une sauvegarde (uniquement en cas de gros problème)");
p("Téléchargez l'archive depuis GitHub Actions, dézippez-la, puis depuis le dossier du projet :");
code('export DATABASE_URL="postgresql://...adresse Neon..."\n./scripts/restore.sh wadacces_20260927_020000.sql.gz');
p("Le script demande de taper OUI avant d'écraser la base. Il affiche ensuite le nombre de produits, ventes et clients restaurés.", { color: GREY });

/* ------------------------------------------------------------------ */
/* ÉTAPE F — VÉRIFICATION                                               */
/* ------------------------------------------------------------------ */
h1("7. Étape F — Vérifier que tout fonctionne");
step(1, "Contrôle automatique", [
  { code: "npm run health -- https://wadacces.vercel.app" },
  "Résultat attendu : toutes les lignes en ✅ et « Base de données : connectée ».",
]);
step(2, "Contrôle manuel sur un téléphone", [
  "Bouton VENDRE → carte « Vendeur » → code 1234 → vendre 1 article → le message « Vente enregistrée » s'affiche.",
  "Bouton GESTIONNAIRE → carte « Gestionnaire » → code 5678 → le menu n'affiche ni Utilisateurs ni Paramètres.",
  "Bouton ADMINISTRATEUR → admin / admin → Tableau de bord : la vente test apparaît ; Alertes : pas de rupture.",
  "Coupez le Wi-Fi et les données → faites une vente → réactivez → Synchro : la vente part sur le serveur.",
]);
step(3, "Nettoyer la vente test", ["Bureau → Historique montre la vente ; elle peut rester (montant réel) ou vous la comptez comme première vente de démonstration."]);

/* ------------------------------------------------------------------ */
/* ÉTAPE G — SÉCURISER                                                  */
/* ------------------------------------------------------------------ */
doc.addPage();
y = 20;
h1("8. Étape G — Sécuriser et préparer la boutique");
callout("À faire OBLIGATOIREMENT avant de donner l'accès au client", "Les codes par défaut (admin/admin, 1234, 5678) sont connus de tous ceux qui ont lu ce guide.");
step(1, "Changer le mot de passe administrateur", [
  "Bureau → Utilisateurs → ligne « Administrateur » → Modifier → Nouveau mot de passe → Enregistrer.",
  "Choisissez 10 caractères minimum, mélange de lettres et chiffres. Notez-le dans un endroit sûr.",
]);
step(2, "Créer les vrais comptes du personnel", [
  "Utilisateurs → Nouvel utilisateur : nom complet, identifiant, rôle, code PIN à 4 chiffres.",
  "Un PIN différent par personne : c'est ce qui permet de savoir qui a vendu quoi.",
  "Retirez ensuite les comptes « Vendeur » et « Gestionnaire » de démonstration (bouton Retirer).",
]);
step(3, "Charger les produits", [
  "Option rapide : Paramètres → « Charger le catalogue WadAcces » (48 produits d'accessoires avec prix et QR codes).",
  "Option personnalisée : Produits → « Import CSV » avec les colonnes nom, categorie, prixAchat, prixVente, prixGros, stock, seuil.",
  "Les codes-barres et QR codes sont créés automatiquement. Imprimez-les via Produits → « Étiquettes QR ».",
]);
step(4, "Renseigner la boutique", ["Paramètres → nom, téléphone, adresse, seuil d'alerte par défaut → Enregistrer."]);
step(5, "Saisir les dettes existantes", ["Clients / Fournisseurs → Nouveau → champ « Dette actuelle » pour reprendre les crédits en cours."]);

/* ------------------------------------------------------------------ */
/* ÉTAPE H — INSTALLATION                                               */
/* ------------------------------------------------------------------ */
h1("9. Étape H — Installer sur les appareils du client");
table(
  ["Appareil", "Comment installer"],
  [
    ["Téléphone / tablette Android", "Chrome → ouvrir https://wadacces.vercel.app → menu ⋮ → « Ajouter à l'écran d'accueil » → « Installer »"],
    ["iPhone / iPad", "Safari → ouvrir l'adresse → bouton Partager → « Sur l'écran d'accueil »"],
    ["Ordinateur Windows / Mac", "Chrome ou Edge → ouvrir l'adresse → icône « Installer » à droite de la barre d'adresse"],
    ["Douchette code-barres USB", "Brancher, c'est tout : elle tape le code comme un clavier, la caisse le reconnaît"],
  ],
  [50, 128]
);
p("Une fois installée, l'application s'ouvre en plein écran avec l'icône WadAcces et fonctionne même sans réseau : les ventes sont gardées sur l'appareil puis envoyées au retour de la connexion.", { color: GREY });

/* ------------------------------------------------------------------ */
/* MISES À JOUR                                                         */
/* ------------------------------------------------------------------ */
doc.addPage();
y = 20;
h1("10. Mettre à jour l'application plus tard");
p("Quand une nouvelle version du code vous est fournie :");
code(
  "# 1. Sauvegarde de sécurité (GitHub → Actions → Run workflow)\n" +
    "# 2. Copier les nouveaux fichiers dans le dossier du projet, puis :\n" +
    "git add .\n" +
    'git commit -m "Mise à jour"\n' +
    "git push\n" +
    "# 3. Si le message de version parle de « nouvelles tables » ou « schéma » :\n" +
    'export DATABASE_URL="postgresql://...adresse Neon..."\n' +
    "npm run db:push\n" +
    "# 4. Vérifier :\n" +
    "npm run health -- https://wadacces.vercel.app"
);
p("Vercel redéploie automatiquement après le push. Les données (produits, ventes, clients) ne sont jamais touchées par une mise à jour : elles sont dans Neon, pas dans le code.", { color: GREY });
callout("Revenir en arrière", "Vercel → Deployments → déploiement précédent → « … » → « Promote to Production ». L'ancienne version revient en 10 secondes.");

/* ------------------------------------------------------------------ */
/* PROBLÈMES                                                            */
/* ------------------------------------------------------------------ */
h1("11. En cas de problème");
table(
  ["Symptôme", "Cause probable", "Solution"],
  [
    ["« Erreur lors de la connexion » sur la page login", "DATABASE_URL absente ou fausse dans Vercel", "Vercel → Settings → Environment Variables → corriger → Deployments → Redeploy"],
    ["Page blanche ou erreur 500", "Tables non créées dans Neon", "Relancer npm run db:push avec la bonne DATABASE_URL"],
    ["Mot de passe admin oublié", "—", "Utilisateurs (par un autre admin) → Modifier ; sinon voir DEPLOYMENT.md, section Dépannage (remise à « admin »)"],
    ["Ventes hors ligne qui ne partent pas", "Réseau instable", "Caisse → SYNCHRO → « Synchroniser » ; les ventes ne sont jamais perdues ni doublées"],
    ["Le vendeur voit « Ce compte n'est pas un compte vendeur »", "Mauvais bouton sur l'accueil", "Utiliser le bouton correspondant à son rôle"],
    ["Application lente", "Base Neon en veille (plan gratuit)", "Normal au premier accès du matin (2-3 s), puis rapide"],
    ["Vercel indique « Build failed »", "Fichier manquant ou modifié", "Vercel → Deployments → cliquer le build rouge → lire l'erreur → corriger → push"],
  ],
  [50, 52, 76]
);
p("Journaux détaillés : Vercel → votre projet → « Logs ». Santé de la base : Neon → « Monitoring ».", { color: GREY });

/* ------------------------------------------------------------------ */
/* CHECK-LIST                                                           */
/* ------------------------------------------------------------------ */
doc.addPage();
y = 20;
h1("12. Check-list finale de livraison");
p("Cochez chaque ligne avant de remettre l'application au client :", { bold: true });
h2("Technique");
checklist([
  "Le code est sur GitHub (dépôt privé wadacces)",
  "La base Neon est créée, les tables existent (npm run db:push → Changes applied)",
  "Vercel déploie sans erreur ; DATABASE_URL et AUTH_SECRET sont renseignées",
  "L'adresse https://wadacces.vercel.app/login s'ouvre avec le cadenas HTTPS",
  "Le secret DATABASE_URL est ajouté dans GitHub Actions et une sauvegarde manuelle a réussi",
  "npm run health affiche toutes les lignes en ✅",
]);
h2("Sécurité et données");
checklist([
  "Le mot de passe admin/admin a été changé",
  "Les comptes de démonstration Vendeur (1234) et Gestionnaire (5678) ont été remplacés par les vrais employés",
  "Les produits sont chargés (catalogue ou import CSV) avec leurs prix d'achat et de vente",
  "Le nom, le téléphone et l'adresse de la boutique sont renseignés dans Paramètres",
  "Les dettes clients / fournisseurs existantes ont été saisies",
]);
h2("Terrain");
checklist([
  "L'application est installée sur le téléphone / la tablette de la caisse",
  "Une vente réelle a été faite : le stock a baissé et la vente apparaît au Bureau",
  "Une vente hors ligne a été testée puis synchronisée",
  "Les étiquettes QR sont imprimées et collées sur les rayons ou produits",
  "Le vendeur a fait 3 ventes seul, sans aide : VENDRE → produit → quantité → VENDRE",
  "Le client a l'adresse de l'application et le mot de passe admin (remis en main propre)",
]);
y += 4;
callout("Support", "Tout ce guide est aussi dans le fichier DEPLOYMENT.md du projet, avec des détails supplémentaires. Le fichier README.md décrit chaque fonctionnalité.");

/* ------------------------------------------------------------------ */
/* PIEDS DE PAGE                                                        */
/* ------------------------------------------------------------------ */
const pages = doc.getNumberOfPages();
for (let i = 2; i <= pages; i++) {
  doc.setPage(i);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(M, H - 14, W - M, H - 14);
  doc.setTextColor(...GREY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("WadAcces — Guide de mise en production", M, H - 9);
  doc.text(`Page ${i} / ${pages}`, W - M, H - 9, { align: "right" });
}

const out = "GUIDE-DEPLOIEMENT-WADACCES.pdf";
fs.writeFileSync(out, Buffer.from(doc.output("arraybuffer")));
console.log(`✅ ${out} généré — ${pages} pages, ${(fs.statSync(out).size / 1024).toFixed(0)} Ko`);
