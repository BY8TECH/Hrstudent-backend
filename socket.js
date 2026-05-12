const { Server } = require("socket.io");

let io;

const init = (server) => {
    io = new Server(server, {
        cors: {
            origin: "*", // Adjust in production
            methods: ["GET", "POST"]
        }
    });

    io.on("connection", (socket) => {
        console.log(`📡 New client connected: ${socket.id}`);

        // Join a room based on userId for private notifications
        socket.on("join", (userId) => {
            if (userId) {
                socket.join(userId.toString());
                console.log(`👤 User ${userId} joined room`);
            }
        });

        // Join HR room
        socket.on("joinHR", () => {
            socket.join("HR_ROOM");
            console.log(`🏢 Socket joined HR_ROOM`);
        });

        socket.on("disconnect", () => {
            console.log("🔌 Client disconnected");
        });
    });

    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};

// Helper to emit to HR users
const emitToHR = (event, data) => {
    if (io) {
        io.to("HR_ROOM").emit(event, data);
    }
};

// Helper to emit to a specific user
const emitToUser = (userId, event, data) => {
    if (io && userId) {
        io.to(userId.toString()).emit(event, data);
    }
};

module.exports = { init, getIO, emitToHR, emitToUser };
