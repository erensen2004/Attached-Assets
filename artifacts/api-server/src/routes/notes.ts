import { Router } from "express";
import { db, candidateNotesTable, candidatesTable, jobRolesTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";

const router = Router({ mergeParams: true });

async function verifyCandidateAccess(
  candidateId: number,
  userRole: string,
  companyId: number | null
): Promise<{ allowed: boolean; notFound?: boolean }> {
  const [row] = await db
    .select({
      id: candidatesTable.id,
      vendorCompanyId: candidatesTable.vendorCompanyId,
      roleCompanyId: jobRolesTable.companyId,
    })
    .from(candidatesTable)
    .leftJoin(jobRolesTable, eq(candidatesTable.roleId, jobRolesTable.id))
    .where(eq(candidatesTable.id, candidateId));

  if (!row) return { allowed: false, notFound: true };

  if (userRole === "admin") return { allowed: true };

  if (userRole === "client" && companyId) {
    return { allowed: row.roleCompanyId === companyId };
  }

  return { allowed: false };
}

router.get("/", requireAuth, requireRole("admin", "client"), async (req, res) => {
  try {
    const candidateId = Number(req.params.id);
    const { role: userRole, companyId } = req.user!;

    const access = await verifyCandidateAccess(candidateId, userRole, companyId);
    if (access.notFound) {
      res.status(404).json({ error: "Not Found", message: "Candidate not found" });
      return;
    }
    if (!access.allowed) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const notes = await db
      .select()
      .from(candidateNotesTable)
      .where(eq(candidateNotesTable.candidateId, candidateId))
      .orderBy(candidateNotesTable.createdAt);

    res.json(notes.map((n) => ({
      id: n.id,
      candidateId: n.candidateId,
      userId: n.userId,
      authorName: n.authorName,
      content: n.content,
      createdAt: n.createdAt.toISOString(),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", requireAuth, requireRole("admin", "client"), async (req, res) => {
  try {
    const candidateId = Number(req.params.id);
    const { role: userRole, companyId } = req.user!;
    const { content } = req.body;

    if (!content || !content.trim()) {
      res.status(400).json({ error: "Bad Request", message: "content required" });
      return;
    }

    const access = await verifyCandidateAccess(candidateId, userRole, companyId);
    if (access.notFound) {
      res.status(404).json({ error: "Not Found", message: "Candidate not found" });
      return;
    }
    if (!access.allowed) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const userId = req.user!.userId;

    const [userRow] = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    const authorName = userRow?.name ?? "Unknown";

    const [note] = await db
      .insert(candidateNotesTable)
      .values({ candidateId, userId, authorName, content: content.trim() })
      .returning();

    res.status(201).json({
      id: note.id,
      candidateId: note.candidateId,
      userId: note.userId,
      authorName: note.authorName,
      content: note.content,
      createdAt: note.createdAt.toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
