import { Router } from "express";
import { db, timesheetsTable, contractsTable, candidatesTable, jobRolesTable, companiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";

const router = Router();

async function formatTimesheet(t: typeof timesheetsTable.$inferSelect) {
  const [contract] = await db
    .select()
    .from(contractsTable)
    .where(eq(contractsTable.id, t.contractId));

  const [candidate] = contract
    ? await db
        .select({
          firstName: candidatesTable.firstName,
          lastName: candidatesTable.lastName,
          roleId: candidatesTable.roleId,
        })
        .from(candidatesTable)
        .where(eq(candidatesTable.id, contract.candidateId))
    : [{ firstName: "", lastName: "", roleId: 0 }];

  const [role] = candidate
    ? await db
        .select({ title: jobRolesTable.title })
        .from(jobRolesTable)
        .where(eq(jobRolesTable.id, candidate.roleId))
    : [{ title: "" }];

  return {
    id: t.id,
    contractId: t.contractId,
    candidateName: candidate ? `${candidate.firstName} ${candidate.lastName}` : "",
    roleTitle: role?.title ?? "",
    month: t.month,
    year: t.year,
    totalDays: t.totalDays,
    totalAmount: Number(t.totalAmount),
    submittedAt: t.submittedAt.toISOString(),
  };
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const { role: userRole, companyId } = req.user!;

    const allTimesheets = await db
      .select()
      .from(timesheetsTable)
      .orderBy(timesheetsTable.submittedAt);

    if (userRole === "vendor" && companyId) {
      const vendorCandidateIds = (
        await db
          .select({ id: candidatesTable.id })
          .from(candidatesTable)
          .where(eq(candidatesTable.vendorCompanyId, companyId))
      ).map((c) => c.id);

      const vendorContractIds = (
        await db
          .select({ id: contractsTable.id, candidateId: contractsTable.candidateId })
          .from(contractsTable)
      )
        .filter((c) => vendorCandidateIds.includes(c.candidateId))
        .map((c) => c.id);

      const filtered = allTimesheets.filter((t) => vendorContractIds.includes(t.contractId));
      const result = await Promise.all(filtered.map(formatTimesheet));
      res.json(result);
      return;
    }

    if (userRole === "client" && companyId) {
      const clientCandidateIds = (
        await db
          .select({
            id: candidatesTable.id,
            roleId: candidatesTable.roleId,
          })
          .from(candidatesTable)
      ).filter(async (c) => {
        const [role] = await db
          .select({ companyId: jobRolesTable.companyId })
          .from(jobRolesTable)
          .where(eq(jobRolesTable.id, c.roleId));
        return role?.companyId === companyId;
      }).map((c) => c.id);

      const clientContractIds = (
        await db
          .select({ id: contractsTable.id, candidateId: contractsTable.candidateId })
          .from(contractsTable)
      )
        .filter((c) => clientCandidateIds.includes(c.candidateId))
        .map((c) => c.id);

      const filtered = allTimesheets.filter((t) => clientContractIds.includes(t.contractId));
      const result = await Promise.all(filtered.map(formatTimesheet));
      res.json(result);
      return;
    }

    const result = await Promise.all(allTimesheets.map(formatTimesheet));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", requireAuth, requireRole("vendor"), async (req, res) => {
  try {
    const { contractId, month, year, totalDays } = req.body;
    if (!contractId || !month || !year || !totalDays) {
      res.status(400).json({ error: "Bad Request", message: "contractId, month, year, totalDays required" });
      return;
    }

    const [contract] = await db
      .select()
      .from(contractsTable)
      .where(eq(contractsTable.id, contractId));

    if (!contract || !contract.isActive) {
      res.status(400).json({ error: "Bad Request", message: "Contract not found or not active" });
      return;
    }

    const totalAmount = Number(contract.dailyRate) * totalDays;

    const [timesheet] = await db
      .insert(timesheetsTable)
      .values({
        contractId,
        month,
        year,
        totalDays,
        totalAmount: String(totalAmount),
      })
      .returning();

    res.status(201).json(await formatTimesheet(timesheet));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
