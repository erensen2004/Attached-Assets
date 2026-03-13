import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, companiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";

const router = Router();

router.get("/", requireAuth, requireRole("admin"), async (_req, res) => {
  try {
    const users = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        role: usersTable.role,
        companyId: usersTable.companyId,
        companyName: companiesTable.name,
        isActive: usersTable.isActive,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .leftJoin(companiesTable, eq(usersTable.companyId, companiesTable.id))
      .orderBy(usersTable.createdAt);

    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { email, name, password, role, companyId } = req.body;
    if (!email || !name || !password || !role) {
      res.status(400).json({ error: "Bad Request", message: "email, name, password, role required" });
      return;
    }
    if (!["admin", "client", "vendor"].includes(role)) {
      res.status(400).json({ error: "Bad Request", message: "role must be admin|client|vendor" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db
      .insert(usersTable)
      .values({ email: email.toLowerCase(), name, passwordHash, role, companyId: companyId ?? null })
      .returning({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        role: usersTable.role,
        companyId: usersTable.companyId,
        isActive: usersTable.isActive,
        createdAt: usersTable.createdAt,
      });

    res.status(201).json({ ...user, companyName: null });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "23505") {
      res.status(409).json({ error: "Conflict", message: "Email already exists" });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.patch("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, email, role, companyId, isActive, password } = req.body;

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email.toLowerCase();
    if (role !== undefined) updates.role = role;
    if (companyId !== undefined) updates.companyId = companyId;
    if (isActive !== undefined) updates.isActive = isActive;
    if (password) updates.passwordHash = await bcrypt.hash(password, 10);

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "Bad Request", message: "No fields to update" });
      return;
    }

    const [user] = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, id))
      .returning({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        role: usersTable.role,
        companyId: usersTable.companyId,
        isActive: usersTable.isActive,
        createdAt: usersTable.createdAt,
      });

    if (!user) {
      res.status(404).json({ error: "Not Found" });
      return;
    }

    let companyName: string | null = null;
    if (user.companyId) {
      const [company] = await db
        .select({ name: companiesTable.name })
        .from(companiesTable)
        .where(eq(companiesTable.id, user.companyId));
      companyName = company?.name ?? null;
    }

    res.json({ ...user, companyName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
