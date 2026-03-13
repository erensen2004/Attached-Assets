import { Router } from "express";
import {
  db,
  timesheetsTable,
  contractsTable,
  candidatesTable,
  jobRolesTable,
  companiesTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
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

      const vendorContracts = await db
        .select({ id: contractsTable.id })
        .from(contractsTable)
        .where(inArray(contractsTable.candidateId, vendorCandidateIds));

      const vendorContractIds = vendorContracts.map((c) => c.id);

      if (vendorContractIds.length === 0) {
        res.json([]);
        return;
      }

      const timesheets = await db
        .select()
        .from(timesheetsTable)
        .where(inArray(timesheetsTable.contractId, vendorContractIds))
        .orderBy(timesheetsTable.submittedAt);

      const result = await Promise.all(timesheets.map(formatTimesheet));
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

      const clientContracts = await db
        .select({ id: contractsTable.id })
        .from(contractsTable)
        .where(inArray(contractsTable.candidateId, clientCandidateIds));

      const clientContractIds = clientContracts.map((c) => c.id);

      if (clientContractIds.length === 0) {
        res.json([]);
        return;
      }

      const timesheets = await db
        .select()
        .from(timesheetsTable)
        .where(inArray(timesheetsTable.contractId, clientContractIds))
        .orderBy(timesheetsTable.submittedAt);

      const result = await Promise.all(timesheets.map(formatTimesheet));
      res.json(result);
      return;
    }

    const allTimesheets = await db
      .select()
      .from(timesheetsTable)
      .orderBy(timesheetsTable.submittedAt);

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

    const companyId = req.user!.companyId;

    const [contract] = await db
      .select()
      .from(contractsTable)
      .where(eq(contractsTable.id, contractId));

    if (!contract || !contract.isActive) {
      res.status(400).json({ error: "Bad Request", message: "Contract not found or not active" });
      return;
    }

    if (companyId) {
      const [candidate] = await db
        .select({ vendorCompanyId: candidatesTable.vendorCompanyId })
        .from(candidatesTable)
        .where(eq(candidatesTable.id, contract.candidateId));

      if (!candidate || candidate.vendorCompanyId !== companyId) {
        res.status(403).json({ error: "Forbidden", message: "This contract does not belong to your company" });
        return;
      }
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
