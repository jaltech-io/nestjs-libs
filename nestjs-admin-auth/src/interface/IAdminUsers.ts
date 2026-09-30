export interface CreateUserInput {
  email: string;
  firstName: string;
  lastName: string;
  /** Identifiant de connexion. Si absent, l'email est utilisé comme username. */
  username?: string;
}

/**
 * Contrat pour la gestion des utilisateurs côté fournisseur d'identité.
 * L'app dépend uniquement de cette interface — jamais de KcAdminUsers directement.
 */
export interface IAdminUsers {
  /** Crée l'utilisateur dans l'IdP. Retourne son identifiant unique (sub). */
  createUser(input: CreateUserInput): Promise<{ sub: string }>;

  /** Liste les utilisateurs du realm (via le service account — ne nécessite pas l'admin master). */
  listUsers(max?: number): Promise<{ id: string; username: string }[]>;

  /**
   * Définit le mot de passe de l'utilisateur.
   * @param temporary - Si true, l'utilisateur devra le changer à la 1ère connexion.
   */
  setPassword(sub: string, password: string, temporary: boolean): Promise<void>;

  /** Envoie l'email d'invitation "Définir mon mot de passe" via l'IdP. */
  sendInvitationEmail(sub: string): Promise<void>;

  /** Ajoute l'utilisateur à un groupe (lui attribue le rôle du groupe). */
  addToGroup(sub: string, groupId: string): Promise<void>;

  /** Retire l'utilisateur d'un groupe. */
  removeFromGroup(sub: string, groupId: string): Promise<void>;

  /** Supprime l'utilisateur de l'IdP. */
  deleteUser(sub: string): Promise<void>;

  /** Met à jour le prénom/nom de l'utilisateur. */
  updateProfile(sub: string, data: { firstName?: string; lastName?: string }): Promise<void>;

  /** Liste les sessions actives de l'utilisateur. */
  listSessions(sub: string): Promise<KcSession[]>;

  /** Révoque une session (déconnexion à distance). */
  revokeSession(sessionId: string): Promise<void>;
}

export interface KcSession {
  id: string;
  ipAddress: string;
  start: number;
  lastAccess: number;
  clients: Record<string, string>;
}
