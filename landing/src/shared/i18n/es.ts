import type { Dict } from "./index";

/** Spanish dictionary. Same keys as en.ts, enforced by the `Dict` type. */
export const es: Dict = {
  markdown: {
    tableOfContents: "Tabla de Contenidos:",
  },

  nav: {
    brand: "Emilia",
    skipToContent: "Saltar al contenido",
    mainNavigation: "Navegación principal",
    about: "Sobre mí",
    whoIAm: "Quién Soy",
    whatIDo: "Qué Hago",
    journal: "Diario",
  },

  footer: {
    tagline: "Ingeniera de Software Senior con mentalidad de producto.",
    navigation: "Navegación",
    navigationLabel: "Navegación del pie de página",
    contact: "Contacto",
    license: "Licensed under Apache 2.0 and CC BY 4.0.",
  },

  language: {
    label: "Idioma",
    flagEmoji: "Flag emoji",
    names: {
      en: "English",
      es: "Español",
    },
  },

  contact: {
    email: "Email",
    linkedin: "LinkedIn",
    github: "GitHub",
    schedule: "Agendar",
    scheduleAction: "una consulta",
    scheduleFull: "Agendar una consulta",
  },

  emailLink: {
    copy: "Copiar email",
    copied: "¡Copiado!",
    gmail: "Abrir en Gmail",
    superhuman: "Abrir en Superhuman",
  },

  pages: {
    home: {
      title: "ємιℓιαċв",
      description:
        "Emilia CB — Ingeniera de Software Senior construyendo productos con IA, desarrollo full-stack y enfoque en el usuario.",
      navTitle: "Inicio",
      mapTitle: "Inicio",
      blurb:
        "Página de inicio: presentación de Emilia CB, ingeniera de software senior que construye productos con IA y apps full-stack, con foco en el usuario.",
    },
    about: {
      title: "Who I Am | ємιℓιαċв",
      description:
        "Conocé el recorrido, habilidades y enfoque de Emilia CB en ingeniería de software y desarrollo de productos.",
      navTitle: "Sobre mí",
      mapTitle: "Sobre mí",
      blurb:
        "Trayectoria, habilidades y enfoque en ingeniería de software y desarrollo de producto.",
    },
    services: {
      title: "What I Offer | ємιℓιαċв",
      description:
        "Servicios de ingeniería de software: integración de IA, desarrollo full-stack y consultoría técnica.",
      navTitle: "Servicios",
      mapTitle: "Servicios",
      blurb: "Servicios de integración de IA, desarrollo full-stack y consultoría técnica.",
    },
    courses: {
      title: "Cursos | ємιℓιαċв",
      description: "Un vistazo a los cursos que Emilia CB está construyendo.",
      navTitle: "Cursos",
      mapTitle: "Cursos",
      blurb: "Cursos prácticos de IA generativa para no programadores y equipos.",
    },
    blog: {
      title: "Diario | ємιℓιαċв",
      description: "Artículos sobre ingeniería de software, IA y desarrollo de productos.",
      navTitle: "Diario",
      mapTitle: "Diario",
      blurb: "Artículos sobre ingeniería de software, IA y desarrollo de productos.",
    },
    "labs-distortion": {
      title: "Labs: Página líquida | ємιℓιαċв",
      description:
        "Toda esta página — navbar incluida — es una textura WebGL. Mové el mouse para torcerla.",
      navTitle: "Labs: Página líquida",
      mapTitle: "Labs: Página líquida",
      blurb: "Experimento de distorsión WebGL de página completa, prueba de concepto.",
    },
    "labs-distortion-bg": {
      title: "Labs: Fondo líquido | ємιℓιαċв",
      description:
        "Solo el gradiente y la ilustración detrás de esta tarjeta son una textura WebGL. El navbar y este texto quedan quietos — mové el mouse sobre la página.",
      navTitle: "Labs: Fondo líquido",
      mapTitle: "Labs: Fondo líquido",
      blurb: "Experimento de distorsión WebGL de fondo, prueba de concepto.",
    },
  },

  notFound: {
    title: "404 | ємιℓιαċв",
    description: "Página no encontrada",
    message: "La página que buscas no existe.",
    cta: "Volver al inicio",
  },

  blog: {
    heading: "Diario",
    intro: "Este diario intenta ser una colección de pensamientos y proyectos.",
    empty: "Posts coming soon...",
  },

  courses: {
    heading: "Cursos",
    intro:
      "Cursos prácticos de IA generativa, sin vueltas: para no programadores y para equipos que quieren moverse más rápido.",
    comingSoon: "Próximamente",
    items: [
      {
        title: "Primeros pasos con IA",
        description:
          "Los fundamentos de cómo funciona la IA generativa y cómo usarla en tu día a día, sin necesitar experiencia técnica.",
      },
      {
        title: "Construí tu primera app con Claude Code",
        description:
          "Usá Claude Code para crear y lanzar proyectos reales sin escribir una línea de código vos mismo.",
      },
      {
        title: "Automatización interna con Hermes",
        description:
          "Cómo desplegar un agente Hermes auto-hospedado para automatización interna en tu empresa: casos de uso reales.",
      },
    ],
  },

  labs: {
    distortion: {
      title: "Página líquida",
      subtitle:
        "Toda esta página — navbar incluida — es una textura WebGL. Mové el mouse para torcerla.",
      how: "Cómo funciona",
      step1:
        "El DOM renderizado se captura como imagen (SVG foreignObject vía html-to-image).",
      step2:
        "La captura pasa a ser una textura sobre un quad fullscreen de Three.js, distorsionada por píxel en un fragment shader (twist, remolino, arrastre y ondas alrededor del cursor).",
      step3:
        "El DOM real queda debajo con opacity 0 pero interactivo: lo que clickeás es la página invisible, lo que ves es el shader.",
      toggle: "Activar / desactivar",
      toggleHint:
        "…o apretá Escape. Este botón es parte de la prueba: estás clickeando el DOM invisible.",
      caveats:
        "Limitaciones del POC: la captura es una foto estática (los hover no se repintan) y respeta prefers-reduced-motion quedándose apagado.",
      linkProof: "Los links siguen funcionando →",
    },
    distortionBg: {
      title: "Fondo líquido",
      subtitle:
        "Solo el gradiente y la ilustración detrás de esta tarjeta son una textura WebGL. El navbar y este texto quedan quietos — mové el mouse sobre la página.",
      how: "En qué se diferencia del POC de página completa",
      step1:
        "Se captura solo la capa decorativa de #overlay-content (el gradiente + la ilustración del árbol), excluyendo navbar y contenido.",
      step2:
        "La captura pasa a ser una textura sobre un quad de Three.js ubicado exactamente detrás del contenido, en el mismo z-index que el gradiente original.",
      step3:
        "Acá no hace falta nada invisible-pero-clickeable: esta capa no tiene links, así que el canvas simplemente la reemplaza en el mismo lugar.",
      caveats:
        "Limitación del POC: es una foto estática — la animación propia de la ilustración se congela al momento de la captura.",
      linkProof: "Los links siguen funcionando →",
    },
  },
};
