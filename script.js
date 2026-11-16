/**
 * Tankbuch PWA – Hauptlogik (Vanilla JS + LocalStorage)
 * Optimiert für BMW 540d xDrive Touring (G31, BJ 2017 • DITUPA Stage 1)
 *
 * Spezielle Berechnungs-Logik:
 * - Beim Speichern eines neuen Tankvorgangs (Eintrag B) wird die Distanz zum
 *   vorherigen Tankvorgang (Eintrag A) berechnet: Distanz = B.odometer - A.odometer
 * - Verbrauch = (B.liters / Distanz) * 100 (bzw. inkl. zwischengelagerter Teilbetankungen)
 * - Dieser berechnete Verbrauch wird NICHT bei Eintrag B angezeigt, sondern
 *   rückwirkend bei Eintrag A gespeichert und in der UI dargestellt.
 * - Der jeweils neueste Eintrag (Eintrag B) zeigt beim Verbrauch immer den
 *   Platzhalter-Text: "Wird beim nächsten Tanken berechnet..."
 */

const STORAGE_KEY = 'tankbuch_pwa_entries_v1';
const VEHICLE_STORAGE_KEY = 'tankbuch_pwa_vehicle_v2';
const DIESEL_CO2_KG_PER_LITER = 2.65; // 2,65 kg CO2 pro Liter Diesel

const DEFAULT_VEHICLE = {
  model: 'BMW 540d xDrive Touring (G31)',
  plate: 'BJ 2017 • DITUPA Stage 1',
  fuel: 'Diesel',
  tankCapacity: 66,
  targetConsumption: 7.0,
};

// Navigation Tabs (Desktop & Smartphone Bottom Bar)
const tabLogbookBtn = document.getElementById('tabLogbookBtn');
const tabAnalyticsBtn = document.getElementById('tabAnalyticsBtn');
const mobileTabLogbookBtn = document.getElementById('mobileTabLogbookBtn');
const mobileTabAnalyticsBtn = document.getElementById('mobileTabAnalyticsBtn');
const viewLogbook = document.getElementById('viewLogbook');
const viewAnalytics = document.getElementById('viewAnalytics');

// DOM Elements – Form
const fuelForm = document.getElementById('fuelForm');
const editingEntryIdInput = document.getElementById('editingEntryId');
const formTitleText = document.getElementById('formTitleText');
const formSubtitleText = document.getElementById('formSubtitleText');
const formModeDot = document.getElementById('formModeDot');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const saveBtnText = document.getElementById('saveBtnText');

const dateInput = document.getElementById('dateInput');
const odometerInput = document.getElementById('odometerInput');
const litersInput = document.getElementById('litersInput');
const priceInput = document.getElementById('priceInput');

// Collapsible Optional Details
const toggleOptionalFieldsBtn = document.getElementById('toggleOptionalFieldsBtn');
const toggleOptionalLabel = document.getElementById('toggleOptionalLabel');
const toggleOptionalChevron = document.getElementById('toggleOptionalChevron');
const optionalFieldsContainer = document.getElementById('optionalFieldsContainer');

const partialFillInput = document.getElementById('partialFillInput');
const routeProfileInput = document.getElementById('routeProfileInput');
const noteInput = document.getElementById('noteInput');
const lastOdometerHint = document.getElementById('lastOdometerHint');
const tankCapacityHint = document.getElementById('tankCapacityHint');
const formAlert = document.getElementById('formAlert');

// DOM Elements – Vehicle Profile
const vehicleNameDisplay = document.getElementById('vehicleNameDisplay');
const vehiclePlateDisplay = document.getElementById('vehiclePlateDisplay');
const vehicleFuelDisplay = document.getElementById('vehicleFuelDisplay');
const vehicleTankDisplay = document.getElementById('vehicleTankDisplay');
const vehicleTargetDisplay = document.getElementById('vehicleTargetDisplay');
const statTankRange = document.getElementById('statTankRange');
const statTankRangeBadge = document.getElementById('statTankRangeBadge');
const vehicleForm = document.getElementById('vehicleForm');
const vehModelInput = document.getElementById('vehModelInput');
const vehPlateInput = document.getElementById('vehPlateInput');
const vehTankInput = document.getElementById('vehTankInput');
const vehTargetInput = document.getElementById('vehTargetInput');

// Live Preview Elements
const previewDistance = document.getElementById('previewDistance');
const previewConsumption = document.getElementById('previewConsumption');
const previewPricePerLiter = document.getElementById('previewPricePerLiter');

// Dashboard Elements
const currentMonthLabel = document.getElementById('currentMonthLabel');
const statMonthCost = document.getElementById('statMonthCost');
const statMonthCostSub = document.getElementById('statMonthCostSub');
const statMonthLiters = document.getElementById('statMonthLiters');
const statMonthLitersSub = document.getElementById('statMonthLitersSub');
const statAvgConsumption = document.getElementById('statAvgConsumption');
const statAvgConsumptionSub = document.getElementById('statAvgConsumptionSub');

// Extended Analytics Elements (Tab 2)
const statCostPer100km = document.getElementById('statCostPer100km');
const statCostPerKm = document.getElementById('statCostPerKm');
const statCo2PerKm = document.getElementById('statCo2PerKm');
const statCo2Total = document.getElementById('statCo2Total');
const statTotalDistance = document.getElementById('statTotalDistance');
const statOdometerSpan = document.getElementById('statOdometerSpan');
const statAllTimeCost = document.getElementById('statAllTimeCost');
const statAllTimeLiters = document.getElementById('statAllTimeLiters');

// Chart Elements (Tab 2)
const chartContainer = document.getElementById('chartContainer');
const chartSubtitle = document.getElementById('chartSubtitle');
const chartModeConsumptionBtn = document.getElementById('chartModeConsumptionBtn');
const chartModePriceBtn = document.getElementById('chartModePriceBtn');
let currentChartMode = 'consumption'; // 'consumption' | 'price'

