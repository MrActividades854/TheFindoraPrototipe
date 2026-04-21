// Tabs login/register
function showTab(tab) {
    document.querySelectorAll(".form").forEach(f => f.classList.remove("active"));
    document.getElementById(tab).classList.add("active");
  }
  
  // Navegación dashboard
  function showSection(section) {
    document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
    document.getElementById(section).classList.add("active");
  }
  
  // Simulación login
  document.querySelectorAll("form").forEach(form => {
    form.addEventListener("submit", e => {
      e.preventDefault();
      window.location.href = "dashboard.html";
    });
  });