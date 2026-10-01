/**
 * telegramNotify.js — Telegram Bot API alert notification service.
 *
 * SKILLS.md §6 (family-notify) & TECHNICAL.md §4:
 * - Silently alerts family/guardian when risk crosses threshold.
 * - Sends structured message with elder's name, risk score %, flagged phrases, and incident link.
 */

const BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN

/**
 * Send an urgent Telegram alert to the guardian.
 *
 * @param {Object} params
 * @param {string} params.chat_id - Telegram chat ID
 * @param {string} params.elder_name - Name of elder on the call
 * @param {number} params.risk_score - Peak risk score (0-100)
 * @param {string[]} params.flagged_phrases - Suspicious phrases detected
 * @param {string} [params.session_id] - Session ID for report link
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function sendTelegramAlert({
  chat_id,
  elder_name = 'Elder',
  risk_score = 0,
  flagged_phrases = [],
  session_id = '',
}) {
  const phrasesText = flagged_phrases.length > 0
    ? flagged_phrases.map(p => `• "${p}"`).join('\n')
    : 'Urgent coercive financial language detected.'

  const reportUrl = session_id
    ? `${window.location.origin}/report/${session_id}`
    : `${window.location.origin}/history`

  const messageText = [
    `🚨 *SANKET FRAUD INTERVENTION ALERT*`,
    ``,
    `⚠️ *High Scam Risk: ${risk_score}%* detected on *${elder_name}*'s active call.`,
    ``,
    `*Flagged Indicators:*`,
    `${phrasesText}`,
    ``,
    `*System Action:* Spoken vernacular warning has been triggered on the elder's device.`,
    ``,
    `🔗 [View Live Incident Report](${reportUrl})`,
  ].join('\n')

  if (!BOT_TOKEN || !chat_id) {
    console.info('[telegramNotify] Telegram bot token or chat_id not configured. Mocking notification delivery:', {
      chat_id,
      risk_score,
      elder_name,
    })
    return {
      success: true,
      simulated: true,
      message: 'Simulated alert recorded (set VITE_TELEGRAM_BOT_TOKEN to enable live Telegram bot messages).',
    }
  }

  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chat_id,
        text: messageText,
        parse_mode: 'Markdown',
        disable_web_page_preview: false,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.warn('[telegramNotify] Telegram API error:', err)
      return { success: false, message: `Telegram error ${response.status}` }
    }

    return { success: true, simulated: false, message: 'Telegram alert dispatched successfully.' }
  } catch (err) {
    console.error('[telegramNotify] Failed to dispatch Telegram alert:', err)
    return { success: false, message: err.message }
  }
}
