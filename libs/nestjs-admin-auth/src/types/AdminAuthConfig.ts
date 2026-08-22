export interface AdminAuthConfig {
  authServerUrl: string;
  realm: string;
  /** Client ID du service account (ex: admin-api) */
  clientId: string;
  clientSecret: string;
  /**
   * Activer l'envoi d'emails d'invitation via Keycloak.
   * Mettre à false tant que le serveur SMTP n'est pas configuré dans Keycloak.
   * Les utilisateurs sont alors créés sans email — le mot de passe se gère
   * manuellement depuis la console Keycloak.
   * @default false
   */
  sendEmails?: boolean;
}
