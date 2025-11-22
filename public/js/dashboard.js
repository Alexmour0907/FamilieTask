document.addEventListener('DOMContentLoaded', async () => {
    const adminButtonContainer = document.getElementById('admin-button-container');

    try {
        const response = await fetch('/api/user/permissions');
        if (!response.ok) {
            throw new Error('Could not check user permissions.');
        }

        const { hasAdminRights } = await response.json();

        if (hasAdminRights) {
            const adminButton = document.createElement('a');
            adminButton.href = '/admin';
            adminButton.textContent = 'Go to Admin Panel';
            adminButtonContainer.appendChild(adminButton);
        }
    } catch (error) {
        console.error('Error setting up admin button:', error);
    }
});