// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBGN_wcJR7xyTssEnZPUNlsyoPf3UXOokQ",
  authDomain: "wedding-planner-6646f.firebaseapp.com",
  databaseURL: "https://wedding-planner-6646f-default-rtdb.firebaseio.com",
  projectId: "wedding-planner-6646f",
  storageBucket: "",
  messagingSenderId: "922613052296",
  appId: "1:922613052296:web:6036abec7044428401c03d"
};

// Initialize Firebase
let database, auth;
try {
  firebase.initializeApp(firebaseConfig);
  database = firebase.database();
  auth = firebase.auth();
} catch (error) {
  console.error("Firebase initialization failed:", error);
  document.getElementById('loadingScreen').innerHTML = `
    <div class="error-message">
      <h2>Initialization Error</h2>
      <p>Failed to connect to the server. Please refresh the page.</p>
      <button onclick="window.location.reload()">Refresh</button>
    </div>
  `;
}

// ImgBB Configuration
const IMGBB_API_KEY = '8b6790dd905e9426a5d92665c9e012f2';
let selectedFile = null;

// DOM Elements
const loadingScreen = document.getElementById('loadingScreen');
const notification = document.getElementById('notification');
const userForm = document.getElementById('userForm');
const yourNameInput = document.getElementById('yourName');
const partnerNameInput = document.getElementById('partnerName');
const weddingYearInput = document.getElementById('weddingYear');
const weddingMonthInput = document.getElementById('weddingMonth');
const weddingDayInput = document.getElementById('weddingDay');
const yourNameDisplay = document.getElementById('yourNameDisplay');
const partnerNameDisplay = document.getElementById('partnerNameDisplay');
const weddingDateDisplay = document.getElementById('weddingDateDisplay');
const countdownElement = document.getElementById('countdown');
const uploadBtn = document.getElementById('upload-btn');

// Global variables
let weddingData = {};
let tasks = [];
let expenses = [];
let guestList = [];
let events = [];
let moodboardImages = [];
let userId = null;
let partnerId = null;
let coupleId = null;
let loadingTimeout = null;

// Debug helper
function debugLog(...args) {
  console.log('[DEBUG]', ...args);
}

// Initialize the app
async function initApp() {
  showLoading();
  debugLog("App initialization started");
  
  // Set timeout safeguard
  loadingTimeout = setTimeout(() => {
    showNotification("Taking longer than expected to load...", 'warning');
    debugLog("Loading timeout reached");
  }, 5000);

  try {
    // Initialize file upload listener
    document.getElementById('image-upload').addEventListener('change', handleFileSelect);
    uploadBtn.addEventListener('click', uploadImage);

    // Try to authenticate anonymously
    debugLog("Attempting anonymous auth");
    const authResult = await auth.signInAnonymously();
    userId = authResult.user.uid;
    debugLog("Authenticated with UID:", userId);
    
    // Check if there's a couple ID in the URL
    const urlParams = new URLSearchParams(window.location.search);
    coupleId = urlParams.get('coupleId');
    debugLog("Couple ID from URL:", coupleId);
    
    if (coupleId) {
      debugLog("Joining existing couple");
      await joinCouple(coupleId);
    } else {
      debugLog("Checking for existing data");
      await checkForExistingData();
    }
  } catch (error) {
    console.error("Initialization error:", error);
    showNotification("Failed to initialize app. Please refresh.", 'error');
    clearTimeout(loadingTimeout);
    hideLoadingScreen();
  }
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  
  if (file) {
    if (!file.type.match('image.*')) {
      showNotification('Please select an image file (JPEG, PNG, etc.)', 'error');
      return;
    }
    
    if (file.size > 32 * 1024 * 1024) {
      showNotification('Image must be smaller than 32MB', 'error');
      return;
    }
    
    selectedFile = file;
    uploadBtn.disabled = false;
    showNotification(`Ready to upload: ${file.name}`, 'success');
  } else {
    selectedFile = null;
    uploadBtn.disabled = true;
  }
}

async function checkForExistingData() {
  try {
    debugLog("Checking for existing user data");
    const snapshot = await database.ref(`users/${userId}`).once('value');
    
    if (snapshot.exists()) {
      coupleId = snapshot.val().coupleId;
      debugLog("Found existing coupleId:", coupleId);
      await loadCoupleData();
    } else {
      debugLog("No existing data found - showing form");
      clearTimeout(loadingTimeout);
      hideLoadingScreen();
    }
  } catch (error) {
    console.error("Error checking for existing data:", error);
    showNotification("Error loading your data", 'error');
    clearTimeout(loadingTimeout);
    hideLoadingScreen();
  }
}

