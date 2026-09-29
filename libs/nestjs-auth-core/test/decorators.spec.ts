import { describe, expect, it } from 'vitest';
import { Public, META_PUBLIC } from '../src/decorators/Public';
import { Roles, RoleMatchingMode, META_ROLES, META_ROLE_MATCHING_MODE } from '../src/decorators/Roles';
import { Resource, META_RESOURCE } from '../src/decorators/Resource';
import { Scopes, ConditionalScopes, META_SCOPES, META_CONDITIONAL_SCOPES } from '../src/decorators/Scopes';
import { UseEnforcerOptions, META_ENFORCER_OPTIONS } from '../src/decorators/UseEnforcerOptions';
import { RoleMatch } from '../src/constants';

/** Applique un décorateur de méthode et lit la métadonnée posée. */
function metaOf(decorator: MethodDecorator, key: string): unknown {
  class Target {
    handler() {}
  }
  decorator(Target.prototype, 'handler', Object.getOwnPropertyDescriptor(Target.prototype, 'handler')!);
  return Reflect.getMetadata(key, Target.prototype.handler);
}

describe('metadata decorators', () => {
  it('@Public sets the public flag', () => {
    expect(metaOf(Public() as MethodDecorator, META_PUBLIC)).toBe(true);
  });

  it('@Roles / @RoleMatchingMode set roles and mode', () => {
    expect(metaOf(Roles('admin', 'user') as MethodDecorator, META_ROLES)).toEqual(['admin', 'user']);
    expect(metaOf(RoleMatchingMode(RoleMatch.ALL) as MethodDecorator, META_ROLE_MATCHING_MODE)).toBe(RoleMatch.ALL);
  });

  it('@Resource / @Scopes / @ConditionalScopes set their metadata', () => {
    expect(metaOf(Resource('Product') as MethodDecorator, META_RESOURCE)).toBe('Product');
    expect(metaOf(Scopes('View', 'Edit') as MethodDecorator, META_SCOPES)).toEqual(['View', 'Edit']);
    const fn = () => ['X'];
    expect(metaOf(ConditionalScopes(fn) as MethodDecorator, META_CONDITIONAL_SCOPES)).toBe(fn);
  });

  it('@UseEnforcerOptions sets enforcer options', () => {
    const opts = { response_mode: 'decision' as const };
    expect(metaOf(UseEnforcerOptions(opts) as MethodDecorator, META_ENFORCER_OPTIONS)).toBe(opts);
  });
});
