// api/contact.js
//
// Vercel serverless function. Sends a visitor's message to the site owner
// without ever exposing the address to the browser. Uses Resend
// (https://resend.com) — set these in your Vercel project's Environment
// Variables, not in any committed file:
//
//   RESEND_API_KEY  — your Resend API key
//   CONTACT_EMAIL   — the address messages should be delivered to
//
// POST /api/contact  { name: string, email: string, message: string }

const MAX_MESSAGE_LENGTH = 500

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { name, email, message } = req.body || {}
  const trimmed = (message || '').trim().slice(0, MAX_MESSAGE_LENGTH)

  if (!trimmed) {
    res.status(400).json({ error: 'Message is required' })
    return
  }

  const apiKey = process.env.RESEND_API_KEY
  const toEmail = process.env.CONTACT_EMAIL

  if (!apiKey || !toEmail) {
    // Not configured yet. Log it and tell the truth in the payload — the caller
    // can see nothing was delivered, rather than being told it was.
    console.log('Contact message received (email not configured):', {
      name,
      email,
      message: trimmed,
    })
    res.status(200).json({ ok: true, delivered: false })
    return
  }

  const from = (name || 'Anonymous').slice(0, 100)

  try {
    const upstream = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'ASX Stills <onboarding@resend.dev>',
        to: [toEmail],
        subject: `ASX Stills message from ${from}`,
        // The visitor's address goes in reply-to, so replying from the inbox
        // reaches them without any copy-and-paste.
        ...(email ? { reply_to: email } : {}),
        text: `Name: ${name || 'Anonymous'}\nEmail: ${email || '(not given)'}\n\n${trimmed}`,
      }),
    })

    if (!upstream.ok) {
      const detail = await upstream.text()
      console.error('Resend error:', detail)
      res.status(502).json({ error: 'Failed to send' })
      return
    }

    res.status(200).json({ ok: true, delivered: true })
  } catch (err) {
    console.error('Contact send failed:', err)
    res.status(502).json({ error: 'Failed to send' })
  }
}