async function joinCouple(coupleId) {
  try {
    debugLog("Joining couple:", coupleId);
    const snapshot = await database.ref(`couples/${coupleId}/partners`).once('value');
    const partners = snapshot.val() || [];
    
    if (partners.includes(userId)) {
      debugLog("User already in couple - loading data");
      await loadCoupleData();
    } else if (partners.length < 2) {
      debugLog("Adding user to couple");
      const updatedPartners = [...partners, userId];
      await database.ref(`couples/${coupleId}/partners`).set(updatedPartners);
      await database.ref(`users/${userId}`).set({ coupleId });
      await loadCoupleData();
    } else {
      showNotification("This wedding already has two partners linked.", 'error');
      window.location.href = window.location.pathname;
    }
  } catch (error) {
    console.error("Error joining couple:", error);
    showNotification("Failed to join wedding data", 'error');
    clearTimeout(loadingTimeout);
    hideLoadingScreen();
  }
}

async function loadCoupleData() {
  try {
    debugLog("Loading couple data for:", coupleId);
    const snapshot = await database.ref(`couples/${coupleId}`).once('value');
    const data = snapshot.val();
    
    if (!data) {
      debugLog("No data found for couple");
      showNotification("No wedding data found", 'error');
      clearTimeout(loadingTimeout);
      hideLoadingScreen();
      return;
    }
    
    weddingData = data.weddingData || {};
    tasks = data.tasks || [];
    expenses = data.expenses || [];
    guestList = data.guestList || [];
    events = data.events || [];
    moodboardImages = data.moodboard || [];
    
    debugLog("Data loaded successfully");
    updateUI();
    clearTimeout(loadingTimeout);
    hideLoadingScreen();
    
    const partners = data.partners || [];
    partnerId = partners.find(id => id !== userId);
    
    // Set up realtime listener after initial load
    database.ref(`couples/${coupleId}`).on('value', (snapshot) => {
      debugLog("Realtime update received");
      const updatedData = snapshot.val();
      if (updatedData) {
        // Update local data if needed
        if (updatedData.weddingData) weddingData = updatedData.weddingData;
        if (updatedData.tasks) tasks = updatedData.tasks;
        if (updatedData.expenses) expenses = updatedData.expenses;
        if (updatedData.guestList) guestList = updatedData.guestList;
        if (updatedData.events) events = updatedData.events;
        if (updatedData.moodboard) moodboardImages = updatedData.moodboard;
        
        updateUI();
      }
    });
    
  } catch (error) {
    console.error("Error loading couple data:", error);
    showNotification("Failed to load wedding data", 'error');
    clearTimeout(loadingTimeout);
    hideLoadingScreen();
  }
}

function updateUI() {
  debugLog("Updating UI with current data");
  
  // Update header
  if (weddingData.yourName) {
    yourNameDisplay.textContent = weddingData.yourName;
    yourNameInput.value = weddingData.yourName;
  }
  
  if (weddingData.partnerName) {
    partnerNameDisplay.textContent = weddingData.partnerName;
    partnerNameInput.value = weddingData.partnerName;
  }
  
  if (weddingData.weddingYear && weddingData.weddingMonth && weddingData.weddingDay) {
    weddingYearInput.value = weddingData.weddingYear;
    weddingMonthInput.value = weddingData.weddingMonth;
    weddingDayInput.value = weddingData.weddingDay;
    
    const weddingDate = new Date(
      parseInt(weddingData.weddingYear),
      getMonthIndex(weddingData.weddingMonth),
      parseInt(weddingData.weddingDay)
    );
    
    weddingDateDisplay.textContent = weddingDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    updateCountdown(weddingDate);
  }
  
  // Render all sections
  renderTasks();
  renderExpenses();
  renderGuestList();
  renderTimeline();
  renderMoodBoard();
}

function getMonthIndex(monthName) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months.indexOf(monthName);
}

