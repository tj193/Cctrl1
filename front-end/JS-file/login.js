const API_BASE_URL = "http://127.0.0.1:8000";

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const errorMessage = document.getElementById("errorMessage");
    const loginBtn = document.getElementById("loginBtn");

    if (loginForm) {
        loginForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            errorMessage.style.display = "none";
            loginBtn.disabled = true;
            loginBtn.innerText = "Logging in...";

            const email = emailInput.value.trim();
            const password = passwordInput.value;

            try {
                const formData = new URLSearchParams();
                formData.append("username", emailInput.value.trim());
                formData.append("password", passwordInput.value);

                const response = await fetch(`${API_BASE_URL}/auth/login`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    body: formData
                });

                const data = await response.json();

                if (response.ok) {

                    localStorage.setItem("adminToken", data.access_token);
                    localStorage.setItem("adminEmail", email);

                    window.location.href = "index.html";
                } 
                else {

                    errorMessage.innerText = data.detail || "Invalid email or password.";
                    errorMessage.style.display = "block";
                }
            } 
            catch (error) {
                console.error("Login Error:", error);
                errorMessage.innerText = "Server connection error. Please try again later.";
                errorMessage.style.display = "block";
            } 
            finally {

                loginBtn.disabled = false;
                loginBtn.innerText = "Login";
            }
        });
    }
});