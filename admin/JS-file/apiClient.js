(() => {
  "use strict";
  const baseUrl =
    ["5500", "5501"].includes(location.port)
      ? location.origin
      : ["localhost", "127.0.0.1"].includes(location.hostname)
        ? `http://${location.hostname}:8001`
        : location.origin;
  async function request(path, options = {}) {
    if (
      path.startsWith("/admin/") &&
      sessionStorage.getItem("adminPreview") === "1" &&
      ["localhost", "127.0.0.1"].includes(location.hostname) &&
      !["GET", "HEAD"].includes(String(options.method || "GET").toUpperCase())
    ) {
      throw new Error("Admin writes are unavailable in local preview.");
    }
    const token = sessionStorage.getItem("adminToken");
    const headers = new Headers(options.headers || {});
    if (token && !headers.has("Authorization"))
      headers.set("Authorization", `Bearer ${token}`);
    const response = await window.fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
    });
    if ([401, 403].includes(response.status)) {
      sessionStorage.removeItem("adminToken");
      sessionStorage.removeItem("adminEmail");
      location.href = "login.html";
      throw new Error("Admin session expired or access denied.");
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(
        typeof body.detail === "string"
          ? body.detail
          : `Request failed (${response.status}).`,
      );
    }
    return response.status === 204 ? null : response.json();
  }
  // Compatibility adapter for existing page code that expects a Fetch Response.
  async function fetchResponse(url, options = {}) {
    if (
      new URL(url, location.href).pathname.startsWith("/admin/") &&
      sessionStorage.getItem("adminPreview") === "1" &&
      ["localhost", "127.0.0.1"].includes(location.hostname) &&
      !["GET", "HEAD"].includes(String(options.method || "GET").toUpperCase())
    ) {
      throw new Error("Admin writes are unavailable in local preview.");
    }
    const response = await window.fetch(url, options);
    if (
      [401, 403].includes(response.status) &&
      new Headers(options.headers || {}).has("Authorization")
    ) {
      sessionStorage.removeItem("adminToken");
      sessionStorage.removeItem("adminEmail");
      location.href = "login.html";
    }
    return response;
  }
  window.DarbGoAdminApi = { baseUrl, request, fetchResponse };
})();
