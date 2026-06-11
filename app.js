// --- Gemini API Configuration ---
// Retrieve API key from localStorage. Stored securely inside the browser client.
let GEMINI_API_KEY = localStorage.getItem('GEMINI_API_KEY') || '';

function getGeminiApiUrl() {
  const key = localStorage.getItem('GEMINI_API_KEY') || GEMINI_API_KEY || '';
  return `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${key}`;
}

// Function to prompt/configure API Key from the UI
function configureApiKey() {
  const currentKey = localStorage.getItem('GEMINI_API_KEY') || '';
  const userKey = prompt("Enter your Google Gemini API Key. (Your key is saved locally in your browser and is never uploaded to any server):", currentKey);
  
  if (userKey !== null) {
    const trimmedKey = userKey.trim();
    if (trimmedKey) {
      localStorage.setItem('GEMINI_API_KEY', trimmedKey);
      GEMINI_API_KEY = trimmedKey;
      alert("API Key saved successfully! The app will reload to apply changes.");
      window.location.reload();
    } else {
      localStorage.removeItem('GEMINI_API_KEY');
      GEMINI_API_KEY = '';
      alert("API Key removed. Real-time agent calls will prompt you for a key.");
    }
  }
}

// Helper function to check/ensure API key exists before making requests
function ensureApiKey() {
  if (!localStorage.getItem('GEMINI_API_KEY') && !GEMINI_API_KEY) {
    const key = prompt("A Gemini API Key is required to run real-time AI agents. Please enter your key (this will be stored locally in your browser):");
    if (key && key.trim()) {
      const trimmedKey = key.trim();
      localStorage.setItem('GEMINI_API_KEY', trimmedKey);
      GEMINI_API_KEY = trimmedKey;
      return true;
    }
    return false;
  }
  return true;
}


const INTAKE_SYSTEM_PROMPT = `You are an AI-powered Symptom Intake Nurse for MediFlow AI, a healthcare coordination platform.
Your role is to gently and professionally gather a patient's medical symptom information through a natural conversation.

Your goals:
1. Ask about the nature of their symptoms (what, where, how it feels).
2. Ask about duration (how long they have had it).
3. Ask about severity (pain scale 1-10 or descriptive severity).
4. Ask at most 1-2 follow-up clarifying questions if needed.

IMPORTANT RULES:
- Be warm, empathetic, and professional. You are NOT diagnosing the patient or providing treatment recommendations.
- Keep responses concise (2-3 sentences max).
- If the patient mentions life-threatening symptoms (e.g., severe chest pain, sudden numbness or paralysis, extreme shortness of breath), advise them to seek emergency services immediately, but continue the intake flow to collect details if they choose to do so.
- Once you have enough information (symptoms, duration, and severity), set "done" to true, "specialty" to the recommended specialty, and "summary" to a 1-2 sentence clinical intake summary.
- Choose the specialty based on the symptoms:
  * Cardiology: chest pain, heart palpitations, shortness of breath, radiating arm/jaw pain, or cardiac history.
  * Neurology: severe headaches, migraines, numbness, tingling, tremors, dizziness, spine/brain issues, or nerve pain.
  * Orthopedics: joint pain, bone fractures, arthritis, muscle strains, ligament tears, shoulder/knee/hip issues.
  * Dermatology: skin rashes, eczema, severe acne, hives, suspicious moles, hair loss, nail infections.
  * Pediatrics: infant/child fever, pediatric growth concerns, childhood viral illness, child developmental checks.
  * Psychiatry: mental health struggles, severe anxiety, depression, mood changes, panic attacks, sleep disorders.
  * Ophthalmology: sudden vision loss, blurry vision, eye pain, redness, itching, double vision, eye injury.
  * Gastroenterology: stomach pain, acid reflux, heartburn, persistent nausea, chronic bloating, IBS, bowel changes.
  * Endocrinology: diabetes management, thyroid nodules, thyroid fatigue, hormonal fluctuations, unexplained weight changes.
  * ENT: ear infections, sinus pressure, nosebleeds, tonsillitis, throat pain, voice hoarseness, hearing issues.
  * General Medicine: mild cold, flu, low-grade fever, general body aches, checkups, or general malaise.
- Never reveal that you are an AI language model; stay in character as the intake nurse.`;

// Call Gemini API with the full multi-turn chat history
async function callGeminiIntakeAgent(chatHistory) {
  // Build conversation turns from app chat history (skip the initial AI greeting bubble)
  const conversationTurns = chatHistory
    .filter((msg, idx) => !(msg.sender === 'ai' && idx === 0))
    .map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

  const requestBody = {
    contents: conversationTurns,
    systemInstruction: {
      parts: [{ text: INTAKE_SYSTEM_PROMPT }]
    },
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          done: { type: "BOOLEAN", description: "Set to true when symptoms, duration, and severity are gathered." },
          reply: { type: "STRING", description: "Your conversational response to the patient." },
          specialty: {
            type: "STRING",
            enum: [
              "Cardiology", "Neurology", "Orthopedics", "Dermatology", "Pediatrics",
              "Psychiatry", "Ophthalmology", "Gastroenterology", "Endocrinology", "ENT",
              "General Medicine"
            ],
            description: "Recommended medical specialty."
          },
          summary: { type: "STRING", description: "A 1-2 sentence clinical intake summary of the patient's symptoms, duration, and severity." }
        },
        required: ["done", "reply"]
      }
    }
  };

  if (!ensureApiKey()) {
    throw new Error("Gemini API Key is missing. Please configure your API key in the top right header.");
  }

  const response = await fetch(getGeminiApiUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData?.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// --- Gemini Prescription Explanation & Follow-up Agents ---

const PRESCRIPTION_SYSTEM_PROMPT = `You are a clinical pharmacologist. Your job is to convert technical doctor prescriptions into plain, easy-to-understand terms for a patient.
You will receive details of the medication (name, dosage directions, duration, and doctor's notes).

You must return a JSON object with the following fields:
- "purpose": A 1-2 sentence explanation of what the medication is and what it does in simple terms.
- "guidelines": Step-by-step instructions on how the patient should take this medication (e.g., with food, timing, consistency).
- "precautions": Critical safety warnings, dangerous drug/food mixtures (e.g., alcohol, grapefruit), side effects to monitor, and when to seek medical help.
- "faqs": An array of 2-3 common questions and answers about this medication (specifically covering missed doses and stopping treatment).

Do not include any explanation outside the JSON format. Use the following schema:
{
  "purpose": "string",
  "guidelines": "string",
  "precautions": "string",
  "faqs": [
    { "q": "string", "a": "string" }
  ]
}`;

async function callGeminiPrescriptionAgent(medName, dosage, duration, notes) {
  const prompt = `Medication: ${medName}
Dosage: ${dosage}
Duration: ${duration}
Doctor's Notes: ${notes}`;

  const requestBody = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction: {
      parts: [{ text: PRESCRIPTION_SYSTEM_PROMPT }]
    },
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          purpose: { type: "STRING" },
          guidelines: { type: "STRING" },
          precautions: { type: "STRING" },
          faqs: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                q: { type: "STRING" },
                a: { type: "STRING" }
              },
              required: ["q", "a"]
            }
          }
        },
        required: ["purpose", "guidelines", "precautions", "faqs"]
      }
    }
  };

  if (!ensureApiKey()) {
    throw new Error("Gemini API Key is missing. Please configure your API key in the top right header.");
  }

  const response = await fetch(getGeminiApiUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData?.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return JSON.parse(rawText.trim());
}

