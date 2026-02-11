import express, { type Request, type Response } from "express";

const app = express();

// Middleware
app.use(express.json());

// Health check endpoint
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// Root endpoint - placeholder
app.get("/", (_req: Request, res: Response) => {
  res.send("Grading Demo Server Running");
});

// Start server
const PORT = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 7860;

app.listen(PORT, "0.0.0.0", () => {});
