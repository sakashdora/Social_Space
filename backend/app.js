import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import authRoutes from "./src/routes/auth.routes.js";
import postsRoutes from "./src/routes/posts.routes.js";
import reactionsRoutes from "./src/routes/reactions.routes.js";
import aiRoutes from "./src/routes/ai.routes.js";
import rssRoutes from "./src/routes/rss.routes.js";
import uploadRoutes from "./src/routes/upload.routes.js";
import { startRetentionCron } from "./src/services/cron.service.js";
import chatsRoutes from "./src/routes/chats.routes.js";

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json({ limit: "15mb" })); // Increase limit to support base64 image transfers
app.use(express.urlencoded({ limit: "15mb", extended: true }));
app.use(morgan("dev")); // Logging HTTP requests

// Base Health Check
app.get("/", (req, res) => {
  res.status(200).json({ message: "Veil Shine Backend API is running!" });
});

// Mounted Routes
app.use("/v1/auth", authRoutes);
app.use("/v1/posts", postsRoutes);
app.use("/v1/reactions", reactionsRoutes);
app.use("/v1/chats", chatsRoutes);
app.use("/api", aiRoutes); // Mount AI endpoints like /api/generate
app.use("/api/rss", rssRoutes);
app.use("/api/upload", uploadRoutes);


// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong on the server." });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startRetentionCron();
});
