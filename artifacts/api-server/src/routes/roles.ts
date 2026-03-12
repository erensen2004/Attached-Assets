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
  salaryMin: string | null;
  salaryMax: string | null;
  location: string | null;
  employmentType: string | null;
  isRemote: boolean;
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
    salaryMin: role.salaryMin ? Number(role.salaryMin) : null,
    salaryMax: role.salaryMax ? Number(role.salaryMax) : null,
    location: role.location,
    employmentType: role.employmentType,
    isRemote: role.isRemote,
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

    let rows = await db
      .select({
        id: jobRolesTable.id,
        title: jobRolesTable.title,
        description: jobRolesTable.description,
        skills: jobRolesTable.skills,
        salaryMin: jobRolesTable.salaryMin,
        salaryMax: jobRolesTable.salaryMax,
        location: jobRolesTable.location,
        employmentType: jobRolesTable.employmentType,
        isRemote: jobRolesTable.isRemote,
        status: jobRolesTable.status,
        companyId: jobRolesTable.companyId,
        companyName: companiesTable.name,
        createdAt: jobRolesTable.createdAt,
        updatedAt: jobRolesTable.updatedAt,
      })
      .from(jobRolesTable)
      .leftJoin(companiesTable, eq(jobRolesTable.companyId, companiesTable.id));

    if (userRole === "client" && companyId) {
      rows = rows.filter((r) => r.companyId === companyId);
    } else if (userRole === "vendor") {
      rows = rows.filter((r) => r.status === "published");
    }

    const candidateCounts = await db
      .select({ roleId: candidatesTable.roleId, cnt: count() })
      .from(candidatesTable)
      .groupBy(candidatesTable.roleId);

    const countMap = Object.fromEntries(candidateCounts.map((c) => [c.roleId, Number(c.cnt)]));

    const result = rows.map((r) => formatRole(
      { ...r, companyName: undefined as unknown as string, isRemote: r.isRemote ?? false },
      r.companyName ?? "",
      countMap[r.id] ?? 0
    ));

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
        salaryMin: jobRolesTable.salaryMin,
        salaryMax: jobRolesTable.salaryMax,
        location: jobRolesTable.location,
        employmentType: jobRolesTable.employmentType,
        isRemote: jobRolesTable.isRemote,
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

    res.json(formatRole({ ...row, isRemote: row.isRemote ?? false }, row.companyName ?? "", Number(cnt)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", requireAuth, requireRole("client"), async (req, res) => {
  try {
    const { title, description, skills, salaryMin, salaryMax, location, employmentType, isRemote } = req.body;
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
      .values({
        title,
        description: description ?? null,
        skills: skills ?? null,
        salaryMin: salaryMin != null ? String(salaryMin) : null,
        salaryMax: salaryMax != null ? String(salaryMax) : null,
        location: location ?? null,
        employmentType: employmentType ?? null,
        isRemote: isRemote ?? false,
        status: "draft",
        companyId,
      })
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
    const { title, description, skills, salaryMin, salaryMax, location, employmentType, isRemote } = req.body;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (skills !== undefined) updates.skills = skills;
    if (salaryMin !== undefined) updates.salaryMin = salaryMin != null ? String(salaryMin) : null;
    if (salaryMax !== undefined) updates.salaryMax = salaryMax != null ? String(salaryMax) : null;
    if (location !== undefined) updates.location = location;
    if (employmentType !== undefined) updates.employmentType = employmentType;
    if (isRemote !== undefined) updates.isRemote = isRemote;

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

    const [existing] = await db.select().from(jobRolesTable).where(eq(jobRolesTable.id, id));
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