function updateCountdown(weddingDate) {
  const now = new Date();
  const diff = weddingDate - now;
  
  if (diff <= 0) {
    countdownElement.innerHTML = '<div class="countdown-item"><div class="countdown-number">🎉</div><div class="countdown-label">Wedding Day!</div></div>';
    return;
  }
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  countdownElement.innerHTML = `
    <div class="countdown-item">
      <div class="countdown-number">${days}</div>
      <div class="countdown-label">Days</div>
    </div>
    <div class="countdown-item">
      <div class="countdown-number">${hours}</div>
      <div class="countdown-label">Hours</div>
    </div>
    <div class="countdown-item">
      <div class="countdown-number">${minutes}</div>
      <div class="countdown-label">Minutes</div>
    </div>
    <div class="countdown-item">
      <div class="countdown-number">${seconds}</div>
      <div class="countdown-label">Seconds</div>
    </div>
  `;
  
  setTimeout(() => updateCountdown(weddingDate), 1000);
}
// Save wedding details
userForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const yourName = yourNameInput.value.trim();
  const partnerName = partnerNameInput.value.trim();
  const weddingYear = weddingYearInput.value.trim();
  const weddingMonth = weddingMonthInput.value.trim();
  const weddingDay = weddingDayInput.value.trim();
  
  if (!yourName || !partnerName || !weddingYear || !weddingMonth || !weddingDay) {
    showNotification('Please fill in all fields', 'error');
    return;
  }
  
  weddingData = {
    yourName,
    partnerName,
    weddingYear,
    weddingMonth,
    weddingDay
  };
  
  try {
    // If this is a new couple, create the couple record
    if (!coupleId) {
      coupleId = database.ref().child('couples').push().key;
      await database.ref(`couples/${coupleId}`).set({
        partners: [userId],
        weddingData,
        tasks: [],
        expenses: [],
        guestList: [],
        events: [],
        moodboard: []
      });
      
      // Save couple ID to user's record
      await database.ref(`users/${userId}`).set({ coupleId });
      
      // Generate shareable link
      const shareLink = `${window.location.origin}${window.location.pathname}?coupleId=${coupleId}`;
      showNotification(`Wedding details saved! Share this link with your partner: ${shareLink}`, 'success');
      
      // Update UI
      updateUI();
    } else {
      // Update existing couple data
      await database.ref(`couples/${coupleId}/weddingData`).set(weddingData);
      showNotification('Wedding details updated!', 'success');
      updateUI();
    }
  } catch (error) {
    console.error("Error saving wedding details:", error);
    showNotification("Failed to save wedding details", 'error');
  }
});

// Tasks functions
function addTask() {
  const taskInput = document.getElementById('task');
  const task = taskInput.value.trim();
  
  if (!task) {
    showNotification('Please enter a task', 'warning');
    return;
  }
  
  tasks.push({
    id: Date.now().toString(),
    text: task,
    completed: false,
    createdAt: new Date().toISOString()
  });
  
  saveTasks();
  taskInput.value = '';
}

async function saveTasks() {
  if (!coupleId) return;
  
  try {
    await database.ref(`couples/${coupleId}/tasks`).set(tasks);
    renderTasks();
  } catch (error) {
    console.error("Error saving tasks:", error);
    showNotification("Failed to save tasks", 'error');
  }
}

function renderTasks() {
  const list = document.getElementById('task-list');
  const progressBar = document.getElementById('checklistProgress');
  const progressText = document.getElementById('progressText');
  
  list.innerHTML = '';
  
  if (tasks.length === 0) {
    list.innerHTML = '<li class="empty">No tasks yet. Add your first task!</li>';
    progressBar.innerHTML = '<div style="width: 0%"></div>';
    progressText.textContent = '0% Complete';
    return;
  }
  
  const completedCount = tasks.filter(task => task.completed).length;
  const progressPercent = Math.round((completedCount / tasks.length) * 100);
  
  progressBar.innerHTML = `<div style="width: ${progressPercent}%"></div>`;
  progressText.textContent = `${progressPercent}% Complete`;
  
  tasks.forEach(task => {
    const li = document.createElement('li');
    li.className = task.completed ? 'completed' : '';
    li.innerHTML = `
      <div class="task-content">
        <input type="checkbox" ${task.completed ? 'checked' : ''} 
               onchange="toggleTaskCompletion('${task.id}', this.checked)">
        <span>${task.text}</span>
      </div>
      <div class="actions">
        <button onclick="deleteTask('${task.id}')"><i class="fas fa-trash"></i></button>
      </div>
    `;
    list.appendChild(li);
  });
}

