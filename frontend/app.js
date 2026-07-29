const state = {
  shares: [],
  status: null,
  stats: null,
  search: "",
  filter: "All",
  activity: []
};

const elements = {
  refreshButton: document.querySelector("#refreshButton"),
  scrollToFormButton: document.querySelector("#scrollToFormButton"),
  connectionBadge: document.querySelector("#connectionBadge"),
  runtimeCard: document.querySelector(".runtime-card"),
  runtimeStatus: document.querySelector("#runtimeStatus"),
  runtimeMessage: document.querySelector("#runtimeMessage"),
  runtimePort: document.querySelector("#runtimePort"),
  runtimeTerminalText: document.querySelector("#runtimeTerminalText"),
  totalShares: document.querySelector("#totalShares"),
  totalTypes: document.querySelector("#totalTypes"),
  totalOwners: document.querySelector("#totalOwners"),
  healthMetric: document.querySelector("#healthMetric"),
  shareCountBadge: document.querySelector("#shareCountBadge"),
  shareList: document.querySelector("#shareList"),
  shareForm: document.querySelector("#shareForm"),
  formMessage: document.querySelector("#formMessage"),
  titleInput: document.querySelector("#titleInput"),
  typeInput: document.querySelector("#typeInput"),
  ownerInput: document.querySelector("#ownerInput"),
  urlInput: document.querySelector("#urlInput"),
  descriptionInput: document.querySelector("#descriptionInput"),
  searchInput: document.querySelector("#searchInput"),
  filterInput: document.querySelector("#filterInput"),
  activityFeed: document.querySelector("#activityFeed"),
  toast: document.querySelector("#toast"),
  createPanel: document.querySelector("#createPanel")
};

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || "API request failed.");
    error.data = data;
    throw error;
  }

  return data;
}

async function loadStatus() {
  try {
    const status = await apiRequest("/api/status");
    state.status = status;

    addActivity({
      type: "status",
      title: "Runtime status checked",
      description: `${status.project || "3S"} API responded successfully on port ${status.port || 3000}.`
    });

    renderStatus();
  } catch {
    state.status = null;

    addActivity({
      type: "warning",
      title: "Runtime status failed",
      description: "The frontend could not reach the 3S API."
    });

    renderStatus();
  }
}

async function loadShares() {
  const data = await apiRequest("/api/shares");
  state.shares = data.items || [];
  renderShares();
}

async function loadStats() {
  const stats = await apiRequest("/api/stats");
  state.stats = stats;
  renderStats();
}

async function refreshAll() {
  setRefreshLoading(true);

  try {
    await Promise.all([
      loadStatus(),
      loadShares(),
      loadStats()
    ]);

    showToast("Workspace refreshed successfully.", "success");
  } catch (error) {
    showToast(error.message || "Could not refresh workspace.", "error");
  } finally {
    setRefreshLoading(false);
  }
}

async function createShare(payload) {
  const data = await apiRequest("/api/shares", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  return data.item;
}

async function deleteShare(id) {
  await apiRequest(`/api/shares/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
}

function renderStatus() {
  const isOnline = Boolean(state.status && state.status.online);

  elements.connectionBadge.classList.toggle("online", isOnline);
  elements.runtimeCard.classList.toggle("online", isOnline);

  if (!isOnline) {
    elements.connectionBadge.lastChild.textContent = " API offline";
    elements.runtimeStatus.textContent = "Offline";
    elements.runtimeMessage.textContent = "The frontend could not reach the 3S API.";
    elements.runtimePort.textContent = "—";
    elements.healthMetric.textContent = "Fail";
    elements.runtimeTerminalText.textContent = "GET /api/status -> failed";
    return;
  }

  elements.connectionBadge.lastChild.textContent = " API online";
  elements.runtimeStatus.textContent = "Online";
  elements.runtimeMessage.textContent = state.status.message || "The 3S API is healthy.";
  elements.runtimePort.textContent = String(state.status.port || "3000");
  elements.healthMetric.textContent = "200";
  elements.runtimeTerminalText.textContent = [
    "GET /api/status -> 200 OK",
    `project=${state.status.project || "3S"}`,
    `service=${state.status.service || "3S API"}`,
    `healthPath=${state.status.healthPath || "/api/status"}`
  ].join("\n");
}

function renderStats() {
  const stats = state.stats || {
    totalShares: state.shares.length,
    byType: {},
    byOwner: {}
  };

  elements.totalShares.textContent = String(stats.totalShares || 0);
  elements.totalTypes.textContent = String(Object.keys(stats.byType || {}).length);
  elements.totalOwners.textContent = String(Object.keys(stats.byOwner || {}).length);
}

function renderShares() {
  const visibleShares = getVisibleShares();

  elements.shareCountBadge.textContent = `${visibleShares.length} item${visibleShares.length === 1 ? "" : "s"}`;

  if (!visibleShares.length) {
    elements.shareList.innerHTML = `
      <div class="empty-state">
        <strong>No resources found.</strong>
        <p>Try another search, change the filter, or create a new shared resource.</p>
      </div>
    `;
    return;
  }

  elements.shareList.innerHTML = visibleShares
    .map((share) => {
      const safeUrl = share.url || "#";
      const linkHtml = share.url
        ? `<a class="share-link" href="${escapeHtml(safeUrl)}" target="_blank" rel="noreferrer">${escapeHtml(safeUrl)}</a>`
        : `<span class="share-link">No URL provided</span>`;

      return `
        <div class="share-card">
          <div class="share-card-header">
            <div>
              <h3>${escapeHtml(share.title)}</h3>
              <div class="share-meta">
                <span>Owner: ${escapeHtml(share.owner)}</span>
                <span>Created: ${formatDate(share.createdAt)}</span>
              </div>
            </div>

            <span class="share-type">${escapeHtml(share.type)}</span>
          </div>

          <p>${escapeHtml(share.description)}</p>

          <div class="share-footer">
            ${linkHtml}
            <button class="delete-button" data-delete-id="${escapeHtml(share.id)}">
              Delete
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  document.querySelectorAll("[data-delete-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.getAttribute("data-delete-id");

      if (!id) {
        return;
      }

      button.disabled = true;
      button.textContent = "Deleting...";

      try {
        await deleteShare(id);

        addActivity({
          type: "delete",
          title: "Resource deleted",
          description: `Deleted resource ${id}.`
        });

        await refreshAll();
        showToast("Resource deleted.", "success");
      } catch (error) {
        button.disabled = false;
        button.textContent = "Delete";
        showFormMessage(error.message || "Could not delete share.", "error");
        showToast(error.message || "Could not delete share.", "error");
      }
    });
  });
}

