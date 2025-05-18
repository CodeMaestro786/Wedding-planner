// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBGN_wcJR7xyTssEnZPUNlsyoPf3UXOokQ",
  authDomain: "wedding-planner-6646f.firebaseapp.com",
  databaseURL: "https://wedding-planner-6646f-default-rtdb.firebaseio.com/",
  projectId: "wedding-planner-6646f",
  storageBucket: "",
  messagingSenderId: "922613052296",
  appId: "1:922613052296:web:6036abec7044428401c03d"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

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

// Initialize the app
function initApp() {
  // Initialize file upload listener
  document.getElementById('image-upload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    
    if (file) {
      // Validate file type
      if (!file.type.match('image.*')) {
        showNotification('Please select an image file (JPEG, PNG, etc.)', 'error');
        return;
      }
      
      // Validate file size (ImgBB has 32MB limit for free tier)
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
  });

  // Try to authenticate anonymously
  auth.signInAnonymously()
    .then(() => {
      // Check if there's a couple ID in the URL
      const urlParams = new URLSearchParams(window.location.search);
      coupleId = urlParams.get('coupleId');
      
      if (coupleId) {
        // Join existing couple data
        joinCouple(coupleId);
      } else {
        // Create new couple data
        userId = auth.currentUser.uid;
        checkForExistingData();
      }
    })
    .catch(error => {
      console.error("Authentication failed:", error);
      showNotification("Failed to connect. Please refresh the page.", 'error');
    });
}

// Check if user already has data
function checkForExistingData() {
  database.ref(`users/${userId}`).once('value')
    .then(snapshot => {
      if (snapshot.exists()) {
        // User has existing data, load it
        coupleId = snapshot.val().coupleId;
        loadCoupleData();
      } else {
        // New user, show form
        hideLoadingScreen();
      }
    });
}

// Join existing couple data
function joinCouple(coupleId) {
  userId = auth.currentUser.uid;
  
  // Check if this user is already part of the couple
  database.ref(`couples/${coupleId}/partners`).once('value')
    .then(snapshot => {
      const partners = snapshot.val() || [];
      
      if (partners.includes(userId)) {
        // User is already part of this couple
        loadCoupleData();
      } else if (partners.length < 2) {
        // Add user to the couple
        partners.push(userId);
        database.ref(`couples/${coupleId}/partners`).set(partners)
          .then(() => {
            // Save couple ID to user's record
            database.ref(`users/${userId}`).set({ coupleId })
              .then(() => {
                loadCoupleData();
              });
          });
      } else {
        // Couple already has 2 partners
        showNotification("This wedding already has two partners linked.", 'error');
        window.location.href = window.location.pathname; // Remove coupleId from URL
      }
    });
}

// Load couple data
function loadCoupleData() {
  database.ref(`couples/${coupleId}`).on('value', snapshot => {
    const data = snapshot.val();
    if (data) {
      weddingData = data.weddingData || {};
      tasks = data.tasks || [];
      expenses = data.expenses || [];
      guestList = data.guestList || [];
      events = data.events || [];
      moodboardImages = data.moodboard || [];
      
      updateUI();
      hideLoadingScreen();
      
      // Set partner ID
      const partners = data.partners || [];
      partnerId = partners.find(id => id !== userId);
    }
  });
}

// Update UI with loaded data
function updateUI() {
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

// Get month index from name
function getMonthIndex(monthName) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months.indexOf(monthName);
}

// Update countdown
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
userForm.addEventListener('submit', e => {
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
  
  // If this is a new couple, create the couple record
  if (!coupleId) {
    coupleId = database.ref().child('couples').push().key;
    database.ref(`couples/${coupleId}`).set({
      partners: [userId],
      weddingData,
      tasks: [],
      expenses: [],
      guestList: [],
      events: [],
      moodboard: []
    });
    
    // Save couple ID to user's record
    database.ref(`users/${userId}`).set({ coupleId })
      .then(() => {
        // Generate shareable link
        const shareLink = `${window.location.origin}${window.location.pathname}?coupleId=${coupleId}`;
        showNotification(`Wedding details saved! Share this link with your partner: ${shareLink}`, 'success');
        
        // Update UI
        updateUI();
      });
  } else {
    // Update existing couple data
    database.ref(`couples/${coupleId}/weddingData`).set(weddingData)
      .then(() => {
        showNotification('Wedding details updated!', 'success');
        updateUI();
      });
  }
});

