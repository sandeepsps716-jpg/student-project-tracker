const form = document.getElementById("project-form");
const nameInput = document.getElementById("name");
const statusSelect = document.getElementById("status");
const saveButton = document.getElementById("save-button");
const cancelButton = document.getElementById("cancel-button");
const message = document.getElementById("message");
const emptyState = document.getElementById("empty-state");
const projectList = document.getElementById("project-list");

const STORAGE_KEY = "workshop-projects-v1";

// Store projects in memory and localStorage.
let projects = [];
let nextId = 1;
let editingId = null;
let storageReady = false;

// Return the form to Add mode.
function resetForm() {
  form.reset();
  editingId = null;
  saveButton.textContent = "Save Project";
  cancelButton.hidden = true;
}

// Check whether stored project records are valid.
function isValidProjects(data) {
  if (!Array.isArray(data)) {
    return false;
  }

  const ids = new Set();

  return data.every((project) => {
    if (
      project === null ||
      typeof project !== "object" ||
      !Number.isSafeInteger(project.id) ||
      project.id < 1 ||
      typeof project.name !== "string" ||
      !["Planned", "In Progress", "Completed"].includes(project.status) ||
      ids.has(project.id)
    ) {
      return false;
    }

    ids.add(project.id);
    return true;
  });
}

// Load projects from localStorage when the page starts.
function loadProjects() {
  let storedData;

  try {
    storedData = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    message.textContent =
      "Projects could not be loaded because browser storage is unavailable.";
    return;
  }

  // No saved data means we can start with an empty collection.
  if (storedData === null) {
    projects = [];
    storageReady = true;
    return;
  }

  try {
    // JSON.parse turns stored text back into a JavaScript collection.
    const parsedData = JSON.parse(storedData);

    if (!isValidProjects(parsedData)) {
      message.textContent =
        "Saved project data is invalid. Existing stored data has not been overwritten.";
      return;
    }

    projects = parsedData;
    nextId = projects.reduce(
      (maximum, project) => Math.max(maximum, project.id),
      0
    ) + 1;

    storageReady = true;
  } catch (error) {
    message.textContent =
      "Saved project data could not be read. Existing stored data has not been overwritten.";
  }
}

// Save projects to localStorage.
function saveProjects() {
  if (!storageReady) {
    message.textContent =
      "Changes could not be saved because the stored project data is unavailable or invalid.";
    return false;
  }

  try {
    // JSON.stringify turns the collection into text for browser storage.
    const storedData = JSON.stringify(projects);
    localStorage.setItem(STORAGE_KEY, storedData);
    return true;
  } catch (error) {
    message.textContent =
      "Changes could not be saved. Browser storage may be unavailable or full.";
    return false;
  }
}

// Display all projects.
function renderProjects() {
  projectList.replaceChildren();
  emptyState.hidden = projects.length > 0;

  projects.forEach((project) => {
    const item = document.createElement("li");

    const details = document.createElement("span");
    details.textContent = `${project.name} — ${project.status} `;

    // Edit button
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Edit";

    editButton.addEventListener("click", () => {
      const selectedProject = projects.find(
        (item) => item.id === project.id
      );

      if (!selectedProject) {
        return;
      }

      editingId = selectedProject.id;
      nameInput.value = selectedProject.name;
      statusSelect.value = selectedProject.status;

      saveButton.textContent = "Save changes";
      cancelButton.hidden = false;
      message.textContent = `Editing "${selectedProject.name}".`;

      nameInput.focus();
    });

    // Delete button
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.dataset.projectId = String(project.id);

    deleteButton.addEventListener("click", () => {
      const projectId = Number(deleteButton.dataset.projectId);

      const selectedProject = projects.find(
        (item) => item.id === projectId
      );

      if (!selectedProject) {
        return;
      }

      const confirmed = window.confirm(
        `Are you sure you want to delete "${selectedProject.name}"?`
      );

      if (!confirmed) {
        message.textContent = "Deletion cancelled.";
        return;
      }

      const index = projects.findIndex(
        (item) => item.id === projectId
      );

      if (index === -1) {
        return;
      }

      projects.splice(index, 1);

      if (editingId === projectId) {
        resetForm();
      }

      renderProjects();

      if (saveProjects()) {
        message.textContent = "Project deleted successfully.";
      }
    });

    item.append(details, editButton, deleteButton);
    projectList.appendChild(item);
  });
}

// Create a project or update the project being edited.
form.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = nameInput.value.trim();
  const status = statusSelect.value;

  if (!name) {
    message.textContent = "Please enter a project name.";
    nameInput.focus();
    return;
  }

  if (editingId !== null) {
    const project = projects.find(
      (item) => item.id === editingId
    );

    if (!project) {
      message.textContent = "The project could not be found.";
      resetForm();
      return;
    }

    project.name = name;
    project.status = status;

    resetForm();
    renderProjects();

    if (saveProjects()) {
      message.textContent = "Project updated successfully.";
    }
  } else {
    projects.push({
      id: nextId++,
      name: name,
      status: status
    });

    resetForm();
    renderProjects();

    if (saveProjects()) {
      message.textContent = "Project added successfully.";
    }
  }
});

// Cancel editing without changing saved records.
cancelButton.addEventListener("click", () => {
  resetForm();
  message.textContent = "Editing cancelled.";
});

// Load saved projects and display them on startup.
loadProjects();
renderProjects();