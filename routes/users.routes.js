const router = require("express").Router();
const requireAuth = require("../middlewares/requireAuth");
const requireAdmin = require("../middlewares/requireAdmin");
const controller = require("../controllers/users.controller");

router.post("/register_user", controller.register);
router.post("/login", controller.login);
router.get("/users", requireAuth, requireAdmin, controller.listUsers);

module.exports = router;