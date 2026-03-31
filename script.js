//Config
const DEFAULT_CITY = "Delhi";
const DEFAULT_LAT  = 28.6139;
const DEFAULT_LON  = 77.2090;

//State
let isCelsius = true;
let isDark    = false;
let lastData  = null;
let lastCity  = "";
let currentLat = DEFAULT_LAT;
let currentLon = DEFAULT_LON;
let refreshTimer = null;

const WMO = {
  0:  {label: "Clear Sky",          emoji: "☀️"},
  1:  {label: "Mostly Clear",       emoji: "🌤️"},
  2:  {label: "Partly Cloudy",      emoji: "⛅"},
  3:  {label: "Overcast",           emoji: "☁️"},
  45: {label: "Foggy",              emoji: "🌫️"},
  48: {label: "Freezing Fog",       emoji: "🌫️"},
  51: {label: "Light Drizzle",      emoji: "🌦️"},
  53: {label: "Drizzle",            emoji: "🌦️"},
  55: {label: "Heavy Drizzle",      emoji: "🌧️"},
  56: {label: "Freezing Drizzle",   emoji: "🌨️"},
  57: {label: "Heavy Frz Drizzle",  emoji: "🌨️"},
  61: {label: "Light Rain",         emoji: "🌧️"},
  63: {label: "Rain",               emoji: "🌧️"},
  65: {label: "Heavy Rain",         emoji: "🌧️"},
  66: {label: "Freezing Rain",      emoji: "🌨️"},
  67: {label: "Heavy Frz Rain",     emoji: "🌨️"},
  71: {label: "Light Snow",         emoji: "🌨️"},
  73: {label: "Snow",               emoji: "❄️"},
  75: {label: "Heavy Snow",         emoji: "❄️"},
  77: {label: "Snow Grains",        emoji: "🌨️"},
  80: {label: "Light Showers",      emoji: "🌦️"},
  81: {label: "Rain Showers",       emoji: "🌧️"},
  82: {label: "Violent Showers",    emoji: "⛈️"},
  85: {label: "Snow Showers",       emoji: "🌨️"},
  86: {label: "Heavy Snow Showers", emoji: "❄️"},
  95: {label: "Thunderstorm",       emoji: "⛈️"},
  96: {label: "Thunderstorm + Hail",emoji: "⛈️"},
  99: {label: "Thunderstorm + Hail",emoji: "⛈️"},
};

function wmo(code) {
  return WMO[code] ?? { label: "Unknown", emoji: "🌡️" };
}

const RAIN_TO_SNOW = {
  51: {label: "Light Snow",         emoji: "🌨️"},
  53: {label: "Snow",               emoji: "❄️"},
  55: {label: "Heavy Snow",         emoji: "❄️"},
  61: {label: "Light Snow",         emoji: "🌨️"},
  63: {label: "Snow",               emoji: "❄️"},
  65: {label: "Heavy Snow",         emoji: "❄️"},
  80: {label: "Snow Showers",       emoji: "🌨️"},
  81: {label: "Snow Showers",       emoji: "🌨️"},
  82: {label: "Heavy Snow Showers", emoji: "❄️"},
};

function smartWmo(code, tempC) {
  if (tempC <= 2 && RAIN_TO_SNOW[code]) return RAIN_TO_SNOW[code];
  return wmo(code);
}

function toDisplay(celsius) {
  if (isCelsius) return Math.round(celsius);
  return Math.round(celsius * 9 / 5 + 32);
}

function windDisplay(kmh) {
  if (isCelsius) return Math.round(kmh) + " km/h";
  return Math.round(kmh * 0.621371) + " mph";
}

function visDisplay(metres) {
  if (metres == null) return "N/A";
  if (isCelsius) return (metres / 1000).toFixed(1) + " km";
  return (metres / 1609.34).toFixed(1) + " mi";
}

