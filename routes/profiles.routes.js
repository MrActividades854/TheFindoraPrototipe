const router = require("express").Router();
const upload = require("../config/multer");
const requireDB = require("../middlewares/requireDB");
const requireAuth = require("../middlewares/requireAuth");
const requireAdmin = require("../middlewares/requireAdmin");
const requireSupabase = require("../middlewares/requireSupabase");
const controller = require("../controllers/profiles.controller");

router.post("/new_profile", requireDB, requireAuth, requireAdmin, requireSupabase, upload.array("refs", 5), controller.create);
router.get("/profiles", requireDB, requireAuth, controller.list);
router.get("/profiles_full", requireDB, controller.listFull);
router.get("/profile/:id", requireDB, requireAuth, controller.getOne);
router.put("/edit_profile/:id", requireDB, requireAuth, requireAdmin, controller.update);
router.delete("/delete_profile/:id", requireDB, requireAuth, requireAdmin, controller.remove);

module.exports = router;
