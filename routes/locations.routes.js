const router = require("express").Router();
const requireDB = require("../middlewares/requireDB");
const controller = require("../controllers/locations.controller");

router.post("/update_location", requireDB, controller.update);
router.get("/location/:profileId", requireDB, controller.get);

module.exports = router;
