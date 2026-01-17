const router = require("express").Router();
const upload = require("../config/multer");
const requireDB = require("../middlewares/requireDB");
const requireSupabase = require("../middlewares/requireSupabase");
const controller = require("../controllers/profiles.controller");

router.post("/new_profile", requireDB, requireSupabase, upload.array("refs", 5), controller.create);
router.get("/profiles", requireDB, controller.list);
router.get("/profiles_full", requireDB, controller.listFull);
router.get("/profile/:id", requireDB, controller.getOne);
router.put("/edit_profile/:id", requireDB, controller.update);
router.delete("/delete_profile/:id", requireDB, controller.remove);

module.exports = router;
