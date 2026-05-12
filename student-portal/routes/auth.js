const express = require("express");
const router = express.Router();
const {
    register,
    login,
    forgotPassword,
    verifyOTP,
    loginWithOTP,
    resetPassword,
} = require("../controllers/authController");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

router.post("/register", upload.single("image"), register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOTP);
router.post("/reset-password", resetPassword);
router.post("/login-with-otp", loginWithOTP);

module.exports = router;
