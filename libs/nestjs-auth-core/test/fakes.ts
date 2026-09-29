import type {
  AuthCapabilities,
  AuthIdentity,
  IAuthInstance,
  IToken,
} from '../src/index';

/** Token factice : rôles portés par un simple tableau. */
export class FakeToken implements IToken {
  constructor(
    readonly token: string,
    readonly content: Record<string, any> = {},
    private readonly roles: string[] = [],
  ) {}
  hasRole(role: string): boolean {
    return this.roles.includes(role);
  }
  hasRealmRole(role: string): boolean {
    return this.roles.includes(role);
  }
  hasApplicationRole(_app: string, role: string): boolean {
    return this.roles.includes(role);
  }
  isExpired(): boolean {
    return false;
  }
}

export type FakeInstanceOptions = {
  capabilities?: Partial<AuthCapabilities>;
  /** Retour de validation : true = valide, false = rejet. */
  valid?: boolean;
  roles?: string[];
  content?: Record<string, any>;
  identity?: Partial<AuthIdentity>;
  /** Comportement de l'enforcer UMA : accorde ou refuse. */
  enforce?: boolean;
};

/** Instance d'authentification factice, entièrement contrôlable, sans réseau. */
export class FakeInstance implements IAuthInstance {
  readonly capabilities: AuthCapabilities;
  accessDenied = (req: any, _res: any, next: any) => {
    req.resourceDenied = true;
    next();
  };
  public validateCalls = 0;

  constructor(private readonly opts: FakeInstanceOptions = {}) {
    this.capabilities = {
      online: true,
      uma: true,
      backChannelLogout: false,
      ...(opts.capabilities ?? {}),
    };
  }

  async createGrant(tokenObj: { access_token: string }): Promise<{ access_token: IToken }> {
    return { access_token: new FakeToken(tokenObj.access_token, this.opts.content ?? {}, this.opts.roles ?? []) };
  }

  async validateAccessToken(token: IToken): Promise<IToken | false> {
    this.validateCalls += 1;
    return this.opts.valid === false ? false : token;
  }

  async validateToken(token: IToken): Promise<IToken | false> {
    this.validateCalls += 1;
    return this.opts.valid === false ? false : token;
  }

  toIdentity(token: IToken): AuthIdentity {
    return {
      provider: 'fake',
      subject: token.content.sub ?? 'sub-1',
      claims: token.content,
      ...(this.opts.identity ?? {}),
    };
  }

  enforcer(): (req: any, res: any, next: any) => Promise<void> {
    return async (req: any, _res: any, next: any) => {
      if (this.opts.enforce === false) req.resourceDenied = true;
      next();
    };
  }
}
