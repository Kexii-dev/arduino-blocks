// Version de l'application — injectée au build par Vite (voir vite.config.js, define.APP_VERSION).
// En dev, ce fichier est lu directement par `import.meta.env` ; en prod, la valeur
// est remplacée au build par la version du package.json.
export const APP_VERSION = import.meta.env.APP_VERSION || 'dev';