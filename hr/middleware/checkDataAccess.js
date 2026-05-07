// Middleware to check if employee has data access
// HR users bypass this check
const checkDataAccess = (req, res, next) => {
    // HR users always have full access
    if (req.user.role === 'HR') {
        return next();
    }

    // Check if employee has data access and is approved
    if (!req.user.hasDataAccess || req.user.approvalStatus !== 'Approved') {
        const isPending = req.user.approvalStatus === 'Pending';
        return res.status(403).json({
            message: isPending 
                ? 'Your account is pending HR approval. Access to data is restricted until approved.'
                : 'Access denied. Please request data access from HR to use this feature.',
            requiresDataAccess: true,
            isPending: isPending
        });
    }

    next();
};

module.exports = checkDataAccess;
