"use strict";
const express = require("express");
const compression = require("compression");
const chalk = require("chalk");

const _port = 81;
const _app_folder = 'www';

const app = express();
app.use(compression());


// ---- SERVE STATIC FILES ---- //
app.all('*.*', express.static(_app_folder, {maxAge: '1y'}));

// ---- SERVE APLICATION PATHS ---- //
app.all('*', function (req, res) {
    res.status(200).sendFile(`/`, {root: _app_folder});
});

// ---- START UP THE NODE SERVER  ----
app.listen(_port, function () {

    console.log(chalk
    `{green ====================================================================} {greenBright.bold 
        8888888b.          888 888                   888 888
        888   Y88b         888 888                   888 888
        888    888         888 888                   888 888
        888   d88P .d88b.  888 888  .d8888b  8888b.  888 888
        8888888P" d88""88b 888 888 d88P"        "88b 888 888
        888 T88b  888  888 888 888 888      .d888888 888 888
        888  T88b Y88..88P 888 888 Y88b.    888  888 888 888
        888   T88b "Y88P"  888 888  "Y8888P "Y888888 888 888 } {green
====================================================================}`+
    chalk`\nRollcall Server UI is listening on {bold http://localhost:${_port}}`+
    chalk`{green \n====================================================================}`
    
        )
});