/*
 * SpiroSense AI — ESP32 Firmware
 * ─────────────────────────────────────────────────────────────────────────────
 * Hardware:  ESP32-DevKitC · HX711 load cell · SSD1306 OLED · RGB LED
 *
 * Features:
 *  • Auto-starts test when flow exceeds 0.20 L/s
 *  • Integrates flow into FVC, tracks FEV1 (first-second volume) and peakFlow
 *  • Classifies result (Normal / Restrictive / Obstructive) and displays on OLED + RGB LED
 *  • Uploads result via HTTPS POST to the Netlify ingest function
 *  • Offline retry: stores last failed result in NVS flash (Preferences)
 *
 * ── Pin assignments ───────────────────────────────────────────────────────────
 *  HX711 DOUT → GPIO 16 | HX711 SCK  → GPIO 17
 *  OLED SDA   → GPIO 21 | OLED SCL   → GPIO 22
 *  LED R      → GPIO 25 | LED G      → GPIO 26 | LED B → GPIO 27
 *
 * ── Libraries needed (install via Arduino Library Manager) ───────────────────
 *  • HX711 by bogde (v0.7.5+)
 *  • Adafruit SSD1306 + Adafruit GFX
 *  • HTTPClient (bundled in Arduino-ESP32 core)
 *
 * ── Security note ─────────────────────────────────────────────────────────────
 *  client.setInsecure() is used for development. For production, replace with
 *  client.setCACert(rootCA) using the Netlify TLS root certificate.
 */

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <HX711.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Preferences.h>

// ── User configuration ────────────────────────────────────────────────────────
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";
// Local testing URL (using your computer's Wi-Fi IP on port 8888)
// Once deployed, change this to: "https://your-site.netlify.app/api/ingest"
const char* API_URL   = "https://spirometerai.netlify.app/api/ingest";
const char* DEVICE_ID = "ESP32-SPIRO-01";
const char* API_KEY   = "my-super-secret-key-123";   // keep secret

// ── HX711 calibration ─────────────────────────────────────────────────────────
// Tune these against a 3 L reference syringe (ATS/ERS standard)
const long   HX_OFFSET    = 1600000L;
const double HX_SCALE     = 8000000.0;  // raw units per L/s

// ── Test thresholds ───────────────────────────────────────────────────────────
const float FLOW_THRESHOLD = 0.20f;  // L/s to start test
const int   SAMPLE_RATE_MS = 12;     // ~83 SPS (HX711 at 80 SPS mode)
const int   END_PAUSE_MS   = 1500;   // stop if flow below threshold for this long
const int   MAX_TEST_MS    = 15000;  // hard cap 15 s

// ── Hardware pins ─────────────────────────────────────────────────────────────
#define HX_DOUT  16
#define HX_SCK   17
#define OLED_SDA 21
#define OLED_SCL 22
#define LED_R    25
#define LED_G    26
#define LED_B    27

#define OLED_WIDTH  128
#define OLED_HEIGHT 64
#define OLED_ADDR   0x3C

// ── Globals ───────────────────────────────────────────────────────────────────
HX711               scale;
Adafruit_SSD1306    oled(OLED_WIDTH, OLED_HEIGHT, &Wire, -1);
Preferences         prefs;

float  gFvc = 0, gFev1 = 0, gPeak = 0;
bool   gTestDone = false;

// ── Helpers ───────────────────────────────────────────────────────────────────
void setLed(bool r, bool g, bool b) {
  digitalWrite(LED_R, r ? HIGH : LOW);
  digitalWrite(LED_G, g ? HIGH : LOW);
  digitalWrite(LED_B, b ? HIGH : LOW);
}

void oledMsg(const char* line1, const char* line2 = "", const char* line3 = "") {
  oled.clearDisplay();
  oled.setTextSize(1); oled.setTextColor(SSD1306_WHITE);
  oled.setCursor(0,  0); oled.println(line1);
  oled.setCursor(0, 20); oled.println(line2);
  oled.setCursor(0, 40); oled.println(line3);
  oled.display();
}

