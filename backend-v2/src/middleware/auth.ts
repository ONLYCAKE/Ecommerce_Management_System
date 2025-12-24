import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";

dotenv.config();

// SECURITY: Fail fast if JWT_SECRET is not set - no fallback allowed in production
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("❌ FATAL: JWT_SECRET environment variable is required");
  console.error("   Please set JWT_SECRET in your .env file");
  process.exit(1);
}

export interface AuthUserPayload {
  id: number;
  email: string;
  roleId: number;
  role: string;
  permissions: string[];
}

export interface AuthRequest extends Request {
  user?: AuthUserPayload;
  body: any;
}

/* ---------------------- AUTHENTICATE ---------------------- */
export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number };

    prisma.user
      .findUnique({
        where: { id: decoded.id },
        include: { role: true },
      })
      .then(async (user) => {
        if (!user || user.isArchived) {
          res.status(401).json({ message: "Unauthorized" });
          return;
        }

        const rolePerms = await prisma.rolePermission.findMany({
          where: { roleId: user.roleId, enabled: true },
          include: { permission: true },
        });

        const overrides = (await (prisma as any).userPermissionOverride.findMany({
          where: { userId: user.id },
          include: { permission: true },
        })) as { mode: "GRANT" | "DENY"; permission: { key: string } }[];

        const base = new Set(rolePerms.map((rp) => rp.permission.key));
        const grants = overrides
          .filter((o: { mode: "GRANT" | "DENY"; permission: { key: string } }) => o.mode === "GRANT")
          .map((o: { mode: "GRANT" | "DENY"; permission: { key: string } }) => o.permission.key);
        const denies = overrides
          .filter((o: { mode: "GRANT" | "DENY"; permission: { key: string } }) => o.mode === "DENY")
          .map((o: { mode: "GRANT" | "DENY"; permission: { key: string } }) => o.permission.key);

        for (const k of grants) base.add(k);
        for (const k of denies) base.delete(k);

        req.user = {
          id: user.id,
          email: user.email,
          roleId: user.roleId,
          role: user.role.name,
          permissions: Array.from(base),
        };

        next();
      });
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};

/* ---------------------- roleCheck ---------------------- */
export const roleCheck = (permissionKey?: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    if (req.user.role === "SuperAdmin") {
      next();
      return;
    }

    if (!permissionKey) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const allowed = req.user.permissions.includes(permissionKey);

    if (!allowed) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    next();
  };
};

/* ---------------------- requirePermission ---------------------- */
export const requirePermission = (key: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    if (req.user.role === "SuperAdmin") {
      next();
      return;
    }

    if (!req.user.permissions.includes(key)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    next();
  };
};
