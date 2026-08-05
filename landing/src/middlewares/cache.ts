export const ONE_HOUR: number = 3600;
export const ONE_YEAR: number = 31_536_000;
export const CACHE_VERSION: string = process.env.CACHE_VERSION!;

export function generalCacheMiddleware(c: any, next: any) {
  // Same reason as versionedStaticCacheMiddleware below: half an hour of max-age in
  // dev means a reload keeps serving the document from before the edit.
  c.header(
    "Cache-Control",
    process.env.NODE_ENV === "production"
      ? `public, max-age=${ONE_HOUR / 2}, stale-while-revalidate=${ONE_HOUR * 6}`
      : "no-store"
  );
  return next();
}

export function cacheVersionMiddleware(c: any, next: any) {
  c.set("CACHE_VERSION", CACHE_VERSION);
  return next();
}

export function versionedStaticCacheMiddleware(c: any, next: any) {
  // CACHE_VERSION only moves on release, so in dev every rebuild is served from the
  // same /public/<version>/ URL. With `immutable` the browser pins whichever
  // snapshot it fetched first and never asks again: edits to _output.css and the
  // client bundles silently don't arrive.
  c.header(
    "Cache-Control",
    process.env.NODE_ENV === "production"
      ? `public, max-age=${ONE_YEAR}, immutable`
      : "no-store"
  );
  return next();
}