function toggleTaskCompletion(taskId, completed) {
  const task = tasks.find(t => t.id === taskId);
  if (task) {
    task.completed = completed;
    saveTasks();
  }
}

async function deleteTask(taskId) {
  tasks = tasks.filter(task => task.id !== taskId);
  await saveTasks();
}

// Budget functions
function addExpense() {
  const name = document.getElementById('expense-name').value.trim();
  const amount = parseFloat(document.getElementById('expense-amount').value);
  
  if (!name || isNaN(amount) || amount <= 0) {
    showNotification('Please enter a valid expense name and amount', 'error');
    return;
  }
  
  expenses.push({
    id: Date.now().toString(),
    name,
    amount,
    date: new Date().toISOString()
  });
  
  saveExpenses();
  document.getElementById('expense-name').value = '';
  document.getElementById('expense-amount').value = '';
}

async function saveExpenses() {
  if (!coupleId) return;
  
  try {
    await database.ref(`couples/${coupleId}/expenses`).set(expenses);
    renderExpenses();
  } catch (error) {
    console.error("Error saving expenses:", error);
    showNotification("Failed to save expenses", 'error');
  }
}

function renderExpenses() {
  const list = document.getElementById('expense-list');
  const totalBudget = document.getElementById('total-budget');
  const totalSpent = document.getElementById('total-spent');
  const remainingBudget = document.getElementById('remaining-budget');
  
  list.innerHTML = '';
  
  if (expenses.length === 0) {
    list.innerHTML = '<li class="empty">No expenses yet. Add your first expense!</li>';
    totalBudget.textContent = '0';
    totalSpent.textContent = '0';
    remainingBudget.textContent = '0';
    return;
  }
  
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  totalSpent.textContent = total.toFixed(2);
  
  // For demo purposes, we'll set a sample budget
  const budget = 15000;
  totalBudget.textContent = budget.toFixed(2);
  remainingBudget.textContent = (budget - total).toFixed(2);
  
  expenses.forEach(expense => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="expense-content">
        <span class="expense-name">${expense.name}</span>
        <span class="expense-amount">$${expense.amount.toFixed(2)}</span>
      </div>
      <div class="actions">
        <button onclick="deleteExpense('${expense.id}')"><i class="fas fa-trash"></i></button>
      </div>
    `;
    list.appendChild(li);
  });
}

async function deleteExpense(expenseId) {
  expenses = expenses.filter(expense => expense.id !== expenseId);
  await saveExpenses();
}

// Guest list functions
function addGuest() {
  const name = document.getElementById('guest-name').value.trim();
  const contact = document.getElementById('guest-contact').value.trim();
  const rsvp = document.getElementById('guest-rsvp').value;
  
  if (!name || !contact) {
    showNotification('Please enter guest name and contact information', 'error');
    return;
  }
  
  guestList.push({
    id: Date.now().toString(),
    name,
    contact,
    rsvp,
    addedBy: userId
  });
  
  saveGuestList();
  document.getElementById('guest-name').value = '';
  document.getElementById('guest-contact').value = '';
}

async function saveGuestList() {
  if (!coupleId) return;
  
  try {
    await database.ref(`couples/${coupleId}/guestList`).set(guestList);
    renderGuestList();
  } catch (error) {
    console.error("Error saving guest list:", error);
    showNotification("Failed to save guest list", 'error');
  }
}

function renderGuestList() {
  const list = document.getElementById('guest-list');
  const totalGuests = document.getElementById('total-guests');
  const acceptedGuests = document.getElementById('accepted-guests');
  const declinedGuests = document.getElementById('declined-guests');
  const pendingGuests = document.getElementById('pending-guests');
  
  list.innerHTML = '';
  
  if (guestList.length === 0) {
    list.innerHTML = '<li class="empty">No guests yet. Add your first guest!</li>';
    totalGuests.textContent = '0';
    acceptedGuests.textContent = '0';
    declinedGuests.textContent = '0';
    pendingGuests.textContent = '0';
    return;
  }
  
  const accepted = guestList.filter(guest => guest.rsvp === 'Accepted').length;
  const declined = guestList.filter(guest => guest.rsvp === 'Declined').length;
  const pending = guestList.filter(guest => guest.rsvp === 'Pending').length;
  
  totalGuests.textContent = guestList.length;
  acceptedGuests.textContent = accepted;
  declinedGuests.textContent = declined;
  pendingGuests.textContent = pending;
  
  guestList.forEach(guest => {
    const li = document.createElement('li');
    li.className = guest.rsvp.toLowerCase();
    li.innerHTML = `
      <div class="guest-content">
        <span class="guest-name">${guest.name}</span>
        <span class="guest-contact">${guest.contact}</span>
        <select class="rsvp-select" onchange="updateGuestRSVP('${guest.id}', this.value)">
          <option value="Pending" ${guest.rsvp === 'Pending' ? 'selected' : ''}>Pending</option>
          <option value="Accepted" ${guest.rsvp === 'Accepted' ? 'selected' : ''}>Accepted</option>
          <option value="Declined" ${guest.rsvp === 'Declined' ? 'selected' : ''}>Declined</option>
        </select>
      </div>
      <div class="actions">
        <button onclick="deleteGuest('${guest.id}')"><i class="fas fa-trash"></i></button>
      </div>
    `;
    list.appendChild(li);
  });
}

async function updateGuestRSVP(guestId, rsvp) {
  const guest = guestList.find(g => g.id === guestId);
  if (guest) {
    guest.rsvp = rsvp;
    await saveGuestList();
  }
}

async function deleteGuest(guestId) {
  guestList = guestList.filter(guest => guest.id !== guestId);
  await saveGuestList();
}

// Timeline functions
function addEvent() {
  const title = document.getElementById('event-title').value.trim();
  const time = document.getElementById('event-time').value;
  
  if (!title || !time) {
    showNotification('Please enter event title and time', 'error');
    return;
  }
  
  events.push({
    id: Date.now().toString(),
    title,
    time,
    addedBy: userId
  });
  
  saveEvents();
  document.getElementById('event-title').value = '';
  document.getElementById('event-time').value = '';
}

async function saveEvents() {
  if (!coupleId) return;
  
  try {
    await database.ref(`couples/${coupleId}/events`).set(events);
    renderTimeline();
  } catch (error) {
    console.error("Error saving events:", error);
    showNotification("Failed to save events", 'error');
  }
}

function renderTimeline() {
  const timeline = document.getElementById('timeline-list');
  timeline.innerHTML = '';
  
  if (events.length === 0) {
    timeline.innerHTML = '<div class="empty">No events yet. Add your first event!</div>';
    return;
  }
  
  // Sort events by time
  events.sort((a, b) => new Date(a.time) - new Date(b.time));
  
  events.forEach(event => {
    const eventElement = document.createElement('div');
    eventElement.className = 'timeline-item';
    
    const date = new Date(event.time);
    const formattedDate = date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    eventElement.innerHTML = `
      <div class="timeline-date">${formattedDate}</div>
      <div class="timeline-title">${event.title}</div>
      <div class="actions">
        <button onclick="deleteEvent('${event.id}')"><i class="fas fa-trash"></i></button>
      </div>
    `;
    
    timeline.appendChild(eventElement);
  });
}

async function deleteEvent(eventId) {
  events = events.filter(event => event.id !== eventId);
  await saveEvents();
}

// Mood Board functions with ImgBB
function uploadImage() {
  if (!selectedFile) {
    showNotification('No image selected', 'error');
    return;
  }

  showLoading();
  const progressElement = document.getElementById('upload-progress');
  progressElement.innerHTML = `
    <div class="upload-progress-bar">
      <div class="progress-fill" style="width: 0%"></div>
    </div>
    <div class="upload-status">Uploading: 0%</div>
  `;

  const formData = new FormData();
  formData.append('image', selectedFile);

  const xhr = new XMLHttpRequest();
  xhr.open('POST', `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`);

  xhr.upload.onprogress = function(e) {
    if (e.lengthComputable) {
      const progress = (e.loaded / e.total) * 100;
      document.querySelector('.progress-fill').style.width = `${progress}%`;
      document.querySelector('.upload-status').textContent = `Uploading: ${Math.round(progress)}%`;
    }
  };

  xhr.onload = function() {
    if (xhr.status === 200) {
      const response = JSON.parse(xhr.responseText);
      if (response.success) {
        addImageToMoodBoard(response.data.url);
        saveImageToDatabase(response.data.url);
        progressElement.innerHTML = `
          <div class="upload-success">
            <i class="fas fa-check-circle"></i> Upload successful!
          </div>
        `;
      } else {
        throw new Error(response.error.message || 'Upload failed');
      }
    } else {
      throw new Error('Upload failed');
    }
    hideLoading();
  };

  xhr.onerror = function() {
    progressElement.innerHTML = `
      <div class="upload-error">
        <i class="fas fa-times-circle"></i> Upload failed
      </div>
    `;
    showNotification('Image upload failed. Please try again.', 'error');
    hideLoading();
  };

  xhr.send(formData);
}

function addImageToMoodBoard(imageUrl) {
  const gallery = document.getElementById('moodboard-gallery');
  const imgItem = document.createElement('div');
  imgItem.className = 'moodboard-item';
  
  imgItem.innerHTML = `
    <img src="${imageUrl}" alt="Wedding inspiration" loading="lazy" />
    <div class="image-actions">
      <button class="download-btn" onclick="downloadImage('${imageUrl}')">
        <i class="fas fa-download"></i>
      </button>
      <button class="delete-btn" onclick="removeImage(this, '${imageUrl}')">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `;
  
  gallery.prepend(imgItem);
  document.getElementById('image-upload').value = '';
  selectedFile = null;
  uploadBtn.disabled = true;
}

async function saveImageToDatabase(imageUrl) {
  if (!coupleId) return;
  
  try {
    await database.ref(`couples/${coupleId}/moodboard`).push().set({
      url: imageUrl,
      timestamp: new Date().toISOString(),
      uploadedBy: userId
    });
  } catch (error) {
    console.error("Error saving image:", error);
    showNotification("Failed to save image", 'error');
  }
}

function renderMoodBoard() {
  const gallery = document.getElementById('moodboard-gallery');
  gallery.innerHTML = '';
  
  if (moodboardImages.length === 0) {
    gallery.innerHTML = '<div class="empty-moodboard">Add your first inspiration image!</div>';
    return;
  }
  
  moodboardImages.forEach(image => {
    addImageToMoodBoard(image.url);
  });
}

async function removeImage(button, imageUrl) {
  const imgItem = button.closest('.moodboard-item');
  imgItem.classList.add('removing');
  
  setTimeout(() => {
    imgItem.remove();
    // Remove from database
    if (coupleId) {
      database.ref(`couples/${coupleId}/moodboard`).once('value', snapshot => {
        snapshot.forEach(child => {
          if (child.val().url === imageUrl) {
            database.ref(`couples/${coupleId}/moodboard/${child.key}`).remove();
          }
        });
      });
    }
  }, 300);
}

function downloadImage(imageUrl) {
  const link = document.createElement('a');
  link.href = imageUrl;
  link.download = `wedding-inspiration-${Date.now()}.jpg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function openPinterest() {
  window.open('https://www.pinterest.com/search/pins/?q=wedding%20ideas', '_blank');
}

// Question tabs
function openTab(tabId) {
  // Hide all tab contents
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.style.display = 'none';
  });
  
  // Remove active class from all buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Show the selected tab and mark button as active
  document.getElementById(tabId).style.display = 'block';
  event.currentTarget.classList.add('active');
}

