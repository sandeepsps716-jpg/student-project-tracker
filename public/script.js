
const form = document.getElementById("project-form");
const nameInput = document.getElementById("name");
const statusSelect = document.getElementById("status");
const saveButton = document.getElementById("save-button");
const cancelButton = document.getElementById("cancel-button");
const message = document.getElementById("message");
const emptyState = document.getElementById("empty-state");
const projectList = document.getElementById("project-list");

// Projects come from the server API, not localStorage.
let projects = [];
let editingId = null;
let isBusy = false;
let hasLoaded = false;

// Return the form to Add mode.
function resetForm() {
  form.reset();
  editingId = null;
  saveButton.textContent = "Save Project";
  cancelButton.hidden = true;
}

// Disable editing and mutation controls while loading or saving.
function setBusy(busy) {
  isBusy = busy;

  nameInput.disabled = busy;
  statusSelect.disabled = busy;
  saveButton.disabled = busy;
  cancelButton.disabled = busy;

  projectList.querySelectorAll("button").forEach((button) => {
    button.disabled = busy;
  });
}

// Read an API error message, including HTTP failures.
async function getResponseData(response) {
  let data = null;

  try {
    data = await response.json();
  } catch {
    // The response may not contain valid JSON.
  }

  if (!response.ok) {
    throw new Error(
      data?.error || `Request failed with status ${response.status}.`
    );
  }

  return data;
}

// Make a same-origin API request.
async function apiRequest(url, options = {}) {
  let response;

  try {
    response = await fetch(url, options);
  } catch {
    throw new Error(
      "Cannot connect to the server. Check that your Express server is running."
    );
  }

  return getResponseData(response);
}

// Remove duplicate records by server-provided ID.
function uniqueProjects(data) {
  if (!Array.isArray(data)) {
    throw new Error("The server returned an invalid project list.");
  }

  const seenIds = new Set();
  const result = [];

  for (const project of data) {
    if (
      !project ||
      !Number.isSafeInteger(project.id) ||
      project.id < 1 ||
      typeof project.name !== "string" ||
      !["Planned", "In Progress", "Completed"].includes(project.status)
    ) {
      throw new Error("The server returned an invalid project record.");
    }

    if (!seenIds.has(project.id)) {
      seenIds.add(project.id);
      result.push(project);
    }
  }

  return result;
}

// Load the latest projects from the API.
async function loadProjects(showLoading = true) {
  if (showLoading) {
    setBusy(true);
    message.textContent = "Loading projects...";
  }

  try {
    const data = await apiRequest("/api/projects");
    projects = uniqueProjects(data);
    hasLoaded = true;

    renderProjects();

    if (projects.length === 0) {
      message.textContent = "No projects found.";
    } else {
      message.textContent = `Loaded ${projects.length} project(s).`;
    }

    return true;
  } catch (error) {
    // Do not present a failed initial load as an empty list.
    if (!hasLoaded) {
      projects = [];
      projectList.replaceChildren();
      emptyState.hidden = true;
    }

    message.textContent = `Error loading projects: ${error.message}`;
    return false;
  } finally {
    if (showLoading) {
      setBusy(false);
      renderProjects();
    }
  }
}

// Display the current API collection.
function renderProjects() {
  projectList.replaceChildren();

  if (!hasLoaded) {
    emptyState.hidden = true;
    return;
  }

  emptyState.hidden = projects.length > 0;

  for (const project of projects) {
    const item = document.createElement("li");

    const details = document.createElement("span");
    details.textContent = `${project.name} — ${project.status} `;

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.disabled = isBusy;

    editButton.addEventListener("click", () => {
      if (isBusy) return;

      const selectedProject = projects.find(
        (item) => item.id === project.id
      );

      if (!selectedProject) return;

      editingId = selectedProject.id;
      nameInput.value = selectedProject.name;
      statusSelect.value = selectedProject.status;

      saveButton.textContent = "Save changes";
      cancelButton.hidden = false;
      message.textContent = `Editing "${selectedProject.name}".`;

      nameInput.focus();
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.disabled = isBusy;

    deleteButton.addEventListener("click", async () => {
      if (isBusy) return;

      const selectedProject = projects.find(
        (item) => item.id === project.id
      );

      if (!selectedProject) return;

      const confirmed = window.confirm(
        `Are you sure you want to delete "${selectedProject.name}"?`
      );

      if (!confirmed) {
        message.textContent = "Deletion cancelled.";
        return;
      }

      setBusy(true);
      message.textContent = "Deleting project...";

      try {
        await apiRequest(`/api/projects/${selectedProject.id}`, {
          method: "DELETE"
        });

        // Exit Edit mode if the edited record was deleted.
        if (editingId === selectedProject.id) {
          resetForm();
        }

        const refreshed = await loadProjects(false);

        if (refreshed) {
          message.textContent = "Project deleted successfully.";
        } else {
          message.textContent =
            "Project deleted, but the list could not be refreshed. " +
            "Try loading the projects again.";
        }
      } catch (error) {
        message.textContent = `Error deleting project: ${error.message}`;
      } finally {
        setBusy(false);
        renderProjects();
      }
    });

    item.append(details, editButton, deleteButton);
    projectList.appendChild(item);
  }
}

// Create a project or update the selected project.
form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (isBusy) return;

  const name = nameInput.value.trim();
  const status = statusSelect.value;

  if (!name) {
    message.textContent = "Please enter a project name.";
    nameInput.focus();
    return;
  }

  if (name.length > 80) {
    message.textContent = "Project name must be 80 characters or fewer.";
    nameInput.focus();
    return;
  }

  if (!["Planned", "In Progress", "Completed"].includes(status)) {
    message.textContent = "Please select a valid project status.";
    return;
  }

  const wasEditing = editingId !== null;
  const projectId = editingId;
  const payload = { name, status };

  setBusy(true);
  message.textContent = wasEditing ? "Saving changes..." : "Saving project...";

  try {
    if (wasEditing) {
      const exists = projects.some((project) => project.id === projectId);

      if (!exists) {
        message.textContent = "The project could not be found.";
        resetForm();
        return;
      }

      await apiRequest(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
    } else {
      await apiRequest("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
    }

    // Reset only after the server confirms the mutation succeeded.
    resetForm();

    const refreshed = await loadProjects(false);

    if (refreshed) {
      message.textContent = wasEditing
        ? "Project updated successfully."
        : "Project added successfully.";
    } else {
      message.textContent =
        "The project was saved, but the list could not be refreshed. " +
        "Try loading the projects again.";
    }
  } catch (error) {
    // Keep the user's input and Edit mode if the mutation fails.
    message.textContent = `Error saving project: ${error.message}`;
  } finally {
    setBusy(false);
    renderProjects();
  }
});

// Cancel editing without making an API request.
cancelButton.addEventListener("click", () => {
  if (isBusy) return;

  resetForm();
  message.textContent = "Editing cancelled.";
});

// Initial API load.
loadProjects();