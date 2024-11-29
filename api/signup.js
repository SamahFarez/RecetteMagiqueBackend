import bcrypt from 'bcrypt';
import User from '../models/User';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'recette.magique.cy@gmail.com',
        pass: process.env.EMAIL_PASSWORD,
    },
});

export default async (req, res) => {
    if (req.method === 'POST') {
        try {
            const { fullName, email, password, foodPreferences } = req.body;

            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(400).json({ message: 'User already exists' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const token = crypto.randomBytes(32).toString('hex');

            const newUser = new User({
                full_name: fullName,
                email,
                password: hashedPassword,
                token,
                isVerified: false,
                foodPreferences: foodPreferences || {},
            });

            await newUser.save();

            const confirmationLink = `https://recette-magique-api.vercel.app/api/confirm/${token}`;

            const mailOptions = {
                from: 'recette.magique.cy@gmail.com',
                to: email,
                subject: 'Email Confirmation',
                html: `<h1>Welcome ${fullName}!</h1><p>Please confirm your email by clicking the link: <a href="${confirmationLink}">Confirm Email</a></p>`,
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error('Error sending email:', error);
                    return res.status(500).json({ message: 'Error sending confirmation email' });
                }
                res.status(200).json({ message: 'User registered successfully, please confirm your email' });
            });
        } catch (error) {
            console.error('Error during signup:', error);
            res.status(500).json({ message: 'Server error' });
        }
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
};