// Notification function
function showNotification(message, type = 'success') {
  notification.textContent = message;
  notification.className = 'notification';
  
  if (type === 'error') {
    notification.style.backgroundColor = 'var(--danger-color)';
  } else if (type === 'warning') {
    notification.style.backgroundColor = 'var(--warning-color)';
  } else {
    notification.style.backgroundColor = 'var(--success-color)';
  }
  
  notification.classList.add('show');
  
  setTimeout(() => {
    notification.classList.remove('show');
  }, 5000);
}

function showLoading() {
  loadingScreen.style.display = 'flex';
  setTimeout(() => loadingScreen.style.opacity = '1', 10);
}

function hideLoading() {
  loadingScreen.style.opacity = '0';
  setTimeout(() => {
    loadingScreen.style.display = 'none';
  }, 500);
}

// Debug function to manually hide loading screen
window.forceHideLoading = function() {
  console.warn("Manually hiding loading screen");
  clearTimeout(loadingTimeout);
  hideLoading();
};


// Smooth scrolling for navigation
document.querySelectorAll('nav a').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    
    // Remove active class from all nav items
    document.querySelectorAll('nav a').forEach(item => {
      item.classList.remove('active');
    });
    
    // Add active class to clicked item
    this.classList.add('active');
    
    // Scroll to section
    const targetId = this.getAttribute('href');
    document.querySelector(targetId).scrollIntoView({
      behavior: 'smooth'
    });
  });
});

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);
