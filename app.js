const express = require('express');
const bcrypt = require('bcrypt');
const path = require('path');

const app = express();
// PORT
const PORT = 3000;

//Databasen
const Database = require('better-sqlite3');
const db = new Database('FamilieTask_database.db');

//console log lenken til siden på localhost
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

//Serve statiske filer fra "public"-mappen
app.use(express.static('public'));

// Middleware
// Legg til body-parsing for skjema/JSON
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

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