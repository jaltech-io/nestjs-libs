import { BadRequestException, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { BACKCHANNEL_LOGOUT_OPTIONS, BACKCHANNEL_LOGOUT_VALIDATOR, REVOCATION_STORE } from '../constants';
import type { IBackChannelLogoutValidator } from '../interface/IBackChannelLogout';
import type { IRevocationStore } from '../interface/IRevocationStore';

/** Options du traitement de Back-Channel Logout. */
export type BackChannelLogoutOptions = {
  /**
   * Durée de rétention des révocations (ms). Doit être ≥ durée de vie maximale
   * d'un access token. Défaut : `3600000` (1 h).
   */
  revocationTtlMs?: number;
  /** Chemin HTTP du endpoint. Défaut : `auth/backchannel-logout`. */
  path?: string;
};

/** TTL de révocation par défaut : 1 heure. */
const DEFAULT_REVOCATION_TTL = 60 * 60 * 1000;

/**
 * Service générique de Back-Channel Logout OIDC.
 *
 * Valide le `logout_token` via le validateur du provider, applique la protection
 * anti-rejeu (`jti`), puis révoque `sid`/`sub` dans le store de révocation.
 * Ne journalise jamais le token ni les claims.
 */
@Injectable()
export class BackChannelLogoutService {
  private readonly logger = new Logger(BackChannelLogoutService.name);
  private readonly revocationTtlMs: number;

  constructor(
    @Inject(BACKCHANNEL_LOGOUT_VALIDATOR) private readonly validator: IBackChannelLogoutValidator,
    @Inject(REVOCATION_STORE) private readonly store: IRevocationStore,
    @Optional() @Inject(BACKCHANNEL_LOGOUT_OPTIONS) options?: BackChannelLogoutOptions,
  ) {
    this.revocationTtlMs = options?.revocationTtlMs ?? DEFAULT_REVOCATION_TTL;
  }

  /**
   * Traite un `logout_token` reçu du provider.
   * @throws BadRequestException si le token est invalide ou rejoué (→ 400).
   */
  async handle(logoutToken: string | undefined): Promise<void> {
    if (!logoutToken || typeof logoutToken !== 'string') {
      throw new BadRequestException('Missing logout_token');
    }

    let event: Awaited<ReturnType<IBackChannelLogoutValidator['validateLogoutToken']>>;
    try {
      event = await this.validator.validateLogoutToken(logoutToken);
    } catch (err) {
      this.logger.warn(`Rejected logout_token: ${(err as Error).message}`);
      throw new BadRequestException('Invalid logout_token');
    }

    const expiresAt = Date.now() + this.revocationTtlMs;

    // Anti-rejeu : un jti déjà vu est refusé.
    const fresh = await this.store.registerJti(event.jti, expiresAt);
    if (!fresh) {
      this.logger.warn('Rejected logout_token: jti replay');
      throw new BadRequestException('Replayed logout_token');
    }

    // OIDC Back-Channel Logout 1.0, § 2.6 : un logout_token portant un `sid` ne désigne QUE
    // cette session. Révoquer aussi le sujet bloquait toute NOUVELLE connexion de l'utilisateur
    // pendant toute la durée de rétention. Le sujet n'est révoqué que sans `sid` (« toutes les
    // sessions de cet utilisateur »).
    if (event.sid) await this.store.revokeSid(event.sid, expiresAt);
    else if (event.subject) await this.store.revokeSubject(event.provider, event.subject, expiresAt);

    this.logger.log(`Back-channel logout processed for issuer ${event.issuer}`);
  }
}