// History Elements
const historyList = document.getElementById('historyList');
const emptyHistoryState = document.getElementById('emptyHistoryState');
const entriesCountBadge = document.getElementById('entriesCountBadge');
const clearAllBtn = document.getElementById('clearAllBtn');
const loadDemoBtn = document.getElementById('loadDemoBtn');
const installPwaBtn = document.getElementById('installPwaBtn');

// Formatters (German Locale)
const numberFormatter1 = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const numberFormatter2 = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter3 = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

const odometerFormatter = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

/**
 * Wechselt zwischen Tab 1 ("logbook") und Tab 2 ("analytics") für Desktop & Smartphone.
 */
function switchTab(tabName) {
  const activeBtnClasses =
    'inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white shadow-sm transition cursor-pointer';
  const inactiveBtnClasses =
    'inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer';

  const activeMobileClasses =
    'flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold bg-emerald-600 text-white shadow-md shadow-emerald-950/50 transition';
  const inactiveMobileClasses =
    'flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold text-slate-400 bg-slate-900/80 border border-slate-800 transition';

  if (tabName === 'analytics') {
    viewLogbook.classList.add('hidden');
    viewAnalytics.classList.remove('hidden');
    tabLogbookBtn.className = inactiveBtnClasses;
    tabAnalyticsBtn.className = activeBtnClasses;
    if (mobileTabLogbookBtn) mobileTabLogbookBtn.className = inactiveMobileClasses;
    if (mobileTabAnalyticsBtn) mobileTabAnalyticsBtn.className = activeMobileClasses;
    renderChart(loadEntries());
  } else {
    viewAnalytics.classList.add('hidden');
    viewLogbook.classList.remove('hidden');
    tabAnalyticsBtn.className = inactiveBtnClasses;
    tabLogbookBtn.className = activeBtnClasses;
    if (mobileTabAnalyticsBtn) mobileTabAnalyticsBtn.className = inactiveMobileClasses;
    if (mobileTabLogbookBtn) mobileTabLogbookBtn.className = activeMobileClasses;
  }
}

tabLogbookBtn.addEventListener('click', () => switchTab('logbook'));
tabAnalyticsBtn.addEventListener('click', () => switchTab('analytics'));
if (mobileTabLogbookBtn) mobileTabLogbookBtn.addEventListener('click', () => switchTab('logbook'));
if (mobileTabAnalyticsBtn) mobileTabAnalyticsBtn.addEventListener('click', () => switchTab('analytics'));

/**
 * Klappt die optionalen Zusatzfelder im Formular ein oder aus.
 */
function setOptionalFieldsOpen(isOpen) {
  if (isOpen) {
    optionalFieldsContainer.classList.remove('hidden');
    toggleOptionalLabel.textContent = '− Optionale Details ausblenden';
    toggleOptionalChevron.classList.add('rotate-180');
  } else {
    optionalFieldsContainer.classList.add('hidden');
    toggleOptionalLabel.textContent = '+ Optionale Details (Streckenprofil, Notiz, Teilbetankung)';
    toggleOptionalChevron.classList.remove('rotate-180');
  }
}

toggleOptionalFieldsBtn.addEventListener('click', () => {
  const isCurrentlyHidden = optionalFieldsContainer.classList.contains('hidden');
  setOptionalFieldsOpen(isCurrentlyHidden);
});

/**
 * Gibt das heutige Datum im Format YYYY-MM-DD zurück.
 */
function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formatiert ein YYYY-MM-DD Datum auf Deutsch (z.B. 16.11.2026)
 */
function formatGermanDate(dateStr) {
  if (!dateStr) return '–';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  return `${day}.${month}.${year}`;
}

/**
 * Escaped HTML-Sonderzeichen für sichere Darstellung von Notizen/Texten.
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Fahrzeugprofil aus LocalStorage laden / speichern.
 */
function loadVehicleProfile() {
  try {
    const raw = localStorage.getItem(VEHICLE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_VEHICLE };
    return { ...DEFAULT_VEHICLE, ...JSON.parse(raw) };
  } catch (err) {
    return { ...DEFAULT_VEHICLE };
  }
}

function saveVehicleProfile(profile) {
  try {
    localStorage.setItem(VEHICLE_STORAGE_KEY, JSON.stringify(profile));
  } catch (err) {
    console.error('Fehler beim Speichern des Fahrzeugprofils:', err);
  }
}

/**
 * Lädt alle gespeicherten Einträge aus dem LocalStorage.
 */
function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Fehler beim Lesen aus LocalStorage:', err);
    return [];
  }
}

/**
 * Speichert das Array der Tankvorgänge im LocalStorage.
 */
function saveEntries(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (err) {
    console.error('Fehler beim Speichern in LocalStorage:', err);
  }
}

/**
 * Berechnet rückwirkend für alle aufeinanderfolgenden Tankvorgänge (A -> B)
 * die Distanz und den Verbrauch und speichert den Wert bei Eintrag A.
 *
 * Der jeweils neueste Eintrag (letztes Element im aufsteigenden Array) erhält IMMER
 * consumption = null und distance = null ("Wird beim nächsten Tanken berechnet...").
 */
