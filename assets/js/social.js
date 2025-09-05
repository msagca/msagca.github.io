(function () {
  function handleSocialPositioning() {
    const socialSidebar = document.querySelector(".social-sidebar");
    const socialBottom = document.querySelector(".social-bottom");
    const container = document.querySelector(".container");
    function updateSocialPosition() {
      const containerRect = container.getBoundingClientRect();
      const sidebarWidth = 4 * 16;
      const hasSpace = containerRect.left > sidebarWidth + 32;
      if (hasSpace && window.innerWidth > 768) {
        socialSidebar.style.display = "flex";
        socialBottom.style.display = "none";
      } else {
        socialSidebar.style.display = "none";
        socialBottom.style.display = "flex";
      }
    }
    updateSocialPosition();
    window.addEventListener("resize", updateSocialPosition);
    window.addEventListener("orientationchange", updateSocialPosition);
  }
  document.addEventListener("DOMContentLoaded", handleSocialPositioning);
  document.addEventListener("click", (e) => {
    const target = e.target.closest('a[href^="#"]');
    if (target) {
      e.preventDefault();
      const targetElement = document.querySelector(target.getAttribute("href"));
      if (targetElement) {
        targetElement.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }
  });
  document.addEventListener("DOMContentLoaded", () => {
    const images = document.querySelectorAll("img");
    images.forEach((img) => {
      if (!img.complete) {
        img.style.opacity = "0";
        img.style.transition = "opacity 0.3s ease";
        img.onload = () => {
          img.style.opacity = "1";
        };
      }
    });
  });
})();
