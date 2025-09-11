function fallbackCopy(text, targetElement) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.left = "-999999px";
  document.body.appendChild(textArea);
  textArea.select();
  try {
    document.execCommand("copy");
    targetElement.classList.add("copied");
    setTimeout(() => targetElement.classList.remove("copied"), 400);
  } catch {
    console.error("Copy failed");
  }
  document.body.removeChild(textArea);
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