function recalculateRetroactiveConsumption(entries) {
  entries.sort((a, b) => a.odometer - b.odometer);

  for (let i = 0; i < entries.length; i++) {
    entries[i].distance = null;
    entries[i].consumption = null;
    entries[i].accumulatedLiters = null;
  }

  let anchorIndex = null;
  let pendingPartialLiters = 0;

  for (let i = 0; i < entries.length; i++) {
    const current = entries[i];
    const isNewest = i === entries.length - 1;

    if (anchorIndex === null) {
      anchorIndex = i;
      pendingPartialLiters = 0;
      continue;
    }

    if (current.isPartial) {
      pendingPartialLiters += Number(current.liters || 0);
    } else {
      const entryA = entries[anchorIndex];
      const totalDistance = current.odometer - entryA.odometer;
      const totalLitersForTrip = pendingPartialLiters + Number(current.liters || 0);

      if (totalDistance > 0) {
        const consumption = (totalLitersForTrip / totalDistance) * 100;
        entryA.distance = Number(totalDistance.toFixed(2));
        entryA.consumption = Number(consumption.toFixed(4));
        entryA.accumulatedLiters = Number(totalLitersForTrip.toFixed(2));
      }

      anchorIndex = i;
      pendingPartialLiters = 0;
    }

    if (isNewest) {
      current.distance = null;
      current.consumption = null;
    }
  }

  return entries;
}

/**
 * Zeigt eine Rückmeldung (Erfolg oder Fehler) über dem Formular an.
 */
let alertTimeout = null;
function showAlert(message, type = 'error') {
  if (alertTimeout) clearTimeout(alertTimeout);

  formAlert.classList.remove(
    'hidden',
    'bg-rose-500/10',
    'text-rose-300',
    'border-rose-500/30',
    'bg-emerald-500/10',
    'text-emerald-300',
    'border-emerald-500/30'
  );

  if (type === 'error') {
    formAlert.classList.add('bg-rose-500/10', 'text-rose-300', 'border-rose-500/30');
  } else {
    formAlert.classList.add('bg-emerald-500/10', 'text-emerald-300', 'border-emerald-500/30');
  }

  formAlert.textContent = message;

  if (type === 'success') {
    alertTimeout = setTimeout(() => {
      formAlert.classList.add('hidden');
    }, 4500);
  }
}

function hideAlert() {
  formAlert.classList.add('hidden');
}

/**
 * Aktualisiert die Live-Vorschau im Eingabeformular während der Eingabe.
 */
function updateLivePreview() {
  const entries = loadEntries();
  const editingId = editingEntryIdInput.value;

  let referenceEntry = null;
  if (editingId) {
    const idx = entries.findIndex((e) => e.id === editingId);
    if (idx > 0) referenceEntry = entries[idx - 1];
  } else if (entries.length > 0) {
    referenceEntry = entries[entries.length - 1];
  }

  const odoVal = parseFloat(odometerInput.value);
  const litersVal = parseFloat(litersInput.value);
  const priceVal = parseFloat(priceInput.value);
  const isPartial = partialFillInput.checked;

  if (!isNaN(litersVal) && litersVal > 0 && !isNaN(priceVal) && priceVal > 0) {
    const eurPerLiter = priceVal / litersVal;
    previewPricePerLiter.textContent = `${numberFormatter3.format(eurPerLiter)} €/L`;
  } else {
    previewPricePerLiter.textContent = '– €/L';
  }

  if (referenceEntry && !isNaN(odoVal) && odoVal > referenceEntry.odometer) {
    const distance = odoVal - referenceEntry.odometer;
    previewDistance.textContent = `+${odometerFormatter.format(distance)} km`;

    if (isPartial) {
      previewConsumption.textContent = 'Teilbetankung';
    } else if (!isNaN(litersVal) && litersVal > 0) {
      const consumption = (litersVal / distance) * 100;
      previewConsumption.textContent = `${numberFormatter2.format(consumption)} L/100km`;
    } else {
      previewConsumption.textContent = '– L/100km';
    }
  } else {
    previewDistance.textContent = referenceEntry ? '– km' : 'Startwert';
    previewConsumption.textContent = referenceEntry ? '– L/100km' : 'Ab 2. Eintrag';
  }
}

/**
 * Rendert die kompakte Fahrzeug-Leiste (BMW 540d xDrive DITUPA Stage 1) und Reichweite.
 */
function renderVehicleHeader(entries) {
  const vehicle = loadVehicleProfile();

  vehicleNameDisplay.textContent = vehicle.model;
  vehiclePlateDisplay.textContent = vehicle.plate;
  vehicleFuelDisplay.textContent = vehicle.fuel;
  vehicleTankDisplay.textContent = `${vehicle.tankCapacity} L`;
  vehicleTargetDisplay.textContent = `${numberFormatter1.format(vehicle.targetConsumption)} L/100km`;
  tankCapacityHint.textContent = `${vehicle.tankCapacity} L`;

  // Formularfelder in Tab 2 synchron halten
  if (document.activeElement !== vehModelInput) vehModelInput.value = vehicle.model;
  if (document.activeElement !== vehPlateInput) vehPlateInput.value = vehicle.plate;
  if (document.activeElement !== vehTankInput) vehTankInput.value = vehicle.tankCapacity;
  if (document.activeElement !== vehTargetInput) vehTargetInput.value = vehicle.targetConsumption;

  const completedEntries = entries.filter(
    (entry) => typeof entry.consumption === 'number' && !isNaN(entry.consumption)
  );

  let basisConsumption = vehicle.targetConsumption;
  let isRealAvg = false;

  if (completedEntries.length > 0) {
    const sumConsumption = completedEntries.reduce((sum, item) => sum + item.consumption, 0);
    basisConsumption = sumConsumption / completedEntries.length;
    isRealAvg = true;
  }

  if (basisConsumption > 0) {
    const theoreticalRangeKm = Math.round((vehicle.tankCapacity / basisConsumption) * 100);
    statTankRange.textContent = `~ ${odometerFormatter.format(theoreticalRangeKm)} km`;
    statTankRangeBadge.textContent = isRealAvg
      ? `(bei Ø ${numberFormatter2.format(basisConsumption)} L)`
      : `(bei ${numberFormatter1.format(vehicle.targetConsumption)} L Ziel)`;
  } else {
    statTankRange.textContent = '– km';
  }
}

