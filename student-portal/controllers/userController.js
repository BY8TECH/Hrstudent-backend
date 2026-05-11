const User = require("../models/User");
const cloudinary = require("cloudinary").v2;

// Configure Cloudinary (usually already done in routes/upload.js, but re-confirming if needed)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * 🔹 POST /api/sp/users/update-profile-photo/:userId
 */
exports.uploadProfileImage = async (req, res, next) => {
    try {
        const { userId } = req.params;
        if (!req.file) {
            return res.status(400).json({ success: false, message: "Please upload an image file using the field name 'image'." });
        }

        // 1. Find user to check for old image
        const userToUpdate = await User.findById(userId);
        if (!userToUpdate) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // 2. Delete old image from Cloudinary if it exists
        if (userToUpdate.profileImage) {
            try {
                // Extract publicId from URL: https://res.cloudinary.com/demo/image/upload/v1234/folder/public_id.jpg
                const urlParts = userToUpdate.profileImage.split('/');
                const fileName = urlParts[urlParts.length - 1]; // public_id.jpg
                const publicId = `profile_images/${fileName.split('.')[0]}`; // folder/public_id
                await cloudinary.uploader.destroy(publicId);
            } catch (err) {
                console.error("Cloudinary cleanup error (non-fatal):", err.message);
            }
        }

        // 3. Stream new file to Cloudinary
        const uploadStream = cloudinary.uploader.upload_stream(
            { folder: "profile_images" },
            async (error, result) => {
                if (error) {
                    console.error("Cloudinary Error:", error);
                    return res.status(500).json({ success: false, message: "Image upload failed", error });
                }

                userToUpdate.profileImage = result.secure_url;
                await userToUpdate.save();

                res.status(200).json({
                    success: true,
                    message: "Profile photo updated successfully",
                    data: {
                        userId: userToUpdate._id,
                        profileImage: userToUpdate.profileImage
                    }
                });
            }
        );

        uploadStream.end(req.file.buffer);
    } catch (err) {
        next(err);
    }
};

/**
 * 🔹 PUT /api/users/update/:userId
 */
exports.updateUserProfile = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { name, email, mobile, oldPassword, newPassword } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Update basic fields
        if (name) user.name = name;
        if (email) user.email = email.toLowerCase();
        if (mobile) user.mobile = mobile;

        // Password update logic
        if (newPassword) {
            if (!oldPassword) {
                return res.status(400).json({ success: false, message: "Old password is required to update to a new password" });
            }

            const isMatch = await user.matchPassword(oldPassword);
            if (!isMatch) {
                return res.status(401).json({ success: false, message: "Incorrect old password" });
            }

            user.password = newPassword; // Hashing will be handled by pre-save hook
        }

        await user.save();

        // Sanitize response
        const updatedUser = user.toObject();
        delete updatedUser.password;
        delete updatedUser.otp;
        delete updatedUser.otpExpiry;

        res.json({
            success: true,
            message: "User profile updated successfully",
            data: updatedUser
        });
    } catch (err) {
        next(err);
    }
};
