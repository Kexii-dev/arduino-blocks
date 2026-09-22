# Sécurité

## Signaler une vulnérabilité

S'il vous plaît **ne publiez pas** de faille non corrigée dans une issue publique ou un pull request.

- **Signalement privé** : envoyez un e-mail à **security@rayroud.com** (contacts de maintenance sur le profil du compte `Kexii-dev`).
- **Timing** : nous accuserons réception sous **48 h** et vous tiendrons informé(e) de l'évaluation et des correctifs.
- **Bounty** : aucun programme de prime formel à ce stade — mais nous créditons publiquement les chercheurs responsables (via `SECURITY.md #Acknowledgements`).

## Portée

Ce dépôt est le **front statique** de l'application (Blockly 13.3 + Vite). Il n'embarque pas le backend
(compile `arduino-cli` + comptes), qui vit dans un service séparé derrière `/api/`. Les vulnérabilités du
front concernent : le code exécuté dans le navigateur (`src/`), les dépendances runtime (`blockly`, `avr8js`),
et la configuration de build (`vite.config.js`).

## Politique de divulgation

1. La faille est traitée en privé jusqu'à un correctif ou une décision.
2. Nous publions un avis (commit / advisory GitHub) au correctif.
3. Vous pouvez demander le crédit public (pseudo / nom) — défaut : anonymat.

Merci de contribuer à rendre ce projet plus sûr.