/**
 * Aktualisiert das Dashboard (3 Hauptkarten in Tab 1 + 4 Detailkarten in Tab 2).
 */
function renderDashboard(entries) {
  const vehicle = loadVehicleProfile();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const monthNames = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];
  currentMonthLabel.textContent = `${monthNames[currentMonth - 1]} ${currentYear}`;

  const currentMonthEntries = entries.filter((entry) => {
    if (!entry.date) return false;
    const [y, m] = entry.date.split('-').map(Number);
    return y === currentYear && m === currentMonth;
  });

  const monthCost = currentMonthEntries.reduce((sum, item) => sum + Number(item.price || 0), 0);
  const monthLiters = currentMonthEntries.reduce((sum, item) => sum + Number(item.liters || 0), 0);

  statMonthCost.textContent = currencyFormatter.format(monthCost);
  statMonthCostSub.textContent =
    currentMonthEntries.length === 1
      ? '1 Tankvorgang in diesem Monat'
      : `${currentMonthEntries.length} Tankvorgänge in diesem Monat`;

  statMonthLiters.textContent = `${numberFormatter2.format(monthLiters)} L`;
  if (monthLiters > 0) {
    const avgLiterPrice = monthCost / monthLiters;
    statMonthLitersSub.textContent = `Ø Literpreis: ${numberFormatter3.format(avgLiterPrice)} €/L`;
  } else {
    statMonthLitersSub.textContent = 'Ø Literpreis: – €/L';
  }

  const completedEntries = entries.filter(
    (entry) => typeof entry.consumption === 'number' && !isNaN(entry.consumption)
  );

  const totalCostAllTime = entries.reduce((sum, item) => sum + Number(item.price || 0), 0);
  const totalLitersAllTime = entries.reduce((sum, item) => sum + Number(item.liters || 0), 0);
  const avgPricePerLiterAllTime = totalLitersAllTime > 0 ? totalCostAllTime / totalLitersAllTime : 0;

  statAllTimeCost.textContent = currencyFormatter.format(totalCostAllTime);
  statAllTimeLiters.textContent = `${numberFormatter2.format(totalLitersAllTime)} L Diesel gesamt`;

  const totalCo2Kg = totalLitersAllTime * DIESEL_CO2_KG_PER_LITER;
  statCo2Total.textContent = `Gesamt: ${numberFormatter1.format(totalCo2Kg)} kg CO₂`;

  if (completedEntries.length > 0) {
    const sumConsumption = completedEntries.reduce((sum, item) => sum + item.consumption, 0);
    const avgConsumption = sumConsumption / completedEntries.length;
    const totalDistance = completedEntries.reduce((sum, item) => sum + Number(item.distance || 0), 0);

    statAvgConsumption.textContent = `${numberFormatter2.format(avgConsumption)} L/100km`;

    const diffToTarget = avgConsumption - vehicle.targetConsumption;
    const diffLabel =
      diffToTarget <= 0
        ? `${numberFormatter2.format(Math.abs(diffToTarget))} L unter Ziel`
        : `${numberFormatter2.format(diffToTarget)} L über Ziel`;

    statAvgConsumptionSub.textContent =
      completedEntries.length === 1
        ? `1 Fahrt (${odometerFormatter.format(totalDistance)} km) • ${diffLabel}`
        : `${completedEntries.length} Fahrten (${odometerFormatter.format(totalDistance)} km) • ${diffLabel}`;

    const costPer100km = avgConsumption * avgPricePerLiterAllTime;
    const costPerKm = costPer100km / 100;
    statCostPer100km.textContent = `${currencyFormatter.format(costPer100km)} / 100km`;
    statCostPerKm.textContent = `${numberFormatter3.format(costPerKm)} € pro km`;

    const co2GramsPerKm = Math.round((avgConsumption * DIESEL_CO2_KG_PER_LITER * 1000) / 100);
    statCo2PerKm.textContent = `${co2GramsPerKm} g CO₂/km`;

    statTotalDistance.textContent = `${odometerFormatter.format(totalDistance)} km`;
    if (entries.length >= 2) {
      statOdometerSpan.textContent = `${odometerFormatter.format(entries[0].odometer)} → ${odometerFormatter.format(entries[entries.length - 1].odometer)} km`;
    }
  } else {
    statAvgConsumption.textContent = '– L/100km';
    statAvgConsumptionSub.textContent = 'Noch keine abgeschlossene Fahrt';
    statCostPer100km.textContent = '– €/100km';
    statCostPerKm.textContent = '– €/km';
    statCo2PerKm.textContent = '– g/km';
    statTotalDistance.textContent = '0 km';
    statOdometerSpan.textContent = 'Aus abgeschlossenen Fahrten';
  }
}

/**
 * Rendert das visuelle SVG-Trend-Diagramm in Tab 2.
 */
