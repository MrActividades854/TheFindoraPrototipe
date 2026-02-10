const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors({
  origin: [
    "http://127.0.0.1:5501",
    "http://localhost:5501",
    "https://thefindoraprototipe.onrender.com"
  ],
  methods: ["GET","POST","PUT","DELETE"],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.redirect("/findorasections/mainPage/Page.html");
});

// Rutas
app.use("/health", require("./routes/health.routes"));
app.use("/api", require("./routes/profiles.routes"));
app.use("/api", require("./routes/notifications.routes"));
app.use("/api", require("./routes/locations.routes"));

module.exports = app;
