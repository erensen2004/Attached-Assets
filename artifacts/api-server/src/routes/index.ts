import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import auth from "./auth.js";
import companies from "./companies.js";
import users from "./users.js";
import roles from "./roles.js";
import candidates from "./candidates.js";
import contracts from "./contracts.js";
import timesheets from "./timesheets.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", auth);
router.use("/companies", companies);
router.use("/users", users);
router.use("/roles", roles);
router.use("/candidates", candidates);
router.use("/contracts", contracts);
router.use("/timesheets", timesheets);

export default router;
