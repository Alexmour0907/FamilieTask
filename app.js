const express = require('express');
const bcrypt = require('bcrypt');
const path = require('path');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const crypto = require('crypto'); // Dette er for Join-code generering, kan ikke bruke bcrypt her.

// Last inn miljøvariabler fra .env-filen
require('dotenv').config();

const app = express();
// PORT
const PORT = 3000;

//Databasen
const Database = require('better-sqlite3');
const db = new Database('FamilieTask_database.db');

// Middleware

app.use(session({
    store: new FileStore({ path: './sessions', logFn: function(){} }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 // 1 dag
    }
}));

// Legg til body-parsing for skjema/JSON
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// En funksjon for å fjerne utgåtte eller avviste join-forespørsler når de blir "expired"
function cleanupExpiredJoinRequests() {
    const sql = `
        DELETE FROM JoinRequests 
        WHERE expires_at < DATETIME('now')
    `;
    try {
        const info = db.prepare(sql).run();
        if (info.changes > 0) {
            console.log(`[Cron Job] Cleaned up ${info.changes} expired join requests.`);
        }
    } catch (error) {
        console.error('[Cron Job] Error cleaning up expired join requests:', error);
    }
}

// Kjør cleanup hver time
setInterval(cleanupExpiredJoinRequests, 1000 * 60 * 60);

// Også kjør den en gang ved oppstart
cleanupExpiredJoinRequests();

// Middleware for å beskytte ruter som krever autentisering
const requireLogin = (req, res, next) => {
    if (!req.session.user) {

        if (req.accepts('html')) {
            return res.redirect('/index.html');
        }
        return res.status(401).json({ message: 'Authentication required. Please log in.' });
    }
    next();
};

//Hoved Ruter
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Beskyttede ruter
app.get('/dashboard.html', requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/createNewFamily.html', requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'createNewFamily.html'));
});

app.get('/admin', requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'user-adminpanel.html'));
});

//Serve statiske filer fra "public"-mappen
app.use(express.static('public'));