function renderChart(entries) {
  const vehicle = loadVehicleProfile();

  if (currentChartMode === 'consumption') {
    chartSubtitle.textContent = `Rückwirkender Realverbrauch (L/100km) vs. Stage-1-Zielverbrauch (${numberFormatter1.format(
      vehicle.targetConsumption
    )} L/100km)`;
    chartModeConsumptionBtn.className =
      'px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white transition cursor-pointer';
    chartModePriceBtn.className =
      'px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer';

    const points = entries.filter(
      (e) => typeof e.consumption === 'number' && !isNaN(e.consumption)
    );

    if (points.length === 0) {
      chartContainer.innerHTML =
        '<p class="text-xs text-slate-500 text-center">Mindestens 1 abgeschlossene Fahrt (2 Tankstopps) erforderlich, um den Verbrauchstrend anzuzeigen.</p>';
      return;
    }

    const values = points.map((p) => p.consumption);
    const minVal = Math.min(...values, vehicle.targetConsumption) - 0.8;
    const maxVal = Math.max(...values, vehicle.targetConsumption) + 0.8;
    const range = Math.max(maxVal - minVal, 1);

    const width = 680;
    const height = 170;
    const padX = 48;
    const padY = 28;
    const usableW = width - padX * 2;
    const usableH = height - padY * 2;

    const getX = (idx) =>
      points.length === 1 ? width / 2 : padX + (idx / (points.length - 1)) * usableW;
    const getY = (val) => padY + usableH - ((val - minVal) / range) * usableH;

    const targetY = getY(vehicle.targetConsumption);
    const coords = points.map((p, i) => ({
      x: getX(i),
      y: getY(p.consumption),
      val: p.consumption,
      date: formatGermanDate(p.date).slice(0, 5),
    }));

    const polylinePoints = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
    const areaPoints = `${coords[0].x.toFixed(1)},${height - padY} ${polylinePoints} ${coords[
      coords.length - 1
    ].x.toFixed(1)},${height - padY}`;

    chartContainer.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" class="w-full h-full overflow-visible">
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#10b981" stop-opacity="0.35" />
            <stop offset="100%" stop-color="#10b981" stop-opacity="0.0" />
          </linearGradient>
        </defs>

        <!-- Zielverbrauch Referenzlinie -->
        <line x1="${padX}" y1="${targetY.toFixed(1)}" x2="${width - padX}" y2="${targetY.toFixed(1)}" stroke="#38bdf8" stroke-width="1.2" stroke-dasharray="4 4" opacity="0.75" />
        <text x="${width - padX}" y="${(targetY - 6).toFixed(1)}" text-anchor="end" fill="#38bdf8" font-size="10" font-weight="600">
          Ziel: ${numberFormatter1.format(vehicle.targetConsumption)} L
        </text>

        <!-- Area & Line -->
        ${coords.length > 1 ? `<polygon points="${areaPoints}" fill="url(#chartGrad)" />` : ''}
        ${
          coords.length > 1
            ? `<polyline fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="${polylinePoints}" />`
            : ''
        }

        <!-- Data Points -->
        ${coords
          .map(
            (c) => `
          <g>
            <circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="4.5" fill="#0f172a" stroke="#34d399" stroke-width="2.5" />
            <text x="${c.x.toFixed(1)}" y="${(c.y - 10).toFixed(1)}" text-anchor="middle" fill="#e2e8f0" font-size="10.5" font-weight="700">
              ${numberFormatter2.format(c.val)}
            </text>
            <text x="${c.x.toFixed(1)}" y="${height - 6}" text-anchor="middle" fill="#94a3b8" font-size="10">
              ${c.date}
            </text>
          </g>
        `
          )
          .join('')}
      </svg>
    `;
  } else {
    chartSubtitle.textContent = 'Entwicklung des gezahlten Literpreises (€/L) über alle Tankstopps';
    chartModePriceBtn.className =
      'px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white transition cursor-pointer';
    chartModeConsumptionBtn.className =
      'px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer';

    const points = entries.filter((e) => e.liters > 0 && e.price > 0);
    if (points.length === 0) {
      chartContainer.innerHTML =
        '<p class="text-xs text-slate-500 text-center">Noch keine Tankvorgänge für den Preisverlauf vorhanden.</p>';
      return;
    }

    const values = points.map((p) => p.price / p.liters);
    const minVal = Math.min(...values) - 0.05;
    const maxVal = Math.max(...values) + 0.05;
    const range = Math.max(maxVal - minVal, 0.1);

    const width = 680;
    const height = 170;
    const padX = 48;
    const padY = 28;
    const usableW = width - padX * 2;
    const usableH = height - padY * 2;

    const getX = (idx) =>
      points.length === 1 ? width / 2 : padX + (idx / (points.length - 1)) * usableW;
    const getY = (val) => padY + usableH - ((val - minVal) / range) * usableH;

    const coords = points.map((p, i) => {
      const val = p.price / p.liters;
      return {
        x: getX(i),
        y: getY(val),
        val,
        date: formatGermanDate(p.date).slice(0, 5),
      };
    });

    const polylinePoints = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');

    chartContainer.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" class="w-full h-full overflow-visible">
        ${
          coords.length > 1
            ? `<polyline fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="${polylinePoints}" />`
            : ''
        }
        ${coords
          .map(
            (c) => `
          <g>
            <circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="4.5" fill="#0f172a" stroke="#38bdf8" stroke-width="2.5" />
            <text x="${c.x.toFixed(1)}" y="${(c.y - 10).toFixed(1)}" text-anchor="middle" fill="#e2e8f0" font-size="10.5" font-weight="700">
              ${numberFormatter3.format(c.val)} €
            </text>
            <text x="${c.x.toFixed(1)}" y="${height - 6}" text-anchor="middle" fill="#94a3b8" font-size="10">
              ${c.date}
            </text>
          </g>
        `
          )
          .join('')}
      </svg>
    `;
  }
}

/**
 * Aktualisiert den Hinweis für den letzten Kilometerstand über dem Eingabefeld.
 */
function updateLastOdometerHint(entries) {
  if (entries.length > 0) {
    const latest = entries[entries.length - 1];
    lastOdometerHint.textContent = `Letzter Stand: ${odometerFormatter.format(latest.odometer)} km`;
    lastOdometerHint.classList.remove('hidden');
  } else {
    lastOdometerHint.classList.add('hidden');
  }
}

/**
 * Liefert eine Ampel-Bewertung für den Verbrauch im Vergleich zum 540d Stage-1-Zielverbrauch.
 */
