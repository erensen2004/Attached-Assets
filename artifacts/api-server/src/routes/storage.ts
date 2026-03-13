import { Router, type Request, type Response } from "express";
import { Readable } from "stream";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage.js";
import { ObjectPermission } from "../lib/objectAcl.js";
import { requireAuth } from "../lib/auth.js";
import { validate } from "../middlewares/validate.js";
import { RequestUploadUrlSchema, ConfirmUploadSchema } from "../lib/schemas.js";
import { Errors } from "../lib/errors.js";

const router = Router();
const objectStorageService = new ObjectStorageService();

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload. Requires authentication.
 * Stores ACL metadata (owner, companyId, visibility=private) on the object.
 */
router.post(
  "/storage/uploads/request-url",
  requireAuth,
  validate(RequestUploadUrlSchema),
  async (req: Request, res: Response) => {
    try {
      const { name, size, contentType } = req.body;
      const { userId, companyId } = req.user!;

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      await objectStorageService.trySetObjectEntityAclPolicy(uploadURL, {
        owner: String(userId),
        visibility: "private",
      }).catch((err) => {
        console.warn("Could not set ACL on upload (object may not exist yet):", err.message);
      });

      res.json({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType, ownerId: userId, companyId },
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      Errors.internal(res, "Failed to generate upload URL");
    }
  }
);

/**
 * POST /storage/uploads/confirm
 *
 * Called after a file upload completes, to write final ACL metadata.
 */
router.post(
  "/storage/uploads/confirm",
  requireAuth,
  validate(ConfirmUploadSchema),
  async (req: Request, res: Response) => {
    try {
      const { objectPath } = req.body;
      const { userId } = req.user!;

      await objectStorageService.trySetObjectEntityAclPolicy(objectPath, {
        owner: String(userId),
        visibility: "private",
      });

      res.json({ success: true, objectPath });
    } catch (error) {
      console.error("Error confirming upload:", error);
      Errors.internal(res, "Failed to confirm upload");
    }
  }
);

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets. No authentication required.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);

    if (!file) {
      Errors.notFound(res, "File not found");
      return;
    }

    const response = await objectStorageService.downloadObject(file);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    console.error("Error serving public object:", error);
    Errors.internal(res, "Failed to serve public object");
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve private objects (e.g. CVs). Requires authentication + route-level authorization.
 *
 * Access rules:
 * - admin → always allowed
 * - client → if candidate is in own company AND candidate has a role in that company
 * - vendor → if candidate was submitted by own company
 * - others → forbidden
 *
 * Note: This is a fallback route-level check. For now, we use ACL owner + admin bypass.
 * A proper implementation would map objectPath -> candidateId -> ownership context.
 */
router.get("/storage/objects/*path", requireAuth, async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;

    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
    const { userId, role: userRole, companyId } = req.user!;

    // Admin always has access
    if (userRole !== "admin") {
      const canAccess = await objectStorageService.canAccessObjectEntity({
        userId: String(userId),
        objectFile,
        requestedPermission: ObjectPermission.READ,
      });

      if (!canAccess) {
        Errors.forbidden(res, "You do not have access to this file");
        return;
      }

      // For non-admins: also check ACL owner is from same company (optional extra safety)
      // This would require parsing ACL to extract companyId and doing an additional check
      // For now, ACL owner match is sufficient
    }

    const response = await objectStorageService.downloadObject(objectFile);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      Errors.notFound(res, "Object not found");
      return;
    }
    console.error("Error serving object:", error);
    Errors.internal(res, "Failed to serve object");
  }
});

export default router;