// Registration route
app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Please provide all required fields.' });
    }

    try {
        // Check if user already exists
        const stmt_find = db.prepare('SELECT * FROM users WHERE email = ?');
        const existingUser = stmt_find.get(email);

        if (existingUser) {
            return res.status(409).json({ message: 'User with this email already exists.' });
        }

        // Hash the password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Insert new user into the database
        const stmt_insert = db.prepare('INSERT INTO users (username, email, password) VALUES (?, ?, ?)');
        stmt_insert.run(username, email, hashedPassword);

        res.status(201).json({ message: 'User registered successfully!' });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Login route
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {
        const userStmt = db.prepare('SELECT * FROM Users WHERE email = ?');
        const user = userStmt.get(email);

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        req.session.user = {
            id: user.id,
            username: user.username,
            email: user.email
        };

        // Sjekk familie medlemskap
        const familyStmt = db.prepare('SELECT family_id FROM FamilyMembers WHERE user_id = ? LIMIT 1');
        const familyMembership = familyStmt.get(user.id);

        if (familyMembership) {
            req.session.currentFamilyId = familyMembership.family_id;
        }

        // Velg redirect URL basert på familie medlemskap
        const redirectUrl = familyMembership ? '/dashboard.html' : '/createNewFamily.html';

        res.status(200).json({ message: 'Login successful!', redirectUrl });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Create Family Route 
app.post('/createFamily', requireLogin, (req, res) => {
    const { familyName } = req.body;
    const userId = req.session.user.id;

    // 1. Validate family name
    const trimmedName = familyName ? familyName.trim() : '';
    if (trimmedName.length < 2 || trimmedName.length > 50) {
        return res.status(400).json({ message: 'Family name must be between 2 and 50 characters.' });
    }

    try {
        // 2. Generer en unik join-kode
        let joinCode;
        let isUnique = false;
        const findCodeStmt = db.prepare('SELECT id FROM Families WHERE join_code = ?');
        while (!isUnique) {
            joinCode = crypto.randomBytes(6).toString('hex').toUpperCase(); // 12-char code
            const existingFamily = findCodeStmt.get(joinCode);
            if (!existingFamily) {
                isUnique = true;
            }
        }

        // 3. Bruke transaksjon for å opprette familie og legge til eier som medlem
        const createFamilyTx = db.transaction(() => {
            const insertFamilyStmt = db.prepare(
                'INSERT INTO Families (name, owner_id, join_code, last_code_update) VALUES (?, ?, ?, ?)'
            );
            const info = insertFamilyStmt.run(trimmedName, userId, joinCode, new Date().toISOString());
            const familyId = info.lastInsertRowid;

            const insertMemberStmt = db.prepare(
                'INSERT INTO FamilyMembers (family_id, user_id, role) VALUES (?, ?, ?)'
            );
            insertMemberStmt.run(familyId, userId, 'owner');

            req.session.currentFamilyId = familyId;
        });

        createFamilyTx();

        // 4. Svar til klienten
        res.status(201).json({ message: 'Family created successfully!', redirectUrl: '/dashboard.html' });

    } catch (error) {
        console.error('Family creation error:', error);
        res.status(500).json({ message: 'Internal server error during family creation.' });
    }
});

// Join Family Route
app.post('/join-request', requireLogin, (req, res) => {
    const { joinCode } = req.body;
    const userId = req.session.user.id;

    if (!joinCode || joinCode.trim().length === 0) {
        return res.status(400).json({ message: 'Join code is required.' });
    }

    try {
        // Finn familie basert på join-koden
        const familyStmt = db.prepare('SELECT id FROM Families WHERE join_code = ?');
        const family = familyStmt.get(joinCode.trim().toUpperCase());

        // Hvis det ikke er en familie med den join-koden send 404 error
        if (!family) {
            return res.status(404).json({ message: 'Invalid join code.' });
        }

        const familyId = family.id;

        // Sjekk om brukeren allerede er medlem av familien
        const memberSql = 'SELECT 1 FROM FamilyMembers WHERE family_id = ? AND user_id = ?';
        const memberStmt = db.prepare(memberSql).get(familyId, userId);

        if (memberStmt) {
            return res.status(409).json({ message: 'You are already a member of this family.' });
        }

        // Sjekk om det allerede finnes en ventende forespørsel
        const requestSql = `SELECT 1 FROM JoinRequests WHERE family_id = ? AND user_id = ? AND status = 'pending'`;
        const existingRequest = db.prepare(requestSql).get(familyId, userId);

        if (existingRequest) {
            return res.status(409).json({ message: 'You already have a pending join request for this family.' });
        }

        const insertSql = `
            INSERT INTO JoinRequests (family_id, user_id, status, expires_at) 
            VALUES (?, ?, 'pending', DATETIME('now', '+7 days'))
        `;
        db.prepare(insertSql).run(familyId, userId);

        // Sender suksessrespons
        res.status(200).json({ 
            success: true,
            message: 'Join request sent successfully! The family owner has been notified.' 
        });

    } catch (error) {
        console.error('Join request error:', error);
        res.status(500).json({ message: 'Server error while processing join request.' });
    }
});

// Hent alle familier for en bruker
// FORMÅL: Gir frontend en liste over alle familier brukeren er medlem av.
app.get('/api/user/families', requireLogin, (req, res) => {
    const userId = req.session.user.id;
    try {
        const sql = `
            SELECT f.id, f.name
            FROM Families f
            JOIN FamilyMembers fm ON f.id = fm.family_id
            WHERE fm.user_id = ?
            ORDER BY f.name
        `;
        const families = db.prepare(sql).all(userId);
        res.status(200).json(families);
    } catch (error) {
        console.error('Error fetching user families:', error);
        res.status(500).json({ message: 'Server error while fetching families.' });
    }
});

// Bytt aktiv familie i session
// FORMÅL: Lar brukeren bytte hvilken familie som er "aktiv".
// VIKTIG: Oppdaterer `req.session.currentFamilyId`, som styrer hvilken families data som vises.
app.post('/api/user/switch-family', requireLogin, (req, res) => {
    const { familyId } = req.body;
    const userId = req.session.user.id;

    if (!familyId) {
        return res.status(400).json({ message: 'Family ID is required.' });
    }

    try {
        // Verifiser at brukeren er medlem av denne familien
        const sql = 'SELECT 1 FROM FamilyMembers WHERE user_id = ? AND family_id = ?';
        const member = db.prepare(sql).get(userId, familyId);

        if (!member) {
            return res.status(403).json({ message: 'You are not a member of this family.' });
        }

        // Oppdater den aktive familien i brukerens session
        req.session.currentFamilyId = familyId;
        res.status(200).json({ message: `Switched to family ${familyId} successfully.` });

    } catch (error) {
        console.error('Error switching family:', error);
        res.status(500).json({ message: 'Server error while switching family.' });
    }
});

// Hent den nåværende aktive familien
// FORMÅL: Lar frontend sjekke hvilken familie som er aktiv.
// BRUK: Nyttig når siden lastes for å sette riktig tilstand i UI, f.eks. vise navnet på aktiv familie.
app.get('/api/user/current-family', requireLogin, (req, res) => {
    if (req.session.currentFamilyId) {
        res.status(200).json({ currentFamilyId: req.session.currentFamilyId });
    } else {
        res.status(404).json({ message: 'No active family selected.' });
    }
});

// Få påventende join-forespørsler (for familieeier og administratorer)
app.get('/api/join-requests', requireLogin, (req, res) => {
    const currentUserId = req.session.user.id;

    try {
        const sql = `
            SELECT 
                jr.id AS requestId,
                u.username AS requesterUsername,
                u.email AS requesterEmail,
                f.name AS familyName,
                jr.status,
                jr.requested_at,
                jr.expires_at
            FROM JoinRequests jr
            JOIN Users u ON jr.user_id = u.id
            JOIN Families f ON jr.family_id = f.id
            WHERE jr.status = 'pending' AND f.id IN (
                SELECT family_id FROM FamilyMembers 
                WHERE user_id = ? AND (role = 'owner' OR role = 'admin')
            )
            ORDER BY jr.requested_at DESC
        `;

        const requests = db.prepare(sql).all(currentUserId);
        res.status(200).json(requests); 

    } catch (error) {
        console.error('Error fetching join requests:', error);
        res.status(500).json({ message: 'Server error while fetching join requests.' });
    }
});

// Skjekk brukerens admin-rettigheter
app.get('/api/user/permissions', requireLogin, (req, res) => {
    const userId = req.session.user.id;
    try {
        const sql = `
            SELECT 1 FROM FamilyMembers 
            WHERE user_id = ? AND (role = 'owner' OR role = 'admin')
            LIMIT 1
        `;
        const permission = db.prepare(sql).get(userId);
        
        res.status(200).json({ hasAdminRights: !!permission });

    } catch (error) {
        console.error('Error fetching user permissions:', error);
        res.status(500).json({ message: 'Server error while fetching permissions.' });
    }
});

// Håndterer join request accept/reject
app.post('/api/join-requests/:requestId/respond', requireLogin, (req, res) => {
    const { requestId } = req.params;
    const { action } = req.body; // 'accept' eller 'reject'
    const currentUserId = req.session.user.id;

    if (!action || !['accept', 'reject'].includes(action)) {
        return res.status(400).json({ message: "Invalid action. Must be 'accept' or 'reject'." });
    }

    try {
        const transaction = db.transaction((userId, reqId, act) => {
            const getRequestSql = `
                SELECT jr.family_id, jr.user_id, jr.status, fm.role
                FROM JoinRequests jr
                LEFT JOIN FamilyMembers fm ON jr.family_id = fm.family_id AND fm.user_id = ?
                WHERE jr.id = ?
            `;
            const request = db.prepare(getRequestSql).get(userId, reqId);

            if (!request) {
                const err = new Error('Join request not found.');
                err.statusCode = 404;
                throw err;
            }
            if (request.status !== 'pending') {
                const err = new Error(`Request has already been ${request.status}.`);
                err.statusCode = 409;
                throw err;
            }
            if (request.role !== 'owner' && request.role !== 'admin') {
                const err = new Error('You do not have permission to manage this request.');
                err.statusCode = 403;
                throw err;
            }

            if (act === 'accept') {
                let responseMessage;
                
                // Sjekk om brukeren allerede er medlem
                const memberCheckSql = 'SELECT 1 FROM FamilyMembers WHERE family_id = ? AND user_id = ?';
                const existingMember = db.prepare(memberCheckSql).get(request.family_id, request.user_id);

                if (existingMember) {
                    responseMessage = 'User was already a member. Request marked as accepted.';
                } else {
                    // Hvis ikke medlem, legg dem til
                    const insertMemberSql = 'INSERT INTO FamilyMembers (family_id, user_id, role) VALUES (?, ?, ?)';
                    db.prepare(insertMemberSql).run(request.family_id, request.user_id, 'standard');
                    responseMessage = 'User has been added to the family.';
                }

                // Uansett, oppdater forespørselsstatus til 'approved'
                const updateRequestSql = "UPDATE JoinRequests SET status = 'approved' WHERE id = ?";
                db.prepare(updateRequestSql).run(reqId);
                
                return { message: responseMessage };

            } else { // action === 'reject'
                const updateRequestSql = "UPDATE JoinRequests SET status = 'rejected' WHERE id = ?";
                db.prepare(updateRequestSql).run(reqId);
                return { message: 'Join request has been rejected.' };
            }
        });

        const result = transaction(currentUserId, requestId, action);
        res.status(200).json(result);

    } catch (error) {
        if (error.statusCode) {
            res.status(error.statusCode).json({ message: error.message });
        } else {
            console.error('Error responding to join request:', error);
            res.status(500).json({ message: 'Server error while processing the request.' });
        }
    }
});

app.get('/api/family-members', requireLogin, (req, res) => {
    const familyId = req.session.currentFamilyId;

    if (!familyId) {
        return res.status(404).json({ message: 'User is not in a family, or no active family selected. Please select an active family.' });
    }

    try {
        const sql = `
            SELECT u.id, u.username 
            FROM Users u
            JOIN FamilyMembers fm ON u.id = fm.user_id
            WHERE fm.family_id = ?
            ORDER BY u.username
        `;
        const members = db.prepare(sql).all(familyId);
        res.status(200).json(members);
    } catch (error) {
        console.error('Error fetching family members:', error);
        res.status(500).json({ message: 'Server error while fetching family members.' });
    }
});

// Task management routes

const getUserRoleInFamily = (userId, familyId) => {
    const roleStmt = db.prepare('SELECT role FROM FamilyMembers WHERE user_id = ? AND family_id = ?');
    const roleResult = roleStmt.get(userId, familyId);
    return roleResult ? roleResult.role : null;
}

// Lage en ny task
app.post('/api/tasks', requireLogin, (req, res) => {
    const { title, description, difficulty, assigned_to, deadline } = req.body;
    const userId = req.session.user.id;

    // Validering av input
    if (!title || title.trim().length === 0) {
        return res.status(400).json({ message: 'Task title is required.' });
    }

    if (title.trim().length > 28) {
        return res.status(400).json({ message: 'Task title cannot exceed 28 characters.' });
    }

    // Faste poengsummer basert på vanskelighetsgrad
    const pointsMap = {
        light: 5,
        easy: 10,
        medium: 25,
        hard: 50
    };
    const taskDifficulty = difficulty || 'medium';
    const points_reward = pointsMap[taskDifficulty];

    // Hent familie og rolle
    const familyId = req.session.currentFamilyId;
    if (!familyId) {
        return res.status(403).json({ message: 'You must be part of a family to create tasks.' });
    }
    const userRole = getUserRoleInFamily(userId, familyId);
    if (userRole !== 'owner' && userRole !== 'admin') {
        return res.status(403).json({ message: 'You do not have permission to create tasks.' });
    }

    // Bruk en transaksjon for å sikre at både task og tildeling blir opprettet
    const createTaskTransaction = db.transaction(() => {
        // Opprett selve oppgaven
        const insertTaskSql = `
            INSERT INTO Tasks (family_id, title, description, difficulty, points_reward, created_by, deadline)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const taskInfo = db.prepare(insertTaskSql).run(
            familyId,
            title.trim(),
            description || null,
            taskDifficulty,
            points_reward,
            userId,
            deadline || null
        );
        const newTaskId = taskInfo.lastInsertRowid;

        // 2. Opprett en tildeling i AssignedTasks
        const assignmentStatus = assigned_to ? 'pending' : 'not_assigned';
        const insertAssignmentSql = `
            INSERT INTO AssignedTasks (task_id, user_id, status)
            VALUES (?, ?, ?)
        `;
        db.prepare(insertAssignmentSql).run(newTaskId, assigned_to || null, assignmentStatus);

        return newTaskId;
    });

    try {
        const newTaskId = createTaskTransaction();
        
        // Hent den nylig opprettede oppgaven for å sende tilbake i responsen
        const getNewTaskSql = `
            SELECT t.*, at.status as assignment_status, u.username as assignee_username
            FROM Tasks t
            LEFT JOIN AssignedTasks at ON t.id = at.task_id
            LEFT JOIN Users u ON at.user_id = u.id
            WHERE t.id = ?
        `;
        const newTask = db.prepare(getNewTaskSql).get(newTaskId);

        res.status(201).json({ message: 'Task created successfully!', task: newTask });

    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ message: 'Server error while creating task.' });
    }
});

// Se tasks / hente alle tasks for familien
app.get('/api/tasks', requireLogin, (req, res) => {
    const familyId = req.session.currentFamilyId;

    if (!familyId) {
        return res.status(200).json([]); // Returner tom liste hvis ikke i familie
    }

    try {
        const sql = `
            SELECT
                t.id,
                t.title,
                t.description,
                t.difficulty,
                t.points_reward,
                t.created,
                t.deadline,
                creator.username AS creator_username,
                assignee.username AS assignee_username,
                at.user_id AS assigned_to,
                at.status AS assignment_status
            FROM Tasks t
            JOIN Users creator ON t.created_by = creator.id
            LEFT JOIN AssignedTasks at ON t.id = at.task_id
            LEFT JOIN Users assignee ON at.user_id = assignee.id
            WHERE t.family_id = ?
            ORDER BY t.created DESC
        `;
        const tasks = db.prepare(sql).all(familyId);
        res.status(200).json(tasks);

    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ message: 'Server error while fetching tasks.' });
    }
});

// Hente oppgaver tildelt til den innloggede brukeren
app.get('/api/mytasks', requireLogin, (req, res) => {
    const userId = req.session.user.id;
    const familyId = req.session.currentFamilyId; // Hent aktiv familie

    if (!familyId) {
        return res.status(200).json([]); // Returner tom liste hvis ingen familie er valgt
    }

    try {
        const sql = `
            SELECT
                t.id AS task_id,
                at.id AS assignment_id,
                t.title,
                t.description,
                t.difficulty,
                t.points_reward,
                t.deadline,
                at.status
            FROM AssignedTasks at
            JOIN Tasks t ON at.task_id = t.id
            WHERE at.user_id = ? AND t.family_id = ? AND at.status IN ('pending', 'completed')
            ORDER BY t.deadline ASC, t.created DESC
        `;
        const myTasks = db.prepare(sql).all(userId, familyId); // Legg til familyId her
        res.status(200).json(myTasks);
    } catch (error) {
        console.error('Error fetching user tasks:', error);
        res.status(500).json({ message: 'Server error while fetching your tasks.' });
    }
});

// Bruker markerer en av sine tildelte oppgaver som fullført (venter på godkjenning)
app.post('/api/tasks/:assignmentId/complete', requireLogin, (req, res) => {
    const { assignmentId } = req.params;
    const userId = req.session.user.id;

    try {
        const getAssignmentSql = 'SELECT user_id, status FROM AssignedTasks WHERE id = ?';
        const assignment = db.prepare(getAssignmentSql).get(assignmentId);

        if (!assignment) {
            return res.status(404).json({ message: 'Task assignment not found.' });
        }

        if (assignment.user_id !== userId) {
            return res.status(403).json({ message: 'You are not authorized to modify this task.' });
        }

        if (assignment.status !== 'pending') {
            return res.status(400).json({ message: `Cannot complete a task that is already in '${assignment.status}' status.` });
        }

        const updateSql = "UPDATE AssignedTasks SET status = 'completed' WHERE id = ?";
        db.prepare(updateSql).run(assignmentId);

        res.status(200).json({ message: 'Task marked as complete. Awaiting approval.' });

    } catch (error) {
        console.error('Error completing task:', error);
        res.status(500).json({ message: 'Server error while completing task.' });
    }
});

// Hent oppgaver som venter på godkjenning (kun for admin/eier)
app.get('/api/tasks/pending-approval', requireLogin, (req, res) => {
    const userId = req.session.user.id;
    const familyId = req.session.currentFamilyId;

    if (!familyId) {
        return res.status(400).json({ message: 'No active family selected.' });
    }

    // Sjekk om brukeren er admin eller eier for den aktive familien
    const userRole = getUserRoleInFamily(userId, familyId);
    if (userRole !== 'owner' && userRole !== 'admin') {
        return res.status(403).json({ message: 'You do not have permission to view this data.' });
    }

    try {
        const sql = `
            SELECT
                at.id AS assignment_id,
                t.title,
                t.points_reward,
                u.username AS completed_by
            FROM AssignedTasks at
            JOIN Tasks t ON at.task_id = t.id
            JOIN Users u ON at.user_id = u.id
            WHERE t.family_id = ? AND at.status = 'completed'
            ORDER BY at.assigned_date ASC
        `;
        const pendingTasks = db.prepare(sql).all(familyId);
        res.status(200).json(pendingTasks);

    } catch (error) {
        console.error('Error fetching tasks pending approval:', error);
        res.status(500).json({ message: 'Server error while fetching tasks for approval.' });
    }
});

//Admin/eier godkjenner en fullført oppgave
app.post('/api/tasks/:assignmentId/approve', requireLogin, (req, res) => {
    const { assignmentId } = req.params;
    const adminUserId = req.session.user.id;

    try {
        const transaction = db.transaction(() => {
            const sql = `
                SELECT
                    at.user_id,
                    at.status,
                    t.points_reward,
                    t.family_id,
                    fm.role
                FROM AssignedTasks at
                JOIN Tasks t ON at.task_id = t.id
                JOIN FamilyMembers fm ON t.family_id = fm.family_id AND fm.user_id = ?
                WHERE at.id = ?
            `;
            const taskInfo = db.prepare(sql).get(adminUserId, assignmentId);

            if (!taskInfo) {
                throw { statusCode: 404, message: 'Task not found or you do not have rights in this family.' };
            }
            if (taskInfo.role !== 'owner' && taskInfo.role !== 'admin') {
                throw { statusCode: 403, message: 'You do not have permission to approve this task.' };
            }
            if (taskInfo.status !== 'completed') {
                throw { statusCode: 400, message: 'Task is not marked as completed.' };
            }

            // Oppdater status til 'approved'
            const updateAssignmentSql = "UPDATE AssignedTasks SET status = 'approved' WHERE id = ?";
            db.prepare(updateAssignmentSql).run(assignmentId);

            // Tildel poeng til brukeren
            const awardPointsSql = `
                INSERT INTO Points (user_id, family_id, points)
                VALUES (?, ?, ?)
                ON CONFLICT(user_id, family_id) DO UPDATE SET
                points = points + excluded.points;
            `;
            db.prepare(awardPointsSql).run(taskInfo.user_id, taskInfo.family_id, taskInfo.points_reward);

            return { message: 'Task approved and points awarded.' };
        });

        const result = transaction();
        res.status(200).json(result);

    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message || 'Server error while approving task.' });
    }
});

// Admin/eier avviser en fullført oppgave
app.post('/api/tasks/:assignmentId/reject', requireLogin, (req, res) => {
    const { assignmentId } = req.params;
    const adminUserId = req.session.user.id;

    try {
        const sql = `
            SELECT at.status, fm.role
            FROM AssignedTasks at
            JOIN Tasks t ON at.task_id = t.id
            JOIN FamilyMembers fm ON t.family_id = fm.family_id AND fm.user_id = ?
            WHERE at.id = ?
        `;
        const taskInfo = db.prepare(sql).get(adminUserId, assignmentId);

        if (!taskInfo) {
            return res.status(404).json({ message: 'Task not found or you do not belong to this family.' });
        }
        if (taskInfo.role !== 'owner' && taskInfo.role !== 'admin') {
            return res.status(403).json({ message: 'You do not have permission to reject tasks.' });
        }
        if (taskInfo.status !== 'completed') {
            return res.status(400).json({ message: `Cannot reject a task with status '${taskInfo.status}'.` });
        }

        const updateSql = "UPDATE AssignedTasks SET status = 'pending' WHERE id = ?";
        db.prepare(updateSql).run(assignmentId);

        res.status(200).json({ message: 'Task completion rejected. Status has been reset to pending.' });
    } catch (error) {
        console.error('Error rejecting task:', error);
        res.status(500).json({ message: 'Server error while rejecting task.' });
    }
});

//console log lenken til siden på localhost
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});