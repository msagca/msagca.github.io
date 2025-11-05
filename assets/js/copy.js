function fallbackCopy(text, targetElement) {
  navigator.clipboard.writeText(text).then(
    () => {
      targetElement.classList.add("copied");
      setTimeout(() => targetElement.classList.remove("copied"), 400);
    },
    (err) => {
      console.error("Copy failed", err);
    },
  );
}
function initializeCodeCopy() {
  document.querySelectorAll("code, pre").forEach((element) => {
    element.addEventListener("click", async function (e) {
      e.stopPropagation();
      let textToCopy;
      let targetElement;
      if (element.tagName === "PRE") {
        const codeElement = element.querySelector("code");
        textToCopy = codeElement
          ? codeElement.textContent
          : element.textContent;
        targetElement = element;
      } else {
        textToCopy = element.textContent;
        targetElement = element;
      }
      try {
        await navigator.clipboard.writeText(textToCopy);
        targetElement.classList.add("copied");
        setTimeout(() => {
          targetElement.classList.remove("copied");
        }, 400);
      } catch (err) {
        fallbackCopy(textToCopy, targetElement);
      }
    });
  });
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeCodeCopy);
} else {
  initializeCodeCopy();
}

