import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../prisma.ts";
import { authenticate, roleCheck } from "../middleware/auth.ts";
import { PERMISSIONS } from "../constants/permissions.ts";

const router = Router();


// All permission routes require authentication first
router.use(authenticate);

/**
 * GET /api/permissions
 * Get all permissions
 */
router.get(
  "/",
  roleCheck(PERMISSIONS.PERMISSION_READ),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const items = await prisma.permission.findMany({
        orderBy: { id: "asc" },
      });
      res.json(items);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/permissions
 * Create a new permission
 * Only SuperAdmin allowed
 */
router.post(
  "/",
  roleCheck(PERMISSIONS.PERMISSION_CREATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user?.role !== "SuperAdmin") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { key, name, description } = req.body;

      const item = await prisma.permission.create({
        data: { key, name, description },
      });

      res.status(201).json(item);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /api/permissions/:id
 * Update permission
 * Only SuperAdmin allowed
 */
router.put(
  "/:id",
  roleCheck(PERMISSIONS.PERMISSION_UPDATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user?.role !== "SuperAdmin") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const id = Number(req.params.id);

      const updated = await prisma.permission.update({
        where: { id },
        data: req.body,
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/permissions/:id
 * Delete permission
 * Only SuperAdmin allowed
 */
router.delete(
  "/:id",
  roleCheck(PERMISSIONS.PERMISSION_DELETE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user?.role !== "SuperAdmin") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const id = Number(req.params.id);

      await prisma.permission.delete({
        where: { id },
      });

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
