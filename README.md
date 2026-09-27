# WadAcces — Gestion de stock et de ventes

Application complète pour la boutique **WadAcces** (accessoires et équipements pour téléphones) :
caisse rapide, stock, achats, clients, fournisseurs, dettes, inventaire, rapports PDF, alertes, mode hors ligne, PWA.

## Trois profils, trois portes d'entrée

L'écran d'accueil (`/login`) propose trois boutons :

| Bouton | Connexion | Accès |
| --- | --- | --- |
| 🟢 **VENDRE** | carte du vendeur + code PIN (4 chiffres) | Caisse uniquement (`/vendor`) |
| 🔵 **GESTIONNAIRE** | carte du gestionnaire + code PIN | Bureau sans suppression, sans utilisateurs ni paramètres |
| ⚫ **ADMINISTRATEUR** | identifiant + mot de passe | Accès total (`/admin`) |

Chaque porte n'accepte que son rôle, contrôle fait côté serveur.

## Comptes créés à la première installation

| Rôle | Identifiants par défaut |
| --- | --- |
| Administrateur | `admin` / `admin` |
| Vendeur | carte **Vendeur**, PIN `1234` |
| Gestionnaire | carte **Gestionnaire**, PIN `5678` |

**À changer immédiatement en production** : Bureau → Utilisateurs → Modifier.
Aucun produit fictif n'est inséré ; le catalogue de démarrage se charge depuis Bureau → Paramètres.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- PostgreSQL + Drizzle ORM
- Sessions HTTP-only, mots de passe et codes PIN hashés (bcrypt)
- PWA (manifest + service worker), hors ligne via IndexedDB + synchronisation idempotente
- PDF : jsPDF + autotable

## Installation locale

```bash
npm install
cp .env.example .env      # renseigner DATABASE_URL et AUTH_SECRET
npm run db:push           # crée les tables
npm run dev               # http://localhost:3000
```

## Scripts

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Développement |
| `npm run build` / `npm start` | Production |
| `npm run typecheck` | Vérification TypeScript |
| `npm run db:push` | Applique le schéma à la base (`DATABASE_URL`) |
| `npm run db:studio` | Explorateur de base Drizzle |
| `npm run backup` | Sauvegarde `pg_dump` compressée dans `backups/` |
| `npm run health -- https://votre-app.vercel.app` | Contrôle de santé après déploiement |

## Fonctionnalités principales

- **Caisse** : recherche, scanner (caméra ou douchette), prix détail / gros, panier multi-produits, retour vocal.
- **Produits** : SKU et code-barres EAN-13 générés automatiquement, QR codes imprimables, import CSV/Excel.
- **Stock & Mouvements** : entrées, ventes, sorties classées (endommagé, perte, retour fournisseur, usage interne), registre complet.
- **Inventaire** : complet ou par catégorie, comptage rapide, écarts valorisés, corrections tracées, archivage.
- **Clients / Fournisseurs** : fiches modifiables, dettes (ajout, paiement, correction, historique).
- **Utilisateurs** : profils complets, performance individuelle et comparaison d'équipe.
- **Rapports** : ventes, bénéfices, stock ; export CSV et PDF soignés.
- **Alertes** : ruptures, stocks bas, dettes, inventaires en cours, synchronisation.
- **Historique** : journal d'audit de toutes les actions.

## Déploiement

Voir **`DEPLOYMENT.md`** (GitHub + Vercel + Neon, sauvegardes automatiques, vérifications).

## Health check

`GET /api/health` → `{"ok":true,"database":"connected",...}`
