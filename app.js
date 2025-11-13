const express = require('express');
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