async function callGeminiFollowupAgent(medName, dosage, duration, notes, chatHistory) {
  const systemPrompt = `You are a warm, empathetic medical follow-up assistant. You are answering a patient's questions about their prescribed medication.
Here are the medication details:
- Name: ${medName}
- Dosage: ${dosage}
- Duration: ${duration}
- Notes: ${notes}

Your goals:
1. Answer the patient's questions accurately, keeping it simple, clear, and reassuring.
2. Refer to the medication's guidelines and precautions when answering.
3. If they ask about dangerous symptoms or toxic side effects, advise them to immediately contact their doctor or seek emergency services, and do not make definitive medical diagnoses.
4. Keep responses concise (3 sentences max).
5. Never reveal you are an AI language model. Stay in character as the follow-up assistant.`;

  // Build turns from chatHistory (excluding the initial greeting)
  const conversationTurns = chatHistory
    .filter((msg, idx) => idx > 0)
    .map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

  const requestBody = {
    contents: conversationTurns,
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    }
  };

  if (!ensureApiKey()) {
    throw new Error("Gemini API Key is missing. Please configure your API key in the top right header.");
  }

  const response = await fetch(getGeminiApiUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData?.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// --- Database & Preloaded Mock Data ---
const DOCTORS_DB = {
  Cardiology: [
    { id: 'doc-card-1', name: 'Dr. Helen Thorne', specialty: 'Cardiology', hospital: 'City Health Heart Center', rating: '4.9 (182 reviews)', distance: '1.8 miles away', avatar: 'HT' },
    { id: 'doc-card-2', name: 'Dr. Aaron Patel', specialty: 'Cardiology', hospital: 'St. Jude Cardiac Clinic', rating: '4.8 (94 reviews)', distance: '3.4 miles away', avatar: 'AP' }
  ],
  Neurology: [
    { id: 'doc-neur-1', name: 'Dr. Sarah Mitchell', specialty: 'Neurology', hospital: 'Brain & Spine Institute', rating: '4.9 (145 reviews)', distance: '2.5 miles away', avatar: 'SM' },
    { id: 'doc-neur-2', name: 'Dr. Marcus Vance', specialty: 'Neurology', hospital: 'Neurological Sciences Care', rating: '4.7 (76 reviews)', distance: '4.1 miles away', avatar: 'MV' }
  ],
  Orthopedics: [
    { id: 'doc-ortho-1', name: 'Dr. Thomas Warren', specialty: 'Orthopedics', hospital: 'Bone & Joint Surgery Clinic', rating: '4.8 (210 reviews)', distance: '2.1 miles away', avatar: 'TW' },
    { id: 'doc-ortho-2', name: 'Dr. Cynthia Diaz', specialty: 'Orthopedics', hospital: 'Sports Medicine & Joint Care', rating: '4.6 (115 reviews)', distance: '5.0 miles away', avatar: 'CD' }
  ],
  Dermatology: [
    { id: 'doc-derm-1', name: 'Dr. Lisa Ray', specialty: 'Dermatology', hospital: 'Skin & Laser Center', rating: '4.9 (120 reviews)', distance: '1.5 miles away', avatar: 'LR' },
    { id: 'doc-derm-2', name: 'Dr. Jordan Cooper', specialty: 'Dermatology', hospital: 'Metro Skin Care Clinic', rating: '4.8 (85 reviews)', distance: '3.2 miles away', avatar: 'JC' }
  ],
  Pediatrics: [
    { id: 'doc-ped-1', name: 'Dr. Emily Watson', specialty: 'Pediatrics', hospital: "Children's Health Hospital", rating: '4.9 (240 reviews)', distance: '2.2 miles away', avatar: 'EW' },
    { id: 'doc-ped-2', name: 'Dr. Ryan Chen', specialty: 'Pediatrics', hospital: 'Happy Kids Pediatric Care', rating: '4.7 (104 reviews)', distance: '4.5 miles away', avatar: 'RC' }
  ],
  Psychiatry: [
    { id: 'doc-psych-1', name: 'Dr. Clara Oswald', specialty: 'Psychiatry', hospital: 'Mind & Behavioral Wellness', rating: '4.8 (90 reviews)', distance: '1.9 miles away', avatar: 'CO' },
    { id: 'doc-psych-2', name: 'Dr. David Tennant', specialty: 'Psychiatry', hospital: 'Cognitive Care Center', rating: '4.9 (156 reviews)', distance: '3.0 miles away', avatar: 'DT' }
  ],
  Ophthalmology: [
    { id: 'doc-eye-1', name: 'Dr. Fiona Gallagher', specialty: 'Ophthalmology', hospital: 'City Eye Care Center', rating: '4.7 (72 reviews)', distance: '2.7 miles away', avatar: 'FG' },
    { id: 'doc-eye-2', name: 'Dr. Henry Wu', specialty: 'Ophthalmology', hospital: 'Advanced Vision Clinic', rating: '4.8 (112 reviews)', distance: '5.1 miles away', avatar: 'HW' }
  ],
  Gastroenterology: [
    { id: 'doc-gastro-1', name: 'Dr. Sanjeev Gupta', specialty: 'Gastroenterology', hospital: 'Digestive Disease Institute', rating: '4.8 (167 reviews)', distance: '1.6 miles away', avatar: 'SG' },
    { id: 'doc-gastro-2', name: 'Dr. Melissa Vance', specialty: 'Gastroenterology', hospital: 'Gastro & Liver Care Clinic', rating: '4.6 (98 reviews)', distance: '4.0 miles away', avatar: 'MV' }
  ],
  Endocrinology: [
    { id: 'doc-endo-1', name: 'Dr. Chloe Bennet', specialty: 'Endocrinology', hospital: 'Thyroid & Diabetes Clinic', rating: '4.7 (88 reviews)', distance: '2.0 miles away', avatar: 'CB' },
    { id: 'doc-endo-2', name: 'Dr. Richard Feynman', specialty: 'Endocrinology', hospital: 'Hormone & Metabolism Center', rating: '4.8 (124 reviews)', distance: '3.8 miles away', avatar: 'RF' }
  ],
  ENT: [
    { id: 'doc-ent-1', name: 'Dr. Arthur Pendragon', specialty: 'ENT', hospital: 'Ear Nose & Throat Associates', rating: '4.8 (192 reviews)', distance: '1.4 miles away', avatar: 'AP' },
    { id: 'doc-ent-2', name: 'Dr. Gwen Stacy', specialty: 'ENT', hospital: 'Sinus & Allergy Clinic', rating: '4.7 (83 reviews)', distance: '2.9 miles away', avatar: 'GS' }
  ],
  'General Medicine': [
    { id: 'doc-gp-1', name: 'Dr. Arthur Pendleton', specialty: 'General Medicine', hospital: 'Central Care Medical Hub', rating: '4.7 (320 reviews)', distance: '1.2 miles away', avatar: 'AP' },
    { id: 'doc-gp-2', name: 'Dr. Evelyn Foster', specialty: 'General Medicine', hospital: 'Community Wellness Center', rating: '4.6 (143 reviews)', distance: '2.8 miles away', avatar: 'EF' }
  ]
};

const DEFAULT_APPOINTMENTS = [
  {
    id: 'apt-101',
    patientName: 'Jane Smith',
    specialty: 'Cardiology',
    doctorName: 'Dr. Helen Thorne',
    symptomSummary: 'Subtle tightness in chest spreading to left shoulder, experiencing for 3 hours. Pain scale: 7/10.',
    date: '2026-06-05',
    time: '10:30 AM',
    method: 'Video Call',
    status: 'In-Consultation'
  },
  {
    id: 'apt-102',
    patientName: 'David Lee',
    specialty: 'Neurology',
    doctorName: 'Dr. Sarah Mitchell',
    symptomSummary: 'Sudden onset of pulsating migraine with sharp pain behind right eye and sensitivity to fluorescent light. Pain scale: 8/10.',
    date: '2026-06-06',
    time: '02:00 PM',
    method: 'In-Person',
    status: 'Scheduled'
  }
];

const DEFAULT_PRESCRIPTIONS = [
  {
    id: 'prsc-501',
    patientName: 'Jane Smith',
    doctorName: 'Dr. Helen Thorne',
    date: '2026-06-05',
    medName: 'Lisinopril 10mg',
    dosage: '1 tablet once daily in the morning',
    duration: '30 Days',
    notes: 'For blood pressure control. Do not skip doses. Avoid eating grapefruits/drinking grapefruit juice while on this medication.',
    status: 'active',
    explanation: {
      purpose: 'An ACE inhibitor used to treat high blood pressure and help prevent heart attacks or strokes.',
      guidelines: 'Take it at the same time each morning. Can be taken with or without food. Drink plenty of water throughout the day.',
      precautions: 'Check your blood pressure regularly. Avoid grapefruit. Call your doctor immediately if you develop swelling in your face or a dry, hacking cough.',
      faqs: [
        { q: 'What should I do if I miss a dose?', a: 'Take the missed dose as soon as you remember. If it is almost time for your next dose, skip the missed dose and resume your regular schedule. Do not double the dose.' },
        { q: 'Why should I avoid grapefruit?', a: 'Grapefruit can increase the concentration of Lisinopril in your blood, making side effects like extreme dizziness or low blood pressure more likely.' }
      ]
    }
  },
  {
    id: 'prsc-502',
    patientName: 'David Lee',
    doctorName: 'Dr. Sarah Mitchell',
    date: '2026-06-06',
    medName: 'Gabapentin 300mg',
    dosage: '1 capsule three times daily (morning, afternoon, bedtime)',
    duration: '14 Days',
    notes: 'For nerve pain management. May cause drowsiness. Avoid alcohol. Do not stop taking abruptly.',
    status: 'active',
    explanation: {
      purpose: 'An anticonvulsant and analgesic medication used primarily to relieve severe nerve pain.',
      guidelines: 'Best taken at evenly spaced intervals (three times daily). Administer with food if it causes stomach upset.',
      precautions: 'May cause severe drowsiness. Do not drive or operate machinery until effects are known. Avoid alcohol.',
      faqs: [
        { q: 'Can I take Gabapentin with antacids?', a: 'No. Antacids containing aluminum or magnesium reduce Gabapentin absorption by 20%. Take them at least 2 hours apart.' },
        { q: 'What should I do if I miss a dose?', a: 'Take as soon as you remember, unless it is close to your next scheduled slot. Never take double doses.' }
      ]
    }
  },
  {
    id: 'prsc-503',
    patientName: 'Jane Smith',
    doctorName: 'Dr. Evelyn Foster',
    date: '2026-04-10',
    medName: 'Amoxicillin 500mg',
    dosage: '1 capsule three times daily',
    duration: '7 Days',
    notes: 'Complete the full course even if you feel better. Take with food.',
    status: 'past',
    explanation: {
      purpose: 'A penicillin antibiotic used to treat bacterial infections like sinus or throat infections.',
      guidelines: 'Take it at evenly spaced times of day with food. Finish all 7 days of capsules.',
      precautions: 'May cause mild stomach upset. Inform doctor if severe rash or watery stools occur.',
      faqs: [
        { q: 'Can I stop if symptoms clear?', a: 'No, finishing the full prescription is crucial to completely clear the infection and prevent bacterial resistance.' }
      ]
    }
  },
  {
    id: 'prsc-504',
    patientName: 'David Lee',
    doctorName: 'Dr. Arthur Pendleton',
    date: '2026-05-15',
    medName: 'Ibuprofen 600mg',
    dosage: '1 tablet every 6 to 8 hours as needed',
    duration: '5 Days',
    notes: 'Take with food or milk to avoid stomach irritation. For back pain.',
    status: 'past',
    explanation: {
      purpose: 'An NSAID (nonsteroidal anti-inflammatory drug) that reduces hormones causing pain and inflammation in the body.',
      guidelines: 'Take only when needed for pain, maximum 3 times a day. Always take with meals or milk.',
      precautions: 'Can cause stomach upset or ulcers if taken long-term. Do not combine with other painkillers.',
      faqs: [
        { q: 'Can I take this on an empty stomach?', a: 'It is highly recommended to take it with food or milk to prevent gastric discomfort.' }
      ]
    }
  }
];

const MOCK_OCR_DATA = {
  medName: 'Gabapentin 300mg',
  dosage: '1 capsule three times daily (morning, afternoon, bedtime)',
  duration: '14 Days',
  notes: 'For nerve pain management. May cause drowsiness. Avoid alcohol. Do not stop taking abruptly.'
};

const MOCK_DOCTORS_DB = {
  'helen': { id: 'doc-card-1', name: 'Dr. Helen Thorne', password: 'password123', specialty: 'Cardiology', avatar: 'HT' },
  'sarah': { id: 'doc-neur-1', name: 'Dr. Sarah Mitchell', password: 'password123', specialty: 'Neurology', avatar: 'SM' }
};

// --- App State Management ---
// Bump this version number whenever a breaking change is made to the state shape.
// The app will automatically clear stale localStorage so users never see broken data.
const STATE_VERSION = 4;

let state = {
  version: STATE_VERSION,
  currentUser: null,
  currentDoctor: null,
  currentPrescriptionTab: 'active',
  appointments: [],
  prescriptions: [],
  selectedAptId: null,
  activePrescIdInterpreter: null,
  patientIntakeStates: {},
  followupChatHistory: {} // mapped by prescId -> list of messages
};

// --- Patient Login Logic ---
const MOCK_PATIENTS_DB = {
  'jane': { name: 'Jane Smith', password: 'password123', avatar: 'JS' },
  'david': { name: 'David Lee', password: 'password123', avatar: 'DL' }
};

function getCurrentPatientState() {
  const user = state.currentUser || 'Jane Smith';
  if (!state.patientIntakeStates) {
    state.patientIntakeStates = {};
  }
  if (!state.patientIntakeStates[user]) {
    state.patientIntakeStates[user] = {
      intakeStage: 0,
      intakeSummary: { symptomDescription: '', duration: '', severity: '', unifiedSummary: '' },
      chatHistory: [
        { sender: 'ai', text: `Hello ${user}! I am the Symptom Analysis Agent. Please describe what symptoms you are experiencing today in detail.`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
      ],
      recommendedSpecialty: null,
      reasoningLogs: []
    };
  }
  return state.patientIntakeStates[user];
}

function submitPatientLogin() {
  const usernameInput = document.getElementById('patient-username');
  const passwordInput = document.getElementById('patient-password');
  const errorMsgEl = document.getElementById('login-error-msg');

  if (!usernameInput || !passwordInput || !errorMsgEl) return;

  const username = usernameInput.value.trim().toLowerCase();
  const password = passwordInput.value.trim();

  errorMsgEl.style.display = 'none';

  const patient = MOCK_PATIENTS_DB[username];
  if (patient && patient.password === password) {
    state.currentUser = patient.name;
    const patientMeds = state.prescriptions.filter(p => p.patientName === state.currentUser);
    if (patientMeds.length > 0) {
      state.activePrescIdInterpreter = patientMeds[0].id;
    } else {
      state.activePrescIdInterpreter = null;
    }

    saveAppState();
    renderPatientPortal();

    usernameInput.value = '';
    passwordInput.value = '';
  } else {
    errorMsgEl.innerText = 'Invalid username or password. Try using "jane" or "david" with "password123".';
    errorMsgEl.style.display = 'block';
  }
}

function quickLogin(username) {
  const patient = MOCK_PATIENTS_DB[username];
  if (patient) {
    state.currentUser = patient.name;
    const patientMeds = state.prescriptions.filter(p => p.patientName === state.currentUser);
    if (patientMeds.length > 0) {
      state.activePrescIdInterpreter = patientMeds[0].id;
    } else {
      state.activePrescIdInterpreter = null;
    }
    saveAppState();
    renderPatientPortal();
  }
}

function patientLogout() {
  state.currentUser = null;
  state.currentPrescriptionTab = 'active';

  // Clear patient-specific logs and recommendations DOM elements immediately on logout
  clearAgentActivityLogs();
  const recContainer = document.getElementById('recommendation-content');
  if (recContainer) {
    recContainer.innerHTML = `
      <div class="rec-placeholder">
        <i class="fa-solid fa-user-md"></i>
        <p>Type symptoms in the intake chat on the left. The Specialist Routing Agent will analyze and recommend doctors here.</p>
      </div>
    `;
  }

  saveAppState();
  renderPatientPortal();
}

// Load State from LocalStorage or Fallback
function loadAppState() {
  const savedState = localStorage.getItem('mediflow_state');
  if (savedState) {
    try {
      const parsed = JSON.parse(savedState);
      // Auto-clear if saved state is from an older broken version
      if (!parsed.version || parsed.version < STATE_VERSION) {
        console.info(`[MediFlow] Stale state detected (v${parsed.version || 0} < v${STATE_VERSION}). Auto-resetting to defaults.`);
        localStorage.removeItem('mediflow_state');
        resetToDefaults();
      } else {
        state = parsed;
      }
    } catch (e) {
      console.error("Failed to parse saved state, resetting to defaults", e);
      localStorage.removeItem('mediflow_state');
      resetToDefaults();
    }
  } else {
    resetToDefaults();
  }
}

function saveAppState() {
  localStorage.setItem('mediflow_state', JSON.stringify(state));
}

function resetToDefaults() {
  state.version = STATE_VERSION;
  state.currentUser = null;
  state.currentDoctor = null;
  state.currentPrescriptionTab = 'active';
  state.appointments = [...DEFAULT_APPOINTMENTS];
  state.prescriptions = [...DEFAULT_PRESCRIPTIONS];
  state.selectedAptId = state.appointments[0].id;
  state.activePrescIdInterpreter = state.prescriptions[0] ? state.prescriptions[0].id : null;
  state.patientIntakeStates = {
    'Jane Smith': {
      intakeStage: 0,
      intakeSummary: { symptomDescription: '', duration: '', severity: '', unifiedSummary: '' },
      chatHistory: [
        { sender: 'ai', text: 'Hello Jane Smith! I am the Symptom Analysis Agent. Please describe what symptoms you are experiencing today in detail.', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
      ],
      recommendedSpecialty: null,
      reasoningLogs: []
    },
    'David Lee': {
      intakeStage: 0,
      intakeSummary: { symptomDescription: '', duration: '', severity: '', unifiedSummary: '' },
      chatHistory: [
        { sender: 'ai', text: 'Hello David Lee! I am the Symptom Analysis Agent. Please describe what symptoms you are experiencing today in detail.', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
      ],
      recommendedSpecialty: null,
      reasoningLogs: []
    }
  };
  state.followupChatHistory = {};
  saveAppState();
}

function resetAppState() {
  resetToDefaults();
  window.location.reload();
}

// --- Navigation ---
function switchView(viewName) {
  // Hide all views
  document.querySelectorAll('.view-section').forEach(view => {
    view.classList.remove('active');
  });

  // Show target view
  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) targetView.classList.add('active');

  // Deactivate all nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  // Activate target nav button
  const targetBtn = document.getElementById(`nav-${viewName}`);
  if (targetBtn) targetBtn.classList.add('active');

  // Re-render specific pages to ensure sync
  if (viewName === 'patient') {
    renderPatientPortal();
  } else if (viewName === 'doctor') {
    renderDoctorPortal();
  }
}

// --- Agent Coordination Logs ---
function logAgentActivity(agentName, text, status = 'running') {
  const logContainer = document.getElementById('agent-reasoning-logs');
  if (!logContainer) return;

  let icon = '<i class="fa-solid fa-spinner fa-spin"></i>';
  let lineClass = 'running';

  if (status === 'success') {
    icon = '<i class="fa-solid fa-circle-check"></i>';
    lineClass = 'success';
  } else if (status === 'info') {
    icon = '<i class="fa-solid fa-circle-info"></i>';
    lineClass = 'info';
  } else if (status === 'empty') {
    icon = '';
    lineClass = '';
  }

  // If there's a logged in patient, store the log in their state
  if (state.currentUser) {
    const patientState = getCurrentPatientState();
    if (!patientState.reasoningLogs) {
      patientState.reasoningLogs = [];
    }
    patientState.reasoningLogs.push({ agentName, text, status, icon, lineClass });
    saveAppState();
  }

  const line = document.createElement('div');
  line.className = `agent-log-line ${lineClass}`;
  line.innerHTML = `${icon} <strong>[${agentName}]</strong> ${text}`;

  logContainer.appendChild(line);
  logContainer.scrollTop = logContainer.scrollHeight;
}

function clearAgentActivityLogs() {
  const logContainer = document.getElementById('agent-reasoning-logs');
  if (logContainer) logContainer.innerHTML = '';
}

// --- PATIENT INTAKE BOT FLOW ---
function injectSymptom(text) {
  const chatInput = document.getElementById('intake-chat-input');
  if (chatInput) {
    chatInput.value = text;
    chatInput.focus();
  }
}

function handleIntakeKeyDown(event) {
  if (event.key === 'Enter') {
    sendPatientMessage();
  }
}

function sendPatientMessage() {
  const inputEl = document.getElementById('intake-chat-input');
  if (!inputEl) return;

  const text = inputEl.value.trim();
  if (!text) return;

  // 1. Add User Message to Chat History
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  getCurrentPatientState().chatHistory.push({ sender: 'user', text: text, time: time });
  inputEl.value = '';
  renderIntakeChat();

  // 2. Advance Dialog Tree
  processIntakeResponse(text);
}

async function processIntakeResponse(text) {
  // Show AI typing indicator
  const msgsContainer = document.getElementById('intake-chat-messages');
  if (!msgsContainer) return;

  const typingBubble = document.createElement('div');
  typingBubble.id = 'chat-typing-bubble';
  typingBubble.className = 'message ai';
  typingBubble.innerHTML = `
    <span class="message-sender">Symptom Agent</span>
    <div style="display: flex; gap: 4px; padding: 4px 0;">
      <span class="status-dot" style="animation-delay: 0.1s;"></span>
      <span class="status-dot" style="animation-delay: 0.2s;"></span>
      <span class="status-dot" style="animation-delay: 0.3s;"></span>
    </div>
  `;
  msgsContainer.appendChild(typingBubble);
  msgsContainer.scrollTop = msgsContainer.scrollHeight;

  // Log activity
  logAgentActivity('Symptom Analysis Agent', 'Analyzing description: "' + text + '"...', 'running');

  try {
    // Call Gemini API
    const responseText = await callGeminiIntakeAgent(getCurrentPatientState().chatHistory);

    // Remove typing bubble
    const bubble = document.getElementById('chat-typing-bubble');
    if (bubble) bubble.remove();

    // Parse the JSON response
    const result = JSON.parse(responseText.trim());
    const reply = result.reply;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (!result.done) {
      logAgentActivity('Symptom Analysis Agent', 'Semantic descriptors extracted. Probing for details.', 'info');
      getCurrentPatientState().chatHistory.push({ sender: 'ai', text: reply, time: time });
      renderIntakeChat();
      saveAppState();
    } else {
      logAgentActivity('Symptom Analysis Agent', 'Intake log compiled successfully.', 'success');

      const specialty = result.specialty || 'General Medicine';
      const summary = result.summary || 'Symptoms collected.';

      // Store summary in state
      getCurrentPatientState().intakeSummary.unifiedSummary = summary;
      getCurrentPatientState().intakeSummary.symptomDescription = summary; // fallback
      getCurrentPatientState().intakeStage = 3;
      getCurrentPatientState().recommendedSpecialty = specialty;

      setTimeout(() => {
        logAgentActivity('Specialist Routing Agent', 'Reviewing symptom profile summaries...', 'running');
      }, 500);

      setTimeout(() => {
        logAgentActivity('Specialist Routing Agent', `Mapping complete. Recommended Specialty: ${specialty}. Routing available specialists...`, 'success');

        getCurrentPatientState().chatHistory.push({ sender: 'ai', text: reply, time: time });
        renderIntakeChat();

        // Render recommended doctors
        renderDoctorsRecommendation(specialty);
        saveAppState();
      }, 1500);
    }
  } catch (error) {
    console.error('Error during symptom intake:', error);
    // Remove typing bubble if present
    const bubble = document.getElementById('chat-typing-bubble');
    if (bubble) bubble.remove();

    logAgentActivity('Symptom Analysis Agent', 'Error during processing: ' + error.message, 'info');

    // Add a user-friendly error bubble in chat
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const errorReply = `⚠️ Sorry, I encountered a connection issue while analyzing your symptoms. Please ensure you are connected to the internet, check the API key, and try again.`;
    getCurrentPatientState().chatHistory.push({ sender: 'ai', text: errorReply, time: time });
    renderIntakeChat();
    saveAppState();
  }
}

// Render Chat Logs
function renderIntakeChat() {
  const container = document.getElementById('intake-chat-messages');
  if (!container) return;

  container.innerHTML = '';
  getCurrentPatientState().chatHistory.forEach(msg => {
    const bubble = document.createElement('div');
    bubble.className = `message ${msg.sender}`;
    bubble.innerHTML = `
      <span class="message-sender">${msg.sender === 'ai' ? 'Symptom Agent' : 'Patient'}</span>
      <div>${msg.text}</div>
      <span class="message-time">${msg.time}</span>
    `;
    container.appendChild(bubble);
  });

  container.scrollTop = container.scrollHeight;
}

// Render Doctor Cards on Matching Specialty
function renderDoctorsRecommendation(specialty) {
  const container = document.getElementById('recommendation-content');
  if (!container) return;

  const doctors = DOCTORS_DB[specialty] || DOCTORS_DB['General Medicine'];
  container.innerHTML = '';

  doctors.forEach(doc => {
    const card = document.createElement('div');
    card.className = 'doctor-card-rec';
    card.innerHTML = `
      <div class="doc-info-header">
        <div class="doc-avatar">${doc.avatar}</div>
        <div>
          <div class="doc-name">${doc.name}</div>
          <div class="doc-specialty">${doc.specialty}</div>
          <div class="doc-rating"><i class="fa-solid fa-star"></i> ${doc.rating}</div>
        </div>
      </div>
      <div class="doc-details-grid">
        <div><i class="fa-solid fa-building-hospital"></i> ${doc.hospital}</div>
        <div><i class="fa-solid fa-location-dot"></i> ${doc.distance}</div>
      </div>
      <button class="book-btn" onclick="openBookingModal('${doc.id}', '${doc.name.replace(/'/g, "\\'")}', '${doc.specialty}')">
        <i class="fa-solid fa-calendar-days"></i> Book Appointment
      </button>
    `;
    container.appendChild(card);
  });
}

// --- BOOKING MODAL AND SCHEDULING ---
let activeBookingDoctor = null;

function openBookingModal(docId, docName, specialty) {
  activeBookingDoctor = { id: docId, name: docName, specialty: specialty };

  const modal = document.getElementById('booking-modal');
  const title = document.getElementById('booking-modal-title');

  if (modal && title) {
    title.innerText = `Book Slot with ${docName}`;

    // Set default date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateInput = document.getElementById('booking-date');
    if (dateInput) {
      dateInput.value = tomorrow.toISOString().split('T')[0];
      dateInput.min = new Date().toISOString().split('T')[0];
    }

    // Clear selections
    document.querySelectorAll('.slot-chip').forEach(c => c.classList.remove('selected'));
    document.querySelectorAll('.method-option').forEach(m => m.classList.remove('selected'));

    modal.style.display = 'flex';
  }
}

function closeBookingModal() {
  const modal = document.getElementById('booking-modal');
  if (modal) modal.style.display = 'none';
  activeBookingDoctor = null;
}

function selectSlot(chip) {
  document.querySelectorAll('.slot-chip').forEach(c => c.classList.remove('selected'));
  chip.classList.add('selected');
}

function selectMethod(option, value) {
  document.querySelectorAll('.method-option').forEach(m => m.classList.remove('selected'));
  option.classList.add('selected');
  option.setAttribute('data-value', value);
}

function confirmAppointment() {
  if (!activeBookingDoctor) return;

  const dateVal = document.getElementById('booking-date').value;
  const selectedSlotEl = document.querySelector('.slot-chip.selected');
  const selectedMethodEl = document.querySelector('.method-option.selected');

  if (!dateVal) {
    alert('Please choose a consultation date.');
    return;
  }
  if (!selectedSlotEl) {
    alert('Please pick an appointment slot.');
    return;
  }
  if (!selectedMethodEl) {
    alert('Please choose a consultation method.');
    return;
  }

  const slotText = selectedSlotEl.innerText;
  const methodText = selectedMethodEl.getAttribute('data-value');

  // ✅ CRITICAL FIX: Snapshot the doctor data NOW before closeBookingModal()
  // nullifies activeBookingDoctor. The setTimeout below runs 1500ms later
  // by which point activeBookingDoctor is already null.
  const bookedDoctor = {
    id: activeBookingDoctor.id,
    name: activeBookingDoctor.name,
    specialty: activeBookingDoctor.specialty
  };

  logAgentActivity('Appointment Scheduling Agent', `Validating slot: ${dateVal} at ${slotText} with ${bookedDoctor.name}...`, 'running');

  closeBookingModal(); // safely nullifies activeBookingDoctor — bookedDoctor is unaffected

  setTimeout(() => {
    // Generate new Appointment ID
    const newId = 'apt-' + Math.floor(100 + Math.random() * 900);
    const summary = getCurrentPatientState().intakeSummary.unifiedSummary || `Symptoms: ${getCurrentPatientState().intakeSummary.symptomDescription || 'Not specified'}. Duration: ${getCurrentPatientState().intakeSummary.duration || 'Not specified'}. Pain scale: ${getCurrentPatientState().intakeSummary.severity || 'N/A'}/10.`;

    const newApt = {
      id: newId,
      patientName: state.currentUser || 'Patient (You)',
      specialty: bookedDoctor.specialty,   // ✅ uses local snapshot
      doctorName: bookedDoctor.name,       // ✅ uses local snapshot
      symptomSummary: summary,
      date: dateVal,
      time: slotText,
      method: methodText,
      status: 'Scheduled'
    };

    state.appointments.push(newApt);
    state.selectedAptId = newId; // pre-select this appointment in Doctor Portal

    logAgentActivity('Appointment Scheduling Agent', `Booking confirmed! Appointment ID: ${newId}. Doctor queue updated.`, 'success');

    // Add success message in the intake chat
    getCurrentPatientState().chatHistory.push({
      sender: 'ai',
      text: `🎉 Appointment successfully booked with <strong>${bookedDoctor.name}</strong> on ${dateVal} at ${slotText} (${methodText}). Switch to the Doctor Portal to manage the consultation.`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    renderIntakeChat();
    saveAppState();

    // Switch to Doctor Portal so the user immediately sees their new booking in the queue
    setTimeout(() => {
      switchView('doctor');
    }, 800);

  }, 1500);
}

// --- DOCTOR PORTAL DASHBOARD LOGIC ---
function handleDoctorLoginKeyDown(event) {
  if (event.key === 'Enter') {
    submitDoctorLogin();
  }
}

function submitDoctorLogin() {
  const usernameInput = document.getElementById('doctor-username');
  const passwordInput = document.getElementById('doctor-password');
  const errorMsgEl = document.getElementById('doc-login-error-msg');
  
  if (!usernameInput || !passwordInput || !errorMsgEl) return;

  const username = usernameInput.value.trim().toLowerCase();
  const password = passwordInput.value.trim();

  errorMsgEl.style.display = 'none';

  const doc = MOCK_DOCTORS_DB[username];
  if (doc && doc.password === password) {
    state.currentDoctor = {
      id: doc.id,
      name: doc.name,
      specialty: doc.specialty,
      avatar: doc.avatar
    };
    
    // Preselect first appointment for this doctor if exists
    const docApts = state.appointments.filter(a => a.doctorName === state.currentDoctor.name);
    state.selectedAptId = docApts.length > 0 ? docApts[0].id : null;

    saveAppState();
    renderDoctorPortal();
    
    usernameInput.value = '';
    passwordInput.value = '';
  } else {
    errorMsgEl.innerText = 'Invalid username or password. Try using "helen" or "sarah" with "password123".';
    errorMsgEl.style.display = 'block';
  }
}

function quickDoctorLogin(username) {
  const doc = MOCK_DOCTORS_DB[username];
  if (doc) {
    state.currentDoctor = {
      id: doc.id,
      name: doc.name,
      specialty: doc.specialty,
      avatar: doc.avatar
    };
    // Preselect first appointment for this doctor if exists
    const docApts = state.appointments.filter(a => a.doctorName === state.currentDoctor.name);
    state.selectedAptId = docApts.length > 0 ? docApts[0].id : null;

    saveAppState();
    renderDoctorPortal();
  }
}

function doctorLogout() {
  state.currentDoctor = null;
  saveAppState();
  renderDoctorPortal();
}

function renderDoctorPortal() {
  const loginViewEl = document.getElementById('doctor-login-view');
  const portalContentEl = document.getElementById('doctor-portal-content');

  if (!state.currentDoctor) {
    if (loginViewEl) loginViewEl.style.display = 'flex';
    if (portalContentEl) portalContentEl.style.display = 'none';
    return;
  } else {
    if (loginViewEl) loginViewEl.style.display = 'none';
    if (portalContentEl) portalContentEl.style.display = 'block';

    // Update doctor ribbon
    const displayNameEl = document.getElementById('doctor-display-name');
    const avatarEl = document.getElementById('doctor-avatar-letter');
    if (displayNameEl) displayNameEl.innerText = `${state.currentDoctor.name} (${state.currentDoctor.specialty})`;
    if (avatarEl) avatarEl.innerText = state.currentDoctor.avatar;
  }

  const queueContainer = document.getElementById('doc-appointment-queue');
  if (!queueContainer) return;

  queueContainer.innerHTML = '';

  // Filter appointments for the logged-in doctor
  const doctorApts = state.appointments.filter(a => a.doctorName === state.currentDoctor.name);

  if (doctorApts.length === 0) {
    queueContainer.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--color-text-muted);">No active appointments in your queue.</div>`;
    renderSelectedPatientOverview(null);
    return;
  }

  doctorApts.forEach(apt => {
    const isSelected = apt.id === state.selectedAptId;
    const card = document.createElement('div');
    card.className = `doc-apt-card ${isSelected ? 'selected' : ''}`;
    card.onclick = () => selectDoctorAppointment(apt.id);

    card.innerHTML = `
      <div>
        <div class="apt-pat-name">${apt.patientName}</div>
        <div class="apt-meta"><i class="fa-solid fa-clock"></i> ${apt.date} | ${apt.time}</div>
      </div>
      <div>
        <span class="apt-status ${apt.status.toLowerCase()}">${apt.status}</span>
      </div>
    `;
    queueContainer.appendChild(card);
  });

  // Render details for current active appointment
  const currentApt = doctorApts.find(a => a.id === state.selectedAptId) || doctorApts[0];
  if (currentApt) {
    state.selectedAptId = currentApt.id;
    renderSelectedPatientOverview(currentApt);
  } else {
    renderSelectedPatientOverview(null);
  }
}

function selectDoctorAppointment(id) {
  state.selectedAptId = id;
  saveAppState();
  renderDoctorPortal();
}

function updateAppointmentStatus(id, newStatus) {
  const apt = state.appointments.find(a => a.id === id);
  if (apt) {
    apt.status = newStatus;
    saveAppState();
    renderDoctorPortal();
  }
}

function renderSelectedPatientOverview(apt) {
  const container = document.getElementById('patient-overview-content');
  if (!container) return;

  if (!apt) {
    container.innerHTML = `
      <div class="diag-empty">
        <i class="fa-solid fa-folder-open"></i>
        <p>Select a patient from the queue on the left to view symptom reports and prescribe medications.</p>
      </div>
    `;
    return;
  }

  // Filter active and past prescriptions for this patient
  const activeMeds = state.prescriptions.filter(p => p.patientName === apt.patientName && (p.status || 'active') === 'active');
  const pastMeds = state.prescriptions.filter(p => p.patientName === apt.patientName && p.status === 'past');

  let activeMedsHTML = '';
  if (activeMeds.length > 0) {
    activeMedsHTML = `
      <div style="margin-top: 1rem;">
        <span class="diagnostic-box-title" style="color:var(--accent-cyan); font-size:0.8rem;"><i class="fa-solid fa-pills"></i> Current Active Medications</span>
        <div style="display:flex; flex-direction:column; gap:0.5rem; margin-top:0.5rem;">
          ${activeMeds.map(p => `
            <div style="background:rgba(255,255,255,0.02); padding:0.75rem; border-radius:4px; border:1px solid var(--border-glass);">
              <div style="font-weight:700; font-size:0.9rem;">${p.medName}</div>
              <div style="font-size:0.75rem; color:var(--accent-cyan);">${p.dosage} (${p.duration})</div>
              <div style="font-size:0.7rem; color:var(--color-text-muted); margin-top:0.25rem;">Issued by: ${p.doctorName} on ${p.date}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } else {
    activeMedsHTML = `<div style="font-size:0.8rem; color:var(--color-text-muted); margin-top:0.5rem;"><i class="fa-solid fa-info-circle"></i> No active medications on file.</div>`;
  }

  let pastMedsHTML = '';
  if (pastMeds.length > 0) {
    pastMedsHTML = `
      <div style="margin-top: 1rem; border-top: 1px solid var(--border-glass); padding-top: 1rem;">
        <span class="diagnostic-box-title" style="color:var(--accent-purple); font-size:0.8rem;"><i class="fa-solid fa-history"></i> Prescription History (Past)</span>
        <div style="display:flex; flex-direction:column; gap:0.5rem; margin-top:0.5rem;">
          ${pastMeds.map(p => `
            <div style="background:rgba(255,255,255,0.01); padding:0.75rem; border-radius:4px; border:1px solid var(--border-glass); opacity:0.85;">
              <div style="font-weight:700; font-size:0.9rem; color:var(--color-text-muted);">${p.medName}</div>
              <div style="font-size:0.75rem; color:var(--color-text-muted);">${p.dosage} (${p.duration})</div>
              <div style="font-size:0.7rem; color:var(--color-text-muted); margin-top:0.25rem;">Issued by: ${p.doctorName} on ${p.date}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="diag-details" style="max-height: 520px; overflow-y: auto; padding-right: 0.5rem;">
      <!-- Diagnostic Metadata Strip -->
      <div class="diag-meta-strip">
        <div class="diag-meta-item">Patient: <strong>${apt.patientName}</strong></div>
        <div class="diag-meta-item">ID: <strong>${apt.id}</strong></div>
        <div class="diag-meta-item">Mode: <strong>${apt.method}</strong></div>
      </div>

      <!-- AI Intake Summary Box -->
      <div class="diagnostic-box">
        <div class="diagnostic-box-title">
          <i class="fa-solid fa-clipboard-question"></i> AI-Generated Intake Case
        </div>
        <p style="font-size: 0.9rem; line-height: 1.5; color: var(--color-text-main); margin-bottom: 0.5rem;">
          ${apt.symptomSummary}
        </p>
        <span style="font-size: 0.75rem; color: var(--color-text-muted); display: block; text-align: right;">
          Prepared by Symptom Analysis Agent
        </span>
      </div>

      <!-- Action Panel -->
      <div class="consultation-actions">
        ${apt.status !== 'In-Consultation' && apt.status !== 'Completed' ? `
          <button class="action-btn primary-consult" onclick="updateAppointmentStatus('${apt.id}', 'In-Consultation')">
            <i class="fa-solid fa-play"></i> Start Consultation
          </button>
        ` : ''}
        
        ${apt.status === 'In-Consultation' ? `
          <button class="action-btn success-consult" onclick="updateAppointmentStatus('${apt.id}', 'Completed')">
            <i class="fa-solid fa-circle-check"></i> Mark Consult Completed
          </button>
        ` : ''}
        
        ${apt.status === 'Completed' ? `
          <div style="text-align: center; width: 100%; font-weight:700; color: #22c55e; background: rgba(34, 197, 94, 0.1); padding: 0.5rem; border-radius: 4px;">
            <i class="fa-solid fa-check-double"></i> Consultation Completed
          </div>
        ` : ''}
      </div>

      <!-- Prescribe Form -->
      <div class="presc-form">
        <div class="presc-form-title">
          <span><i class="fa-solid fa-file-medical"></i> Generate Prescription</span>
          <button class="ocr-simulate-btn" onclick="simulateOCRScan()">
            <i class="fa-solid fa-file-invoice"></i> Simulate OCR Scan
          </button>
        </div>
        
        <div class="form-group">
          <label for="form-medname">Medication Name & Strength</label>
          <input type="text" id="form-medname" class="form-input" placeholder="e.g. Lisinopril 10mg">
        </div>

        <div class="form-group-row">
          <div class="form-group">
            <label for="form-dosage">Dosage Directions</label>
            <input type="text" id="form-dosage" class="form-input" placeholder="e.g. 1 tablet daily">
          </div>
          <div class="form-group">
            <label for="form-duration">Duration</label>
            <input type="text" id="form-duration" class="form-input" placeholder="e.g. 30 Days">
          </div>
        </div>

        <div class="form-group">
          <label for="form-notes">Treatment Guidelines & Notes</label>
          <input type="text" id="form-notes" class="form-input" placeholder="e.g. Take with water. Avoid grapefruits.">
        </div>

        <button class="submit-presc-btn" onclick="submitDoctorPrescription()">
          <i class="fa-solid fa-file-signature"></i> Upload Prescription
        </button>

        <!-- Patient Clinical Summary of Medications -->
        <div style="margin-top: 1.5rem; border-top: 1px solid var(--border-glass); padding-top: 1.25rem;">
          <h4 style="font-size: 0.95rem; font-weight:700; margin-bottom:0.75rem;"><i class="fa-solid fa-folder-medical"></i> Patient Medication Profile</h4>
          ${activeMedsHTML}
          ${pastMedsHTML}
        </div>
      </div>
    </div>
  `;
}

// Simulated OCR Prescription Scanner
function simulateOCRScan() {
  const overlay = document.getElementById('ocr-overlay');
  if (!overlay) return;

  overlay.style.display = 'flex';

  setTimeout(() => {
    // Fill form fields
    const nameEl = document.getElementById('form-medname');
    const doseEl = document.getElementById('form-dosage');
    const durEl = document.getElementById('form-duration');
    const notesEl = document.getElementById('form-notes');

    if (nameEl) nameEl.value = MOCK_OCR_DATA.medName;
    if (doseEl) doseEl.value = MOCK_OCR_DATA.dosage;
    if (durEl) durEl.value = MOCK_OCR_DATA.duration;
    if (notesEl) notesEl.value = MOCK_OCR_DATA.notes;

    overlay.style.display = 'none';
  }, 2200);
}

// Doctor submits new prescription
async function submitDoctorPrescription() {
  const apt = state.appointments.find(a => a.id === state.selectedAptId);
  if (!apt) return;

  const medNameVal = document.getElementById('form-medname').value.trim();
  const dosageVal = document.getElementById('form-dosage').value.trim();
  const durationVal = document.getElementById('form-duration').value.trim();
  const notesVal = document.getElementById('form-notes').value.trim();

  if (!medNameVal || !dosageVal) {
    alert('Please enter at least the Medication Name and Dosage directions.');
    return;
  }

  // Get the submit button element
  const submitBtn = document.querySelector('.submit-presc-btn');
  let originalBtnHTML = '';
  if (submitBtn) {
    originalBtnHTML = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Generating AI Explanations...`;
  }

  let aiExplanation;
  try {
    aiExplanation = await callGeminiPrescriptionAgent(medNameVal, dosageVal, durationVal, notesVal);
  } catch (error) {
    console.error('Error generating AI explanation via Gemini API, falling back to mock generator:', error);
    aiExplanation = generateAIExplanationForMed(medNameVal, notesVal);
  }

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnHTML;
  }

  const newPrsc = {
    id: 'prsc-' + Math.floor(500 + Math.random() * 500),
    patientName: apt.patientName,
    doctorName: apt.doctorName,
    date: new Date().toISOString().split('T')[0],
    medName: medNameVal,
    dosage: dosageVal,
    duration: durationVal || 'As directed',
    notes: notesVal || 'Take as directed.',
    status: 'active',
    explanation: aiExplanation,
    isNewForPatient: true // flag to show notification tag in Patient portal
  };

  state.prescriptions.push(newPrsc);

  // Set as active interpreter
  state.activePrescIdInterpreter = newPrsc.id;

  // Mark appointment status as completed automatically
  apt.status = 'Completed';

  saveAppState();
  renderDoctorPortal();

  alert(`Prescription uploaded successfully for ${apt.patientName}! It is now available in the patient's active records.`);
}

// Simple parser to generate explanations based on medication names
function generateAIExplanationForMed(medName, doctorNotes) {
  const name = medName.toLowerCase();
  let purpose = "Prescribed therapeutic medication as scheduled by your doctor.";
  let guidelines = "Follow doctor notes. Take with a full glass of water. Keep consistent schedules.";
  let precautions = "Monitor for side effects. Seek help if rashes, dizziness or shortness of breath occurs.";
  let faqs = [
    { q: 'Can I stop this medication when I feel better?', a: 'Always consult your practitioner before stopping treatment. Ending regimens early can trigger recurrence.' },
    { q: 'What if I miss a dose?', a: 'Take as soon as you remember, unless it is close to your next scheduled slot. Never take double doses.' }
  ];

  if (name.includes('lisinopril') || name.includes('blood pressure')) {
    purpose = "An ACE inhibitor used to lower blood pressure and protect cardiac muscle functions.";
    guidelines = "Take once daily at the same time every morning. Can be taken with or without food.";
    precautions = "Avoid potassium supplements or salt substitutes unless approved. Report throat swelling or persistent dry cough.";
    faqs = [
      { q: 'Why do I have a persistent cough?', a: 'Lisinopril increases chemical compounds in the airways that can cause a dry tickling cough. If troublesome, your doctor can swap medications.' },
      { q: 'Is it safe during pregnancy?', a: 'No, Lisinopril is contraindicated during pregnancy as it can harm the fetus.' }
    ];
  } else if (name.includes('gabapentin') || name.includes('neurontin')) {
    purpose = "An anticonvulsant and analgesic medication used primarily to relieve severe nerve pain.";
    guidelines = "Best taken at evenly spaced intervals (three times daily). Administer with food if it causes stomach upset.";
    precautions = "May cause severe drowsiness. Do not drive or operate machinery until effects are known. Avoid alcohol.";
    faqs = [
      { q: 'Can I take Gabapentin with antacids?', a: 'No. Antacids containing aluminum or magnesium reduce Gabapentin absorption by 20%. Take them at least 2 hours apart.' },
      { q: 'What are withdrawal signs?', a: 'Stopping abruptly can trigger rebound pain or anxiety. Always taper down dosage with doctor guidance.' }
    ];
  } else if (name.includes('atorvastatin') || name.includes('lipitor') || name.includes('cholesterol')) {
    purpose = "A statin drug prescribed to lower blood LDL cholesterol and reduce cardiovascular risks.";
    guidelines = "Take once daily, preferably in the evening. Consistent daily scheduling is important.";
    precautions = "Avoid eating grapefruits or drinking grapefruit juices. Report unexplained muscle aches or fatigue.";
  } else if (name.includes('amoxicillin') || name.includes('antibiotic') || name.includes('penicillin')) {
    purpose = "A penicillin-type antibiotic used to eliminate bacterial infections.";
    guidelines = "Complete the entire course prescribed, even if symptoms clear early. Take with food to reduce stomach cramps.";
    precautions = "May cause mild diarrhea. Check with your doctor if a severe rash or breathing issues develop.";
  }

  if (doctorNotes) {
    guidelines += ` Clinician specifically noted: "${doctorNotes}".`;
  }

  return { purpose, guidelines, precautions, faqs };
}

// --- PATIENT: PRESCRIPTIONS VIEW LOGIC ---
function renderPatientPortal() {
  const loginViewEl = document.getElementById('patient-login-view');
  const portalContentEl = document.getElementById('patient-portal-content');

  if (!state.currentUser) {
    if (loginViewEl) loginViewEl.style.display = 'flex';
    if (portalContentEl) portalContentEl.style.display = 'none';
    return;
  } else {
    if (loginViewEl) loginViewEl.style.display = 'none';
    if (portalContentEl) portalContentEl.style.display = 'block';

    // Update profile ribbon
    const displayNameEl = document.getElementById('patient-display-name');
    const avatarEl = document.getElementById('patient-avatar-letter');
    if (displayNameEl) displayNameEl.innerText = state.currentUser;
    if (avatarEl) avatarEl.innerText = state.currentUser === 'Jane Smith' ? 'JS' : 'DL';
  }

  renderIntakeChat();

  // Clear or render doctor recommendations
  const activePatientState = getCurrentPatientState();
  if (activePatientState.recommendedSpecialty) {
    renderDoctorsRecommendation(activePatientState.recommendedSpecialty);
  } else {
    const recContainer = document.getElementById('recommendation-content');
    if (recContainer) {
      recContainer.innerHTML = `
        <div class="rec-placeholder">
          <i class="fa-solid fa-user-md"></i>
          <p>Type symptoms in the intake chat on the left. The Specialist Routing Agent will analyze and recommend doctors here.</p>
        </div>
      `;
    }
  }

  // Clear or render reasoning logs
  const logContainer = document.getElementById('agent-reasoning-logs');
  if (logContainer) {
    logContainer.innerHTML = '';
    if (activePatientState.reasoningLogs && activePatientState.reasoningLogs.length > 0) {
      activePatientState.reasoningLogs.forEach(log => {
        const line = document.createElement('div');
        line.className = `agent-log-line ${log.lineClass}`;
        line.innerHTML = `${log.icon} <strong>[${log.agentName}]</strong> ${log.text}`;
        logContainer.appendChild(line);
      });
    } else {
      logContainer.innerHTML = `<div class="agent-log-line"><i class="fa-solid fa-spinner fa-spin"></i> Idle. Waiting for patient symptom input...</div>`;
    }
    logContainer.scrollTop = logContainer.scrollHeight;
  }

  const medsContainer = document.getElementById('patient-meds-list');
  if (!medsContainer) return;

  medsContainer.innerHTML = '';

  // Update Tab highlights
  const activeTabBtn = document.getElementById('med-tab-active');
  const pastTabBtn = document.getElementById('med-tab-past');
  const currentTab = state.currentPrescriptionTab || 'active';

  if (activeTabBtn && pastTabBtn) {
    if (currentTab === 'active') {
      activeTabBtn.classList.add('active');
      pastTabBtn.classList.remove('active');
    } else {
      activeTabBtn.classList.remove('active');
      pastTabBtn.classList.add('active');
    }
  }

  // Filter prescriptions for the Patient & current tab status
  const patientMeds = state.prescriptions.filter(
    p => p.patientName === state.currentUser && (p.status || 'active') === currentTab
  );

  if (patientMeds.length === 0) {
    const noMedsMsg = currentTab === 'active' ? 'No active prescriptions.' : 'No past prescriptions.';
    medsContainer.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--color-text-muted);">${noMedsMsg}</div>`;
    renderPrescriptionExplanationPanel(null);
    return;
  }

  patientMeds.forEach(med => {
    const isNew = med.isNewForPatient ? 'new-alert' : '';
    const card = document.createElement('div');
    card.className = `med-card ${isNew}`;
    
    let actionsHTML = `
      <div class="med-card-actions">
        <button class="explain-ai-btn" onclick="selectPrescriptionForAI('${med.id}')">
          <i class="fa-solid fa-wand-magic-sparkles"></i> Explain with AI
        </button>
    `;

    if (currentTab === 'active') {
      actionsHTML += `
        <button class="archive-presc-btn" onclick="archivePrescription('${med.id}')">
          <i class="fa-solid fa-box-archive"></i> Archive to History
        </button>
      `;
    }
    
    actionsHTML += `</div>`;

    card.innerHTML = `
      <h4>${med.medName}</h4>
      <div class="med-dosage"><i class="fa-solid fa-pills"></i> ${med.dosage}</div>
      <div class="med-instructions">Duration: ${med.duration} | Issued by: ${med.doctorName}</div>
      ${actionsHTML}
    `;
    medsContainer.appendChild(card);
  });

  const currentMed = patientMeds.find(p => p.id === state.activePrescIdInterpreter) || patientMeds[0];
  if (currentMed) {
    state.activePrescIdInterpreter = currentMed.id;
    renderPrescriptionExplanationPanel(currentMed);
  } else {
    renderPrescriptionExplanationPanel(null);
  }
}

function selectPrescriptionForAI(id) {
  state.activePrescIdInterpreter = id;

  // Clear "New" flag when explained
  const med = state.prescriptions.find(m => m.id === id);
  if (med && med.isNewForPatient) {
    delete med.isNewForPatient;
  }

  saveAppState();
  renderPatientPortal();
}

function switchPrescriptionTab(tabName) {
  state.currentPrescriptionTab = tabName;
  saveAppState();
  renderPatientPortal();
}

function archivePrescription(prescId) {
  const med = state.prescriptions.find(p => p.id === prescId);
  if (med) {
    med.status = 'past';
    // If this is the active interpreter, update it to the first available active medication
    if (state.activePrescIdInterpreter === prescId) {
      const remainingActive = state.prescriptions.filter(p => p.patientName === state.currentUser && (p.status || 'active') === 'active');
      state.activePrescIdInterpreter = remainingActive.length > 0 ? remainingActive[0].id : null;
    }
    saveAppState();
    renderPatientPortal();
    alert(`${med.medName} has been archived to your prescription history.`);
  }
}

function renderPrescriptionExplanationPanel(med) {
  const container = document.getElementById('prescription-interpreter-panel');
  if (!container) return;

  if (!med) {
    container.innerHTML = `
      <div class="explain-empty">
        <i class="fa-solid fa-wand-magic-sparkles"></i>
        <p>Click "Explain with AI" on any active prescription to receive custom guidelines and ask follow-up questions.</p>
      </div>
    `;
    return;
  }

  // Initialise chat list for this prescription if empty
  if (!state.followupChatHistory[med.id]) {
    state.followupChatHistory[med.id] = [
      { sender: 'ai', text: `Hi! I am your Follow-Up Assistant. I have read the pharmacological details for **${med.medName}** prescribed by **${med.doctorName}**. You can ask me questions about dosage timings, missed pills, or dietary guidelines here.` }
    ];
  }

  const chats = state.followupChatHistory[med.id];
  const chatMessagesHTML = chats.map(msg => `
    <div class="message ${msg.sender}">
      <span class="message-sender">${msg.sender === 'ai' ? 'Follow-up Agent' : 'Patient'}</span>
      <div>${msg.text}</div>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="explanation-card">
      <div class="explanation-header">
        <i class="fa-solid fa-capsules"></i>
        <div>
          <strong style="font-size: 1.15rem; color:#fff;">${med.medName}</strong>
          <div style="font-size: 0.8rem; color:var(--color-text-muted);">Decoded by Prescription Explanation Agent</div>
        </div>
      </div>
      
      <div class="explanation-section">
        <div class="explanation-section-title"><i class="fa-solid fa-notes-medical"></i> Clinical Purpose</div>
        <div class="explanation-section-content">${med.explanation.purpose}</div>
      </div>
      
      <div class="explanation-section">
        <div class="explanation-section-title"><i class="fa-solid fa-clock-rotate-left"></i> How to Take</div>
        <div class="explanation-section-content">${med.explanation.guidelines}</div>
      </div>
      
      <div class="explanation-section">
        <div class="explanation-section-title"><i class="fa-solid fa-triangle-exclamation"></i> Critical Safety Precautions</div>
        <div class="explanation-section-content">${med.explanation.precautions}</div>
      </div>
      
      <!-- Follow up interaction sub-area -->
      <div class="follow-up-chat">
        <div class="follow-up-chat-title">
          <i class="fa-solid fa-comments"></i> Ask Agent Follow-Up Questions
        </div>
        <div class="follow-up-messages" id="follow-up-messages-box">
          ${chatMessagesHTML}
        </div>
        <div class="chat-input-area">
          <input type="text" id="follow-up-input" class="chat-input" placeholder="e.g. Can I take this with milk? What if I miss a dose?" onkeydown="handleFollowupKeyDown(event, '${med.id}')">
          <button class="send-btn" style="width:40px; height:40px;" onclick="sendFollowupMessage('${med.id}')">
            <i class="fa-solid fa-paper-plane" style="font-size:0.9rem;"></i>
          </button>
        </div>
      </div>
    </div>
  `;

  // Scroll follow-up messages
  const chatBox = document.getElementById('follow-up-messages-box');
  if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
}
function handleFollowupKeyDown(event, medId) {
  if (event.key === 'Enter') {
    sendFollowupMessage(medId);
  }
}
async function sendFollowupMessage(medId) {
  const inputEl = document.getElementById('follow-up-input');
  if (!inputEl) return;

  const text = inputEl.value.trim();
  if (!text) return;

  // Add user chat
  state.followupChatHistory[medId].push({ sender: 'user', text: text });
  inputEl.value = '';

  const med = state.prescriptions.find(p => p.id === medId);

  // Show typing indicator in the follow-up messages box
  const chatBox = document.getElementById('follow-up-messages-box');
  if (chatBox) {
    // Re-render the panel first to show the user's message
    renderPrescriptionExplanationPanel(med);

    // Append a typing bubble
    const typingBubble = document.createElement('div');
    typingBubble.id = 'followup-typing-bubble';
    typingBubble.className = 'message ai';
    typingBubble.innerHTML = `
      <span class="message-sender">Follow-up Agent</span>
      <div style="display: flex; gap: 4px; padding: 4px 0;">
        <span class="status-dot" style="animation-delay: 0.1s;"></span>
        <span class="status-dot" style="animation-delay: 0.2s;"></span>
        <span class="status-dot" style="animation-delay: 0.3s;"></span>
      </div>
    `;
    chatBox.appendChild(typingBubble);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  try {
    // Call Gemini API
    const reply = await callGeminiFollowupAgent(
      med.medName,
      med.dosage,
      med.duration,
      med.notes,
      state.followupChatHistory[medId]
    );

    // Remove typing bubble
    const bubble = document.getElementById('followup-typing-bubble');
    if (bubble) bubble.remove();

    state.followupChatHistory[medId].push({ sender: 'ai', text: reply });
    saveAppState();
    renderPrescriptionExplanationPanel(med);

  } catch (error) {
    console.error('Error in follow-up agent:', error);

    // Remove typing bubble
    const bubble = document.getElementById('followup-typing-bubble');
    if (bubble) bubble.remove();

    // Offline fallback simulation
    let reply = `Checking details for ${med.medName}... Make sure to keep consistent timetables. If you experience severe symptoms, report immediately to Dr. ${med.doctorName}.`;

    const userQuery = text.toLowerCase();
    if (userQuery.includes('miss') || userQuery.includes('forget') || userQuery.includes('skipped')) {
      const customFAQ = med.explanation.faqs ? med.explanation.faqs.find(f => f.q.toLowerCase().includes('miss')) : null;
      reply = customFAQ ? customFAQ.a : "If you miss a dose, take it as soon as you remember. However, if it is nearly time for your next capsule, skip it and continue your normal schedule. Never double dose.";
    } else if (userQuery.includes('food') || userQuery.includes('eat') || userQuery.includes('grapefruit') || userQuery.includes('milk')) {
      const customFAQ = med.explanation.faqs ? med.explanation.faqs.find(f => f.q.toLowerCase().includes('grapefruit')) : null;
      if (customFAQ) {
        reply = customFAQ.a;
      } else {
        reply = `For ${med.medName}, taking it with food can help reduce stomach sensitivities. Ensure you avoid alcohol as it interacts negatively with the central nervous system.`;
      }
    } else if (userQuery.includes('alcohol') || userQuery.includes('drink')) {
      reply = `It is highly advised to avoid alcoholic beverages while taking ${med.medName}. Combining them can exacerbate common side effects like sudden dizziness, drowsiness, or slow breathing.`;
    } else if (userQuery.includes('exercise') || userQuery.includes('work out') || userQuery.includes('driving')) {
      reply = `Since ${med.medName} might trigger moderate sleepiness, avoid driving, operating machinery, or performing high-alert fitness regimes until you know exactly how it affects your focus.`;
    }

    state.followupChatHistory[medId].push({ sender: 'ai', text: reply });
    saveAppState();
    renderPrescriptionExplanationPanel(med);
  }
}

// --- APP INITIALISATION ---
document.addEventListener('DOMContentLoaded', () => {
  loadAppState();

  // Determine starting view
  const hash = window.location.hash.replace('#', '');
  if (['home', 'patient', 'doctor', 'architecture'].includes(hash)) {
    switchView(hash);
  } else {
    switchView('home');
  }
});
