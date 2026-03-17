class DropdownTrigger extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        /* Hide the dropdown content until the component is defined */
        :host(:not(:defined)) slot:not([name="icon"]) {
          display: none;
        }

        .dropdown-content {
          position: absolute;
          margin-top: 0.5rem;
          transform: translateX(-50%) scale(0.96);
          transform-origin: top center;
          left: 50%;
          opacity: 0;
          pointer-events: none;
          transition: opacity 200ms cubic-bezier(0.23, 1, 0.32, 1),
                      transform 200ms cubic-bezier(0.23, 1, 0.32, 1);
        }

        .dropdown-content.show {
          opacity: 1;
          transform: translateX(-50%) scale(1);
          pointer-events: auto;
        }

        button {
          all: unset;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
        }

        ::slotted([slot="icon"]) {
          display: inline-flex;
          margin-right: 0.25rem;
        }

        button:focus-visible {
          outline: 2px solid currentColor;
          outline-offset: 2px;
        }

        .icon {
          margin-left: 0.2rem;
          width: 1rem;
          height: 1rem;
          transform: rotate(0deg);
          transition: transform 200ms cubic-bezier(0.23, 1, 0.32, 1);
          mix-blend-mode: difference;
        }

        .icon.open {
          transform: rotate(180deg);
        }

        .variant-small {
          font-size: 14px;
          padding: 0.2rem !important;
          margin-left: -0.2rem;
        }

        @media (prefers-reduced-motion: reduce) {
          .dropdown-content {
            transition: opacity 100ms linear;
            transform: translateX(-50%) scale(1) !important;
          }
        }

      </style>

      <div>
        <button class="button" part="trigger" aria-expanded="false" aria-haspopup="true">
          <slot name="icon"></slot>
          <span part="label"></span>
          <svg part="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <div part="content" class="dropdown-content"><slot></slot></div>
      </div>
    `;
  }

  connectedCallback() {
    this.trigger = this.shadowRoot.querySelector('[part="trigger"]');
    this.content = this.shadowRoot.querySelector('[part="content"]');
    this.label = this.shadowRoot.querySelector('[part="label"]');
    this.icon = this.shadowRoot.querySelector(".icon");

    // Apply the variant-<value> class to the trigger if the variant attribute is present
    this.applyVariantClass();

    this.trigger.addEventListener("click", () => this.toggle());
    this.label.textContent = this.getAttribute("label") || "";

    // Close dropdown when clicking outside
    this._onDocumentClick = (e) => {
      if (!this.contains(e.target) && !this.shadowRoot.contains(e.target)) {
        this.close();
      }
    };
    document.addEventListener("click", this._onDocumentClick);

    // Close dropdown on Escape key and return focus to trigger
    this._onKeyDown = (e) => {
      if (e.key === "Escape" && this.content.classList.contains("show")) {
        this.close();
        this.trigger.focus();
      }
    };
    document.addEventListener("keydown", this._onKeyDown);
  }

  disconnectedCallback() {
    document.removeEventListener("click", this._onDocumentClick);
    document.removeEventListener("keydown", this._onKeyDown);
  }

  _getStaggerItems() {
    const slot = this.content.querySelector("slot:not([name])");
    if (!slot) return [];
    const slotted = slot.assignedElements();
    // If content is wrapped in a container, stagger its children
    if (slotted.length === 1 && slotted[0].children.length > 0) {
      return Array.from(slotted[0].children);
    }
    return slotted;
  }

  _staggerIn() {
    const items = this._getStaggerItems();
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    items.forEach((el, i) => {
      el.style.opacity = "0";
      el.style.transform = "translateY(-8px)";
      el.style.transition = "none";
      // Force reflow so the initial state applies before animating
      el.offsetHeight;
      el.style.transition = prefersReduced
        ? "opacity 100ms linear"
        : "opacity 200ms ease-out, transform 250ms cubic-bezier(0.23, 1, 0.32, 1)";
      el.style.transitionDelay = prefersReduced ? "0ms" : `${30 + i * 70}ms`;
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    });
  }

  _staggerOut() {
    const items = this._getStaggerItems();
    items.forEach((el) => {
      el.style.opacity = "0";
      el.style.transform = "translateY(-8px)";
      el.style.transitionDelay = "0ms";
    });
  }

  toggle() {
    this.content.classList.toggle("show");
    const isOpen = this.content.classList.contains("show");
    this.trigger.setAttribute("aria-expanded", isOpen);
    this.icon.classList.toggle("open");
    if (isOpen) {
      this.setAttribute("open", "");
      this._staggerIn();
    } else {
      this.removeAttribute("open");
      this._staggerOut();
    }
  }

  close() {
    this.content.classList.remove("show");
    this.trigger.setAttribute("aria-expanded", "false");
    this.icon.classList.remove("open");
    this.removeAttribute("open");
    this._staggerOut();
  }

  static get observedAttributes() {
    return ["label", "variant"];
  }

  attributeChangedCallback(name, _, newVal) {
    if (name === "label" && this.label) {
      this.label.textContent = newVal;
    }
    if (name === "variant") {
      this.applyVariantClass();
    }
  }

  // Apply the variant-<value> class to the trigger
  applyVariantClass() {
    if (!this.trigger) return;
    // Remove any previous variant- class
    this.trigger.className = 'button';
    const variant = this.getAttribute('variant');
    if (variant) {
      this.trigger.classList.add(`variant-${variant}`);
    }
  }
}

customElements.define("dropdown-trigger", DropdownTrigger);