// ── Wi-Fi ─────────────────────────────────────────────────────────────────────
void connectWifi() {
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  oledMsg("Connecting Wi-Fi", WIFI_SSID);
  unsigned long t = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t < 15000) delay(300);
  if (WiFi.status() == WL_CONNECTED)
    oledMsg("Wi-Fi OK", WiFi.localIP().toString().c_str());
  else
    oledMsg("Wi-Fi FAILED", "Tests saved locally");
}

// ── Upload to Netlify ─────────────────────────────────────────────────────────
bool postResult(float fvc, float fev1, float peak) {
  if (WiFi.status() != WL_CONNECTED) connectWifi();
  if (WiFi.status() != WL_CONNECTED) return false;

  WiFiClientSecure client;
  client.setInsecure();  // dev only — replace with setCACert() for production

  HTTPClient http;
  http.begin(client, API_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", API_KEY);
  http.setTimeout(10000);

  char body[200];
  snprintf(body, sizeof(body),
    "{\"deviceId\":\"%s\",\"fvc\":%.3f,\"fev1\":%.3f,\"peakFlow\":%.3f}",
    DEVICE_ID, fvc, fev1, peak);

  int code = http.POST(body);
  http.end();
  return code == 201;
}

// ── Store / retry failed upload ───────────────────────────────────────────────
void storeRetry(float fvc, float fev1, float peak) {
  prefs.begin("spiro", false);
  prefs.putFloat("fvc",  fvc);
  prefs.putFloat("fev1", fev1);
  prefs.putFloat("peak", peak);
  prefs.putBool("pending", true);
  prefs.end();
}

void retryPending() {
  prefs.begin("spiro", true);
  bool pending = prefs.getBool("pending", false);
  if (!pending) { prefs.end(); return; }
  float fvc  = prefs.getFloat("fvc",  0);
  float fev1 = prefs.getFloat("fev1", 0);
  float peak = prefs.getFloat("peak", 0);
  prefs.end();

  oledMsg("Retrying upload…");
  if (postResult(fvc, fev1, peak)) {
    prefs.begin("spiro", false);
    prefs.putBool("pending", false);
    prefs.end();
    oledMsg("Retry OK!");
    delay(1500);
  }
}

// ── Evaluate and display result ───────────────────────────────────────────────
void evaluateResults(float fvc, float fev1) {
  float ratio = (fvc > 0) ? (fev1 / fvc) * 100.0f : 0;

  char l1[32], l2[32], l3[32];
  snprintf(l1, sizeof(l1), "FVC:  %.2f L", fvc);
  snprintf(l2, sizeof(l2), "FEV1: %.2f L", fev1);
  snprintf(l3, sizeof(l3), "Ratio:%.1f%%", ratio);

  if (ratio >= 75 && fvc >= 3.5f) {
    setLed(false, true, false);       // green
    oled.clearDisplay();
    oled.setTextSize(2); oled.setTextColor(SSD1306_WHITE);
    oled.setCursor(28, 0); oled.println("Normal");
    oled.setTextSize(1);
    oled.setCursor(0, 24); oled.println(l1);
    oled.setCursor(0, 36); oled.println(l2);
    oled.setCursor(0, 48); oled.println(l3);
  } else if (ratio >= 65 && fvc >= 2.5f) {
    setLed(true, true, false);        // yellow
    oled.clearDisplay();
    oled.setTextSize(1); oled.setTextColor(SSD1306_WHITE); // Use size 1 to fit "Restrictive"
    oled.setCursor(30, 0); oled.println("RESTRICTIVE");
    oled.setCursor(0, 24); oled.println(l1);
    oled.setCursor(0, 36); oled.println(l2);
    oled.setCursor(0, 48); oled.println(l3);
  } else {
    setLed(true, false, false);       // red
    oled.clearDisplay();
    oled.setTextSize(1); oled.setTextColor(SSD1306_WHITE); // Use size 1 to fit "Obstructive"
    oled.setCursor(30, 0); oled.println("OBSTRUCTIVE");
    oled.setCursor(0, 24); oled.println(l1);
    oled.setCursor(0, 36); oled.println(l2);
    oled.setCursor(0, 48); oled.println(l3);
  }
  oled.display();
}

// ── Main spirometry test loop ─────────────────────────────────────────────────
void runSpirometryTest() {
  oledMsg("Ready", "Blow forcefully", "into mouthpiece");
  setLed(false, false, true);  // blue = ready

  // ── Wait for test start ───────────────────────────────────────────────────
  while (true) {
    if (!scale.is_ready()) continue;
    float flow = (scale.get_units(1) - HX_OFFSET) / HX_SCALE;
    if (flow >= FLOW_THRESHOLD) break;
    delay(SAMPLE_RATE_MS);
  }

  // ── Recording phase ───────────────────────────────────────────────────────
  oledMsg("Recording…");
  setLed(true, true, false);  // yellow = recording

  float fvc      = 0;
  float fev1     = 0;
  float peakFlow = 0;
  unsigned long testStart   = millis();
  unsigned long belowSince  = 0;
  bool          fev1Locked  = false;

  while (true) {
    unsigned long now = millis();
    unsigned long elapsed = now - testStart;

    if (!scale.is_ready()) { delay(SAMPLE_RATE_MS); continue; }

    float raw  = scale.get_units(1);
    float flow = (raw - HX_OFFSET) / HX_SCALE;
    if (flow < 0) flow = 0;

    float dt_s = SAMPLE_RATE_MS / 1000.0f;
    fvc += flow * dt_s;

    if (flow > peakFlow) peakFlow = flow;

    if (!fev1Locked && elapsed <= 1000) fev1 = fvc;
    if (elapsed > 1000) fev1Locked = true;

    // End-of-test detection
    if (flow < FLOW_THRESHOLD) {
      if (belowSince == 0) belowSince = now;
      if (now - belowSince >= (unsigned long)END_PAUSE_MS) break;
    } else {
      belowSince = 0;
    }
    if (elapsed >= MAX_TEST_MS) break;

    delay(SAMPLE_RATE_MS);
  }

  // ── Store sample stats ────────────────────────────────────────────────────
  gFvc = fvc; gFev1 = fev1; gPeak = peakFlow;

  // ── Evaluate ──────────────────────────────────────────────────────────────
  evaluateResults(fvc, fev1);
  delay(2000);

  // ── Upload result ─────────────────────────────────────────────────────────
  oledMsg("Uploading…");
  bool ok = postResult(fvc, fev1, peakFlow);
  if (ok) {
    oledMsg("Upload OK!", "Result saved");
  } else {
    storeRetry(fvc, fev1, peakFlow);
    oledMsg("UPLOAD FAILED", "Saved locally", "Will retry next boot");
  }

  // ── Hold display for 10 s ─────────────────────────────────────────────────
  delay(10000);
  setLed(false, false, false);
  gTestDone = true;
}

// ── setup / loop ──────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);

  // Pins
  pinMode(LED_R, OUTPUT); pinMode(LED_G, OUTPUT); pinMode(LED_B, OUTPUT);
  setLed(false, false, false);

  // OLED
  Wire.begin(OLED_SDA, OLED_SCL);
  if (!oled.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
    Serial.println("OLED init failed"); while (true);
  }
  oled.clearDisplay(); oled.display();

  // HX711
  scale.begin(HX_DOUT, HX_SCK);
  scale.set_scale(HX_SCALE);
  scale.tare();

  // Wi-Fi
  connectWifi();
  retryPending();

  oledMsg("SpiroSense AI", "Ready");
}

void loop() {
  gTestDone = false;
  runSpirometryTest();
  delay(3000);
}