function getConsumptionRatingBadge(consumption, targetConsumption) {
  if (consumption <= targetConsumption - 0.3) {
    return '<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Sparsam</span>';
  }
  if (consumption <= targetConsumption + 0.6) {
    return '<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">Im Zielbereich</span>';
  }
  return '<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">Sport / Volllast</span>';
}

/**
 * Rendert die Historie als absteigend sortierte Liste moderner Karten.
 * Der neueste Eintrag (oben, Index 0 in der absteigenden Liste) zeigt beim Verbrauch
 * immer: "Wird beim nächsten Tanken berechnet..."
 */
function renderHistory(entries) {
  const vehicle = loadVehicleProfile();

  entriesCountBadge.textContent =
    entries.length === 1 ? '1 Eintrag' : `${entries.length} Einträge`;

  if (entries.length === 0) {
    emptyHistoryState.classList.remove('hidden');
    historyList.classList.add('hidden');
    clearAllBtn.classList.add('hidden');
    clearAllBtn.classList.remove('inline-flex');
    historyList.innerHTML = '';
    return;
  }

  emptyHistoryState.classList.add('hidden');
  historyList.classList.remove('hidden');
  clearAllBtn.classList.remove('hidden');
  clearAllBtn.classList.add('inline-flex');

  const descendingEntries = [...entries].reverse();

  historyList.innerHTML = descendingEntries
    .map((entry, idx) => {
      const isNewest = idx === 0;
      const hasConsumption =
        !isNewest && typeof entry.consumption === 'number' && !isNaN(entry.consumption);
      const pricePerLiter = entry.liters > 0 ? entry.price / entry.liters : 0;

      let consumptionBadgeHtml = '';

      if (isNewest) {
        consumptionBadgeHtml = `
          <div class="mt-3 pt-2.5 border-t border-slate-800/90 flex items-center justify-between gap-2">
            <span class="text-xs font-medium text-slate-400">Verbrauch dieser Fahrt:</span>
            <span class="pulse-subtle inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/25">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Wird beim nächsten Tanken berechnet...</span>
            </span>
          </div>
        `;
      } else if (entry.isPartial) {
        consumptionBadgeHtml = `
          <div class="mt-3 pt-2.5 border-t border-slate-800/90 flex items-center justify-between gap-2">
            <span class="text-xs font-medium text-slate-400">Teilbetankung:</span>
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-500/10 text-sky-300 border border-sky-500/25">
              <span>Liter in vorherige Etappe eingerechnet</span>
            </span>
          </div>
        `;
      } else if (hasConsumption) {
        const ratingBadge = getConsumptionRatingBadge(entry.consumption, vehicle.targetConsumption);
        consumptionBadgeHtml = `
          <div class="mt-3 pt-2.5 border-t border-slate-800/90 flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-1.5 text-xs text-slate-400">
              <span>Verbrauch (über <strong class="text-slate-200">+${odometerFormatter.format(entry.distance)} km</strong>):</span>
              ${ratingBadge}
            </div>
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>${numberFormatter2.format(entry.consumption)} L/100km</span>
            </span>
          </div>
        `;
      } else {
        consumptionBadgeHtml = `
          <div class="mt-3 pt-2.5 border-t border-slate-800/90 flex items-center justify-between gap-2">
            <span class="text-xs font-medium text-slate-400">Verbrauch dieser Fahrt:</span>
            <span class="pulse-subtle inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/25">
              <span>Wird beim nächsten Tanken berechnet...</span>
            </span>
          </div>
        `;
      }

      const routeBadge =
        entry.routeProfile && entry.routeProfile !== 'Drittelmix'
          ? `<span class="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-800/90 text-slate-300 border border-slate-700/80">${escapeHtml(
              entry.routeProfile
            )}</span>`
          : '';

      const partialBadge = entry.isPartial
        ? '<span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/25">Teilbetankung</span>'
        : '';

      const noteHtml = entry.note
        ? `<p class="mt-2 text-xs text-slate-400 bg-slate-900/50 border border-slate-800/60 rounded-lg px-2.5 py-1.5 italic">„${escapeHtml(
            entry.note
          )}“</p>`
        : '';

      return `
        <article
          data-entry-id="${entry.id}"
          class="animate-card rounded-xl bg-slate-950/80 hover:bg-slate-950 border ${
            isNewest ? 'border-emerald-500/35 ring-1 ring-emerald-500/15' : 'border-slate-800/90'
          } p-4 transition shadow-sm"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-slate-800/90 px-2.5 py-1 rounded-lg border border-slate-700/80">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                ${formatGermanDate(entry.date)}
              </span>

              <span class="inline-flex items-center gap-1 text-xs font-medium text-slate-300 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                <span>KM:</span>
                <strong class="text-white">${odometerFormatter.format(entry.odometer)} km</strong>
              </span>

              ${routeBadge}
              ${partialBadge}

              ${
                isNewest
                  ? '<span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">Neuester Eintrag</span>'
                  : ''
              }
            </div>

            <div class="flex items-center gap-1 shrink-0">
              <button
                type="button"
                data-edit-id="${entry.id}"
                title="Diesen Tankvorgang bearbeiten"
                aria-label="Tankvorgang vom ${formatGermanDate(entry.date)} bearbeiten"
                class="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 transition cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>

              <button
                type="button"
                data-delete-id="${entry.id}"
                title="Diesen Tankvorgang löschen"
                aria-label="Tankvorgang vom ${formatGermanDate(entry.date)} löschen"
                class="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div class="mt-3 grid grid-cols-2 gap-3">
            <div class="rounded-lg bg-slate-900/70 border border-slate-800/70 px-3 py-2">
              <span class="block text-[11px] text-slate-400">Getankte Liter</span>
              <span class="text-sm sm:text-base font-bold text-white">
                ${numberFormatter2.format(entry.liters)} L
              </span>
            </div>

            <div class="rounded-lg bg-slate-900/70 border border-slate-800/70 px-3 py-2 flex items-center justify-between">
              <div>
                <span class="block text-[11px] text-slate-400">Gesamtpreis</span>
                <span class="text-sm sm:text-base font-bold text-white">
                  ${currencyFormatter.format(entry.price)}
                </span>
              </div>
              <span class="text-[11px] font-medium text-slate-400 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800">
                ${numberFormatter3.format(pricePerLiter)} €/L
              </span>
            </div>
          </div>

          ${noteHtml}
          ${consumptionBadgeHtml}
        </article>
      `;
    })
    .join('');
}

