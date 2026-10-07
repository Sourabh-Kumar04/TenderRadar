/* TenderRadar UX scripts */

document.addEventListener("DOMContentLoaded", () => {
  // Scan Button feedback
  const scanButtons = document.querySelectorAll(".scan-btn");
  scanButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      btn.innerHTML = `<span class="spinner">⏳</span> Scanning...`;
      btn.disabled = true;
      btn.form?.submit();
    });
  });

  // Auto-dismiss alerts after 5 seconds
  const alerts = document.querySelectorAll(".alert-dismissible");
  alerts.forEach(alert => {
    setTimeout(() => {
      alert.style.transition = "opacity 0.5s ease";
      alert.style.opacity = "0";
      setTimeout(() => alert.remove(), 500);
    }, 5000);
  });
});
