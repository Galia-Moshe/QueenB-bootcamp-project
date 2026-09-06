import cors from "cors";
import dotenv from "dotenv";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { connectDatabase } from "./config/database";
import adminRoutes from "./routes/admin";
import authRoutes from "./routes/auth";
import meetingsRoutes from "./routes/meetings";
import mentorsRoutes from "./routes/mentors";
import notificationsRoutes from "./routes/notifications";
import usersRoutes from "./routes/users";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors());
app.use(morgan("combined"));
app.use(express.json({ limit: "3mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/mentors", mentorsRoutes);
app.use("/api/meetings", meetingsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/users", usersRoutes);

app.get("/api/health", (_req, res) => {
  res.json({
    message: "QueenB Server is running",
    timestamp: new Date().toISOString(),
    status: "healthy",
  });
});

app.get("/", (_req, res) => {
  res.json({ message: "Welcome to QueenB API" });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "משהו השתבש בשרת" });
});

app.use("*", (_req, res) => {
  res.status(404).json({ error: "הנתיב לא נמצא" });
});

connectDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
    });
  })
  .catch((error) => {
    console.error("Failed to connect to MongoDB", error);
    process.exit(1);
  });
