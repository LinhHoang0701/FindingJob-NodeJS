"use strict";

const express = require("express");
const router = express.Router();
const authController = require("../../controllers/auth.controller");
const validator = require("express-validation");
const {
  login,
  create,
  update,
  forgot,
  reset,
} = require("../../validations/user.validation");

router.post("/login", validator(login), authController.login); // login
router.post(
  "/signup",
  validator(create),
  validator(update),
  authController.register
); // validate and register

router.post("/forgot", validator(forgot), authController.forgotPassword);

router.post("/reset/:token", validator(reset), authController.resetPassword);

module.exports = router;
