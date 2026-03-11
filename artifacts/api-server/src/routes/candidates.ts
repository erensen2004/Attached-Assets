import { Router, type IRouter } from "express";
import { db, candidatesTable, jobRolesTable, companiesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";

const router: IRouter = Router();

function formatCandidate(c: {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  expectedSalary: string | null;
  status: string;
  roleId: number;
  vendorCompanyId: number;
  submittedAt: Date;
  updatedAt: Date;
}, roleTitle: string, vendorCompanyName: string) {
  return {
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    phone: c.phone,
    expectedSalary: c.expectedSalary ? Number(c.expectedSalary) : null,
    status: c.status,
    roleId: c.roleId,
    roleTitle,
    vendorCompanyId: c.vendorCompanyId,
    vendorCompanyName,
    submittedAt: c.submittedAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const { role: userRole, companyId } = req.user!;
    const roleIdFilter = req.query.roleId ? Number(req.query.roleId) : undefined;

    const rows = await db
      .select({
        id: candidatesTable.id,
        firstName: candidatesTable.firstName,
        lastName: candidatesTable.lastName,
        email: candidatesTable.email,
        phone: candidatesTable.phone,
        expectedSalary: candidatesTable.expectedSalary,
        status: candidatesTable.status,
        roleId: candidatesTable.roleId,
        vendorCompanyId: candidatesTable.vendorCompanyId,
        submittedAt: candidatesTable.submittedAt,
        updatedAt: candidatesTable.updatedAt,
        roleTitle: jobRolesTable.title,
        roleCompanyId: jobRolesTable.companyId,
        vendorCompanyName: companiesTable.name,
      })
      .from(candidatesTable)
      .leftJoin(jobRolesTable, eq(candidatesTable.roleId, jobRolesTable.id))
      .leftJoin(companiesTable, eq(candidatesTable.vendorCompanyId, companiesTable.id));

    let filtered = rows;

    if (roleIdFilter) {
      filtered = filtered.filter((c) => c.roleId === roleIdFilter);
    }

    if (userRole === "vendor" && companyId) {
      filtered = filtered.filter((c) => c.vendorCompanyId === companyId);
    } else if (userRole === "client" && companyId) {
      filtered = filtered.filter((c) => c.roleCompanyId === companyId);
    }

    const result = filtered.map((c) =>
      formatCandidate(c, c.roleTitle ?? "", c.vendorCompanyName ?? "")
    );

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", requireAuth, requireRole("vendor"), async (req, res) => {
  try {
    const { firstName, lastName, email, phone, expectedSalary, roleId } = req.body;
    if (!firstName || !lastName || !email || !roleId) {
      res.status(400).json({ error: "Bad Request", message: "firstName, lastName, email, roleId required" });
      return;
    }

    const companyId = req.user!.companyId;
    if (!companyId) {
      res.status(400).json({ error: "Bad Request", message: "Vendor has no associated company" });
      return;
    }

    const [role] = await db
      .select()
      .from(jobRolesTable)
      .where(eq(jobRolesTable.id, roleId));

    if (!role) {
      res.status(404).json({ error: "Not Found", message: "Role not found" });
      return;
    }

    if (role.status !== "published") {
      res.status(400).json({ error: "Bad Request", message: "Role is not open for submissions" });
      return;
    }

    const [duplicate] = await db
      .select()
      .from(candidatesTable)
      .where(
        and(
          eq(candidatesTable.email, email.toLowerCase()),
          eq(candidatesTable.roleId, roleId)
        )
      );

    if (duplicate) {
      res.status(409).json({ error: "Conflict", message: "This candidate has already been submitted for this role" });
      return;
    }

    const [candidate] = await db
      .insert(candidatesTable)
      .values({
        firstName,
        lastName,
        email: email.toLowerCase(),
        phone: phone ?? null,
        expectedSalary: expectedSalary ? String(expectedSalary) : null,
        status: "submitted",
        roleId,
        vendorCompanyId: companyId,
      })
      .returning();

    const [vendorCompany] = await db
      .select({ name: companiesTable.name })
      .from(companiesTable)
      .where(eq(companiesTable.id, companyId));

    res.status(201).json(formatCandidate(candidate, role.title, vendorCompany?.name ?? ""));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.patch("/:id/status", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    const validStatuses = ["submitted", "screening", "interview", "offer", "hired", "rejected"];

    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({ error: "Bad Request", message: "Valid status required" });
      return;
    }

    const [candidate] = await db
      .update(candidatesTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(candidatesTable.id, id))
      .returning();

    if (!candidate) {
      res.status(404).json({ error: "Not Found" });
      return;
    }

    const [role] = await db
      .select({ title: jobRolesTable.title })
      .from(jobRolesTable)
      .where(eq(jobRolesTable.id, candidate.roleId));

    const [vendorCompany] = await db
      .select({ name: companiesTable.name })
      .from(companiesTable)
      .where(eq(companiesTable.id, candidate.vendorCompanyId));

    res.json(formatCandidate(candidate, role?.title ?? "", vendorCompany?.name ?? ""));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
