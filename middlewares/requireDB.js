const { isDBConnected } = require("../database/initDB");

module.exports = (req, res, next) => {
    if (!isDBConnected()) {
        return res.status(503).json({ error: "DB no disponible" });
    }
    next();
};
