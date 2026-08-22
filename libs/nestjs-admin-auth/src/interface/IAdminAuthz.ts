export interface AuthzScope {
  id: string;
  name: string;
}

export interface AuthzResource {
  id: string;
  name: string;
  displayName?: string;
  /** Type logique (ex: urn:projectflow:program, urn:projectflow:custom). */
  type?: string;
  scopes: AuthzScope[];
}

export interface AuthzPolicy {
  id: string;
  name: string;
  /** Type Keycloak de la policy (ex: "role"). */
  type: string;
}

export interface AuthzPermission {
  id: string;
  name: string;
  /** Noms des ressources couvertes par la permission. */
  resourceNames: string[];
  /** Noms des scopes couverts (ex: READ, UPDATE). */
  scopeNames: string[];
  /** Noms des policies associées (ex: role:org_admin). */
  policyNames: string[];
}

export interface EnsureResourceInput {
  name: string;
  displayName?: string;
  type?: string;
  /** Scopes (par nom) portés par la ressource — créés au niveau resource-server s'ils manquent. */
  scopeNames: string[];
}

/**
 * Contrat pour la gestion des Authorization Services (fine-grained authz)
 * du client configuré (ex: admin-api) côté fournisseur d'identité.
 * L'app dépend uniquement de cette interface — jamais de KcAdminAuthz directement.
 *
 * Modèle : les SCOPES (READ/CREATE/UPDATE/DELETE) sont globaux au resource-server ;
 * chaque RESSOURCE les porte ; une PERMISSION de scope relie (ressource × scopes)
 * à des POLICIES basées sur les rôles client existants.
 *
 * Toutes les méthodes ensure* sont idempotentes (find-or-create) — utilisables
 * par un seed relançable autant que par un CRUD d'interface.
 */
export interface IAdminAuthz {
  /**
   * Active les Authorization Services sur le client configuré s'ils ne le sont
   * pas déjà (authorizationServicesEnabled + serviceAccountsEnabled). Idempotent.
   */
  ensureAuthorizationEnabled(): Promise<void>;

  // ── Scopes ────────────────────────────────────────────────────────────────

  listScopes(): Promise<AuthzScope[]>;

  /** Crée le scope s'il n'existe pas. Retourne le scope existant sinon. */
  ensureScope(name: string): Promise<AuthzScope>;

  // ── Ressources ────────────────────────────────────────────────────────────

  listResources(): Promise<AuthzResource[]>;

  /** Cherche une ressource par nom exact. `null` si absente. */
  findResourceByName(name: string): Promise<AuthzResource | null>;

  /**
   * Crée la ressource si absente, sinon s'assure que les scopes demandés lui
   * sont bien attachés (les scopes manquants du resource-server sont créés).
   */
  ensureResource(input: EnsureResourceInput): Promise<AuthzResource>;

  /** Supprime la ressource (et les permissions Keycloak qui la référencent). */
  deleteResource(resourceId: string): Promise<void>;

  // ── Policies (role-based) ─────────────────────────────────────────────────

  listRolePolicies(): Promise<AuthzPolicy[]>;

  /**
   * Crée une policy role-based (logic POSITIVE) pointant le CLIENT role donné,
   * si elle n'existe pas déjà. Le rôle client doit exister.
   */
  ensureRolePolicy(policyName: string, clientRoleName: string): Promise<AuthzPolicy>;

  // ── Permissions (scope-based) ─────────────────────────────────────────────

  listPermissions(): Promise<AuthzPermission[]>;

  /** Détail d'une permission (ressources, scopes, policies associés). */
  getPermission(permissionId: string): Promise<AuthzPermission | null>;

  /**
   * Aligne les permissions d'une ressource sur la matrice donnée : pour chaque
   * scope, une permission nommée `perm:<ressource>:<scope>` (decisionStrategy
   * AFFIRMATIVE) reliée aux policies listées. Une entrée sans policy supprime
   * la permission correspondante (retour au refus par défaut). Idempotent.
   */
  setResourcePermissions(
    resourceName: string,
    matrix: Array<{ scopeName: string; policyNames: string[] }>,
  ): Promise<void>;

  /** Supprime une permission par id. */
  deletePermission(permissionId: string): Promise<void>;
}
