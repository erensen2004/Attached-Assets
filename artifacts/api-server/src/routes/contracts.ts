import { Router } from "express";
import { db, contractsTable, candidatesTable, jobRolesTable, companiesTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";

const router = Router();

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

    if (userRole === "vendor" && companyId) {
      const vendorCandidateIds = (
        await db
          .select({ id: candidatesTable.id })
          .from(candidatesTable)
          .where(eq(candidatesTable.vendorCompanyId, companyId))
      ).map((c) => c.id);

      if (vendorCandidateIds.length === 0) {
        res.json([]);
        return;
      }

      const contracts = await db
        .select()
        .from(contractsTable)
        .where(inArray(contractsTable.candidateId, vendorCandidateIds))
        .orderBy(contractsTable.createdAt);

      const result = await Promise.all(contracts.map(formatContract));
      res.json(result);
      return;
    }

    if (userRole === "client" && companyId) {
      const clientRoles = await db
        .select({ id: jobRolesTable.id })
        .from(jobRolesTable)
        .where(eq(jobRolesTable.companyId, companyId));

      const clientRoleIds = clientRoles.map((r) => r.id);

      if (clientRoleIds.length === 0) {
        res.json([]);
        return;
      }

      const clientCandidates = await db
        .select({ id: candidatesTable.id })
        .from(candidatesTable)
        .where(inArray(candidatesTable.roleId, clientRoleIds));

      const clientCandidateIds = clientCandidates.map((c) => c.id);

      if (clientCandidateIds.length === 0) {
        res.json([]);
        return;
      }

      const contracts = await db
        .select()
        .from(contractsTable)
        .where(inArray(contractsTable.candidateId, clientCandidateIds))
        .orderBy(contractsTable.createdAt);

      const result = await Promise.all(contracts.map(formatContract));
      res.json(result);
      return;
    }

    const allContracts = await db
      .select()
      .from(contractsTable)
      .orderBy(contractsTable.createdAt);

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
