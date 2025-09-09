class DropdownTrigger extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        /* Hide the slot content until the component is defined */
        :host(:not(:defined)) slot {
          display: none;
        }

        .dropdown-content {
          display: none;
          position: absolute;
          margin-top: 0.5rem;
          transform: translateX(-50%);
          left: 50%;
        }

        .dropdown-content.show {
          display: block;
        }

        button {
          all: unset;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
        }

        .icon {
          margin-left: 0.2rem;
          width: 1rem;
          height: 1rem;
          transform: rotate(0deg);
          transition: transform 0.2s ease-in-out;
          mix-blend-mode: difference;
        }

        .icon.open {
          transform: rotate(180deg);
          transition: transform 0.2s ease-in-out;
        }

        .variant-small {
          font-size: 14px;
          padding: 0.2rem !important;
          margin-left: -0.2rem;
        }
      </style>

      <div>
        <button class="button" part="trigger" aria-expanded="false" aria-haspopup="true">
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
    document.addEventListener("click", (e) => {
      if (!this.contains(e.target) && !this.shadowRoot.contains(e.target)) {
        this.content.classList.remove("show");
        this.trigger.setAttribute("aria-expanded", "false");
        this.icon.classList.remove("open");
      }
    });
  }

  toggle() {
    this.content.classList.toggle("show");
    this.trigger.setAttribute(
      "aria-expanded",
      this.content.classList.contains("show")
    );
    this.icon.classList.toggle("open");
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
