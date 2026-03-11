import { Router, type IRouter } from "express";
import { db, contractsTable, candidatesTable, jobRolesTable, companiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";

const router: IRouter = Router();

async function formatContract(c: typeof contractsTable.$inferSelect) {
  const [candidate] = await db
    .select({
      firstName: candidatesTable.firstName,
      lastName: candidatesTable.lastName,
      roleId: candidatesTable.roleId,
      vendorCompanyId: candidatesTable.vendorCompanyId,
    })
    .from(candidatesTable)
    .where(eq(candidatesTable.id, c.candidateId));

  const [role] = candidate
    ? await db
        .select({ title: jobRolesTable.title })
        .from(jobRolesTable)
        .where(eq(jobRolesTable.id, candidate.roleId))
    : [{ title: "" }];

  const [vendor] = candidate
    ? await db
        .select({ name: companiesTable.name })
        .from(companiesTable)
        .where(eq(companiesTable.id, candidate.vendorCompanyId))
    : [{ name: "" }];

  return {
    id: c.id,
    candidateId: c.candidateId,
    candidateName: candidate ? `${candidate.firstName} ${candidate.lastName}` : "",
    roleTitle: role?.title ?? "",
    vendorCompanyName: vendor?.name ?? "",
    startDate: c.startDate,
    endDate: c.endDate ?? null,
    dailyRate: Number(c.dailyRate),
    isActive: c.isActive,
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const { role: userRole, companyId } = req.user!;

    const allContracts = await db
      .select()
      .from(contractsTable)
      .orderBy(contractsTable.createdAt);

    if (userRole === "vendor" && companyId) {
      const vendorCandidateIds = (
        await db
          .select({ id: candidatesTable.id })
          .from(candidatesTable)
          .where(eq(candidatesTable.vendorCompanyId, companyId))
      ).map((c) => c.id);

      const filtered = allContracts.filter((c) => vendorCandidateIds.includes(c.candidateId));
      const result = await Promise.all(filtered.map(formatContract));
      res.json(result);
      return;
    }

    const result = await Promise.all(allContracts.map(formatContract));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { candidateId, startDate, endDate, dailyRate } = req.body;
    if (!candidateId || !startDate || !dailyRate) {
      res.status(400).json({ error: "Bad Request", message: "candidateId, startDate, dailyRate required" });
      return;
    }

    const [contract] = await db
      .insert(contractsTable)
      .values({
        candidateId,
        startDate,
        endDate: endDate ?? null,
        dailyRate: String(dailyRate),
        isActive: true,
      })
      .returning();

    res.status(201).json(await formatContract(contract));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
