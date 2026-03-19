const jwt = require('jsonwebtoken');
require('dotenv').config();

const verifyToken = (req, res, next) => {
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
        return res.status(401).json({ error: "Access Denied. No token provided." });
    }
    const token = authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({ error: "Access Denied. Invalid token format." });
    }

    try {
        //Verify the ticket hasn't been forged or expired
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        
        //Attach the user's data (id, role) to the request so the next function can use it
        req.user = verified;
        
        //Let them in!
        next();
    } catch (err) {
        res.status(403).json({ error: "Invalid or expired token." });
    }
};

module.exports = verifyToken;