const router = require("express").Router();
const { isDBConnected } = require("../database/initDB");
const supabase = require("../config/supabase");

router.get("/", (req, res) => {
    res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        services: {
            database: isDBConnected() ? "connected" : "disconnected",
            supabase: supabase ? "configured" : "not configured"
        }
    });
});

module.exports = router;
