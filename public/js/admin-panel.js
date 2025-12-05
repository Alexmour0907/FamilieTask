document.addEventListener('DOMContentLoaded', () => {
    // --- Element-referanser ---
    const joinRequestsList = document.getElementById('join-requests-list');
    const approvalTasksList = document.getElementById('approval-tasks-list');
    const userList = document.getElementById('user-list');
    const allTasksList = document.getElementById('all-tasks-list');
    const createTaskModal = document.getElementById('create-task-modal');
    const createTaskForm = document.getElementById('create-task-form');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const createNewTaskBtn = document.querySelector('.create-new-task-btn');
    const assignedToSelect = document.getElementById('task-assign-to');

    // --- Funksjoner for datainnhenting og rendering ---

    /**
     * Henter og viser innkommende join-requests.
     */
    const fetchAndDisplayRequests = async () => {
        const template = document.getElementById('join-request-template');
        if (!joinRequestsList || !template) return;

        try {
            const response = await fetch('/api/join-requests');
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            
            const requests = await response.json();
            joinRequestsList.innerHTML = ''; // Tømmer listen

            if (requests.length === 0) {
                joinRequestsList.innerHTML = '<p>No pending join requests.</p>';
                return;
            }

            requests.forEach(request => {
                const clone = template.content.cloneNode(true);
                const item = clone.querySelector('.request-item');
                item.dataset.requestId = request.requestId;

                clone.querySelector('.username').textContent = request.requesterUsername;
                clone.querySelector('.email').textContent = request.requesterEmail;
                clone.querySelector('.timestamp').textContent = `Expires: ${new Date(request.expires_at).toLocaleDateString()}`;
                
                // Legger til event listeners direkte på knappene
                clone.querySelector('.accept-btn').addEventListener('click', () => handleJoinRequestAction(request.requestId, 'accept'));
                clone.querySelector('.reject-btn').addEventListener('click', () => handleJoinRequestAction(request.requestId, 'reject'));

                joinRequestsList.appendChild(clone);
            });

        } catch (error) {
            console.error('Error fetching join requests:', error);
            joinRequestsList.innerHTML = '<p>Could not load join requests.</p>';
        }
    };

    /**
     * Henter og viser oppgaver som venter på godkjenning.
     */
    const fetchPendingApprovalTasks = async () => {
        if (!approvalTasksList) return;
        try {
            const response = await fetch('/api/tasks/pending-approval');
            if (!response.ok) throw new Error('Failed to fetch tasks for approval.');
            
            const tasks = await response.json();
            approvalTasksList.innerHTML = ''; // Tømmer listen

            if (tasks.length === 0) {
                approvalTasksList.innerHTML = '<li>No tasks are currently awaiting approval.</li>';
                return;
            }

            tasks.forEach(task => {
                const item = document.createElement('li');
                item.className = 'approval-item'; // Bruker en klasse for styling
                item.dataset.assignmentId = task.assignment_id;
                item.innerHTML = `
                    <div class="task-info">
                        <span class="task-title">${task.title}</span>
                        <span class="completed-by">Completed by: ${task.completed_by}</span>
                    </div>
                    <span class="points-reward">${task.points_reward}p</span>
                    <div class="actions">
                        <button class="approve-btn">Approve</button>
                        <button class="reject-btn">Reject</button>
                    </div>
                `;
                // Legger til event listeners direkte på knappene
                item.querySelector('.approve-btn').addEventListener('click', () => handleTaskApprovalAction(task.assignment_id, 'approve'));
                item.querySelector('.reject-btn').addEventListener('click', () => handleTaskApprovalAction(task.assignment_id, 'reject'));

                approvalTasksList.appendChild(item);
            });
        } catch (error) {
            console.error('Error fetching pending tasks:', error);
            approvalTasksList.innerHTML = '<li>Could not load tasks for approval.</li>';
        }
    };

    const fetchFamilyMembersForDropdown = async () => {
        const assignToSelect = document.getElementById('task-assign-to');
        if (!assignToSelect) return;
        try {
            const response = await fetch('/api/family-members');
            if (!response.ok) throw new Error('Failed to fetch family members.');
            const members = await response.json();

            assignToSelect.innerHTML = '<option value="">Unassigned</option>'; // Standardvalg

            members.forEach(member => {
                const option = document.createElement('option');
                option.value = member.id;
                option.textContent = member.username;
                assignToSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error fetching family members:', error);
        }
    };


    // --- Funksjoner for å håndtere brukerhandlinger ---

    /**
     * Håndterer 'accept'/'reject' for join-requests.
     */
    const handleJoinRequestAction = async (requestId, action) => {
        try {
            const response = await fetch(`/api/join-requests/${requestId}/respond`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            });

            if (response.ok) {
                // Fjerner elementet fra UI ved suksess
                const itemToRemove = joinRequestsList.querySelector(`li[data-request-id="${requestId}"]`);
                if (itemToRemove) itemToRemove.remove();
                // Sjekker om listen er tom etter fjerning
                if (joinRequestsList.children.length === 0 || (joinRequestsList.children.length === 1 && joinRequestsList.children[0].tagName !== 'LI')) {
                    joinRequestsList.innerHTML = '<p>No pending join requests.</p>';
                }
            } else {
                const result = await response.json();
                alert(`Error: ${result.message}`);
            }
        } catch (error) {
            console.error('Error processing join request:', error);
            alert('An unexpected error occurred.');
        }
    };

    /**
     * Håndterer 'approve'/'reject' for fullførte oppgaver.
     */
    const handleTaskApprovalAction = async (assignmentId, action) => {
        const endpointAction = action === 'reject' ? 'reject' : 'approve';
        try {
            const response = await fetch(`/api/tasks/${assignmentId}/${endpointAction}`, {
                method: 'POST'
            });

            if (response.ok) {
                // Fjerner elementet fra UI ved suksess
                const itemToRemove = approvalTasksList.querySelector(`li[data-assignment-id="${assignmentId}"]`);
                if (itemToRemove) itemToRemove.remove();
                if (approvalTasksList.children.length === 0) {
                    approvalTasksList.innerHTML = '<li>No tasks are currently awaiting approval.</li>';
                }
            } else {
                const result = await response.json();
                alert(`Error: ${result.message}`);
            }
        } catch (error) {
            console.error('Error processing task approval:', error);
            alert('An unexpected error occurred.');
        }
    };

    const handleCreateTask = async (event) => {
        event.preventDefault();

        const taskData = {
            title: document.getElementById('task-title').value,
            description: document.getElementById('task-description').value,
            difficulty: document.getElementById('task-difficulty').value,
            assigned_to: document.getElementById('task-assign-to').value || null,
            deadline: document.getElementById('task-deadline').value || null
        };

        try {
            const response = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taskData)
            });

            if (response.ok) {
                alert('Task created successfully!');
                createTaskForm.reset();
                createTaskModal.style.display = 'none';
            } else {
                const result = await response.json();
                alert(`Error: ${result.message}`);
            }
        } catch (error) {
            console.error('Error creating task:', error);
            alert('An unexpected error occurred.');
        }
    };

    // --- Modal-kontroll ---
    if (createNewTaskBtn) {
        createNewTaskBtn.addEventListener('click', () => {
            fetchFamilyMembersForDropdown();
            createTaskModal.style.display = 'flex';
            lucide.createIcons();
        });
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            createTaskModal.style.display = 'none';
        });
    }

    if (createTaskModal) {
        createTaskModal.addEventListener('click', (event) => {
            if (event.target === createTaskModal) {
                createTaskModal.style.display = 'none';
            }
        });
    }

    // --- Skjema-innsending ---
    if (createTaskForm) {
        createTaskForm.addEventListener('submit', handleCreateTask);
    }

    // --- Placeholder-funksjoner for fremtidig utvikling ---
    const displayUserManagementPlaceholder = () => {
        if (userList) {
            userList.innerHTML = '<tr><td colspan="4" style="text-align: center;">User management is coming soon.</td></tr>';
        }
    };

    const displayAllTasksPlaceholder = () => {
        if (allTasksList) {
            allTasksList.innerHTML = '<li style="text-align: center;">Viewing all family tasks is coming soon.</li>';
        }
    };

    // --- Initialiser siden ---
    const initializePage = () => {
        fetchAndDisplayRequests();
        fetchPendingApprovalTasks();
        displayUserManagementPlaceholder();
        displayAllTasksPlaceholder();
        lucide.createIcons(); // Kjøres for å rendere ikoner
    };

    initializePage();
});