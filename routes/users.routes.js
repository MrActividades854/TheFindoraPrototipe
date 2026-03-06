const router = require("express").Router();
const controller = require("../controllers/users.controller");

router.post("/register_user", controller.register);
router.post("/login", controller.login);

module.exports = router;