import mongoose from 'mongoose';
import User from '../models/User';  // Import the User model
import { getSession } from 'next-auth/client';  // For session management

const mongoURI = process.env.MONGO_URI || 'mongodb+srv://hh:hhhhhhhh@cluster0.5eb3y.mongodb.net/recette?retryWrites=true&w=majority';

mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Error connecting to MongoDB:', err));

export default async (req, res) => {
    if (req.method === 'POST') {
        try {
            const { preferences } = req.body;

            // Check for the user session (you might want to use cookies or JWT for this in serverless functions)
            const session = await getSession({ req });
            if (!session || !session.user) {
                return res.status(401).json({ error: 'Unauthorized. Please log in first.' });
            }

            const user = await User.findOne({ email: session.user.email });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Update preferences in the DB
            user.foodPreferences = preferences;
            await user.save();

            res.status(200).json({ message: 'Preferences saved successfully!' });
        } catch (error) {
            console.error('Error saving preferences:', error);
            res.status(500).json({ error: 'Server error' });
        }
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
};
