const router = require("express").Router();
const requireAuth = require("../middlewares/requireAuth");
const requireAdmin = require("../middlewares/requireAdmin");
const controller = require("../controllers/users.controller");

router.post("/register_user", controller.register);
router.post("/login", controller.login);
router.post("/user/upload_profile",requireAuth,controller.uploadProfile)
router.get("/me", requireAuth, controller.me)
router.get("/users", requireAuth, requireAdmin, controller.listUsers);
router.get("/user/:id", requireAuth, requireAdmin, controller.getUser);
router.put("/edit_user/:id", requireAuth, requireAdmin, controller.updateUser);
router.delete("/delete_user/:id", requireAuth, requireAdmin, controller.deleteUser);

module.exports = router;