// Tasks functions
function addTask() {
  const taskInput = document.getElementById('task');
  const task = taskInput.value.trim();
  
  if (!task) return;
  
  tasks.push({
    id: Date.now().toString(),
    text: task,
    completed: false,
    createdAt: new Date().toISOString()
  });
  
  saveTasks();
  taskInput.value = '';
}

function saveTasks() {
  if (!coupleId) return;
  
  database.ref(`couples/${coupleId}/tasks`).set(tasks)
    .then(() => renderTasks());
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

function deleteTask(taskId) {
  tasks = tasks.filter(task => task.id !== taskId);
  saveTasks();
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

function saveExpenses() {
  if (!coupleId) return;
  
  database.ref(`couples/${coupleId}/expenses`).set(expenses)
    .then(() => renderExpenses());
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

function deleteExpense(expenseId) {
  expenses = expenses.filter(expense => expense.id !== expenseId);
  saveExpenses();
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

function saveGuestList() {
  if (!coupleId) return;
  
  database.ref(`couples/${coupleId}/guestList`).set(guestList)
    .then(() => renderGuestList());
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

function updateGuestRSVP(guestId, rsvp) {
  const guest = guestList.find(g => g.id === guestId);
  if (guest) {
    guest.rsvp = rsvp;
    saveGuestList();
  }
}

function deleteGuest(guestId) {
  guestList = guestList.filter(guest => guest.id !== guestId);
  saveGuestList();
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

function saveEvents() {
  if (!coupleId) return;
  
  database.ref(`couples/${coupleId}/events`).set(events)
    .then(() => renderTimeline());
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

function deleteEvent(eventId) {
  events = events.filter(event => event.id !== eventId);
  saveEvents();
}

// Mood Board functions
function uploadImage() {
  if (!selectedFile) {
    showNotification('No image selected', 'error');
    return;
  }

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
      const percentComplete = Math.round((e.loaded / e.total) * 100);
      document.querySelector('.progress-fill').style.width = `${percentComplete}%`;
      document.querySelector('.upload-status').textContent = `Uploading: ${percentComplete}%`;
    }
  };

  xhr.onload = function() {
    if (xhr.status === 200) {
      const response = JSON.parse(xhr.responseText);
      if (response.success) {
        addImageToMoodBoard(response.data.url);
        progressElement.innerHTML = `
          <div class="upload-success">
            <i class="fas fa-check-circle"></i> Upload successful!
          </div>
        `;
        saveImageToDatabase(response.data.url);
      } else {
        throw new Error(response.error.message || 'Upload failed');
      }
    } else {
      throw new Error('Upload failed');
    }
  };

  xhr.onerror = function() {
    progressElement.innerHTML = `
      <div class="upload-error">
        <i class="fas fa-times-circle"></i> Upload failed
      </div>
    `;
    showNotification('Image upload failed. Please try again.', 'error');
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

function saveImageToDatabase(imageUrl) {
  if (coupleId) {
    database.ref(`couples/${coupleId}/moodboard`).push().set({
      url: imageUrl,
      timestamp: new Date().toISOString(),
      uploadedBy: userId
    });
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

function removeImage(button, imageUrl) {
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
  
  // Set color based on type
  if (type === 'error') {
    notification.style.backgroundColor = 'var(--danger-color)';
  } else if (type === 'warning') {
    notification.style.backgroundColor = 'var(--warning-color)';
  } else {
    notification.style.backgroundColor = 'var(--success-color)';
  }
  
  notification.classList.add('show');
  
  // Hide after 5 seconds
  setTimeout(() => {
    notification.classList.remove('show');
  }, 5000);
}

// Hide loading screen
function hideLoadingScreen() {
  loadingScreen.style.opacity = '0';
  setTimeout(() => {
    loadingScreen.style.display = 'none';
  }, 500);
}

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
