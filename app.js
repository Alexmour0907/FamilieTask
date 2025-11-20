const express = require('express');
const bcrypt = require('bcrypt');
const path = require('path');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const crypto = require('crypto'); // Dette er for Join-code generering, kan ikke bruke bcrypt her.

const app = express();
// PORT
const PORT = 3000;

//Databasen
const Database = require('better-sqlite3');
const db = new Database('FamilieTask_database.db');


//Serve statiske filer fra "public"-mappen
app.use(express.static('public'));

//console log lenken til siden på localhost
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Middleware

app.use(session({
    store: new FileStore({ path: './sessions', logFn: function(){} }),
    secret: 'en-veldig-hemmelig-nokkel', // Replace with a long, random string
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

// Middleware for å beskytte ruter som krever autentisering
const requireLogin = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Authentication required. Please log in.' });
    }
    next();
};

//Ruter
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

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
        const familyStmt = db.prepare('SELECT family_id FROM FamilyMembers WHERE user_id = ?');
        const familyMembership = familyStmt.get(user.id);

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
        });

        createFamilyTx();

        // 4. Svar til klienten
        res.status(201).json({ message: 'Family created successfully!', redirectUrl: '/dashboard.html' });

    } catch (error) {
        console.error('Family creation error:', error);
        res.status(500).json({ message: 'Internal server error during family creation.' });
    }
});