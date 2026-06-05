// --- Gemini API Configuration ---
const GEMINI_API_KEY = 'AQ.Ab8RN6LUx8N69vO0RmcyKC6S9oDsKCHWmxZNHhIkpm3WDnT7Ug';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY}`;

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

  const response = await fetch(GEMINI_API_URL, {
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
    explanation: {
      purpose: 'An anticonvulsant and analgesic medication used primarily to relieve severe nerve pain.',
      guidelines: 'Best taken at evenly spaced intervals (three times daily). Administer with food if it causes stomach upset.',
      precautions: 'May cause severe drowsiness. Do not drive or operate machinery until effects are known. Avoid alcohol.',
      faqs: [
        { q: 'Can I take Gabapentin with antacids?', a: 'No. Antacids containing aluminum or magnesium reduce Gabapentin absorption by 20%. Take them at least 2 hours apart.' },
        { q: 'What should I do if I miss a dose?', a: 'Take as soon as you remember, unless it is close to your next scheduled slot. Never take double doses.' }
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

// --- App State Management ---
// Bump this version number whenever a breaking change is made to the state shape.
// The app will automatically clear stale localStorage so users never see broken data.
const STATE_VERSION = 3;

let state = {
  version: STATE_VERSION,
  currentUser: null,
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
      ]
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
      ]
    },
    'David Lee': {
      intakeStage: 0,
      intakeSummary: { symptomDescription: '', duration: '', severity: '', unifiedSummary: '' },
      chatHistory: [
        { sender: 'ai', text: 'Hello David Lee! I am the Symptom Analysis Agent. Please describe what symptoms you are experiencing today in detail.', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
      ]
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
    lineClass = '';
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
function renderDoctorPortal() {
  const queueContainer = document.getElementById('doc-appointment-queue');
  if (!queueContainer) return;

  queueContainer.innerHTML = '';

  if (state.appointments.length === 0) {
    queueContainer.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--color-text-muted);">No active appointments.</div>`;
    renderSelectedPatientOverview(null);
    return;
  }

  state.appointments.forEach(apt => {
    const isSelected = apt.id === state.selectedAptId;
    const card = document.createElement('div');
    card.className = `doc-apt-card ${isSelected ? 'selected' : ''}`;
    card.onclick = () => selectDoctorAppointment(apt.id);

    card.innerHTML = `
      <div>
        <div class="apt-pat-name">${apt.patientName}</div>
        <div class="apt-meta"><i class="fa-solid fa-user-md"></i> ${apt.doctorName}</div>
        <div class="apt-meta"><i class="fa-solid fa-clock"></i> ${apt.date} | ${apt.time}</div>
      </div>
      <div>
        <span class="apt-status ${apt.status.toLowerCase()}">${apt.status}</span>
      </div>
    `;
    queueContainer.appendChild(card);
  });

  // Render details for current active appointment
  const currentApt = state.appointments.find(a => a.id === state.selectedAptId) || state.appointments[0];
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

  // Check if there is an active prescription in state for this patient appointment to show prescription notes
  const patientPresc = state.prescriptions.filter(p => p.patientName === apt.patientName);
  let prescHistoryHTML = '';
  if (patientPresc.length > 0) {
    prescHistoryHTML = `
      <div style="margin-top: 1rem; border-top: 1px solid var(--border-glass); padding-top: 1rem;">
        <span class="diagnostic-box-title" style="color:var(--accent-purple); font-size:0.8rem;"><i class="fa-solid fa-history"></i> Prescribed During Visit</span>
        <div style="display:flex; flex-direction:column; gap:0.5rem; margin-top:0.5rem;">
          ${patientPresc.map(p => `
            <div style="background:rgba(255,255,255,0.02); padding:0.75rem; border-radius:4px; border:1px solid var(--border-glass);">
              <div style="font-weight:700; font-size:0.9rem;">${p.medName}</div>
              <div style="font-size:0.75rem; color:var(--accent-cyan);">${p.dosage} (${p.duration})</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="diag-details">
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

        ${prescHistoryHTML}
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
function submitDoctorPrescription() {
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

  // Generate automated AI explanations mimicking Clinical Pharmacologist Agent
  const aiExplanation = generateAIExplanationForMed(medNameVal, notesVal);

  const newPrsc = {
    id: 'prsc-' + Math.floor(500 + Math.random() * 500),
    patientName: apt.patientName,
    doctorName: apt.doctorName,
    date: new Date().toISOString().split('T')[0],
    medName: medNameVal,
    dosage: dosageVal,
    duration: durationVal || 'As directed',
    notes: notesVal || 'Take as directed.',
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

  const medsContainer = document.getElementById('patient-meds-list');
  if (!medsContainer) return;

  medsContainer.innerHTML = '';

  // Filter prescriptions for the Patient
  const patientMeds = state.prescriptions.filter(p => p.patientName === state.currentUser);

  if (patientMeds.length === 0) {
    medsContainer.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--color-text-muted);">No prescriptions on file yet.</div>`;
    renderPrescriptionExplanationPanel(null);
    return;
  }

  patientMeds.forEach(med => {
    const isNew = med.isNewForPatient ? 'new-alert' : '';
    const card = document.createElement('div');
    card.className = `med-card ${isNew}`;
    card.innerHTML = `
      <h4>${med.medName}</h4>
      <div class="med-dosage"><i class="fa-solid fa-pills"></i> ${med.dosage}</div>
      <div class="med-instructions">Duration: ${med.duration} | Issued by: ${med.doctorName}</div>
      <button class="explain-ai-btn" onclick="selectPrescriptionForAI('${med.id}')">
        <i class="fa-solid fa-wand-magic-sparkles"></i> Explain with AI
      </button>
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
function sendFollowupMessage(medId) {
  const inputEl = document.getElementById('follow-up-input');
  if (!inputEl) return;

  const text = inputEl.value.trim();
  if (!text) return;

  // Add user chat
  state.followupChatHistory[medId].push({ sender: 'user', text: text });
  inputEl.value = '';

  // Re-render chat area partially
  renderPrescriptionExplanationPanel(state.prescriptions.find(p => p.id === medId));

  // Simulate Follow-up agent processing
  setTimeout(() => {
    const med = state.prescriptions.find(p => p.id === medId);
    let reply = `Checking details for ${med.medName}... Make sure to keep consistent timetables. If you experience severe symptoms, report immediately to Dr. ${med.doctorName}.`;

    // Dynamic answers checking
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

    // Refresh Panel
    renderPrescriptionExplanationPanel(med);
  }, 1200);
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
