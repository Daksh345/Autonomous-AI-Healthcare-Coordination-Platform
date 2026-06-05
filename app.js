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
  General: [
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
const STATE_VERSION = 2;

let state = {
  version: STATE_VERSION,
  appointments: [],
  prescriptions: [],
  selectedAptId: null,
  intakeStage: 0,
  intakeSummary: {
    symptomDescription: '',
    duration: '',
    severity: ''
  },
  activePrescIdInterpreter: null,
  chatHistory: [],
  followupChatHistory: {} // mapped by prescId -> list of messages
};

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
  state.appointments = [...DEFAULT_APPOINTMENTS];
  state.prescriptions = [...DEFAULT_PRESCRIPTIONS];
  state.selectedAptId = state.appointments[0].id;
  state.intakeStage = 0;
  state.intakeSummary = { symptomDescription: '', duration: '', severity: '' };
  state.activePrescIdInterpreter = state.prescriptions[0] ? state.prescriptions[0].id : null;
  state.chatHistory = [
    { sender: 'ai', text: 'Hello! I am the Symptom Analysis Agent. Please describe what symptoms you are experiencing today in detail.', time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }
  ];
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
  state.chatHistory.push({ sender: 'user', text: text, time: time });
  inputEl.value = '';
  renderIntakeChat();

  // 2. Advance Dialog Tree
  processIntakeResponse(text);
}

function processIntakeResponse(text) {
  // Show thinking indicator in chat
  setTimeout(() => {
    // Show AI typing indicator
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
    document.getElementById('intake-chat-messages').appendChild(typingBubble);
    const msgsContainer = document.getElementById('intake-chat-messages');
    msgsContainer.scrollTop = msgsContainer.scrollHeight;
  }, 300);

  setTimeout(() => {
    // Remove typing indicator
    const bubble = document.getElementById('chat-typing-bubble');
    if (bubble) bubble.remove();

    let reply = '';
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (state.intakeStage === 0) {
      // Input symptoms
      state.intakeSummary.symptomDescription = text;
      state.intakeStage = 1;
      
      logAgentActivity('Symptom Analysis Agent', 'Analyzing description: "' + text + '"...', 'running');
      setTimeout(() => {
        logAgentActivity('Symptom Analysis Agent', 'Semantic descriptors extracted. Requesting onset duration.', 'info');
      }, 800);
      
      reply = "Thank you for describing your symptoms. To help me coordinate effectively, how long have you been experiencing this (e.g., hours, days, weeks)?";
      
    } else if (state.intakeStage === 1) {
      // Input duration
      state.intakeSummary.duration = text;
      state.intakeStage = 2;
      
      logAgentActivity('Symptom Analysis Agent', 'Onset cataloged: ' + text, 'running');
      setTimeout(() => {
        logAgentActivity('Symptom Analysis Agent', 'Probing severity indicators.', 'info');
      }, 600);
      
      reply = "Got it. On a scale of 1 to 10 (where 10 is the worst pain/discomfort you have felt), how would you rate your severity?";
      
    } else if (state.intakeStage === 2) {
      // Input severity
      state.intakeSummary.severity = text;
      state.intakeStage = 3;
      
      logAgentActivity('Symptom Analysis Agent', 'Severity registered: ' + text + '/10. Intake log compiled.', 'success');
      
      // Specialist Routing trigger
      setTimeout(() => {
        logAgentActivity('Specialist Routing Agent', 'Reviewing symptom profile summaries...', 'running');
      }, 1000);
      
      setTimeout(() => {
        const specialty = determineSpecialty(state.intakeSummary.symptomDescription);
        logAgentActivity('Specialist Routing Agent', `Mapping complete. Recommended Specialty: ${specialty}. Routing available specialists...`, 'success');
        
        reply = `Intake complete! The Specialist Routing Agent has reviewed your file and matched your symptoms to <strong>${specialty}</strong>. Please review the recommended doctors on the right and book a time slot.`;
        
        state.chatHistory.push({ sender: 'ai', text: reply, time: time });
        renderIntakeChat();
        
        // Render recommended doctors
        renderDoctorsRecommendation(specialty);
        saveAppState();
      }, 2200);
      
      return; // Handled asynchronously
    } else {
      // Conversation complete, loop back or prompt next steps
      reply = "Your intake is already compiled. Please select a doctor from the recommendations to book your appointment, or click 'Reset App' to start fresh.";
    }

    state.chatHistory.push({ sender: 'ai', text: reply, time: time });
    renderIntakeChat();
    saveAppState();
  }, 1800);
}

// Simple rule-based specialty classifier mimicking Specialist Routing Agent
function determineSpecialty(desc) {
  const txt = desc.toLowerCase();
  if (txt.includes('chest') || txt.includes('heart') || txt.includes('breath') || txt.includes('cardiac') || txt.includes('pulse')) {
    return 'Cardiology';
  } else if (txt.includes('head') || txt.includes('migraine') || txt.includes('spine') || txt.includes('brain') || txt.includes('nerve') || txt.includes('dizzy')) {
    return 'Neurology';
  } else if (txt.includes('knee') || txt.includes('joint') || txt.includes('bone') || txt.includes('fracture') || txt.includes('shoulder') || txt.includes('ortho')) {
    return 'Orthopedics';
  } else {
    return 'General';
  }
}

// Render Chat Logs
function renderIntakeChat() {
  const container = document.getElementById('intake-chat-messages');
  if (!container) return;
  
  container.innerHTML = '';
  state.chatHistory.forEach(msg => {
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
  
  const doctors = DOCTORS_DB[specialty] || DOCTORS_DB.General;
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
    const summary = `Symptoms: ${state.intakeSummary.symptomDescription || 'Not specified'}. Duration: ${state.intakeSummary.duration || 'Not specified'}. Pain scale: ${state.intakeSummary.severity || 'N/A'}/10.`;
    
    const newApt = {
      id: newId,
      patientName: 'Patient (You)',
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
    state.chatHistory.push({
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
  renderIntakeChat();
  
  const medsContainer = document.getElementById('patient-meds-list');
  if (!medsContainer) return;
  
  medsContainer.innerHTML = '';
  
  // Filter prescriptions for the Patient
  const patientMeds = state.prescriptions.filter(p => p.patientName === 'Patient (You)' || p.patientName === 'Jane Smith');
  
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
  
  const currentMed = state.prescriptions.find(p => p.id === state.activePrescIdInterpreter) || patientMeds[0];
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
