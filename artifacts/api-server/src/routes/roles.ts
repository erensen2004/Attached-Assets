import { Router, type IRouter } from "express";
import { db, jobRolesTable, companiesTable, candidatesTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";

const router: IRouter = Router();

function formatRole(role: {
  id: number;
  title: string;
  description: string | null;
  skills: string | null;
  status: string;
  companyId: number;
  createdAt: Date;
  updatedAt: Date;
}, companyName: string, candidateCount: number) {
  return {
    id: role.id,
    title: role.title,
    description: role.description,
    skills: role.skills,
    status: role.status,
    companyId: role.companyId,
    companyName,
    candidateCount,
    createdAt: role.createdAt.toISOString(),
    updatedAt: role.updatedAt.toISOString(),
  };
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const { role: userRole, companyId } = req.user!;

    let query = db
      .select({
        id: jobRolesTable.id,
        title: jobRolesTable.title,
        description: jobRolesTable.description,
        skills: jobRolesTable.skills,
        status: jobRolesTable.status,
        companyId: jobRolesTable.companyId,
        companyName: companiesTable.name,
        createdAt: jobRolesTable.createdAt,
        updatedAt: jobRolesTable.updatedAt,
      })
      .from(jobRolesTable)
      .leftJoin(companiesTable, eq(jobRolesTable.companyId, companiesTable.id));

    let rows: { id: number; title: string; description: string | null; skills: string | null; status: string; companyId: number; companyName: string | null; createdAt: Date; updatedAt: Date }[];

    if (userRole === "client" && companyId) {
      rows = await query.where(eq(jobRolesTable.companyId, companyId));
    } else if (userRole === "vendor") {
      rows = await (query as typeof query).where(eq(jobRolesTable.status, "published"));
    } else {
      rows = await query;
    }

    const candidateCounts = await db
      .select({ roleId: candidatesTable.roleId, cnt: count() })
      .from(candidatesTable)
      .groupBy(candidatesTable.roleId);

    const countMap = Object.fromEntries(candidateCounts.map((c) => [c.roleId, Number(c.cnt)]));

    const result = rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      skills: r.skills,
      status: r.status,
      companyId: r.companyId,
      companyName: r.companyName ?? "",
      candidateCount: countMap[r.id] ?? 0,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [row] = await db
      .select({
        id: jobRolesTable.id,
        title: jobRolesTable.title,
        description: jobRolesTable.description,
        skills: jobRolesTable.skills,
        status: jobRolesTable.status,
        companyId: jobRolesTable.companyId,
        companyName: companiesTable.name,
        createdAt: jobRolesTable.createdAt,
        updatedAt: jobRolesTable.updatedAt,
      })
      .from(jobRolesTable)
      .leftJoin(companiesTable, eq(jobRolesTable.companyId, companiesTable.id))
      .where(eq(jobRolesTable.id, id));

    if (!row) {
      res.status(404).json({ error: "Not Found" });
      return;
    }

    const [{ cnt }] = await db
      .select({ cnt: count() })
      .from(candidatesTable)
      .where(eq(candidatesTable.roleId, id));

    res.json({
      id: row.id,
      title: row.title,
      description: row.description,
      skills: row.skills,
      status: row.status,
      companyId: row.companyId,
      companyName: row.companyName ?? "",
      candidateCount: Number(cnt),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", requireAuth, requireRole("client"), async (req, res) => {
  try {
    const { title, description, skills } = req.body;
    if (!title) {
      res.status(400).json({ error: "Bad Request", message: "title required" });
      return;
    }

    const companyId = req.user!.companyId;
    if (!companyId) {
      res.status(400).json({ error: "Bad Request", message: "User has no associated company" });
      return;
    }

    const [role] = await db
      .insert(jobRolesTable)
      .values({ title, description: description ?? null, skills: skills ?? null, status: "draft", companyId })
      .returning();

    const [company] = await db
      .select({ name: companiesTable.name })
      .from(companiesTable)
      .where(eq(companiesTable.id, companyId));

    res.status(201).json(formatRole(role, company?.name ?? "", 0));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { title, description, skills } = req.body;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (skills !== undefined) updates.skills = skills;

    const [role] = await db
      .update(jobRolesTable)
      .set(updates)
      .where(eq(jobRolesTable.id, id))
      .returning();

    if (!role) {
      res.status(404).json({ error: "Not Found" });
      return;
    }

    const [company] = await db
      .select({ name: companiesTable.name })
      .from(companiesTable)
      .where(eq(companiesTable.id, role.companyId));

    const [{ cnt }] = await db
      .select({ cnt: count() })
      .from(candidatesTable)
      .where(eq(candidatesTable.roleId, id));

    res.json(formatRole(role, company?.name ?? "", Number(cnt)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.patch("/:id/status", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    const validStatuses = ["draft", "pending_approval", "published", "closed"];

    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({ error: "Bad Request", message: "Valid status required" });
      return;
    }

    const [existing] = await db
      .select()
      .from(jobRolesTable)
      .where(eq(jobRolesTable.id, id));

    if (!existing) {
      res.status(404).json({ error: "Not Found" });
      return;
    }

    const { role: userRole } = req.user!;

    if (status === "pending_approval" && userRole !== "client") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    if (status === "published" && userRole !== "admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const [role] = await db
      .update(jobRolesTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(jobRolesTable.id, id))
      .returning();

    const [company] = await db
      .select({ name: companiesTable.name })
      .from(companiesTable)
      .where(eq(companiesTable.id, role.companyId));

    const [{ cnt }] = await db
      .select({ cnt: count() })
      .from(candidatesTable)
      .where(eq(candidatesTable.roleId, id));

    res.json(formatRole(role, company?.name ?? "", Number(cnt)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
