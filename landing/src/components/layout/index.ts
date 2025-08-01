import { html } from "hono/html";
import { HtmlEscapedString } from "hono/utils/html";
import { config } from "dotenv";
import navbar from "../navbar";
import tree from "../tree";
import footer from "../footer";

config();

const CACHE_VERSION = process.env.CACHE_VERSION!;

type LayoutProps = {
  siteData: {
    title: string;
    description: string;
    lang: string;
  };
  withFooter?: boolean;
  withIlustration?: boolean;
  resetScroll?: boolean;
  children?: HtmlEscapedString | Promise<HtmlEscapedString>;
};

export default function layout({
  siteData,
  withFooter = true,
  withIlustration = false,
  resetScroll = false,
  children,
}: LayoutProps) {
  return html`
    <!DOCTYPE html>
    <html lang="${siteData.lang}">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📚</text></svg>"
        />

        <!-- Primary Meta Tags -->
        <title>${siteData.title}</title>
        <meta name="title" content="${siteData.title}" />
        <meta name="description" content="${siteData.description}" />

        <!-- Open Graph / Facebook -->
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://emiliacabral.com/" />
        <meta property="og:title" content="${siteData.title}" />
        <meta property="og:description" content="${siteData.description}" />
        <meta property="og:image" content="/public/preview.png" />

        <!-- Twitter -->
        <meta property="twitter:card" content="/public/preview.png" />
        <meta property="twitter:url" content="https://emiliacabral.com/" />
        <meta property="twitter:title" content="${siteData.title}" />
        <meta
          property="twitter:description"
          content="${siteData.description}"
        />
        <meta property="twitter:image" content="/public/preview.png" />

        <!-- Posthog -->
        <script>
          !(function (t, e) {
            var o, n, p, r;
            e.__SV ||
              ((window.posthog = e),
              (e._i = []),
              (e.init = function (i, s, a) {
                function g(t, e) {
                  var o = e.split(".");
                  2 == o.length && ((t = t[o[0]]), (e = o[1])),
                    (t[e] = function () {
                      t.push(
                        [e].concat(Array.prototype.slice.call(arguments, 0))
                      );
                    });
                }
                ((p = t.createElement("script")).type = "text/javascript"),
                  (p.crossOrigin = "anonymous"),
                  (p.async = !0),
                  (p.src =
                    s.api_host.replace(
                      ".i.posthog.com",
                      "-assets.i.posthog.com"
                    ) + "/static/array.js"),
                  (r =
                    t.getElementsByTagName(
                      "script"
                    )[0]).parentNode.insertBefore(p, r);
                var u = e;
                for (
                  void 0 !== a ? (u = e[a] = []) : (a = "posthog"),
                    u.people = u.people || [],
                    u.toString = function (t) {
                      var e = "posthog";
                      return (
                        "posthog" !== a && (e += "." + a),
                        t || (e += " (stub)"),
                        e
                      );
                    },
                    u.people.toString = function () {
                      return u.toString(1) + ".people (stub)";
                    },
                    o =
                      "init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug getPageViewId".split(
                        " "
                      ),
                    n = 0;
                  n < o.length;
                  n++
                )
                  g(u, o[n]);
                e._i.push([i, s, a]);
              }),
              (e.__SV = 1));
          })(document, window.posthog || []);
          posthog.init("phc_A5rSMcILj7RSGSsDaYZ0MIIKkhZKGjla9AZpVlpB56N", {
            api_host: "https://us.i.posthog.com",
            person_profiles: "identified_only", // or 'always' to create profiles for anonymous users as well
          });
        </script>

        <!-- Lottie -->
        <link
          rel="preload"
          href="/public/${CACHE_VERSION}/_dotlottie-bundle.js"
          as="script"
          crossorigin="anonymous"
        />

        <!-- Dropdown -->
        <script src="/public/${CACHE_VERSION}/_dropdown-bundle.js"></script>

        <!-- Google Fonts -->
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&display=swap"
          rel="stylesheet"
        />

        <!-- CSS -->
        <link rel="stylesheet" href="/public/${CACHE_VERSION}/_output.css" />
        <style>
          @keyframes move-out {
            0% {
              opacity: 100%;
              filter: blur(0px);
            }

            80% {
              opacity: 0%;
              filter: blur(10px);
            }

            100% {
              opacity: 0%;
              filter: blur(10px);
            }
          }

          @keyframes move-in {
            from {
              transform: translateX(100%);
              opacity: 0%;
            }

            to {
              transform: translateX(0%);
              opacity: 100%;
            }
          }

          @view-transition {
            navigation: auto;
          }

          #content {
            view-transition-name: content;
            contain: paint;
          }

          html {
            scroll-behavior: auto;
          }

          @media (prefers-reduced-motion: no-preference) {
            html {
              scroll-behavior: smooth;
            }

            ::view-transition-old(content) {
              animation: 100ms cubic-bezier(0.17, 0.67, 0.81, 0.35) both
                move-out;
            }

            ::view-transition-new(content) {
              animation: 300ms cubic-bezier(0.42, 0.28, 0.42, 0.89) both move-in;
              animation-delay: 100ms;
            }
          }
        </style>
        ${resetScroll
          ? html`<script>
              if ("scrollRestoration" in history) {
                history.scrollRestoration = "manual";
                window.scrollTo({ top: 0, left: 0, behavior: "auto" });
              }
            </script> `
          : ""}
      </head>

      <body
        class="text-stone-800 dark:text-stone-100 overscroll-none md:overscroll-auto"
      >
        <div
          id="overlay-content"
          class="relative overflow-hidden shadow-lg flex flex-col min-h-static-screen bg-stone-100 z-10 dark:bg-stone-800 prose-h1:text-3xl"
        >
          <div
            class="absolute -z-10 top-[25vh] left-0 w-full h-[150vh] radial-green-gradient dark:radial-maroon-gradient"
          ></div>
          ${withIlustration
            ? html`
                <div
                  class="absolute bottom-0 w-[50vw] right-0 h-static-screen overflow-hidden"
                >
                  ${tree()}
                </div>
              `
            : null}
          <div class="flex flex-col h-fit">
            ${navbar({ lang: siteData.lang })}
            <main
              id="content"
              class="min-h-static-screen-minus-nav overflow-hidden flex flex-col justify-between md:justify-start w-full px-4 sm:px-8 md:pt-6 m-auto max-w-[60rem] h-full pb-16 md:pb-24"
            >
              ${children}
            </main>
          </div>
        </div>
        ${withFooter ? footer({ lang: siteData.lang }) : null}
        <script>
          if (
            window.matchMedia("(prefers-reduced-motion: no-preference)").matches
          ) {
            const overlayContent = document.getElementById("overlay-content");
            if (overlayContent) {
              let timeout;
              window.addEventListener("scroll", () => {
                const overlayContentHeight = overlayContent.offsetHeight;
                const scrolled =
                  window.scrollY >
                  overlayContentHeight - window.innerHeight + 1;
                overlayContent.classList.toggle("scrolled", scrolled);

                // Debounce scroll handler to handle inertial scrolling animations
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                  const scrolledPast =
                    window.scrollY >
                    overlayContentHeight - window.innerHeight + 1;
                  overlayContent.classList.toggle("scrolled", scrolledPast);
                }, 1000);
              });
            }
          }
        </script>
      </body>
    </html>
  `;
}
