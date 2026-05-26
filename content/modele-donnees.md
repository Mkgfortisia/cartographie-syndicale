---
title: Modèle de données syndical
description: Taxonomie normalisée pour distinguer centrales, fédérations, composantes, régions et sections locales.
tags: [modele, taxonomie, donnees]
---

# Modèle de données syndical

Cette page sert de grille de lecture pour toute la cartographie. Elle corrige le principal risque du projet : mélanger dans une même liste des centrales, des syndicats nationaux, des fédérations sectorielles, des régions, des bureaux et des sections locales.

## Hiérarchie recommandée

```text
Centrale, congrès ou fédération du travail
└── Syndicat national, fédération sectorielle ou composante
    └── Division provinciale, district, conseil central ou région
        └── Section locale, syndicat local ou unité de négociation
            └── Employeur, établissement, convention collective ou lieu de travail
```

## Types d'entités

| Type | Définition | Exemples |
|---|---|---|
| `congres_national` | Regroupement national de syndicats affiliés | [[CLC]] |
| `centrale_quebec` | Centrale syndicale québécoise multisectorielle | [[FTQ]], [[CSN]], [[CSQ]], [[CSD]] |
| `federation_travail_provinciale` | Fédération provinciale ou territoriale affiliée au CLC | [[BCFED]], [[AFL]], [[OFL]], [[MFL]], [[SFL]] |
| `syndicat_national` | Syndicat présent dans plusieurs provinces | [[SCFP-CUPE]], [[Unifor]], [[AFPC-PSAC]], [[Teamsters]], [[TUAC-UFCW]] |
| `federation_sectorielle` | Fédération par secteur à l'intérieur d'une centrale | FSSS-CSN, FNEEQ-CSN, FSE-CSQ |
| `composante` | Union membre d'une fédération nationale | [[BCGEU]], [[OPSEU-SEFPO]], [[MGEU]], [[SGEU]], [[NSGEU]] |
| `division_provinciale` | Branche provinciale d'un syndicat national | [[CUPE-ON]], [[CUPE-BC]], SCFP-Québec |
| `district` | Structure régionale ou industrielle d'un syndicat | Métallos District 5, Teamsters Joint Council 91 |
| `conseil_central` | Conseil régional, surtout dans la CSN | CCMM-CSN, CCSM-CSN |
| `region` | Région administrative syndicale | Régions AFPC, régions APTS, régions FIQ |
| `section_locale` | Local ou syndicat local représentant directement les membres | TUAC 500, Teamsters 106, Unifor Local 1104 |
| `bureau` | Adresse ou point de service, sans être une entité autonome | Bureau Québec, bureau Montréal |
| `employeur` | Employeur ou unité de négociation | IGA, CIUSSS, université, municipalité |

## Champs minimaux par note

```yaml
---
id: ftq
title: Fédération des travailleurs et travailleuses du Québec
acronym: FTQ
type_entite: federation_travail_provinciale
territoire: Québec
parent: CLC
membres: 600000
secteurs:
  - construction
  - transport
  - secteur public
  - alimentation
relations:
  - type: federation_provinciale_affiliee
    cible: CLC
  - type: affilié
    cible: SCFP-CUPE
sources:
  - https://ftq.qc.ca
  - https://canadianlabour.ca
---
```

## Règles de normalisation

1. Une organisation ne doit avoir qu'un seul `type_entite` principal.
2. Les bureaux ne doivent pas être comptés comme des sections locales.
3. Les membres ne doivent pas être additionnés entre niveaux parent/enfant.
4. Les relations doivent être explicites, pas seulement implicites dans le titre.
5. Les notes qui mélangent plusieurs niveaux doivent pointer vers [[cartographie-relationnelle]].

## Comptage sans double comptage

Le CLC, la FTQ, le SCFP/CUPE, Unifor, Teamsters et TUAC/UFCW se recoupent. Par exemple, compter le CLC puis ajouter ses affiliés produit un total gonflé. Le champ `membres` sert donc à décrire l'organisation, pas à produire un total national naïf.

## Priorité de confiance

| Niveau | Source | Usage |
|---|---|---|
| Très élevé | Site officiel de l'organisation | Coordonnées, dirigeants, structure actuelle |
| Élevé | Pages officielles de fédérations affiliées | Relations et secteurs |
| Moyen | Documents internes de recherche | Préremplissage et repérage |
| À vérifier | Wikipédia, communiqués, répertoires tiers | Contexte seulement |

## Prochain enrichissement recommandé

- Ajouter `type_entite` et `parent` dans le frontmatter de chaque note.
- Séparer les pages qui contiennent à la fois des syndicats nationaux et leurs sections locales.
- Créer une table CSV exportable `organisations.csv` et `relations.csv` si le projet doit alimenter un CRM ou une prospection Fortisia.

---

Retour à [[index|l'accueil]].
