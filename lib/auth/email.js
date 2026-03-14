export async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM

  if (!apiKey || !from) {
    console.warn("Email not sent. Configure RESEND_API_KEY and EMAIL_FROM.")
    return { skipped: true }
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html, text }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Email send failed: ${response.status} ${body}`)
  }

  return response.json()
}