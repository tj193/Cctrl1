document.addEventListener("DOMContentLoaded", () => {
  const createAdminForm = document.getElementById("createAdminForm");
  const responseMessage = document.getElementById("responseMessage");
  const submit = document.getElementById("submitAdminBtn");
  const passwordInput = document.getElementById("password");
  document
    .getElementById("toggleAdminPassword")
    ?.addEventListener("click", (event) => {
      const visible = passwordInput.type === "password";
      passwordInput.type = visible ? "text" : "password";
      event.currentTarget.textContent = visible
        ? "Hide password"
        : "Show password";
      event.currentTarget.setAttribute("aria-pressed", String(visible));
    });
  const token = sessionStorage.getItem("adminToken");
  const apiBase = window.DarbGoAdminApi.baseUrl;
  if (
    sessionStorage.getItem("adminPreview") === "1" &&
    ["localhost", "127.0.0.1"].includes(location.hostname)
  ) {
    submit.disabled = true;
    responseMessage.textContent =
      "Admin creation is unavailable in local preview.";
    document.getElementById("logoutBtn")?.addEventListener("click", () => {
      sessionStorage.removeItem("adminPreview");
      window.location.href = "login.html";
    });
    return;
  }
  if (!token) {
    window.location.replace("login.html");
    return;
  }
  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("adminToken");
    window.location.href = "login.html";
  });

  if (createAdminForm) {
    createAdminForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const fullName = document.getElementById("fullName").value.trim();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      if (
        fullName.length < 2 ||
        password.length < 12 ||
        !createAdminForm.reportValidity()
      )
        return;
      submit.disabled = true;
      submit.textContent = "Creating…";

      try {
        const response = await window.DarbGoAdminApi.fetchResponse(
          `${apiBase}/admin/admins`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              name: fullName,
              email: email,
              password: password,
            }),
          },
        );

        const data = await response.json();

        if (response.ok) {
          responseMessage.style.color = "green";
          responseMessage.textContent = "Admin created successfully!";
          createAdminForm.reset();
        } else {
          responseMessage.style.color = "red";
          responseMessage.textContent =
            typeof data.detail === "string"
              ? data.detail
              : "Failed to create admin.";
        }
      } catch (error) {
        console.error("Error:", error);
        responseMessage.style.color = "red";
        responseMessage.textContent = "Server connection error.";
      } finally {
        submit.disabled = false;
        submit.textContent = "Create Admin";
      }
    });
  }
});
