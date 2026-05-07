// Role-based access control middleware

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Not authenticated' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                message: `User role '${req.user.role}' is not authorized to access this route`
            });
        }

        next();
    };
};

// Check if user is HR
const isHR = (req, res, next) => {
    if (req.user && req.user.role === 'HR') {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. HR role required.' });
    }
};

// Check if user is Manager
const isManager = (req, res, next) => {
    if (req.user && (req.user.role === 'Manager' || req.user.role === 'HR')) {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Manager or HR role required.' });
    }
};

// Check if user can access their own data or is HR
const isSelfOrHR = (req, res, next) => {
    const requestedUserId = req.params.id || req.params.employeeId;

    // HR always has access
    if (req.user.role === 'HR') {
        return next();
    }

    // Check if user is accessing their own employee data
    if (req.user.employeeId) {
        const userEmployeeId = typeof req.user.employeeId === 'object'
            ? req.user.employeeId._id?.toString() || req.user.employeeId.toString()
            : req.user.employeeId.toString();

        if (userEmployeeId === requestedUserId) {
            return next();
        }
    }

    // Access denied
    res.status(403).json({
        message: 'Access denied. You can only access your own data.',
        hint: 'If you just linked your employee account, please logout and login again to refresh your session.'
    });
};

module.exports = { authorize, isHR, isManager, isSelfOrHR };
