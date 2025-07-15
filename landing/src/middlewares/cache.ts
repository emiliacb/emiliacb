export const ONE_HOUR: number = 3600;
export const ONE_YEAR: number = 31_536_000;
export const CACHE_VERSION: string = process.env.CACHE_VERSION!;

export function noStoreCacheMiddleware(c: any, next: any) {
  if (c.req.path === "/public/_output.css") {
    c.header("Cache-Control", "no-store");
  }
  return next();
}

export function generalCacheMiddleware(c: any, next: any) {
  c.header(
    "Cache-Control",
    `public, max-age=${ONE_HOUR / 2}, stale-while-revalidate=${ONE_HOUR * 6}`
  );
  return next();
}

export function cacheVersionMiddleware(c: any, next: any) {
  c.set("CACHE_VERSION", CACHE_VERSION);
  return next();
}

export function versionedStaticCacheMiddleware(c: any, next: any) {
  c.header("Cache-Control", `public, max-age=${ONE_YEAR}, immutable`);
  return next();
}