/**
 * Beendet den Bearbeitungsmodus im Formular und setzt es auf "Neuer Tankvorgang" zurück.
 */
function resetFormMode() {
  editingEntryIdInput.value = '';
  formTitleText.textContent = 'Neuer Tankvorgang';
  formSubtitleText.textContent = 'Schnell-Eingabe (Verbrauch wird rückwirkend berechnet)';
  formModeDot.className = 'w-2 h-2 rounded-full bg-emerald-400';
  saveBtnText.textContent = 'Speichern';
  cancelEditBtn.classList.add('hidden');

  odometerInput.value = '';
  litersInput.value = '';
  priceInput.value = '';
  partialFillInput.checked = false;
  routeProfileInput.value = 'Drittelmix';
  noteInput.value = '';
  dateInput.value = getTodayDateString();
  setOptionalFieldsOpen(false);
  updateLivePreview();
}

/**
 * Gesamte UI anhand des aktuellen LocalStorage-Zustands aktualisieren.
 */
function refreshApp() {
  const entries = loadEntries();
  renderVehicleHeader(entries);
  renderDashboard(entries);
  renderChart(entries);
  updateLastOdometerHint(entries);
  renderHistory(entries);
  updateLivePreview();
}

/**
 * Neuen Tankvorgang speichern oder bestehenden Eintrag aktualisieren.
 */
