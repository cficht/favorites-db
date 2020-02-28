// Load Environment Variables from the .env file
require('dotenv').config();

// Application Dependencies
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const request = require('superagent');

// Initiate database connection
const client = require('./lib/client');
client.connect();

// Application Setup
const app = express();
const PORT = process.env.PORT;
app.use(morgan('dev')); // http logging
app.use(cors()); // enable CORS request
app.use(express.static('public')); // server files from /public folder
app.use(express.json()); // enable reading incoming json data
app.use(express.urlencoded({ extended: true }));
// app.use(auth());

// Auth Routes
const createAuthRoutes = require('./lib/auth/create-auth-routes');

const authRoutes = createAuthRoutes({
    selectUser(email) {
        return client.query(`
            SELECT id, email, hash 
            FROM users
            WHERE email = $1;
        `,
        [email]
        ).then(result => result.rows[0]);
    },
    insertUser(user, hash) {
        return client.query(`
            INSERT into users (email, hash)
            VALUES ($1, $2)
            RETURNING id, email;
        `,
        [user.email, hash]
        ).then(result => result.rows[0]);
    }
});

// before ensure auth, but after other middleware:
app.use('/api/auth', authRoutes);
const ensureAuth = require('./lib/auth/ensure-auth');
app.use('/api', ensureAuth);

// API Routes
app.get('/api/videogames', async (req, res) => {
    try {
        const data = await request.get(`https://api.rawg.io/api/games?search=${req.query.search}`);
        res.json(data.body);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({
            error: err.message || err
        });
    }
});

app.post('/api/todos', async (req, res) => {
    try {
        const result = await client.query(`
            INSERT INTO todos (task, complete, user_id)
            VALUES ($1, $2, $3)
            RETURNING *;
            
        `,
        [req.body.task, false, req.userId]);

        res.json(result.rows[0]);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({
            error: err.message || err
        });
    }
});

app.put('/api/todos/:id', async (req, res) => {
    try {
        const result = await client.query(`
            UPDATE todos
            SET complete=$1
            WHERE id = $2
            RETURNING *;
        `, [req.body.complete, req.params.id]);

        res.json(result.rows[0]);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({
            error: err.message || err
        });
    }
});

app.delete('/api/todos/:id', async (req, res) => {
    try {
        const result = await client.query(`
            DELETE FROM todos
            WHERE todos.id=$1;        
        `, [req.params.id]);

        res.json(result.rows[0]);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({
            error: err.message || err
        });
    }
});

app.get('*', (req, res) => {
    res.send('No todos are here...');
});

// Start the server
app.listen(PORT, () => {
    console.log('server running on PORT', PORT);
});