import User from '../../models/User';

export default async (req, res) => {
    const token = req.query.token;

    try {
        const user = await User.findOne({ token });

        if (!user) {
            return res.status(400).json({ message: 'Invalid token or user already verified' });
        }

        if (user.isVerified) {
            return res.status(200).json({ message: 'Email already confirmed. You can now login.' });
        }

        user.isVerified = true;
        user.token = null;
        await user.save();

        res.status(200).json({ message: 'Email confirmed successfully!' });
    } catch (error) {
        console.error('Error confirming token:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
