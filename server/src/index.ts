import express, { Request, Response } from "express";
import { INITIAL_GRADING_STATE } from "@shared/types";

const app = express();

// Verify @shared import works
console.log("✓ @shared/types imported successfully");
console.log("✓ INITIAL_GRADING_STATE:", INITIAL_GRADING_STATE);

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
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 7860;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
