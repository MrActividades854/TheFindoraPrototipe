const { createClient } = require("@supabase/supabase-js");

if (!process.env.SUPABASE_URL) return null;

module.exports = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);
