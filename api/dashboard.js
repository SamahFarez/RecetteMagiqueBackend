export default async (req, res) => {
    if (req.method === 'GET') {
        // You can use JWT or cookies for session management
        if (req.cookies && req.cookies.user) {
            res.status(200).json({ message: 'Welcome to the dashboard!' });
        } else {
            res.status(401).json({ message: 'Unauthorized access' });
        }
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
};
