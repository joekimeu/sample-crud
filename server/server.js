import express from 'express';
import mysql from 'mysql';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv'

dotenv.config() //ensure functional authentication
const app = express();

// Middleware to verify JWT
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ error: 'No token provided' });

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(500).json({ error: 'Failed to authenticate token' });
        req.username = decoded.username;
        next();
    });
};

app.use(cors()); // allows cross-origin resource sharing
app.use(express.json());

const db = mysql.createConnection({
    host: 'localhost',
    user: "root",
    password: "",
    database: "crud"
});

app.put('/edit/:username', (req, res) => {
    const sql = "UPDATE employees SET username=?, password=?, email=?, firstname=?, lastname=?, position=? WHERE username=?";
    const username = req.params.username;
    const values = [
        req.body.username,
        req.body.password,
        req.body.email,
        req.body.firstname,
        req.body.lastname,
        req.body.position,
        username
    ];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).json({ message: "Error inside server", error: err });
        }
        return res.json({ message: 'Record updated successfully', result: result });
    });
});

app.get('/home', (req, res) => {
    const sql = "SELECT * from employees";
    db.query(sql, (err, result) => {
        if (err) return res.json({ Message: "Error inside server" }) && console.log(err);

        console.log(result);
        return res.json(result);
    });
});

app.get('/read/:username', (req, res) => {
    const sql = "SELECT * from employees WHERE username = ?";
    const username = req.params.username;

    db.query(sql, [username], (err, result) => {
        if (err) return res.json({ Message: "Error inside server" });
        console.log(result);
        return res.json(result);
    });
});

app.post('/employees', (req, res) => {
    const sql = "INSERT INTO employees (username, password, email, firstname, lastname, position) VALUES (?)";
    const values = [
        req.body.username,
        req.body.password,
        req.body.email,
        req.body.firstname,
        req.body.lastname,
        req.body.position
    ];

    db.query(sql, [values], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).json({ error: 'Internal Server Error', details: err });
        }
        return res.status(201).json({ message: 'Record inserted successfully', result: result });
    });
});

app.delete('/delete/:username', (req, res) => {
    const sql = "DELETE FROM employees WHERE username = ?";
    const username = req.params.username;

    db.query(sql, [username], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).json({ error: 'Internal Server Error', details: err });
        }
        return res.status(200).json({ message: 'Employee successfully deleted', result: result });
    });
});

app.post('/signin', async (req, res) => {
    const { username, password } = req.body;
    const sql = 'SELECT * FROM employees WHERE username = ?';
    db.query(sql, [username], async (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).json({ error: 'Username doesn\'t exist' });
        }
        if (result.length > 0) {
            // User found, compare the hashed password
            const user = result[0];
            if (user.password === password) {
                const jwtToken = jwt.sign(
                    { username: username },
                    process.env.JWT_SECRET,
                    { expiresIn: '1h' } // Token expires in 1 hour
                );
                res.json({ message: "Welcome back!", token: jwtToken });
            } else {
                res.status(401).json({ error: 'Invalid username or password' });
            }
        } else {
            res.status(401).json({ error: 'Invalid username or password' });
        }
    });
});

// New search endpoint
app.get('/search', (req, res) => {
    const searchTerm = req.query.q;
    const sql = "SELECT * FROM employees WHERE username LIKE ? OR firstname LIKE ? OR lastname LIKE ? OR position LIKE ?";
    const values = [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).json({ error: 'Internal Server Error', details: err });
        }
        return res.json(result);
    });
});

//clock-in and out functionality

const getCurrentClockStatus = (username) => {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT * FROM clockins 
            WHERE username = ? AND date = CURDATE() 
            ORDER BY clockin_time DESC LIMIT 1
        `;
        db.query(sql, [username], (err, result) => {
            if (err) reject(err);
            resolve(result[0] || null);
        });
    });
};

app.get('/currentstatus', verifyToken, async (req, res) => {
    try {
        const status = await getCurrentClockStatus(req.username);
        res.json(status);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error', details: err });
    }
});

// Clock-in endpoint
app.post('/clockin', verifyToken, async (req, res) => {
    try {
        const status = await getCurrentClockStatus(req.username);
        if (status && !status.clockout_time) {
            return res.status(400).json({ error: 'Already clocked in' });
        }
        
        const sql = "INSERT INTO clockins (username, date, clockin_time) VALUES (?, CURDATE(), CURTIME())";
        db.query(sql, [req.username], (err, result) => {
            if (err) return res.status(500).json({ error: 'Internal Server Error', details: err });
            res.status(201).json({ message: 'Clocked in successfully', result });
        });
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error', details: err });
    }
});

// Lunch start endpoint
app.post('/lunchstart', verifyToken, async (req, res) => {
    try {
        const status = await getCurrentClockStatus(req.username);
        if (!status || status.clockout_time) {
            return res.status(400).json({ error: 'Not clocked in' });
        }
        if (status.lunch_start && !status.lunch_end) {
            return res.status(400).json({ error: 'Already on lunch break' });
        }
        if (status.lunch_start && status.lunch_end) {
            return res.status(400).json({ error: 'Lunch break already taken for this clock-in event' });
        }
        
        const sql = "UPDATE clockins SET lunch_start = CURTIME() WHERE id = ?";
        db.query(sql, [status.id], (err, result) => {
            if (err) return res.status(500).json({ error: 'Internal Server Error', details: err });
            res.status(200).json({ message: 'Lunch started successfully', result });
        });
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error', details: err });
    }
});

// Lunch end endpoint
app.post('/lunchend', verifyToken, async (req, res) => {
    try {
        const status = await getCurrentClockStatus(req.username);
        if (!status || status.clockout_time) {
            return res.status(400).json({ error: 'Not clocked in' });
        }
        if (!status.lunch_start) {
            return res.status(400).json({ error: 'Lunch break not started' });
        }
        if (status.lunch_end) {
            return res.status(400).json({ error: 'Lunch break already ended' });
        }
        
        const sql = "UPDATE clockins SET lunch_end = CURTIME() WHERE id = ?";
        db.query(sql, [status.id], (err, result) => {
            if (err) return res.status(500).json({ error: 'Internal Server Error', details: err });
            res.status(200).json({ message: 'Lunch ended successfully', result });
        });
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error', details: err });
    }
});

// Clock-out endpoint
app.post('/clockout', verifyToken, async (req, res) => {
    try {
        const status = await getCurrentClockStatus(req.username);
        if (!status || status.clockout_time) {
            return res.status(400).json({ error: 'Not clocked in' });
        }
        if (status.lunch_start && !status.lunch_end) {
            return res.status(400).json({ error: 'Cannot clock out while on lunch break' });
        }
        
        const sql = "UPDATE clockins SET clockout_time = CURTIME() WHERE id = ?";
        db.query(sql, [status.id], (err, result) => {
            if (err) return res.status(500).json({ error: 'Internal Server Error', details: err });
            res.status(200).json({ message: 'Clocked out successfully', result });
        });
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error', details: err });
    }
});

// Get clock-in/out history
app.get('/clockhistory', verifyToken, (req, res) => {
    const sql = "SELECT date, clockin_time, lunch_start, lunch_end, clockout_time FROM clockins WHERE username = ? ORDER BY date DESC, clockin_time DESC";
    db.query(sql, [req.username], (err, result) => {
        if (err) return res.status(500).json({ error: 'Internal Server Error', details: err });
        res.status(200).json(result);
    });
});

app.listen(8081, () => {
    console.log("Server is running on port 8081");
});