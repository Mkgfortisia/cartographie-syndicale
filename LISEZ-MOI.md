# 🚀 Instructions de déploiement — Cartographie syndicale Fortisia

## Ce que tu as ici

Un site web statique avec graph de navigation construit sur **Quartz** :
- 47+ notes interconnectées (une par syndicat)
- Liens bidirectionnels `[[CLC]]` → graph visuel des affiliations
- Couleurs Fortisia (vert foncé #153F37, orange #FF9936)
- Recherche full-text intégrée
- Fonctionne sur GitHub Pages — **gratuit, zéro maintenance**

---

## Déploiement en 3 étapes

### Étape 1 — Créer un repo GitHub

1. Va sur **github.com/new**
2. Nom du repo : `cartographie-syndicale`
3. Visibility : **Private** (ton équipe seulement)
4. Clique **Create repository**

### Étape 2 — Pousser le code

Dans VS Code, ouvre un terminal (`Ctrl+`` `) dans ce dossier, puis :

```bash
git init
git add .
git commit -m "init: cartographie syndicale Fortisia"
git branch -M main
git remote add origin https://github.com/TON-USERNAME/cartographie-syndicale.git
git push -u origin main
```

### Étape 3 — Activer GitHub Pages

1. Dans ton repo GitHub → **Settings** → **Pages**
2. Source : **GitHub Actions**
3. Le site se build automatiquement (2-3 min)
4. URL : `https://ton-username.github.io/cartographie-syndicale`

---

## Partager avec Alexandre et Dominic

Comme le repo est **Private**, ils doivent être invités :

1. Settings → Collaborators → **Add people**
2. Entre leur GitHub username ou email
3. Ils auront accès au site ET au repo

---

## Ajouter / modifier une note

1. Ouvre n'importe quel fichier `.md` dans `content/`
2. Modifie le contenu
3. Dans le terminal :
```bash
git add .
git commit -m "update: ajout contact SEIU Local 2"
git push
```
Le site se met à jour automatiquement en 2 min.

---

## Structure des dossiers

```
content/
  index.md              ← Page d'accueil
  centrales/            ← CLC, FTQ, CSN, SCFP, Unifor...
  federations/          ← BCGEU, OPSEU, AUPE, BCFED, AFL...
  locaux/               ← ATU, IAFF, UNITE HERE, Policiers...
```

---

## Voir le site en local (optionnel)

```bash
npm run dev
```
Puis ouvre http://localhost:8080

