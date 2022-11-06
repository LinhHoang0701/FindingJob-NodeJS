"use strict";

const User = require("../models/user.model");
const Recruiter = require("../models/recruiter.model");
const Applicant = require("../models/applicant.model");
const jwt = require("jsonwebtoken");
const config = require("../config");
const httpStatus = require("http-status");
const crypto = require("crypto");
const mongoose = require("mongoose");

const mail = require("../services/mail");

exports.register = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  const opts = { session };
  try {
    const userData = req.body;
    const user = new User(userData);
    const savedUser = await user.save(opts);
    userData.id = savedUser.id;
    const userDetails =
      savedUser.role === "applicant"
        ? new Applicant(userData)
        : new Recruiter(userData);
    const savedUserDetails = await userDetails.save(opts);
    await mail.sendEmail(
      savedUser.email,
      "signup",
      null,
      savedUserDetails.transform()
    );
    await session.commitTransaction();
    session.endSession();
    const response = {
      account: savedUser.transform(),
      details: savedUserDetails.transform(),
    };
    res.status(httpStatus.CREATED);
    res.send(response);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return next(User.checkDuplicateEmailError(error));
  }
};

exports.login = async (req, res, next) => {
  try {
    const user = await User.findAndGenerateToken(req.body);
    const payload = { sub: user.id, role: user.role };
    const token = jwt.sign(payload, config.secret);
    return res.json({ message: "OK", token: token });
  } catch (error) {
    next(error);
  }
};

exports.forgotPassword = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  const opts = { session };
  try {
    const { email } = req.body;

    const existingUser = await User.findOne({ email });

    if (!existingUser) {
      throw new APIError("No user found for this email address.");
    }

    const buffer = crypto.randomBytes(48);
    const resetToken = buffer.toString("hex");

    existingUser.resetPasswordToken = resetToken;
    existingUser.resetPasswordExpires = Date.now() + 3600000;

    existingUser.save(opts);
    await mail.sendEmail(
      existingUser.email,
      "reset",
      req.headers.host,
      resetToken
    );

    await session.commitTransaction();
    session.endSession();

    res.status(httpStatus.OK).json({
      success: true,
      message: "Please check your email for the link to reset your password.",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

exports.resetPassword = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  const opts = { session };
  try {
    const { password } = req.body;

    const resetUser = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!resetUser) {
      throw new APIError(
        "Your token has expired. Please attempt to reset your password again."
      );
    }

    resetUser.password = password;
    resetUser.resetPasswordToken = undefined;
    resetUser.resetPasswordExpires = undefined;

    resetUser.save(opts);

    await mail.sendEmail(resetUser.email, "reset-confirmation");

    await session.commitTransaction();
    session.endSession();

    res.status(httpStatus.OK).json({
      success: true,
      message:
        "Password changed successfully. Please login with your new password.",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};
