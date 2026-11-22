/** Conventional Commits: exige prefijo tipo (feat, fix, docs, chore, ...).
 *  Usado por CI en los PRs; release-please genera el CHANGELOG a partir
 *  de estos mensajes. */
export default {
  extends: ["@commitlint/config-conventional"],
};
