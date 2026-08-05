import { RateLimiterMemory } from "rate-limiter-flexible";
import { html } from "hono/html";
import layout from "../components/layout";

const BLOCK_SECONDS: number = 120;
const ipLimiter = new RateLimiterMemory({
  points: 300,
  duration: 30,
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

    const view = layout({
      siteData: {
        title: "429 | ємιℓιαċв",
        description: "Too many requests",
        lang: "en",
      },
      withFooter: false,
      children: html`
        <section
          class="py-16 md:py-24 flex flex-col items-center text-center gap-4 md:gap-6"
        >
          <h1 class="text-6xl md:text-8xl font-extrabold tracking-tight">429</h1>
          <p class="text-base md:text-lg opacity-80">
            You've been blocked due to too many requests. Please wait ${waitTime} seconds.
          </p>
        </section>
      `,
    });

    return c.html(view, 429);
  }
};
