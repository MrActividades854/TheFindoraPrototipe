const supabase = require("../config/supabase");

module.exports = (req, res, next) => {
    if (!supabase) {
        return res.status(503).json({ error: "Supabase no configurado" });
    }
    next();
};
