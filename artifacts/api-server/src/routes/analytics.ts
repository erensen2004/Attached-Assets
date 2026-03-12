import { Router, type IRouter } from "express";
import { db, jobRolesTable, candidatesTable, companiesTable, usersTable } from "@workspace/db";
import { eq, count, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";

const router: IRouter = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const { role: userRole, companyId } = req.user!;

    const [totals] = await db
      .select({
        totalCandidates: count(candidatesTable.id),
      })
      .from(candidatesTable);

    const [roleTotals] = await db
      .select({ totalRoles: count(jobRolesTable.id) })
      .from(jobRolesTable);

    const [companyTotals] = await db
      .select({ totalCompanies: count(companiesTable.id) })
      .from(companiesTable);

    const [userTotals] = await db
      .select({ totalUsers: count(usersTable.id) })
      .from(usersTable);

    const candidatesByStatus = await db
      .select({ status: candidatesTable.status, cnt: count() })
      .from(candidatesTable)
      .groupBy(candidatesTable.status);

    const rolesByStatus = await db
      .select({ status: jobRolesTable.status, cnt: count() })
      .from(jobRolesTable)
      .groupBy(jobRolesTable.status);

    const topRoles = await db
      .select({
        roleId: candidatesTable.roleId,
        roleTitle: jobRolesTable.title,
        cnt: count(),
      })
      .from(candidatesTable)
      .leftJoin(jobRolesTable, eq(candidatesTable.roleId, jobRolesTable.id))
      .groupBy(candidatesTable.roleId, jobRolesTable.title)
      .orderBy(sql`count(*) desc`)
      .limit(5);

    res.json({
      totalCandidates: Number(totals.totalCandidates),
      totalRoles: Number(roleTotals.totalRoles),
      totalCompanies: Number(companyTotals.totalCompanies),
      totalUsers: Number(userTotals.totalUsers),
      candidatesByStatus: candidatesByStatus.map((s) => ({ status: s.status, count: Number(s.cnt) })),
      rolesByStatus: rolesByStatus.map((s) => ({ status: s.status, count: Number(s.cnt) })),
      topRoles: topRoles.map((r) => ({ roleId: r.roleId, roleTitle: r.roleTitle ?? "", count: Number(r.cnt) })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