fuelForm.addEventListener('submit', (event) => {
  event.preventDefault();
  hideAlert();

  const editingId = editingEntryIdInput.value;
  const date = dateInput.value.trim();
  const odometer = parseFloat(odometerInput.value);
  const liters = parseFloat(litersInput.value);
  const price = parseFloat(priceInput.value);
  const isPartial = partialFillInput.checked;
  const routeProfile = routeProfileInput.value;
  const note = noteInput.value.trim();

  if (!date) {
    showAlert('Bitte wähle ein gültiges Datum aus.', 'error');
    dateInput.focus();
    return;
  }

  if (isNaN(odometer) || odometer < 0) {
    showAlert('Bitte gib einen gültigen Kilometerstand ein.', 'error');
    odometerInput.focus();
    return;
  }

  if (isNaN(liters) || liters <= 0) {
    showAlert('Bitte gib die getankten Liter (größer als 0) ein.', 'error');
    litersInput.focus();
    return;
  }

  if (isNaN(price) || price <= 0) {
    showAlert('Bitte gib den gezahlten Gesamtpreis (größer als 0) ein.', 'error');
    priceInput.focus();
    return;
  }

  const entries = loadEntries();

  if (editingId) {
    const idx = entries.findIndex((item) => item.id === editingId);
    if (idx === -1) {
      resetFormMode();
      return;
    }

    entries[idx] = {
      ...entries[idx],
      date,
      odometer: Number(odometer.toFixed(1)),
      liters: Number(liters.toFixed(2)),
      price: Number(price.toFixed(2)),
      isPartial,
      routeProfile,
      note,
    };

    recalculateRetroactiveConsumption(entries);
    saveEntries(entries);
    resetFormMode();
    refreshApp();
    showAlert('Tankvorgang aktualisiert und Verbräuche neu berechnet!', 'success');
    return;
  }

  const previousEntryA = entries.length > 0 ? entries[entries.length - 1] : null;

  if (previousEntryA && odometer <= previousEntryA.odometer) {
    showAlert(
      `Der Kilometerstand muss größer als beim vorherigen Tankvorgang (${odometerFormatter.format(
        previousEntryA.odometer
      )} km) sein.`,
      'error'
    );
    odometerInput.focus();
    return;
  }

  const newEntryB = {
    id: `fuel_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    date,
    odometer: Number(odometer.toFixed(1)),
    liters: Number(liters.toFixed(2)),
    price: Number(price.toFixed(2)),
    isPartial,
    routeProfile,
    note,
    distance: null,
    consumption: null,
    createdAt: Date.now(),
  };

  entries.push(newEntryB);
  recalculateRetroactiveConsumption(entries);
  saveEntries(entries);

  resetFormMode();
  refreshApp();

  if (previousEntryA && !isPartial && typeof previousEntryA.consumption === 'number') {
    showAlert(
      `Gespeichert! Verbrauch von ${numberFormatter2.format(
        previousEntryA.consumption
      )} L/100km wurde rückwirkend beim vorherigen Eintrag (${formatGermanDate(
        previousEntryA.date
      )}) eingetragen.`,
      'success'
    );
  } else if (isPartial) {
    showAlert(
      'Teilbetankung gespeichert! Die Liter werden beim nächsten Volltanken in den Verbrauch eingerechnet.',
      'success'
    );
  } else {
    showAlert(
      'Erster Tankvorgang gespeichert! Der Verbrauch dieser Fahrt wird beim nächsten Tanken berechnet.',
      'success'
    );
  }
});

// Abbrechen im Bearbeitungsmodus
cancelEditBtn.addEventListener('click', () => {
  hideAlert();
  resetFormMode();
});

// Live-Vorschau bei Eingabe aktualisieren
[odometerInput, litersInput, priceInput, partialFillInput].forEach((inputEl) => {
  inputEl.addEventListener('input', updateLivePreview);
  inputEl.addEventListener('change', updateLivePreview);
});

// Fahrzeugprofil speichern (in Tab 2)
vehicleForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const current = loadVehicleProfile();
  const updated = {
    ...current,
    model: vehModelInput.value.trim() || DEFAULT_VEHICLE.model,
    plate: vehPlateInput.value.trim() || DEFAULT_VEHICLE.plate,
    tankCapacity: Math.max(10, parseFloat(vehTankInput.value) || DEFAULT_VEHICLE.tankCapacity),
    targetConsumption: Math.max(
      1,
      parseFloat(vehTargetInput.value) || DEFAULT_VEHICLE.targetConsumption
    ),
  };
  saveVehicleProfile(updated);
  refreshApp();
});

// Chart-Modus Umschalter
chartModeConsumptionBtn.addEventListener('click', () => {
  currentChartMode = 'consumption';
  renderChart(loadEntries());
});

chartModePriceBtn.addEventListener('click', () => {
  currentChartMode = 'price';
  renderChart(loadEntries());
});

// Einzelnen Eintrag bearbeiten oder löschen (Event Delegation)
historyList.addEventListener('click', (event) => {
  const editBtn = event.target.closest('[data-edit-id]');
  if (editBtn) {
    const entryId = editBtn.getAttribute('data-edit-id');
    const entries = loadEntries();
    const entry = entries.find((item) => item.id === entryId);
    if (!entry) return;

    editingEntryIdInput.value = entry.id;
    dateInput.value = entry.date;
    odometerInput.value = entry.odometer;
    litersInput.value = entry.liters;
    priceInput.value = entry.price;
    partialFillInput.checked = Boolean(entry.isPartial);
    routeProfileInput.value = entry.routeProfile || 'Drittelmix';
    noteInput.value = entry.note || '';

    // Optionale Felder ausklappen, falls Notiz/Streckenprofil/Teilbetankung gesetzt
    if (entry.note || entry.isPartial || (entry.routeProfile && entry.routeProfile !== 'Drittelmix')) {
      setOptionalFieldsOpen(true);
    }

    formTitleText.textContent = 'Tankvorgang bearbeiten';
    formSubtitleText.textContent = `Eintrag vom ${formatGermanDate(entry.date)} (${odometerFormatter.format(
      entry.odometer
    )} km) anpassen`;
    formModeDot.className = 'w-2 h-2 rounded-full bg-sky-400';
    saveBtnText.textContent = 'Änderungen speichern';
    cancelEditBtn.classList.remove('hidden');

    updateLivePreview();
    fuelForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }

  const deleteBtn = event.target.closest('[data-delete-id]');
  if (deleteBtn) {
    const entryId = deleteBtn.getAttribute('data-delete-id');
    let entries = loadEntries();
    entries = entries.filter((item) => item.id !== entryId);
    recalculateRetroactiveConsumption(entries);
    saveEntries(entries);
    if (editingEntryIdInput.value === entryId) {
      resetFormMode();
    }
    refreshApp();
  }
});

// Alle Einträge löschen
clearAllBtn.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  hideAlert();
  resetFormMode();
  refreshApp();
  showAlert('Alle Tankvorgänge wurden gelöscht.', 'success');
});

// 540d Beispieldaten laden
loadDemoBtn.addEventListener('click', () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  const demoEntries = [
    {
      id: 'demo_540d_1',
      date: `${year}-${month}-01`,
      odometer: 145200,
      liters: 58.4,
      price: 96.89,
      isPartial: false,
      routeProfile: 'Autobahn',
      note: 'Aral Ultimate Diesel • Langstrecke A8',
      distance: null,
      consumption: null,
      createdAt: Date.now() - 86400000 * 15,
    },
    {
      id: 'demo_540d_2',
      date: `${year}-${month}-06`,
      odometer: 146080,
      liters: 55.44,
      price: 90.87,
      isPartial: false,
      routeProfile: 'Autobahn',
      note: 'Tempomat 140 km/h',
      distance: null,
      consumption: null,
      createdAt: Date.now() - 86400000 * 10,
    },
    {
      id: 'demo_540d_3',
      date: `${year}-${month}-11`,
      odometer: 146860,
      liters: 54.6,
      price: 91.12,
      isPartial: false,
      routeProfile: 'Drittelmix',
      note: 'Alltag & kurzes Stage-1-Beschleunigen',
      distance: null,
      consumption: null,
      createdAt: Date.now() - 86400000 * 5,
    },
    {
      id: 'demo_540d_4',
      date: getTodayDateString(),
      odometer: 147650,
      liters: 51.35,
      price: 86.78,
      isPartial: false,
      routeProfile: 'Landstraße',
      note: 'Shell V-Power Diesel • Volltankung',
      distance: null,
      consumption: null,
      createdAt: Date.now(),
    },
  ];

  recalculateRetroactiveConsumption(demoEntries);
  saveEntries(demoEntries);
  resetFormMode();
  refreshApp();
  showAlert('4 Beispiel-Tankvorgänge geladen!', 'success');
});

// PWA Installation & Service Worker Registrierung
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installPwaBtn.classList.remove('hidden');
  installPwaBtn.classList.add('inline-flex');
});

installPwaBtn.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installPwaBtn.classList.add('hidden');
  installPwaBtn.classList.remove('inline-flex');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        console.log('Service Worker erfolgreich registriert:', reg.scope);
      })
      .catch((err) => {
        console.warn('Service Worker Registrierung fehlgeschlagen:', err);
      });
  });
}

// Initialisierung beim Start
document.addEventListener('DOMContentLoaded', () => {
  dateInput.value = getTodayDateString();
  refreshApp();
});