function formatDate(isoDate) {
  const d = new Date(isoDate + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function shortDay(isoDate) {
  const d = new Date(isoDate + "T12:00:00");
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

async function fetchWeather(lat, lon) {
  const currentFields = [
    "temperature_2m","apparent_temperature","relative_humidity_2m",
    "wind_speed_10m","weather_code","visibility","precipitation"
  ].join(",");
  const dailyFields = ["weather_code","temperature_2m_max","temperature_2m_min"].join(",");
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=${currentFields}&daily=${dailyFields}` +
    `&temperature_unit=celsius&wind_speed_unit=kmh&precipitation_unit=mm` +
    `&timezone=auto&forecast_days=5&_=${Date.now()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (!json.current || json.current.temperature_2m == null)
    throw new Error("Unexpected API shape");
  return json;
}

async function geocode(query) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Geocode failed");
  return res.json();
}

function render(data, cityName) {
  const c = data.current;
  const d = data.daily;
  const unitLabel = isCelsius ? "°C" : "°F";

  document.getElementById("locationCity").textContent = cityName;
  document.getElementById("locationDate").textContent = formatDate(new Date().toISOString().split("T")[0]);
  document.getElementById("tempVal").textContent = toDisplay(c.temperature_2m);
  document.getElementById("tempUnit").textContent = unitLabel;

  const cond = smartWmo(c.weather_code, c.temperature_2m);
  document.getElementById("condition").textContent = cond.label;
  document.getElementById("weatherIcon").textContent = cond.emoji;

  document.getElementById("hiTemp").textContent    = toDisplay(d.temperature_2m_max[0]) + (isCelsius ? "°C" : "°F");
  document.getElementById("loTemp").textContent    = toDisplay(d.temperature_2m_min[0]) + (isCelsius ? "°C" : "°F");
  document.getElementById("feelsLike").textContent = toDisplay(c.apparent_temperature) + (isCelsius ? "°C" : "°F");

  document.getElementById("humidity").textContent   = c.relative_humidity_2m + "%";
  document.getElementById("wind").textContent       = windDisplay(c.wind_speed_10m);
  document.getElementById("visibility").textContent = visDisplay(c.visibility);

  const strip = document.getElementById("forecastStrip");
  strip.innerHTML = "";
  const days = Math.min(5, d.time.length);
  for (let i = 0; i < days; i++) {
    const fc  = smartWmo(d.weather_code[i], d.temperature_2m_max[i]);
    const div = document.createElement("div");
    div.className = "forecast-day" + (i === 0 ? " active" : "");
    div.innerHTML = `
      <div class="fday">${shortDay(d.time[i])}</div>
      <div class="ficon">${fc.emoji}</div>
      <div class="ftemp">${toDisplay(d.temperature_2m_max[i])}${isCelsius ? "°C" : "°F"}</div>
    `;
    strip.appendChild(div);
  }

  const now = new Date();
  document.getElementById("updatedTime").textContent =
    "Updated " + now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function rerender() {
  if (lastData) render(lastData, lastCity);
}

async function loadWeather(lat, lon, name) {
  document.getElementById("condition").textContent = "Loading…";
  document.getElementById("tempVal").textContent   = "—";
  try {
    const data = await fetchWeather(lat, lon);
    lastData = data; lastCity = name;
    currentLat = lat; currentLon = lon;
    render(data, name);
    scheduleRefresh();
  } catch (e) {
    console.error("loadWeather failed:", e);
    document.getElementById("condition").textContent = "Failed to load";
    document.getElementById("tempVal").textContent   = "—";
  }
}

function scheduleRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => loadWeather(currentLat, currentLon, lastCity), 5 * 60 * 1000);
}

// Unit toggle
const unitToggleBtn = document.getElementById("unitToggle");
unitToggleBtn.addEventListener("click", () => {
  isCelsius = !isCelsius;
  unitToggleBtn.textContent = isCelsius ? "°C" : "°F";
  unitToggleBtn.classList.toggle("metric", !isCelsius);
  rerender();
});

// Theme toggle
const themeToggleBtn = document.getElementById("themeToggle");
const themeIcon      = themeToggleBtn.querySelector(".theme-icon");

const savedTheme = localStorage.getItem("nimbus-theme");
if (savedTheme === "dark") {
  isDark = true;
  document.documentElement.setAttribute("data-theme", "dark");
  themeIcon.textContent = "☀️";
}

themeToggleBtn.addEventListener("click", () => {
  isDark = !isDark;
  if (isDark) {
    document.documentElement.setAttribute("data-theme", "dark");
    themeIcon.textContent = "☀️";
    localStorage.setItem("nimbus-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
    themeIcon.textContent = "🌙";
    localStorage.setItem("nimbus-theme", "light");
  }
});

// Search UI
const searchOverlay = document.getElementById("searchOverlay");
const searchInput   = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");
const searchBtn     = document.getElementById("searchBtn");
const searchClose   = document.getElementById("searchClose");

searchBtn.addEventListener("click", () => {
  searchOverlay.classList.add("open");
  searchInput.value = "";
  searchResults.innerHTML = "";
  setTimeout(() => searchInput.focus(), 60);
});

searchClose.addEventListener("click", closeSearch);
searchOverlay.addEventListener("click", e => { if (e.target === searchOverlay) closeSearch(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeSearch(); });

function closeSearch() { searchOverlay.classList.remove("open"); }

let debounceTimer;
searchInput.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  const q = searchInput.value.trim();
  if (q.length < 2) { searchResults.innerHTML = ""; return; }
  debounceTimer = setTimeout(() => doSearch(q), 350);
});

async function doSearch(q) {
  searchResults.innerHTML = `<li class="sr-loading">Searching…</li>`;
  try {
    const data = await geocode(q);
    searchResults.innerHTML = "";
    if (!data.results || data.results.length === 0) {
      searchResults.innerHTML = `<li class="sr-empty">No results found</li>`;
      return;
    }
    data.results.forEach(r => {
      const li = document.createElement("li");
      li.className = "sr-item";
      const label = [r.name, r.admin1, r.country].filter(Boolean).join(", ");
      li.textContent = label;
      li.addEventListener("click", () => {
        closeSearch();
        loadWeather(r.latitude, r.longitude, r.name + (r.admin1 ? ", " + r.admin1 : ""));
      });
      searchResults.appendChild(li);
    });
  } catch (e) {
    console.error("Search failed:", e);
    searchResults.innerHTML = `<li class="sr-empty">Search failed</li>`;
  }
}

// Init
loadWeather(DEFAULT_LAT, DEFAULT_LON, "Delhi, India");
