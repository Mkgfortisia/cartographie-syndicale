---
title: Cartographie du mouvement syndical canadien
description: Aperçu structuré des centrales, fédérations, divisions, composantes, sections locales et relations syndicales au Canada.
tags: [index, cartographie, syndicats]
---

# 🇨🇦 Cartographie syndicale canadienne

> Base de données synthétique pour Fortisia — centrales, fédérations, composantes, sections locales et relations d'affiliation.

## Navigation rapide

- [Modèle de données](./modele-donnees) — taxonomie pour ne pas mélanger centrales, fédérations, régions et locaux
- [Cartographie relationnelle](./cartographie-relationnelle) — liens parent/enfant entre organisations
- [Centrales nationales](./centrales)
- [Fédérations provinciales, composantes et divisions](./federations)
- [Sections locales](./sections-locales)
- [Locaux et syndicats spécialisés](./locaux)
- [Contacts syndicaux](./contacts)

## Structure recommandée

```text
Centrale / congrès / fédération du travail
└── Syndicat national / fédération sectorielle / composante
    └── Division provinciale / district / conseil central / région
        └── Section locale / syndicat local / unité de négociation
            └── Employeur / établissement / convention collective
```

## Aperçu

- 55+ syndicats-mères, centrales, fédérations et composantes
- 200+ contacts et courriels repérés dans les notes existantes
- 80+ dirigeant·es ou responsables nommés
- 47+ notes interconnectées dans Quartz
- Nouvelle couche de normalisation : `type_entite`, `parent`, `relations`
- Graph de liens et recherche interne

## Grandes couches de la cartographie

| Couche | Contenu | Page |
|---|---|---|
| 1 | Centrales, congrès et syndicats-mères | [[centrales/index|Centrales nationales]] |
| 2 | Fédérations provinciales, composantes NUPGE, divisions CUPE | [[federations/index|Fédérations et composantes]] |
| 3 | Sections locales, syndicats locaux et unités locales | [[sections-locales/index|Sections locales]] |
| 4 | Syndicats spécialisés par secteur | [[locaux/index|Locaux spécialisés]] |
| 5 | Relations d'affiliation et parenté organisationnelle | [[cartographie-relationnelle]] |

## Composantes NUPGE

| BCGEU | OPSEU-SEFPO | AUPE | MGEU |
|---|---|---|---|
| NAPE | PEIUPSE | NBU | HSAA |
| HSABC | MAHCP | HEU | SGEU |

## CUPE — Divisions provinciales

[[CUPE-BC]] · [[CUPE-AB]] · [[CUPE-SK]] · [[CUPE-MB]] · [[CUPE-ON]] · [[CUPE-NB]] · [[CUPE-NS]] · [[CUPE-NL]] · [[CUPE-PEI]] · [[CUPE-YK]]

## Priorités de prospection Fortisia

| Segment | Pourquoi c'est prioritaire |
|---|---|
| Syndicats locaux municipaux | Fort potentiel pour assemblées générales, avis aux membres et votes |
| Santé et services sociaux | Multiplicité de lieux de travail, besoin de communication rapide |
| Éducation | Forte densité de membres, assemblées fréquentes, enjeux de mobilisation |
| Transport et services publics | Sections locales structurées, besoins opérationnels constants |
| Commerce et alimentation | Nombreuses unités locales, fort roulement, besoin de rejoindre les membres |

## Objectif

Organiser les syndicats canadiens par centrale, fédération, composante, division provinciale, section locale et secteur spécialisé pour un accès rapide aux contacts et aux relations d'affiliation.

---

> **Dernière mise à jour :** 2026-05-26 · **Source : recherche web, sites officiels et documents de cartographie fournis
