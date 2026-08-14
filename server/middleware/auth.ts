import { Request, Response, NextFunction } from "express";

export function requireInternalKey(req: Request, res: Response, next: NextFunction) {
  const key = req.headers["x-internal-key"];
  const expected = process.env.INTERNAL_API_KEY;
  if (!expected || key !== expected) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}
