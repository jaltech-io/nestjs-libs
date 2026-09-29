/**
 * Principal applicatif résolu à partir d'une `AuthIdentity`.
 *
 * Retourné par `IPrincipalResolver.resolve(identity)`. Positionné sur
 * `request.user` par l'`AuthGuard` ; ses `roles` REMPLACENT les rôles du token
 * pour l'évaluation du `RoleGuard`.
 */
export type AuthPrincipal = {
  /** Identifiant stable du sujet (repris de l'identité). */
  subject: string;
  /** Adresse e-mail si connue. */
  email?: string;
  /** Nom d'affichage si connu. */
  displayName?: string;
  /** Rôles applicatifs — utilisés par le `RoleGuard` à la place des rôles du token. */
  roles: string[];
  /** Attributs applicatifs additionnels (organisation, permissions fines, etc.). */
  [key: string]: unknown;
};
