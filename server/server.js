import express from 'express'
import mysql from 'mysql'
import cors from 'cors'

const app = express();

app.use(cors()); /*allows cross origin resource sharing 
allows server to load information from an "outside" server
*/
app.use(express.json())

const db = mysql.createConnection({
    host: 'localhost',
    user: "root",
    password: "",
    database: "crud"
})

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


app.get('/', (req, res) => {
    const sql = "SELECT * from employees"
    db.query(sql,(err, result) =>{
        if(err) return (res.json({Message: "error inside server"}) && console.log(err))
        
        console.log(result)
        return res.json(result)
    })
})

app.get('/read/:username', (req, res) => {
    const sql = "SELECT * from employees WHERE username = ?"
    const username = req.params.username
     
    db.query(sql, [username], (err, result) =>{
        if(err) return res.json({Message: "error inside server"})
        console.log(result)
        return res.json(result)
    })
})

app.listen(8081, ()=> {
    console.log("listening");
    
})

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
params.username;
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
    const jwt = require('jsonwebtoken')
    const sql = 'SELECT * FROM employees WHERE username = ?';
    db.query(sql, [username], async (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).json({ error: 'username doesn\'t exist' });
        }
        if (result.length > 0) {
            // User found, compare the hashed password
            const user = result[0];
            if (user.password === password) {
                res.status(200).json({ message: 'Sign-in successful', user });
                const jwtToken = jwt.sign(
                    {id: user, username: username},
                    process.env.JWT_SECRET
                );
                res.json({mess: "welcom back!", token: jwtToken});
            } else {
                res.status(401).json({ error: 'Invalid username or password' });
            }
        } else {
            res.status(401).json({ error: 'Invalid username or password' });
        }
    });
});