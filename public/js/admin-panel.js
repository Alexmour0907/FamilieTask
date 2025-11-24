document.addEventListener('DOMContentLoaded', () => {
    const requestsList = document.getElementById('requests-list');
    const messageContainer = document.getElementById('message-container');

    const createTaskForm = document.getElementById('create-task-form');
    const taskFormMessage = document.getElementById('task-form-message');
    const taskListContainer = document.getElementById('task-list-container');

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

    const handleRequestAction = async (event) => {
        const target = event.target;
        const isAccept = target.classList.contains('accept-btn');
        const isReject = target.classList.contains('reject-btn');

        if (!isAccept && !isReject) {
            return; // Click was not on a button
        }

        const requestId = target.dataset.requestId;
        const action = isAccept ? 'accept' : 'reject';

        try {
            const response = await fetch(`/api/join-requests/${requestId}/respond`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            });

            const result = await response.json();
            messageContainer.textContent = result.message;
            messageContainer.className = response.ok ? 'success-message' : 'error-message';

            if (response.ok) {
                // Fjern forespørselen fra listen når den er behandlet
                const itemToRemove = requestsList.querySelector(`div[data-request-id="${requestId}"]`);
                if (itemToRemove) {
                    itemToRemove.remove();
                }
                // Hvis ingen forespørsler er igjen, vis meldingen "No pending join requests."
                if (requestsList.children.length === 0) {
                    requestsList.innerHTML = '<p>No pending join requests.</p>';
                }
            }

        } catch (error) {
            console.error('Error processing request:', error);
            messageContainer.textContent = 'An unexpected error occurred. Please try again.';
            messageContainer.className = 'error-message';
        }
    };

    // Funksjon for å fetche og vise tasks
    const fetchAndDisplayTasks = async () => {
        try {
            const response = await fetch('/api/tasks');
            if (!response.ok) {
                throw new Error('Failed to fetch tasks');
            }

            const tasks = await response.json();
            taskListContainer.innerHTML = ''; // Klarer "Loading..." meldingen

            if (tasks.length === 0) {
                taskListContainer.innerHTML = '<p>No tasks available.</p>';
                return;
            }

            const taskList = document.createElement('ul');
            tasks.forEach(task => {
                const item = document.createElement('li');
                // Vi bruker creator_username fra API responsen
                item.textContent = `Title: ${task.title} (Created by: ${task.creator_username}, Points: ${task.points_reward})`;
                taskList.appendChild(item);
            });
            taskListContainer.appendChild(taskList);

        } catch (error) {
            console.error('Error fetching tasks:', error);
            taskListContainer.innerHTML = '<p>Could not load tasks. Please try again later.</p>';
        }
    };

    // Håndter opprettelse av ny task
    const handleCreateTask = async (event) => {
        event.preventDefault();

        const formData = new FormData(createTaskForm);
        const data = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

        const result = await response.json();

        taskFormMessage.textContent = result.message;
        taskFormMessage.style.display = 'block';
        taskFormMessage.style.color = response.ok ? 'green' : 'red';

        if (response.ok) {
            createTaskForm.reset();
            fetchAndDisplayTasks(); // Oppdater task listen
        }
    } catch (error) {
        console.error('Error creating task:', error);
        taskFormMessage.textContent = 'An unexpected error occurred. Please try again.';
        taskFormMessage.style.display = 'block';
        taskFormMessage.style.color = 'red';
    }
};

    createTaskForm.addEventListener('submit', handleCreateTask);
    requestsList.addEventListener('click', handleRequestAction);

    fetchAndDisplayRequests();
    fetchAndDisplayTasks();
});