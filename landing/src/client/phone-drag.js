import { throttle } from 'throttle-debounce';

/**
 * Main function to create and manage the draggable phone element with boundary constraints.
 * This function prevents the phone from going outside the viewport using simple boundary checks.
 */

function main() {
  // Step 1: Define and inject the CSS styles dynamically, including a media query to hide on small screens.
  const cssRules = `
        #draggable-phone-js {
            position: absolute;
            width: 200px;
            height: 400px;
            background: linear-gradient(145deg, #2c2c2c, #1a1a1a);
            border-radius: 25px;
            z-index: 9999;
            
            /* Initial centering on the screen */
            bottom: 3rem;
            left: 3rem;

            /* User experience improvements */
            cursor: grab;
            user-select: none;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3), 
                        0 0 0 2px rgba(255, 255, 255, 0.1),
                        inset 0 1px 0 rgba(255, 255, 255, 0.1);
            
            /* Phone frame styling */
            border: 3px solid #333;
            padding: 8px;
        }

        .phone-screen {
            width: 100%;
            height: calc(100% - 20px);
            background: #000;
            border-radius: 18px;
            overflow: hidden;
            position: relative;
            margin-top: 10px;
            display: grid;
            place-items: center;
        }

        .phone-screen iframe {
            width: 250%;
            height: 250%;
            border: none;
            border-radius: 18px;
            pointer-events: auto;
        }

        .scroll-content-demo {
            height: 200vh;
        }

        /* Ocultar el componente en celulares y tablets */
        @media (max-width: 1380px) {
            #draggable-phone-js {
                display: none !important;
            }
        }
    `;

  const styleElement = document.createElement("style");
  styleElement.textContent = cssRules;
  document.head.appendChild(styleElement);

  // Step 2: Create the draggable phone element.
  const phone = document.createElement("div");
  phone.id = "draggable-phone-js";

  // Create phone screen with iframe
  const phoneScreen = document.createElement("div");
  phoneScreen.className = "phone-screen";

  const lang = document?.documentElement?.lang || 'en';
  const iframe = document.createElement("iframe");
  iframe.setAttribute("allow", "microphone;");
  iframe.src = `https://voice-agent-front.onrender.com?lang=${lang}`;
  iframe.title = "Phone Content";
  iframe.style.transform = "scale(0.5)";

  phoneScreen.appendChild(iframe);
  phone.appendChild(phoneScreen);

  // Step 3: Append the created element to the document body.
  document.body.appendChild(phone);

  // Step 5: Define state variables and implement the drag logic with boundary constraints.
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;
  let animationFrameId = null;
  let pendingPosition = null;

  // Function to constrain position within viewport boundaries
  function constrainPosition(x, y) {
    const phoneWidth = 200;
    const phoneHeight = 400;

    // Get viewport dimensions including scroll
    const maxX = window.innerWidth + window.scrollX - phoneWidth;
    const maxY = window.innerHeight + window.scrollY - phoneHeight;
    const minX = window.scrollX;
    const minY = window.scrollY;

    // Constrain the position
    const constrainedX = Math.max(minX, Math.min(maxX, x));
    const constrainedY = Math.max(minY, Math.min(maxY, y));

    return { x: constrainedX, y: constrainedY };
  }

  // Function to check if click is inside the iframe area
  function isClickInsideIframe(e) {
    const phoneRect = phone.getBoundingClientRect();
    const screenRect = phoneScreen.getBoundingClientRect();

    // Check if click is within the phone screen area (where iframe is)
    return (
      e.clientX >= screenRect.left &&
      e.clientX <= screenRect.right &&
      e.clientY >= screenRect.top &&
      e.clientY <= screenRect.bottom
    );
  }

  // Add event listener for when the mouse button is pressed on the phone.
  phone.addEventListener("mousedown", (e) => {
    // Don't start dragging if clicking inside the iframe area
    if (isClickInsideIframe(e)) {
      return;
    }

    isDragging = true;
    phone.style.cursor = "grabbing";
    e.preventDefault();

    // Synchronize the element's position and neutralize transform
    const rect = phone.getBoundingClientRect();

    phone.style.left = `${rect.left + window.scrollX}px`;
    phone.style.top = `${rect.top + window.scrollY}px`;
    phone.style.transform = "none";

    // Calculate the mouse's offset from the element's top-left corner
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
  });

  // Function to update phone position using requestAnimationFrame
  function updatePhonePosition() {
    if (pendingPosition) {
      phone.style.left = `${pendingPosition.x}px`;
      phone.style.top = `${pendingPosition.y}px`;
      pendingPosition = null;
    }
    animationFrameId = null;
  }

  // Throttled mousemove handler using throttle-debounce
  const throttledMouseMove = throttle(20, (e) => {
    if (!isDragging) {
      return;
    }

    // Calculate desired position
    const desiredX = e.clientX - offsetX + window.scrollX;
    const desiredY = e.clientY - offsetY + window.scrollY;

    // Apply boundary constraints
    const { x, y } = constrainPosition(desiredX, desiredY);

    // Store the position to be applied in the next animation frame
    pendingPosition = { x, y };

    // Schedule position update if not already scheduled
    if (!animationFrameId) {
      animationFrameId = requestAnimationFrame(updatePhonePosition);
    }
  });

  // Add event listener for mouse movement using throttled handler
  document.addEventListener("mousemove", throttledMouseMove);

  // Add event listener for when the mouse button is released anywhere.
  document.addEventListener("mouseup", () => {
    isDragging = false;
    phone.style.cursor = "grab";

    // Cancel any pending animation frame
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  });
}

// Ensure the DOM is fully loaded before executing the main function.
document.addEventListener("DOMContentLoaded", main);
