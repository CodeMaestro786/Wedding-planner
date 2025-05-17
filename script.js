const weddingDate = new Date("2025-12-20T00:00:00").getTime();
const timer = document.getElementById("timer");

setInterval(() => {
  const now = new Date().getTime();
  const diff = weddingDate - now;

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  timer.innerHTML = `${days} days left until the wedding!`;
}, 1000);
