import {
  Controller,
  type DynamicModule,
  Global,
  HttpCode,
  Module,
  Post,
  type Provider,
  Req,
} from '@nestjs/common';
import { BACKCHANNEL_LOGOUT_OPTIONS, BACKCHANNEL_LOGOUT_VALIDATOR, REVOCATION_STORE } from '../constants';
import { Public } from '../decorators/Public';
import type { IRevocationStore } from '../interface/IRevocationStore';
import { InMemoryRevocationStore } from '../services/InMemoryRevocationStore';
import {
  BackChannelLogoutService,
  type BackChannelLogoutOptions,
} from '../services/BackChannelLogoutService';
import type { AuthProvider } from '../types/AuthProvider';

/** Options de `BackChannelLogoutModule.register()`. */
export type BackChannelLogoutModuleOptions = BackChannelLogoutOptions & {
  /** Provider fournissant le validateur (doit supporter le Back-Channel Logout). */
  provider: AuthProvider;
  /** Store de révocation partagé. Défaut : `InMemoryRevocationStore`. */
  revocationStore?: IRevocationStore;
};

/** Chemin par défaut du endpoint de Back-Channel Logout. */
const DEFAULT_PATH = 'auth/backchannel-logout';

/** Construit dynamiquement le contrôleur monté au chemin configuré. */
function createController(path: string): new (...args: any[]) => any {
  @Controller(path)
  class BackChannelLogoutController {
    constructor(private readonly service: BackChannelLogoutService) {}

    /** Reçoit le `logout_token` (form POST) et applique la révocation. */
    @Post()
    @HttpCode(200)
    @Public()
    async handle(@Req() request: any): Promise<{ ok: true }> {
      await this.service.handle(request?.body?.logout_token);
      return { ok: true };
    }
  }
  return BackChannelLogoutController;
}

/**
 * Module (global) exposant l'endpoint OIDC Back-Channel Logout et le store de
 * révocation partagé.
 *
 * Le store est fourni sous `REVOCATION_STORE` et consommé par l'`AuthGuard` du
 * `AuthModule` pour rejeter (401) les tokens révoqués.
 *
 * @example
 * BackChannelLogoutModule.register({
 *   provider: KeycloakProvider.create({ ... }),
 *   path: 'auth/backchannel-logout',
 * })
 */
@Global()
@Module({})
export class BackChannelLogoutModule {
  /**
   * Configure le module. Valide au boot que le provider supporte le Back-Channel Logout.
   * @throws Error si le provider ne déclare pas la capacité.
   */
  static register(options: BackChannelLogoutModuleOptions): DynamicModule {
    if (!options.provider.instance.capabilities.backChannelLogout || !options.provider.backChannelLogout) {
      throw new Error(
        `BackChannelLogoutModule: provider "${options.provider.name}" does not support OIDC Back-Channel Logout.`,
      );
    }

    const store = options.revocationStore ?? new InMemoryRevocationStore();

    const providers: Provider[] = [
      { provide: REVOCATION_STORE, useValue: store },
      { provide: BACKCHANNEL_LOGOUT_VALIDATOR, useValue: options.provider.backChannelLogout },
      {
        provide: BACKCHANNEL_LOGOUT_OPTIONS,
        useValue: { revocationTtlMs: options.revocationTtlMs, path: options.path } as BackChannelLogoutOptions,
      },
      BackChannelLogoutService,
    ];

    return {
      module: BackChannelLogoutModule,
      controllers: [createController(options.path ?? DEFAULT_PATH)],
      providers,
      exports: [REVOCATION_STORE, BACKCHANNEL_LOGOUT_VALIDATOR, BackChannelLogoutService],
    };
  }
}
