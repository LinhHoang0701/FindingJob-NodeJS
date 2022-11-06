"use strict";

const express = require("express");
const router = express.Router();
const auth = require("../../middlewares/authorization");
const usersController = require("../../controllers/users.controller");
const dashboardController = require("../../controllers/dashboard.controller");
const validator = require("express-validation");
const { update } = require("../../validations/user.validation");
const { userId } = require("../../validations/common.validation");

router.get("/", auth(), usersController.getAll);
router.get("/dashboard", auth(), dashboardController.generateDashboardData);
router.get("/profile", auth(), usersController.getProfile);
router.get("/:userId", auth(), validator(userId), usersController.getOne);
router.put(
  "/:userId",
  auth(),
  validator(userId),
  validator(update),
  usersController.putOne
);
router.delete("/:userId", auth(), validator(userId), usersController.deleteOne);

module.exports = router;
