# 🚀 Guide de déploiement WadAcces

Ce guide vous accompagne pour déployer WadAcces en production et le livrer à votre client.

---

## 📋 Sommaire

1. [Architecture recommandée](#architecture-recommandée)
2. [Prérequis](#prérequis)
3. [Étape 1 : Configurer la base de données](#étape-1--configurer-la-base-de-données)
4. [Étape 2 : Déployer l'application sur Vercel](#étape-2--déployer-lapplication-sur-vercel)
5. [Étape 3 : Configurer le nom de domaine](#étape-3--configurer-le-nom-de-domaine)
6. [Étape 4 : Automatiser les sauvegardes](#étape-4--automatiser-les-sauvegardes)
7. [Étape 5 : Vérifier le déploiement](#étape-5--vérifier-le-déploiement)
8. [Étape 6 : Former le client](#étape-6--former-le-client)
9. [Maintenance](#maintenance)
10. [Dépannage](#dépannage)

---

## Architecture recommandée

### Stack de production (recommandée pour WadAcces)

- **Application** : Vercel (gratuit jusqu'à 100 GB/mois)
- **Base de données** : Neon PostgreSQL (gratuit jusqu'à 3 GB)
- **Adresse** : `xxx.vercel.app` fournie gratuitement par Vercel
- **SSL/HTTPS** : Automatique
- **Sauvegardes** : Scripts + cron (gratuit)

**Coût estimé** : 0 € pour démarrer

### Alternatives

| Service | Avantages | Inconvénients | Coût |
|---------|-----------|---------------|------|
| **Vercel + Neon** | Simple, gratuit, rapide | Limites de bande passante | 0-20 €/mois |
| **Railway** | Tout-en-un, facile | Moins de contrôle | 5-20 €/mois |
| **VPS OVH/Hetzner** | Contrôle total, pas cher | Configuration manuelle | 5-15 €/mois |
| **AWS/Azure/GCP** | Scalable, professionnel | Complexe, coûteux | 20-100 €/mois |

---

## Prérequis

### Comptes à créer

1. **Vercel** : https://vercel.com (gratuit, connexion GitHub recommandée)
2. **Neon** : https://neon.tech (gratuit, base PostgreSQL serverless)
3. **GitHub** : https://github.com (gratuit, pour héberger le code)

### Outils à installer

- **Node.js 18+** : https://nodejs.org (pour les scripts locaux)
- **Git** : https://git-scm.com (pour versionner le code)
- **PostgreSQL client** (`psql`, `pg_dump`) : uniquement si vous faites les sauvegardes depuis votre PC ; avec GitHub Actions ce n'est pas nécessaire

---

## Étape 1 : Configurer la base de données

### 1.1 Créer un compte Neon

1. Allez sur https://neon.tech et cliquez sur **Sign up**
2. Connectez-vous avec GitHub (recommandé)
3. Créez un nouveau projet :
   - **Name** : `wadacces-production`
   - **Region** : `Frankfurt (eu-central-1)` (proche de l'Afrique)
   - Cliquez sur **Create project**

### 1.2 Récupérer l'URL de connexion

1. Sur le dashboard Neon, cliquez sur **Connect**
2. Copiez l'URL de connexion (format : `postgresql://user:password@host/database?sslmode=require`)
3. **Gardez-la secrète**, vous en aurez besoin pour Vercel

### 1.3 Créer les tables dans Neon

Depuis votre ordinateur, dans le dossier du projet :

```bash
# Windows PowerShell :  $env:DATABASE_URL="postgresql://...?sslmode=require"
# Mac / Linux :
export DATABASE_URL="postgresql://user:password@host/database?sslmode=require"

npm install
npm run db:push
```

Résultat attendu : `[✓] Changes applied`. Les 19 tables sont créées.
Les comptes par défaut (admin, vendeur, gestionnaire) et les catégories seront créés
automatiquement à la première ouverture de l'application.

### 1.4 Tester la connexion (facultatif)

```bash
# Depuis votre terminal local
psql "postgresql://user:password@host/database?sslmode=require"

# Vous devriez voir le prompt PostgreSQL :
# database=>
```

---

## Étape 2 : Déployer l'application sur Vercel

### 2.1 Pousser le code sur GitHub

```bash
# Initialiser le dépôt Git (si pas déjà fait)
git init
git add .
git commit -m "Initial commit: WadAcces ready for production"

# Créer un dépôt GitHub (faites-le manuellement sur github.com)
# Puis connectez-le :
git remote add origin https://github.com/VOTRE_USERNAME/wadacces.git
git branch -M main
git push -u origin main
```

### 2.2 Importer le projet sur Vercel

1. Allez sur https://vercel.com/new
2. Cliquez sur **Import Project** → sélectionnez votre dépôt GitHub `wadacces`
3. Vercel détecte automatiquement Next.js
4. **Configurez les variables d'environnement** :

| Variable | Valeur | Description |
|----------|--------|-------------|
| `DATABASE_URL` | `postgresql://...` (depuis Neon) | URL de connexion à la base |
| `AUTH_SECRET` | Générer avec `openssl rand -base64 48` | Clé secrète pour les sessions |
| `NODE_ENV` | `production` | Mode production |

**Générer AUTH_SECRET** :
```bash
openssl rand -base64 48
# Exemple : aMCqmMbjQwsEPK24qw7Qni6aYiXE6mirrZoyylcDq4wFEKkWSmQ98mEOkRqwtXvZ
```

5. Cliquez sur **Deploy**
6. Attendez 2-3 minutes que le build se termine

### 2.3 Vérifier le déploiement

Vercel vous donne une URL temporaire : `wadacces-xxx.vercel.app`

Testez :
- Page de connexion : `https://wadacces-xxx.vercel.app/login`
- API health : `https://wadacces-xxx.vercel.app/api/health` (doit renvoyer `{"ok":true}`)

---

## Étape 3 : Adresse de l'application (.vercel.app, gratuite)

Aucun nom de domaine à acheter : Vercel fournit une adresse gratuite en HTTPS.

### 3.1 Choisir une adresse lisible

1. Vercel → votre projet → **Settings** → **Domains**
2. L'adresse générée ressemble à `wadacces-abc123.vercel.app`.
   Cliquez sur **Edit** et remplacez-la par une adresse simple, par exemple :
   **`wadacces.vercel.app`** (si elle est libre) ou `wadacces-boutique.vercel.app`.
3. Enregistrez : le HTTPS est automatique.

### 3.2 Communiquer l'adresse au client

- Adresse unique à retenir : **`https://wadacces.vercel.app/login`**
- Sur téléphone : ouvrir cette adresse dans Chrome → menu ⋮ → **Ajouter à l'écran d'accueil**.
  L'application s'installe comme une vraie application (icône WadAcces, plein écran, hors ligne).
- Sur ordinateur : icône **Installer** dans la barre d'adresse de Chrome / Edge.

> Si un jour vous souhaitez un domaine personnalisé (`app.wadacces.com`), il suffira de l'ajouter
> dans **Settings → Domains** : rien à changer dans le code.

---

## Étape 4 : Automatiser les sauvegardes

### 4.1 Tester le script de sauvegarde

```bash
# Depuis votre ordinateur (avec PostgreSQL client installé)
export DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
./scripts/backup.sh

# Résultat attendu :
# 📦 Début de la sauvegarde : wadacces_20260927_143022.sql.gz
# ✅ Sauvegarde terminée : backups/wadacces_20260927_143022.sql.gz (245K)
# 🧹 Nettoyage des sauvegardes de plus de 7 jours...
# 📚 1 sauvegarde(s) conservée(s) dans backups
```

### 4.2 Automatiser avec cron (Linux/Mac)

```bash
# Éditer le crontab
crontab -e

# Ajouter cette ligne (sauvegarde quotidienne à 2h du matin)
0 2 * * * cd /path/to/wadacces && ./scripts/backup.sh >> backups/cron.log 2>&1
```

### 4.3 Automatiser avec GitHub Actions (recommandé)

Créez `.github/workflows/backup.yml` :

```yaml
name: Daily Backup

on:
  schedule:
    - cron: '0 2 * * *'  # Tous les jours à 2h UTC
  workflow_dispatch:      # Permet de lancer manuellement

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install PostgreSQL client
        run: sudo apt-get install -y postgresql-client
      
      - name: Backup database
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: ./scripts/backup.sh
      
      - name: Upload backup artifact
        uses: actions/upload-artifact@v4
        with:
          name: backup-${{ github.run_id }}
          path: backups/
          retention-days: 30
```

**Ajouter le secret** : GitHub → Settings → Secrets → Actions → New secret
- **Name** : `DATABASE_URL`
- **Value** : URL de connexion Neon

---

## Étape 5 : Vérifier le déploiement

### 5.1 Checklist de santé

```bash
# Lancer le script de vérification
./scripts/check-health.sh https://wadacces.vercel.app

# Résultat attendu :
# 🔍 Vérification de santé : https://wadacces.vercel.app
#
#   Page d'accueil                 ✅ 200
#   Caisse vendeur                 ✅ 200
#   Bureau admin                   ✅ 200
#   API health                     ✅ 200
#   API auth/vendors               ✅ 200
#   Manifest PWA                   ✅ 200
#   Service Worker                 ✅ 200
#
#   Base de données                ✅ connectée
#
# ✅ Tous les contrôles sont passés
```

### 5.2 Tests fonctionnels manuels

1. **Connexion vendeur** :
   - URL : `https://wadacces.vercel.app/vendor`
   - Sélectionnez "Vendeur" → PIN `1234`
   - Créez une vente test → vérifiez que le stock diminue

2. **Connexion admin** :
   - URL : `https://wadacces.vercel.app/admin`
   - Bouton **ADMINISTRATEUR** → `admin` / `admin`
   - Vérifiez le dashboard, les rapports, les alertes
   - **Changez immédiatement le mot de passe** : Utilisateurs → Modifier

3. **Connexion gestionnaire** :
   - URL : `https://wadacces.vercel.app/admin`
   - Sélectionnez "Gestionnaire" → PIN `5678`
   - Vérifiez que l'accès à "Utilisateurs" et "Paramètres" est bloqué

4. **Mode hors ligne** :
   - Ouvrez l'application sur mobile
   - Coupez Internet
   - Créez une vente → elle doit se sauvegarder localement
   - Réactivez Internet → la vente doit se synchroniser

5. **Installation PWA** :
   - Sur mobile : ajoutez à l'écran d'accueil
   - Vérifiez que l'icône s'affiche et que l'app se lance en plein écran

---

## Étape 6 : Former le client

### 6.1 Documents à préparer

1. **Guide utilisateur vendeur** (1 page) :
   - Comment se connecter (PIN)
   - Comment créer une vente (scan ou recherche)
   - Comment gérer le stock basique

2. **Guide utilisateur admin** (3-5 pages) :
   - Gestion des produits et catégories
   - Gestion des clients et fournisseurs (dettes)
   - Rapports et alertes
   - Inventaire physique
   - Gestion des utilisateurs

3. **Guide de dépannage** (1 page) :
   - Problèmes courants (connexion, synchronisation)
   - Contacts support

### 6.2 Formation en personne

**Durée recommandée** : 2-3 heures

**Programme** :
1. **30 min** : Présentation générale et navigation
2. **30 min** : Formation vendeur (création de ventes, stock)
3. **30 min** : Formation admin (produits, clients, rapports)
4. **30 min** : Exercices pratiques (scénarios réels)
5. **30 min** : Questions/réponses et dépannage

### 6.3 Checklist de livraison

- [ ] Application déployée et accessible sur l'adresse .vercel.app
- [ ] Compte admin créé avec mot de passe fort
- [ ] Comptes vendeur/gestionnaire créés avec PIN
- [ ] Catalogue initial importé (si applicable)
- [ ] Sauvegardes automatiques configurées
- [ ] Documentation fournie
- [ ] Formation effectuée
- [ ] Support contact communiqué

---

## Maintenance

### Sauvegardes

**Fréquence recommandée** : Quotidienne (via cron ou GitHub Actions)

**Vérifier les sauvegardes** :
```bash
# Lister les sauvegardes récentes
ls -lh backups/

# Vérifier l'intégrité d'une sauvegarde
gunzip -t backups/wadacces_20260927_020000.sql.gz
# Pas de message = OK
```

**Restaurer une sauvegarde** :
```bash
# ATTENTION : écrase la base actuelle
./scripts/restore.sh backups/wadacces_20260927_020000.sql.gz
```

### Mises à jour

**Fréquence recommandée** : Mensuelle (ou selon besoins)

**Procédure** :
```bash
# 1. Sauvegarder la base
./scripts/backup.sh

# 2. Pull les changements
git pull origin main

# 3. Installer les dépendances
npm install

# 4. Tester en local
npm run dev

# 5. Pousser vers Vercel (déploiement automatique)
git push origin main
```

### Monitoring

**Vérifications quotidiennes** :
```bash
./scripts/check-health.sh https://wadacces.vercel.app
```

**Alertes recommandées** :
- UptimeRobot (gratuit) : https://uptimerobot.com
  - Vérifie `/api/health` toutes les 5 minutes
  - Alerte par email si l'application est hors ligne

---

## Dépannage

### Problème : "Application inaccessible"

**Causes possibles** :
1. **Vercel en panne** : Vérifiez https://vercel-status.com
2. **Base de données inaccessible** : Vérifiez Neon dashboard
3. **DNS non propagé** : Attendez 24h ou utilisez `dig`

**Solution** :
```bash
# Vérifier le DNS
curl -I https://wadacces.vercel.app

# Vérifier l'API health
curl https://wadacces.vercel.app/api/health

# Vérifier les logs Vercel
# Vercel dashboard → votre projet → Deployments → dernier déploiement → Logs
```

### Problème : "Impossible de se connecter"

**Causes possibles** :
1. **Mot de passe incorrect** : Réinitialisez via la base de données
2. **AUTH_SECRET changé** : Toutes les sessions sont invalidées
3. **Base de données corrompue** : Restaurez une sauvegarde

**Solution** :
```bash
# Réinitialiser le mot de passe admin à « admin » (à changer ensuite dans l'application)
# Le hash ci-dessous correspond exactement au mot de passe « admin ».
psql "$DATABASE_URL" -c "UPDATE users SET password_hash = '$2b$10$eUtSdO7zEnLYmP5KQ578SuulnzZkWBoShiwOSxjnTGW6Ib9mwupue' WHERE username = 'admin';"
```

### Problème : "Ventes non synchronisées"

**Causes possibles** :
1. **Connexion Internet instable** : Les ventes sont en queue locale
2. **API inaccessible** : Vérifiez `/api/health`
3. **Conflit de données** : Vérifiez les logs d'erreurs

**Solution** :
1. Vérifiez la connexion Internet
2. Allez dans `/vendor/sync` pour voir les ventes en attente
3. Cliquez sur "Synchroniser maintenant"
4. Si erreur persistante, vérifiez les logs Vercel

### Problème : "Performance lente"

**Causes possibles** :
1. **Base de données saturée** : Vérifiez la taille sur Neon
2. **Trop de produits** : Utilisez la pagination
3. **Cache désactivé** : Vérifiez `vercel.json`

**Solution** :
```bash
# Vérifier la taille de la base
psql "$DATABASE_URL" -c "
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"

# Si > 1 GB, envisagez de nettoyer les logs anciens
psql "$DATABASE_URL" -c "
DELETE FROM audit_logs 
WHERE created_at < NOW() - INTERVAL '6 months';
"
```

---

## Coûts estimés

### Plan gratuit (pour démarrer)

| Service | Coût | Limites |
|---------|------|---------|
| Vercel Hobby | 0 € | 100 GB bande passante/mois |
| Neon Free | 0 € | 3 GB stockage, 190 heures compute/mois |
| Adresse .vercel.app | 0 € | HTTPS inclus |
| GitHub | 0 € | Dépôts privés illimités |
| **Total** | **0 €** | Suffisant pour ~500 ventes/jour |

### Plan croissance (si besoin)

| Service | Coût | Avantages |
|---------|------|-----------|
| Vercel Pro | 20 €/mois | Bande passante illimitée, analytics |
| Neon Launch | 19 €/mois | 10 GB stockage, 300 heures compute |
| Adresse .vercel.app | 0 € | Incluse, HTTPS automatique |
| UptimeRobot | 0 € | Monitoring gratuit |
| **Total** | **~40 €/mois** | Pour ~5000 ventes/jour |

---

## Support et contact

### En cas de problème critique

1. **Vérifiez les logs Vercel** : Dashboard → Deployments → Logs
2. **Vérifiez Neon** : Dashboard → Logs → Query history
3. **Contactez le support** :
   - Vercel : https://vercel.com/support
   - Neon : https://neon.tech/support

### Ressources utiles

- **Documentation Next.js** : https://nextjs.org/docs
- **Documentation Drizzle ORM** : https://orm.drizzle.team/docs
- **Documentation Vercel** : https://vercel.com/docs
- **Documentation Neon** : https://neon.tech/docs

---

## Checklist finale de déploiement

Avant de livrer au client, vérifiez :

- [ ] Application accessible sur `https://wadacces.vercel.app/login`
- [ ] HTTPS actif (automatique sur Vercel)
- [ ] Compte admin avec mot de passe fort
- [ ] Comptes vendeur/gestionnaire créés
- [ ] Base de données Neon configurée
- [ ] Sauvegardes automatiques actives (testez une restauration)
- [ ] Mode hors ligne fonctionnel (testez en coupant Internet)
- [ ] PWA installable sur mobile
- [ ] Scanner de code-barres fonctionnel
- [ ] Rapports PDF générés correctement
- [ ] Alertes affichées correctement
- [ ] Documentation fournie au client
- [ ] Formation effectuée

---

**Dernière mise à jour** : 27 septembre 2026  
**Version** : 1.0
