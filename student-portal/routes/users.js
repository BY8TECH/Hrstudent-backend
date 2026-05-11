const express = require("express");
const router = express.Router();
const multer = require("multer");
const { protect } = require("../middlewares/auth");
const { updateFCMToken } = require("../controllers/authController");
const { uploadProfileImage, updateUserProfile } = require("../controllers/userController");

const upload = multer({ storage: multer.memoryStorage() });

// Public route to update FCM token (uses email/password verification)
router.put("/update-fcm-token", updateFCMToken);

/**
 * 🔹 USER: Update Profile Photo (replaces old photo)
 * POST /api/sp/users/update-profile-photo/:userId
 */
router.post("/update-profile-photo/:userId", protect, upload.single("image"), uploadProfileImage);
router.post("/upload-profile/:userId", protect, upload.single("image"), uploadProfileImage); // Alias for convenience

/**
 * 🔹 USER: Update Profile
 * PUT /api/users/update/:userId
 */
router.put("/update/:userId", protect, updateUserProfile);

module.exports = router;
