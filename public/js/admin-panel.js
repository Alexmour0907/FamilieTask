document.addEventListener('DOMContentLoaded', () => {
    const requestsList = document.getElementById('requests-list');
    const messageContainer = document.getElementById('message-container');
    
    const createTaskForm = document.getElementById('create-task-form');
    const taskFormMessage = document.getElementById('task-form-message');
    const taskListContainer = document.getElementById('task-list-container');
    const assignedToSelect = document.getElementById('task-assigned-to');

    // Funksjon for å hente og populere familiemedlemmer i "Assign To" dropdown
    const fetchAndPopulateFamilyMembers = async () => {
        try {
            const response = await fetch('/api/family-members');
            if (!response.ok) {
                throw new Error('Failed to fetch family members');
            }
            const members = await response.json();
            members.forEach(member => {
                const option = document.createElement('option');
                option.value = member.id;
                option.textContent = member.username;
                assignedToSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error populating family members:', error);
        }
    };

    // Funksjon for å hente og vise join-requests
    const fetchAndDisplayRequests = async () => {
        try {
            const response = await fetch('/api/join-requests');
            
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    document.querySelector('.join-requests-container').innerHTML = '<h2>Incoming Join Requests</h2><p>You do not have permission to view join requests.</p>';
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const requests = await response.json();
            requestsList.innerHTML = ''; 

            if (requests.length === 0) {
                requestsList.innerHTML = '<p>No pending join requests.</p>';
                return;
            }

            requests.forEach(request => {
                const requestElement = document.createElement('div');
                requestElement.className = 'request-item';
                // Lagt til data-request-id her for enklere fjerning
                requestElement.setAttribute('data-request-id', request.requestId); 
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

    // Funksjon for å håndtere accept/reject av join-requests
    const handleRequestAction = async (event) => {
        const target = event.target;
        const isAccept = target.classList.contains('accept-btn');
        const isReject = target.classList.contains('reject-btn');

        if (!isAccept && !isReject) return;

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
                const itemToRemove = requestsList.querySelector(`div[data-request-id="${requestId}"]`);
                if (itemToRemove) {
                    itemToRemove.remove();
                }
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

    // Funksjon for å hente og vise tasks med detaljer
    const fetchAndDisplayTasks = async () => {
        try {
            const response = await fetch('/api/tasks');
            if (!response.ok) {
                throw new Error('Failed to fetch tasks');
            }

            const tasks = await response.json();
            taskListContainer.innerHTML = '';

            if (tasks.length === 0) {
                taskListContainer.innerHTML = '<p>No tasks available.</p>';
                return;
            }

            const taskList = document.createElement('ul');
            tasks.forEach(task => {
                const item = document.createElement('li');
                
                let assignmentText = 'Unassigned';
                if (task.assignee_username) {
                    assignmentText = `Assigned to: ${task.assignee_username} (Status: ${task.assignment_status})`;
                }

                let deadlineText = task.deadline ? ` | Deadline: ${new Date(task.deadline).toLocaleString()}` : '';

                item.innerHTML = `
                    <strong>${task.title}</strong> (${task.difficulty}, ${task.points_reward} pts) - <em>Created by: ${task.creator_username}</em><br>
                    <small>${assignmentText}${deadlineText}</small>
                `;
                taskList.appendChild(item);
            });
            taskListContainer.appendChild(taskList);

        } catch (error) {
            console.error('Error fetching tasks:', error);
            taskListContainer.innerHTML = '<p>Could not load tasks. Please try again later.</p>';
        }
    };

    // Funksjon for å håndtere opprettelse av ny task
    const handleCreateTask = async (event) => {
        event.preventDefault();

        const formData = new FormData(createTaskForm);
        const data = Object.fromEntries(formData.entries());

        // Fjern tomme valgfrie felt slik at de ikke sendes som tomme strenger
        if (!data.assigned_to) delete data.assigned_to;
        if (!data.deadline) delete data.deadline;

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
                fetchAndDisplayTasks(); // Oppdater task-listen med den nye oppgaven
            }
        } catch (error) {
            console.error('Error creating task:', error);
            taskFormMessage.textContent = 'An unexpected error occurred. Please try again.';
            taskFormMessage.style.display = 'block';
            taskFormMessage.style.color = 'red';
        }
    };

    // Legg til event listeners
    createTaskForm.addEventListener('submit', handleCreateTask);
    requestsList.addEventListener('click', handleRequestAction);

    // Initialiser siden ved å hente all nødvendig data
    fetchAndPopulateFamilyMembers();
    fetchAndDisplayRequests();
    fetchAndDisplayTasks();
});