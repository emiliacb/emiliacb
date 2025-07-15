import "hono";

declare module "hono" {
  interface ContextVariableMap {
    CACHE_VERSION: string;
  }
}
