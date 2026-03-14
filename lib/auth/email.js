import nodemailer from "nodemailer"

let transporter

function getTransporter() {
  if (transporter) return transporter

  const from = process.env.EMAIL_FROM
  const appPassword = process.env.GMAIL_APP_PASSWORD

  if (!from || !appPassword) {
    return null
  }

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: from,
      pass: appPassword,
    },
  })

  return transporter
}

export async function sendEmail({ to, subject, html, text }) {
  const from = process.env.EMAIL_FROM
  const mailer = getTransporter()

  if (!from || !mailer) {
    console.warn("Email not sent. Configure EMAIL_FROM and GMAIL_APP_PASSWORD.")
    return { skipped: true }
  }

  const info = await mailer.sendMail({
    from,
    to,
    subject,
    html,
    text,
  })

  return {
    id: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
    response: info.response,
  }
}
