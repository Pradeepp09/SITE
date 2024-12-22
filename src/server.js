const express = require('express');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const session = require('express-session');
require('dotenv').config();
const MongoClient = require('mongodb').MongoClient;

const app = express();
const port = 3000;

// Middleware setup
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files (HTML, CSS, JS)
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'secretKey', 
    resave: false,
    saveUninitialized: true
}));

// MongoDB setup for user storage
const dbUrl = process.env.MONGO_URL;
const dbName = 'secure_image_app';
let db;

// Establish database connection
MongoClient.connect(dbUrl, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(client => {
        db = client.db(dbName);
        console.log('Connected to database');
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });

// Login route
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    db.collection('users').findOne({ email: email }, (err, user) => {
        if (err || !user) return res.status(401).send('User not found');

        bcrypt.compare(password, user.password, (err, result) => {
            if (err) return res.status(500).send('Error comparing passwords');

            if (result) {
                req.session.user = user; // Store user info in session
                return res.redirect('/main.html'); // Redirect to main page after login
            } else {
                return res.status(401).send('Invalid credentials');
            }
        });
    });
});

// Sign-up route
app.post('/register', (req, res) => {
    const { email, password, aesKey, iv } = req.body;

    // Check if the user already exists
    db.collection('users').findOne({ email: email }, (err, user) => {
        if (err) return res.status(500).send('Database error');
        if (user) return res.status(400).send('User already exists');

        bcrypt.hash(password, 10, (err, hashedPassword) => {
            if (err) return res.status(500).send('Error hashing password');

            const newUser = {
                email,
                password: hashedPassword,
                aesKey,
                iv
            };

            db.collection('users').insertOne(newUser, (err, result) => {
                if (err) return res.status(500).send('Error saving user');
                res.send('Sign-up successful');
            });
        });
    });
});

// Forgot password route (for sending reset link via email)
app.post('/forgot-password', (req, res) => {
    const { email } = req.body;

    db.collection('users').findOne({ email: email }, (err, user) => {
        if (err || !user) return res.status(404).send('User not found');

        // Send reset email via Nodemailer
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER, // Your email
                pass: process.env.EMAIL_PASS  // Your email password
            }
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Password Reset Request',
            text: 'Click here to reset your password: http://localhost:3000/reset-password'
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                return res.status(500).send('Error sending email');
            } else {
                res.send('Password reset link sent');
            }
        });
    });
});

// Image decryption route
app.post('/decrypt-image', (req, res) => {
    const { imageName, aesKey, iv } = req.body;

    if (!aesKey || !iv) {
        return res.status(400).send('AES Key and IV are required');
    }

    const imagePath = path.join(__dirname, 'uploads', imageName);
    fs.readFile(imagePath, (err, encryptedData) => {
        if (err) return res.status(500).send('Error reading encrypted image file');

        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(aesKey, 'hex'), Buffer.from(iv, 'hex'));
        let decryptedData = Buffer.concat([decipher.update(encryptedData), decipher.final()]);

        // Save the decrypted image in a new file
        const decryptedImagePath = path.join(__dirname, 'uploads', 'decrypted-' + imageName);
        fs.writeFile(decryptedImagePath, decryptedData, (err) => {
            if (err) return res.status(500).send('Error saving decrypted image');
            res.send('Image decrypted successfully');
        });
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:5040`);
});
