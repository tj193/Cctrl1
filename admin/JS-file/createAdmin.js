document.addEventListener('DOMContentLoaded', () => {
    const createAdminForm = document.getElementById('createAdminForm');
    const responseMessage = document.getElementById('responseMessage');
    const submitButton = document.getElementById('submitAdminBtn');
    const token = sessionStorage.getItem('adminToken');
    const apiBaseUrl = ['localhost', '127.0.0.1'].includes(window.location.hostname)
        ? `http://${window.location.hostname}:8000` : window.location.origin;

    if (!token) {
        window.location.replace('login.html');
        return;
    }

    document.getElementById('logoutBtn').addEventListener('click', () => {
        sessionStorage.removeItem('adminToken');
        sessionStorage.removeItem('adminEmail');
        window.location.href = 'login.html';
    });

    if (createAdminForm) {
        createAdminForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const fullName = document.getElementById('fullName').value.trim();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            responseMessage.textContent = '';
            submitButton.disabled = true;

            try {
                const response = await fetch(`${apiBaseUrl}/admin/admins`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ name: fullName, email, password })
                });

                const data = await response.json().catch(() => ({}));

                if (response.ok) {
                    responseMessage.style.color = 'green';
                    responseMessage.textContent = 'Admin created successfully!';
                    createAdminForm.reset();
                } else {
                    responseMessage.style.color = 'red';
                    const detail = Array.isArray(data.detail) ? data.detail[0]?.msg : data.detail;
                    responseMessage.textContent = detail || 'Failed to create admin.';
                }
            } catch (error) {
                responseMessage.style.color = 'red';
                responseMessage.textContent = 'Server connection error.';
            } finally {
                submitButton.disabled = false;
            }
        });
    }
});
