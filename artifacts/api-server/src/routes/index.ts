import { Router, type IRouter } from "express";
import healthRouter from "./health";
import domainsRouter from "./domains";
import emailsRouter from "./emails";
import webhookRouter from "./webhook";
import testRouter from "./test";
import eventsRouter from "./events";
import usersRouter from "./users";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(domainsRouter);
router.use(emailsRouter);
router.use(webhookRouter);
router.use(testRouter);
router.use(eventsRouter);
router.use(usersRouter);
router.use(adminRouter);

export default router;
