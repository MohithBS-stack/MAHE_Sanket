/**
 * riskTestSet.js — Curated test fixture for pre-demo sanity runs.
 *
 * SKILLS.md §7 (risk-test-set) & TECHNICAL.md §6:
 * - Half genuine scam patterns, half benign lookalikes.
 * - Used to sanity-check risk-scoring before every demo run.
 * - Must pass 100% (TECHNICAL.md §6).
 */

import { evaluateLocally } from '../services/riskScoring.js'

export const RISK_TEST_CASES = [
  // --- SCAM PATTERNS (Expected: CAUTION or DANGER, risk_score >= 40) ---
  {
    id: 'scam-01-otp-hindi',
    language: 'hi',
    type: 'scam',
    description: 'SBI KYC update + OTP coercion',
    expectedMinScore: 70,
    expectedThreat: 'DANGER',
    lines: [
      { text: 'नमस्ते, मैं SBI मुख्य शाखा से बोल रहा हूँ।' },
      { text: 'आपका खाता तुरंत बंद हो जाएगा।' },
      { text: 'KYC update करने के लिए अपने फोन पर आया OTP तुरंत शेयर करें।' },
    ],
  },
  {
    id: 'scam-02-electricity-hindi',
    language: 'hi',
    type: 'scam',
    description: 'Electricity board bill urgency',
    expectedMinScore: 60,
    expectedThreat: 'CAUTION',
    lines: [
      { text: 'बिजली विभाग से सूचना है।' },
      { text: 'आज रात 9 बजे आपकी बिजली काट दी जाएगी।' },
      { text: 'तुरंत इस नंबर पर पैसे भेजें।' },
    ],
  },
  {
    id: 'scam-03-digital-arrest-hindi',
    language: 'hi',
    type: 'scam',
    description: 'Digital arrest / Police impersonation',
    expectedMinScore: 70,
    expectedThreat: 'DANGER',
    lines: [
      { text: 'मैं दिल्ली क्राइम ब्रांच पुलिस से बात कर रहा हूँ।' },
      { text: 'आपके नाम पर गैरकानूनी पार्सल मिला है, आपको अरेस्ट किया जाएगा।' },
      { text: 'अपने फोन पर AnyDesk डाउनलोड करें और सत्यापन करें।' },
    ],
  },
  {
    id: 'scam-04-kannada-bank-otp',
    language: 'kn',
    type: 'scam',
    description: 'Kannada bank account block & OTP demand',
    expectedMinScore: 70,
    expectedThreat: 'DANGER',
    lines: [
      { text: 'ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ಖಾತೆ ಬ್ಲಾಕ್ ಆಗಿದೆ.' },
      { text: 'ಆನ್‌ಲೈನ್ ಪರಿಶೀಲನೆಗೆ ನಿಮ್ಮ ಒಟಿಪಿ ಮತ್ತು ಕಾರ್ಡ್ ವಿವರ ನೀಡಿ.' },
    ],
  },
  {
    id: 'scam-05-tamil-remote-access',
    language: 'ta',
    type: 'scam',
    description: 'Tamil remote access app install scam',
    expectedMinScore: 50,
    expectedThreat: 'CAUTION',
    lines: [
      { text: 'உங்கள் வங்கி கணக்கு முடக்கப்பட்டுள்ளது.' },
      { text: 'உடனடியாக AnyDesk app install செய்து சரிபார்க்கவும்.' },
    ],
  },

  // --- BENIGN LOOKALIKES (Expected: SAFE, risk_score < 40) ---
  {
    id: 'benign-01-delivery-hindi',
    language: 'hi',
    type: 'benign',
    description: 'Courier delivery confirmation',
    expectedMaxScore: 35,
    expectedThreat: 'SAFE',
    lines: [
      { text: 'नमस्ते, मैं अमेज़ॅन डिलीवरी से हूँ।' },
      { text: 'आपका पार्सल गेट पर रख दिया है।' },
      { text: 'धन्यवाद।' },
    ],
  },
  {
    id: 'benign-02-family-hindi',
    language: 'hi',
    type: 'benign',
    description: 'Family member routine conversation',
    expectedMaxScore: 10,
    expectedThreat: 'SAFE',
    lines: [
      { text: 'माँ, मैं शाम को 7 बजे घर आ रहा हूँ।' },
      { text: 'सब्जी खरीद ली है, चिंता मत करो।' },
    ],
  },
  {
    id: 'benign-03-bank-balance-kannada',
    language: 'kn',
    type: 'benign',
    description: 'Bank routine branch hours check',
    expectedMaxScore: 20,
    expectedThreat: 'SAFE',
    lines: [
      { text: 'ನಾಳೆ ಬ್ಯಾಂಕ್ ಎಷ್ಟು ಗಂಟೆಗೆ ತೆರೆಯುತ್ತದೆ?' },
      { text: 'ಪಾಸ್‌ಬುಕ್ ಎಂಟ್ರಿ ಮಾಡಿಸಲು ಬರುತ್ತೇನೆ.' },
    ],
  },
  {
    id: 'benign-04-doctor-appointment-hindi',
    language: 'hi',
    type: 'benign',
    description: 'Clinic appointment reminder',
    expectedMaxScore: 15,
    expectedThreat: 'SAFE',
    lines: [
      { text: 'नमस्ते, डॉक्टर गुप्ता के क्लिनिक से बोल रहे हैं।' },
      { text: 'कल सुबह 11 बजे आपका ब्लड टेस्ट का समय है।' },
    ],
  },
]

/**
 * Run the risk test set against evaluateLocally
 * @returns {{ passed: boolean, total: number, passedCount: number, results: Array }}
 */
export function runRiskTestSet() {
  let passedCount = 0
  const results = RISK_TEST_CASES.map(tc => {
    const outcome = evaluateLocally(tc.lines)
    let isPass = false

    if (tc.type === 'scam') {
      isPass = outcome.risk_score >= (tc.expectedMinScore || 40)
    } else {
      isPass = outcome.risk_score <= (tc.expectedMaxScore || 39)
    }

    if (isPass) passedCount++

    return {
      id: tc.id,
      description: tc.description,
      type: tc.type,
      score: outcome.risk_score,
      threat_level: outcome.threat_level,
      flagged: outcome.flagged_phrases,
      isPass,
    }
  })

  return {
    passed: passedCount === RISK_TEST_CASES.length,
    total: RISK_TEST_CASES.length,
    passedCount,
    results,
  }
}
