document.addEventListener('DOMContentLoaded', () => {
    const createAdminForm = document.getElementById('createAdminForm');
    const responseMessage = document.getElementById('responseMessage');

    if (createAdminForm) {
        createAdminForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const fullName = document.getElementById('fullName').value.trim();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value.trim();

            const token = localStorage.getItem('token');

            try {
                const response = await fetch('http://127.0.0.1:8000/auth/create-admin',{
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
                    responseMessage.textContent = data.message || 'Failed to create admin.';
                }
            } catch (error) {
                console.error('Error:', error);
                responseMessage.style.color = 'red';
                responseMessage.textContent = 'Server connection error.';
            }
        });
    }
});