function renderActivity() {
  const items = state.activity.slice(0, 8);

  if (!items.length) {
    elements.activityFeed.innerHTML = `
      <div class="empty-state">
        Activity will appear here after you use the workspace.
      </div>
    `;
    return;
  }

  elements.activityFeed.innerHTML = items
    .map((item) => {
      return `
        <div class="activity-item">
          <span class="activity-icon">${getActivityIcon(item.type)}</span>
          <div>
            <strong>${escapeHtml(item.title)}</strong>
            <small>${escapeHtml(item.description)}</small>
          </div>
        </div>
      `;
    })
    .join("");
}

function getVisibleShares() {
  const search = state.search.trim().toLowerCase();
  const filter = state.filter;

  return state.shares.filter((share) => {
    const matchesFilter = filter === "All" || share.type === filter;

    const searchable = [
      share.title,
      share.type,
      share.owner,
      share.description,
      share.url
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesSearch = !search || searchable.includes(search);

    return matchesFilter && matchesSearch;
  });
}

function getFormPayload() {
  return {
    title: elements.titleInput.value.trim(),
    type: elements.typeInput.value.trim(),
    owner: elements.ownerInput.value.trim(),
    url: elements.urlInput.value.trim(),
    description: elements.descriptionInput.value.trim()
  };
}

function resetForm() {
  elements.shareForm.reset();
  elements.typeInput.value = "Document";
}

function showFormMessage(message, type = "") {
  elements.formMessage.textContent = message;
  elements.formMessage.className = `form-message ${type}`.trim();
}

function showToast(message, type = "") {
  elements.toast.textContent = message;
  elements.toast.className = `toast visible ${type}`.trim();

  window.clearTimeout(showToast.timeoutId);

  showToast.timeoutId = window.setTimeout(() => {
    elements.toast.className = "toast";
  }, 2800);
}

function setRefreshLoading(isLoading) {
  elements.refreshButton.disabled = isLoading;
  elements.refreshButton.textContent = isLoading ? "Refreshing..." : "Refresh workspace";
}

function addActivity(item) {
  state.activity = [
    {
      ...item,
      createdAt: new Date().toISOString()
    },
    ...state.activity
  ].slice(0, 12);

  renderActivity();
}

function getActivityIcon(type) {
  const icons = {
    status: "✓",
    warning: "!",
    create: "+",
    delete: "−",
    refresh: "↻"
  };

  return icons[type] || "•";
}

function formatDate(value) {
  if (!value) {
    return "unknown";
  }

  try {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return "unknown";
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

elements.refreshButton.addEventListener("click", async () => {
  addActivity({
    type: "refresh",
    title: "Manual refresh started",
    description: "Refreshing status, shares, and metrics."
  });

  await refreshAll();
});

elements.scrollToFormButton.addEventListener("click", () => {
  elements.createPanel.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

  elements.titleInput.focus({
    preventScroll: true
  });
});

elements.searchInput.addEventListener("input", (event) => {
  state.search = event.target.value;
  renderShares();
});

elements.filterInput.addEventListener("change", (event) => {
  state.filter = event.target.value;
  renderShares();
});

elements.shareForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  showFormMessage("Creating share...", "");

  try {
    const payload = getFormPayload();
    const item = await createShare(payload);

    addActivity({
      type: "create",
      title: "Resource shared",
      description: `${item.title} was added to the 3S workspace.`
    });

    resetForm();
    showFormMessage("Shared resource created successfully.", "success");
    showToast("Shared resource created.", "success");
    await refreshAll();
  } catch (error) {
    const messages = error.data?.messages;

    if (Array.isArray(messages)) {
      showFormMessage(messages.join(", "), "error");
      showToast(messages.join(", "), "error");
    } else {
      showFormMessage(error.message || "Could not create shared resource.", "error");
      showToast(error.message || "Could not create shared resource.", "error");
    }
  }
});

renderActivity();
refreshAll();