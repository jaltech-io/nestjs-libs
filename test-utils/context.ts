import 'reflect-metadata';

/** Métadonnées à poser sur le handler ou la classe simulés. */
export type Meta = Record<string, unknown>;

export type FakeContextInput = {
  request?: any;
  response?: any;
  handlerMeta?: Meta;
  classMeta?: Meta;
  type?: string;
};

/**
 * Construit un `ExecutionContext` NestJS minimal pour tester les guards sans
 * démarrer d'application. Les métadonnées des décorateurs sont posées via
 * `Reflect.defineMetadata` sur des fonctions handler/classe factices.
 */
export function makeExecutionContext(input: FakeContextInput = {}): any {
  const handler = function testHandler() {};
  class TestClass {}

  for (const [key, value] of Object.entries(input.handlerMeta ?? {})) {
    Reflect.defineMetadata(key, value, handler);
  }
  for (const [key, value] of Object.entries(input.classMeta ?? {})) {
    Reflect.defineMetadata(key, value, TestClass);
  }

  const request = input.request ?? {};
  const response = input.response ?? {};

  return {
    getType: () => input.type ?? 'http',
    getHandler: () => handler,
    getClass: () => TestClass,
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  };
}
