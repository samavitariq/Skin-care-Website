const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql');
const session = require('express-session');
const nodemailer = require('nodemailer'); // For forget-password emails
const crypto = require('crypto'); // To generate random tokens
const path = require('path'); // Added to handle paths

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(session({
    secret: 'abubakar123#', // Replace with a secure secret key
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Serve static files from the root directory
app.use(express.static(path.join(__dirname)));

// MySQL Connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '', // Your MySQL password
    database: 'login' // Your database name
});

// Connect to the database
db.connect(err => {
    if (err) {
        console.error('Database connection failed:', err.stack);
        return;
    }
    console.log('Connected to database.');
});

// Signup Route
app.post('/api/signup', (req, res) => {
    const { fullname, email, password, confirmPassword } = req.body;

    // Check if passwords match
    if (password !== confirmPassword) {
        return res.status(400).json({ message: 'Passwords do not match.' });
    }

    // Check if email is already registered
    const checkEmailQuery = 'SELECT * FROM registration WHERE email = ?';
    db.query(checkEmailQuery, [email], (err, result) => {
        if (err) {
            console.error('Error checking email:', err);
            return res.status(500).json({ message: 'Database error during signup.' });
        }
        if (result.length > 0) {
            return res.status(400).json({ message: 'Email already registered.' });
        } else {
            // Insert user without password hashing (Consider hashing passwords in production)
            const sql = 'INSERT INTO registration (fullname, email, password) VALUES (?, ?, ?)';
            db.query(sql, [fullname, email, password], (err) => {
                if (err) {
                    console.error('Error executing query:', err);
                    return res.status(500).json({ message: 'Signup failed. Please try again.' });
                }
                res.status(200).json({ message: 'Signup successful!' });
            });
        }
    });
});


// Login Route
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const sql = 'SELECT * FROM registration WHERE email = ?';

    db.query(sql, [email], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).json({ message: 'Login failed. Please try again.' });
        }
        if (result.length > 0) {
            const user = result[0];
            if (password === user.password) { // Direct password comparison
                req.session.userId = user.id; // Save user ID in session
                res.status(200).json({ message: 'Login successful!' });
            } else {
                res.status(401).json({ message: 'Invalid credentials.' });
            }
        } else {
            res.status(401).json({ message: 'Email not registered.' });
        }
    });
});
localStorage.setItem("fullname", response.fullname);  // Set the fullname to localStorage

// Forget Password Route
app.post('/api/forget-password', (req, res) => {
    const { email } = req.body;

    const sql = 'SELECT * FROM registration WHERE email = ?';
    db.query(sql, [email], (err, result) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).json({ message: 'Database error.' });
        }
        if (result.length === 0) {
            return res.status(404).json({ message: 'Email not found.' });
        }

        const user = result[0];
        const token = crypto.randomBytes(20).toString('hex'); // Generate a token
        const expires = Date.now() + 3600000; // Token valid for 1 hour

        const updateQuery = 'UPDATE registration SET resetPasswordToken = ?, resetPasswordExpires = ? WHERE email = ?';
        db.query(updateQuery, [token, expires, email], (err) => {
            if (err) {
                console.error('Error saving reset token:', err);
                return res.status(500).json({ message: 'Error saving reset token.' });
            }

            // Nodemailer Configuration
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                host: 'smtp.gmail.com',
                port: 587,
                secure: false, // Use TLS
                auth: {
                    user: 'samavitariq5432@gmail.com', // Your Gmail address
                    pass: 'fdwgasebtpuxgmvl'  // App password generated from Gmail settings
                },
                tls: {
                    rejectUnauthorized: false  // Allow unverified certificates (useful for development)
                },
                debug: true // Enable debugging for more verbose logs
            });

            const mailOptions = {
                from: 'samavitariq5432@gmail.com', // Replace with your email
                to: email,
                subject: 'Password Reset Request',
                text: `Click the following link to reset your password: http://localhost:5001/reset-password?token=${token}`
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error('Error sending email:', error);
                    return res.status(500).json({ message: 'Failed to send reset link.' });
                }
                console.log('Email sent:', info);
                res.status(200).json({ message: 'Password reset link sent!' });
            });
        });
    });
});

// Reset Password API
app.post('/api/reset-password', (req, res) => {
    const { token, password } = req.body;

    const sql = 'SELECT * FROM registration WHERE resetPasswordToken = ? AND resetPasswordExpires > ?';
    db.query(sql, [token, Date.now()], (err, result) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Internal server error.' });
        }
        if (result.length === 0) {
            return res.status(400).json({ message: 'Invalid or expired token.' });
        }

        // Update the user's password and clear the reset token
        const updateQuery = 'UPDATE registration SET password = ?, resetPasswordToken = NULL, resetPasswordExpires = NULL WHERE resetPasswordToken = ?';
        db.query(updateQuery, [password, token], (err) => {
            if (err) {
                console.error('Error updating password:', err);
                return res.status(500).json({ message: 'Password reset failed.' });
            }

            res.status(200).json({
                message: "Password reset successfully.",
                redirectUrl: '/login' // Specify the correct redirect URL
            });  
        });         
    });
});

// Route to serve reset-password.html
app.get('/reset-password', (req, res) => {
    console.log('Reset password page requested');
    res.sendFile(path.join(__dirname, 'reset-password.html'));
});

// Route to serve login page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html')); // Path to your login page
});

// Logout Route
app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ message: 'Logout failed. Please try again.' });
        }
        res.status(200).json({ message: 'Logout successful!' });
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
