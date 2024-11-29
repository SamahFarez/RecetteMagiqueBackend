import bcrypt from 'bcrypt';
import User from '../models/User';

export default async (req, res) => {
    if (req.method === 'POST') {
        try {
            const { email, password } = req.body;

            const user = await User.findOne({ email });
            if (!user) {
                return res.status(401).json({ error: 'User not found' });
            }

            if (!user.isVerified) {
                return res.status(403).json({ error: 'Email not confirmed. Please check your inbox.' });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json({ error: 'Incorrect password' });
            }

            // Handle session management, e.g., via JWT, or use cookies
            res.status(200).json({ message: 'Login successful', user });
        } catch (error) {
            console.error('Error during login:', error);
            res.status(500).json({ error: 'Server error' });
        }
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
};
