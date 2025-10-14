import { RateLimiterMemory } from "rate-limiter-flexible";

const BLOCK_SECONDS: number = 120;
const ipLimiter = new RateLimiterMemory({
  points: 120,
  duration: 60,
});

export const rateLimiterMiddleware = async (c: any, next: any) => {
  const ip = c.req.ip;
  const { msBeforeNext } = (await ipLimiter.get(ip)) || {};

  try {
    await ipLimiter.consume(ip);
    await next();
  } catch (error) {
    await ipLimiter.block(ip, BLOCK_SECONDS);
    const waitTime = String(msBeforeNext ? Math.trunc(msBeforeNext / 1000) : BLOCK_SECONDS);
    c.header("Retry-After", waitTime);
    return c.html(
      `You have been blocked due too many requests. Please wait ${waitTime} seconds.`,
      429
    );
  }
};
