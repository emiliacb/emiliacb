document.addEventListener("click", async (e) => {
  const button = e.target.closest("[data-copy-value]");
  if (!button) return;

  const value = button.dataset.copyValue;
  if (!value) return;

  try {
    await navigator.clipboard.writeText(value);
  } catch {
    return;
  }

  const originalLabel = button.textContent;
  const copiedLabel = button.dataset.copiedLabel || originalLabel;

  clearTimeout(button._copyResetTimeout);
  button.textContent = copiedLabel;
  button._copyResetTimeout = setTimeout(() => {
    button.textContent = originalLabel;
  }, 1500);
});
