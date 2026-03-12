import { Router, type IRouter } from "express";
import { db, candidateNotesTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router: IRouter = Router({ mergeParams: true });

router.get("/", requireAuth, async (req, res) => {
  try {
    const candidateId = Number(req.params.id);

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

router.post("/", requireAuth, async (req, res) => {
  try {
    const candidateId = Number(req.params.id);
    const { content } = req.body;

    if (!content || !content.trim()) {
      res.status(400).json({ error: "Bad Request", message: "content required" });
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
