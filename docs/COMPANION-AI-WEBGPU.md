# Compagnon IA WebGPU — étude de faisabilité

>Statut : **étude préalable** (aucun dev commencé). 2026-09-22, à valider par David.
>Objectif : intégrer un compagnon IA dans l'éditeur Arduino par blocs (arduino.rayroud.com),
tournant **100 % dans le navigateur de l'élève** via WebGPU, en réutilisant la pile du projet
prompt-forge (WebLLM + Transformers.js). Aucune inférence serveur.

## Réutilisation depuis prompt-forge (déjà éprouvé en prod sur webgpu.rayroud.com)

- `lib/providers/` — `WebLLMProvider` + `TransformersJsProvider` + `createModelProvider()`
  (abstraction WebGPU / repli WASM, chargement + progression + streaming).
- `lib/models.ts` — catalogue profilé (Léger/Équilibré), dimensionné VRAM.
- `lib/db.ts` — IndexedDB (contexte/chat persistant).
- `lib/webgpu.ts` — détection fiable (`requestAdapter()`, pas le `"gpu" in navigator` naïf).

## Contraintes matérielles (les vraies divergences vs prompt-forge)

| Facteur | prompt-forge | Arduino par blocs |
|---|---|---|
| Cible | Laptop David, RTX 2050 4 Go VRAM | Tablettes/mobiles/PC des élèves (iGPU ~1-2 Go) |
| Audience | Personnel, auth basique | Site public, ados, sans auth |
| VRAM | Modèle « Équilibré » (~2,5 Go) ok | Souvent < 1,5 Go → profil **Léger seul** |
| Safari/iOS | — | **Pas de WebGPU** → repli WASM lent |
| Téléchargement modèle | Cache réutilisé | 0,5-1,5 Go depuis HF la 1re fois (10-30 min en connexion scolaire) |

## Niveaux d'intégration (coût croissant)

- **A. Panneau « Compagnon »** : bouton header → drawer latéral chat. Contexte = C++ généré
  (pas le JSON Blockly complet) → explique le code, diagnostique, suggère des blocs.
  Dé-corrélé du moteur. Le plus simple/utile.
- **B. A + feedback ciblé** : sur échec de compile (popup hack), bouton « Expliquer l'erreur »
  pré-remplit le compagnon.
- **C. Assistant création** : phrase → renvoie JSON Blockly à charger. Ambitieux, fragile → v2.

## Contraintes d'architecture

- Front **statique vanilla (HTML/JS + Vite), PAS Next.js** → intégration par **import en module
  ES dans le bundle Vite** (l'`'use client'`/SSR de prompt-forge est hors-sujet).
- Origine HTTPS (arduino.rayroud.com) → `navigator.gpu` disponible.
- **Ne PAS charger le modèle au boot** (uniquement au clic), sinon gel de la tablette.
- Contexte léger : envoyer le C++ généré, pas tout le workspace JSON (limite tokens).

## Idées

- Sélection auto du profil GPU selon l'appareil (`requestAdapter`) → pas de choix manuel ado.
- Bandeau « mode dégradé » explicite en repli WASM (transparence).
- Onboarding auto-généré : expliquer les blocs du workspace courant (« c'est quoi cette boucle ? »).
- Suggérer la correction d'erreur de compile pré-générée (option A+B combinées).
- v2 : génération de programme par phrase (option C) validée côté client avant injection.
- Ne pas dupliquer le runtime : chat directement dans le drawer (pas de route /compagnon séparée).

## Bloquant à trancher par David

Sur quoi tourne réellement le public ? → (1) PC/portables Chrome (vrai GPU), (2) iPad/Safari
dominant, (3) mix inconnu. Réponse = dimensionnement du profil et feuille de route.

_Voir aussi : note Obsidian « Arduino par blocs - Compagnon IA WebGPU - Faisabilité »._