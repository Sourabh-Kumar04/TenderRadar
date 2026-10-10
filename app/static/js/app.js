/* TenderRadar UX & Interactivity Scripts */

document.addEventListener("DOMContentLoaded", () => {
  // 1. Scan Button Loading Feedback
  const scanButtons = document.querySelectorAll(".scan-btn");
  scanButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      btn.innerHTML = `<span class="spinner">⚡</span> Querying SerpApi...`;
      btn.disabled = true;

      // Show non-blocking informational toast
      const toast = document.createElement("div");
      toast.className = "alert alert-info";
      toast.style.position = "fixed";
      toast.style.bottom = "24px";
      toast.style.right = "24px";
      toast.style.zIndex = "99999";
      toast.style.maxWidth = "420px";
      toast.style.boxShadow = "var(--shadow-lg)";
      toast.innerHTML = `<span style="display:flex; align-items:center; gap:0.5rem;"><span class="spinner">⚡</span> <strong>SerpApi Multi-Portal Scan Active:</strong> Querying GeM, CPPP &amp; State portals...</span>`;
      document.body.appendChild(toast);

      btn.form?.submit();
    });
  });

  // 2. Auto-dismiss alerts after 5 seconds
  const alerts = document.querySelectorAll(".alert-dismissible");
  alerts.forEach(alert => {
    setTimeout(() => {
      alert.style.transition = "opacity 0.4s ease";
      alert.style.opacity = "0";
      setTimeout(() => alert.remove(), 400);
    }, 5000);
  });
});

/**
 * Toggle Save / Unsave tender bookmark via REST API.
 */
async function toggleSaveTender(btn, tenderId) {
  const isCurrentlySaved = btn.classList.contains("is-saved");
  btn.disabled = true;
  const originalText = btn.innerHTML;
  btn.innerHTML = `<span class="spinner">⏳</span>`;

  try {
    if (isCurrentlySaved) {
      // Unsave
      const res = await fetch(`/api/tenders/${tenderId}/save`, {
        method: "DELETE",
        headers: { "Accept": "application/json" }
      });
      if (res.ok) {
        btn.classList.remove("is-saved");
        btn.innerHTML = "☆ Save";
        btn.title = "Bookmark this tender";
        // If on saved page, optionally remove the card
        const card = document.getElementById(`saved-card-${tenderId}`);
        if (card) {
          card.style.transition = "opacity 0.3s ease, transform 0.3s ease";
          card.style.opacity = "0";
          card.style.transform = "scale(0.98)";
          setTimeout(() => {
            card.remove();
            const list = document.querySelector(".tenders-list");
            if (list && list.children.length === 0) {
              window.location.reload();
            }
          }, 300);
        }
      } else {
        btn.innerHTML = originalText;
      }
    } else {
      // Save
      const res = await fetch(`/api/tenders/${tenderId}/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({})
      });
      if (res.ok) {
        btn.classList.add("is-saved");
        btn.innerHTML = "★ Saved";
        btn.title = "Remove from Saved";
      } else {
        btn.innerHTML = originalText;
      }
    }
  } catch (err) {
    console.error("Failed to toggle save status:", err);
    btn.innerHTML = originalText;
  } finally {
    btn.disabled = false;
  }
}

/**
 * Save user notes for a bookmarked tender.
 */
async function saveTenderNotes(tenderId) {
  const textarea = document.getElementById(`notes-input-${tenderId}`);
  const statusEl = document.getElementById(`notes-status-${tenderId}`);
  if (!textarea) return;

  const notes = textarea.value.trim();
  if (statusEl) {
    statusEl.textContent = "Saving...";
    statusEl.classList.add("visible");
  }

  try {
    const res = await fetch(`/api/tenders/${tenderId}/notes`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ notes: notes })
    });

    if (res.ok) {
      if (statusEl) {
        statusEl.textContent = "✓ Saved!";
        setTimeout(() => statusEl.classList.remove("visible"), 2500);
      }
    } else {
      if (statusEl) {
        statusEl.textContent = "Error saving note";
        setTimeout(() => statusEl.classList.remove("visible"), 3000);
      }
    }
  } catch (e) {
    console.error("Notes save error:", e);
    if (statusEl) {
      statusEl.textContent = "Network error";
      setTimeout(() => statusEl.classList.remove("visible"), 3000);
    }
  }
}
