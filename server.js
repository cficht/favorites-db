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
app.use('/api/me', ensureAuth);

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

app.get('/api/me/favorites', async (req, res) => {
    try {
        const myQuery = `
        SELECT * FROM favorites
        WHERE user_id=$1
        `;
        const favorites = await client.query(myQuery, [req.userId]);
        res.json(favorites.rows);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({
            error: err.message || err
        });
    }
});

app.post('/api/me/favorites', async (req, res) => {
    try {
        const newFavorites = await client.query(`
        INSERT INTO favorites (name, rating, background_image, released, user_id)
        values ($1, $2, $3, $4, $5)
        RETURNING *
        `, [req.body.name, req.body.rating, req.body.background_image, req.body.released, req.userId]);
        
        res.json(newFavorites.rows[0]);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({
            error: err.message || err
        });
    }
});

app.delete('/api/me/favorites/:id', async (req, res) => {
    try {
        const delFavorite = await client.query(`
        DELETE FROM favorites
        WHERE favorites.id=$1
        RETURNING *
        `, [req.params.id]);
        
        res.json(delFavorite.rows);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({
            error: err.message || err
        });
    }
});

app.get('*', (req, res) => {
    res.send('No favorites are here...');
});

// Start the server
app.listen(PORT, () => {
    console.log('server running on PORT', PORT);
});