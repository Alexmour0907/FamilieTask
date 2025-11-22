document.addEventListener('DOMContentLoaded', () => {
    const requestsList = document.getElementById('requests-list');

    const fetchAndDisplayRequests = async () => {
        try {
            const response = await fetch('/api/join-requests');
            
            if (!response.ok) {
                // Om brukeren ikke har owner eller admin rettigheter, returneres 401 eller 403.
                // Frontend-systemet ber om dataene, og backend-systemet avgjør om brukeren har autorisasjon til å se dem ved å sjekke rollen sin i databasen.
                if (response.status === 401 || response.status === 403) {
                    requestsList.innerHTML = '<p>You do not have permission to view this page.</p>';
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const requests = await response.json();
            requestsList.innerHTML = ''; // Klarerer "Loading..." mweldingen på html-siden

            if (requests.length === 0) {
                requestsList.innerHTML = '<p>No pending join requests.</p>';
                return;
            }

            requests.forEach(request => {
                const requestElement = document.createElement('div');
                requestElement.className = 'request-item';
                requestElement.innerHTML = `
                    <p>
                        <strong>User:</strong> ${request.requesterUsername} (${request.requesterEmail})<br>
                        <strong>Status:</strong> ${request.status}<br>
                        <strong>Created:</strong> ${new Date(request.requested_at).toLocaleString()}<br>
                        <strong>Expires:</strong> ${new Date(request.expires_at).toLocaleString()}
                    </p>
                    <button class="accept-btn" data-request-id="${request.requestId}">Accept</button>
                    <button class="reject-btn" data-request-id="${request.requestId}">Reject</button>
                `;
                requestsList.appendChild(requestElement);
            });

        } catch (error) {
            console.error('Error fetching join requests:', error);
            requestsList.innerHTML = '<p>Could not load join requests. Please try again later.</p>';
        }
    };

    fetchAndDisplayRequests();
});