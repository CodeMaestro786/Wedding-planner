// Countdown timer
const weddingDate = new Date("2025-12-20T00:00:00").getTime();
const timer = document.getElementById("timer");

setInterval(() => {
  const now = new Date().getTime();
  const diff = weddingDate - now;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  timer.innerHTML = `${days} days left until the wedding!`;
}, 1000);

// Save checklist state
const tasks = ["task1", "task2", "task3", "task4", "task5"];
tasks.forEach(id => {
  const checkbox = document.getElementById(id);
  checkbox.checked = localStorage.getItem(id) === "true";
  checkbox.addEventListener("change", () => {
    localStorage.setItem(id, checkbox.checked);
  });
});

// Save answers
function saveAnswers() {
  const venue = document.getElementById("venue").value;
  const bestMan = document.getElementById("bestMan").value;
  const honeymoon = document.getElementById("honeymoon").value;

  localStorage.setItem("venue", venue);
  localStorage.setItem("bestMan", bestMan);
  localStorage.setItem("honeymoon", honeymoon);

  document.getElementById("saved-message").innerText = "Answers saved successfully!";
}

// Load saved answers on page load
window.onload = function() {
  document.getElementById("venue").value = localStorage.getItem("venue") || "";
  document.getElementById("bestMan").value = localStorage.getItem("bestMan") || "";
  document.getElementById("honeymoon").value = localStorage.getItem("honeymoon") || "";
};
