const router = require("express").Router();
const requireDB = require("../middlewares/requireDB");
const controller = require("../controllers/notifications.controller");

router.post("/notifications", requireDB, controller.create);
router.get("/notifications", requireDB, controller.list);
router.delete("/notifications/cleanup", requireDB, controller.cleanup);

module.exports = router;
