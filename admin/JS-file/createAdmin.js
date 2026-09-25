document.addEventListener('DOMContentLoaded', () => {
    const createAdminForm = document.getElementById('createAdminForm');
    const responseMessage = document.getElementById('responseMessage');
    const token = sessionStorage.getItem('adminToken');
    const apiBase = ['localhost', '127.0.0.1'].includes(window.location.hostname)
        ? `http://${window.location.hostname}:8000` : window.location.origin;
    if (!token) { window.location.replace('login.html'); return; }
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        sessionStorage.removeItem('adminToken');
        window.location.href = 'login.html';
    });

    if (createAdminForm) {
        createAdminForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const fullName = document.getElementById('fullName').value.trim();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;

            try {
                const response = await fetch(`${apiBase}/admin/admins`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        name: fullName,
                        email: email,
                        password: password
                    })
                });

                const data = await response.json();

                if (response.ok) {
                    responseMessage.style.color = 'green';
                    responseMessage.textContent = 'Admin created successfully!';
                    createAdminForm.reset();
                } else {
                    responseMessage.style.color = 'red';
                    responseMessage.textContent = typeof data.detail === 'string' ? data.detail : 'Failed to create admin.';
                }
            } catch (error) {
                console.error('Error:', error);
                responseMessage.style.color = 'red';
                responseMessage.textContent = 'Server connection error.';
            }
        });
    }
});
