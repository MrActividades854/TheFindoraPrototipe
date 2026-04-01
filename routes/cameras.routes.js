const express = require("express");
const router = express.Router();
const controller = require("../controllers/cameras.controller");

// Crear o actualizar cámara
router.post("/cameras", controller.createOrUpdate);

// Listar cámaras
router.get("/cameras", controller.list);

// Obtener una cámara
router.get("/cameras/:device_id", controller.getOne);

// Eliminar cámara
router.delete("/cameras/:device_id", controller.delete);

module.exports = router;