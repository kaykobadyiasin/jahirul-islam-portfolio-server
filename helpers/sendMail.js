const nodemailer = require("nodemailer");
require('dotenv').config()

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    secure: false, // Use `true` for port 465, `false` for all other ports
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
    },
});

// async..await is not allowed in global scope, must use a wrapper
async function sendMail(from, to, subject, text, html) {
    // send mail with defined transport object
    const info = await transporter.sendMail({
        from, // sender address
        to,
        subject,
        text,
        html
    })
}


module.exports = { sendMail }