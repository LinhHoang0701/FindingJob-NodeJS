const nodemailer = require("nodemailer");

const config = require("../config");
const template = require("../config/template");

const sender = config.mail.email;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: config.mail.email,
    pass: config.mail.password,
  },
});

exports.sendEmail = async (email, type, host, data) => {
  try {
    const message = prepareTemplate(type, host, data);
    const config = {
      from: `FindingJob <${sender}>`,
      to: email,
      subject: message.subject,
      text: message.text,
    };
    return await transporter.sendMail(config);
  } catch (error) {
    throw new Error(error);
  }
};

const prepareTemplate = (type, host, data) => {
  let message;

  switch (type) {
    case "signup":
      message = template.signupEmail(data);
      break;
    case "signin":
      message = template.signinEmail(data, host);
      break;
    case "reset":
      message = template.resetPassword(host, data);
      break;

    case "reset-confirmation":
      message = template.confirmResetPassword();
      break;
    case "order-confirmation":
      message = template.orderConfirmationEmail(data);
      break;
    default:
      message = "";
  }

  return message;
};
