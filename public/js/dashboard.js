document.addEventListener('DOMContentLoaded', () => {
    // Setup
    checkAdminRights();
    fetchMyTasks();

    // Bruk event delegation for complete buttons
    const taskList = document.getElementById('my-tasks-list');
    if (taskList) {
        taskList.addEventListener('click', (event) => {
            // Check if a complete button was clicked inside the list
            const completeButton = event.target.closest('.task-complete-btn');
            if (completeButton) {
                const assignmentId = completeButton.dataset.assignmentId;
                if (assignmentId) {
                    markTaskAsComplete(assignmentId);
                }
            }
        });
    }
});

async function checkAdminRights() {
    const adminButtonContainer = document.getElementById('admin-button-container');
    try {
        const response = await fetch('/api/user/permissions');
        if (!response.ok) throw new Error('Could not check user permissions.');
        
        const { hasAdminRights } = await response.json();
        if (hasAdminRights && adminButtonContainer) {
            adminButtonContainer.innerHTML = `<a href="/admin">Go to Admin Panel</a>`;
        }
    } catch (error) {
        console.error('Error setting up admin button:', error);
    }
}

async function fetchMyTasks() {
    try {
        const response = await fetch('/api/mytasks');
        if (!response.ok) throw new Error('Could not fetch your tasks.');
        const tasks = await response.json();
        renderTasks(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        const taskList = document.getElementById('my-tasks-list');
        if(taskList) taskList.innerHTML = '<li>Could not load your tasks.</li>';
    }
}

function renderTasks(tasks) {
    const taskList = document.getElementById('my-tasks-list');
    const template = document.getElementById('task-item-template');
    const noTasksMessage = document.getElementById('no-tasks-message');

    if (!taskList || !template || !noTasksMessage) return;

    // klarer listen før vi rendrer nye tasks
    taskList.innerHTML = '';

    if (tasks.length === 0) {
        noTasksMessage.style.display = 'block';
        return;
    }
    
    noTasksMessage.style.display = 'none';

    tasks.forEach(task => {
        // Klon template for hver task
        const clone = template.content.cloneNode(true);

        // Finn elementene i klonen
        const taskTitle = clone.querySelector('.task-title');
        const completeButton = clone.querySelector('.task-complete-btn');
        const statusSpan = clone.querySelector('.task-status');
        const taskItem = clone.querySelector('.task-item');

        // Gi elementene riktige data
        taskItem.id = `task-item-${task.assignment_id}`;
        taskTitle.textContent = task.title;

        // Håndtere logik for knapp og status basert på task status
        if (task.status === 'pending') {
            completeButton.style.display = 'block';
            statusSpan.style.display = 'none';
            // Lagre ID-en på knappen for klikkbehandleren
            completeButton.dataset.assignmentId = task.assignment_id;
        } else if (task.status === 'completed') {
            completeButton.style.display = 'none';
            statusSpan.style.display = 'block';
        }

        // Legg til klone i listen
        taskList.appendChild(clone);
    });
}

async function markTaskAsComplete(assignmentId) {
    if (!confirm('Are you sure you want to mark this task as complete?')) return;

    try {
        const response = await fetch(`/api/tasks/${assignmentId}/complete`, { method: 'POST' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'An error occurred.');

        alert(result.message);
        // Re-fetch alle oppgaver på nytt for å sikre at brukergrensesnittet er synkronisert med servertilstanden
        fetchMyTasks();

    } catch (error) {
        console.error('Error completing task:', error);
        alert(`Error: ${error.message}`);
    }
}