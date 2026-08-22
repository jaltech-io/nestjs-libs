export interface GroupInfo {
  groupId: string;
  name: string;
}

export interface GroupMember {
  sub: string;
  email: string;
}

/**
 * Contrat pour la gestion des groupes côté fournisseur d'identité.
 * L'app dépend uniquement de cette interface — jamais de KcAdminGroups directement.
 *
 * Les rôles sont des CLIENT roles du client configuré (ex: admin-api),
 * jamais des realm roles — Keycloak reste agnostique des domaines métier.
 */
export interface IAdminGroups {
  /** Crée un rôle client dans l'IdP s'il n'existe pas déjà. Idempotent. */
  createRole(roleName: string, description?: string): Promise<void>;

  /**
   * Crée le groupe dans l'IdP. Retourne son identifiant interne.
   * Avec `parentId`, le groupe est créé comme sous-groupe de `parentId` (arborescence),
   * plutôt qu'au niveau racine.
   */
  createGroup(name: string, parentId?: string): Promise<{ groupId: string }>;

  /** Cherche un groupe racine par nom exact. `null` s'il n'existe pas. */
  findGroupByName(name: string): Promise<{ groupId: string } | null>;

  /** Attribue un rôle client au groupe (tous les membres héritent du rôle). */
  assignRole(groupId: string, roleName: string): Promise<void>;

  /** Retire un rôle client du groupe. */
  removeRole(groupId: string, roleName: string): Promise<void>;

  /** Supprime le groupe. */
  deleteGroup(groupId: string): Promise<void>;

  /** Liste tous les groupes. */
  listGroups(): Promise<GroupInfo[]>;

  /** Liste les membres d'un groupe. */
  listMembers(groupId: string): Promise<GroupMember[]>;
}
