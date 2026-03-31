import { Router } from "express";

const router = Router();

router.post("/auth/verify-password", (req, res): void => {
  const { password } = req.body ?? {};
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    res.status(503).json({ error: "Auth not configured" });
    return;
  }

  if (typeof password !== "string" || password !== adminPassword) {
    res.status(401).json({ error: "Incorrect password" });
    return;
  }

  res.json({ ok: true });
});

export default router;
