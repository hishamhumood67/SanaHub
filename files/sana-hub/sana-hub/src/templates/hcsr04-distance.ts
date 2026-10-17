import type { Localized } from '@/i18n/dictionaries'
import type { ProjectTemplate } from './types'

const L = (en: string, ar: string): Localized => ({ en, ar })

export const hcsr04Template: ProjectTemplate = {
  id: 'esp32-hcsr04-distance',
  layout: 'esp32-hcsr04',
  codeLang: 'cpp',
  title: L('Ultrasonic distance meter', 'مقياس المسافة بالموجات فوق الصوتية'),
  summary: L(
    'Measure distance with an HC-SR04 and print it on the Serial Monitor.',
    'قس المسافة بحساس HC-SR04 واطبعها على مراقب السيريال.',
  ),

  steps: [
    {
      id: 'gnd',
      title: L('Connect ground first', 'وصّل الأرضي أولًا'),
      body: L(
        'Wire HC-SR04 GND to any ESP32 GND pin. Every signal needs a shared 0 V reference.',
        'وصّل GND في الحساس بأي دبوس GND في ESP32. كل إشارة تحتاج مرجع 0 فولت مشترك.',
      ),
      pins: ['hcsr04:GND', 'esp32:GND1'],
    },
    {
      id: 'vcc',
      title: L('Power the sensor', 'غذِّ الحساس'),
      body: L(
        'Wire VCC to the ESP32 VIN pin. The module needs about 5 V.',
        'وصّل VCC بدبوس VIN في ESP32. الوحدة تحتاج حوالي 5 فولت.',
      ),
      pins: ['hcsr04:VCC', 'esp32:VIN'],
    },
    {
      id: 'trig',
      title: L('Wire the trigger', 'وصّل دبوس التشغيل'),
      body: L(
        'Wire TRIG to GPIO18. The ESP32 sends a 10 µs pulse here to start each measurement.',
        'وصّل TRIG بـ GPIO18. يرسل ESP32 نبضة 10 ميكروثانية هنا ليبدأ كل قياس.',
      ),
      pins: ['hcsr04:TRIG', 'esp32:D18'],
    },
    {
      id: 'echo',
      title: L('Wire the echo safely', 'وصّل الصدى بأمان'),
      body: L(
        'Wire ECHO to GPIO19 through a 1 kΩ / 2 kΩ voltage divider, because ECHO outputs 5 V.',
        'وصّل ECHO بـ GPIO19 عبر مقسّم جهد 1 كيلو / 2 كيلو أوم، لأن ECHO يخرج 5 فولت.',
      ),
      pins: ['hcsr04:ECHO', 'esp32:D19'],
    },
  ],

  starterCode: `// ESP32 + HC-SR04 distance meter
const int TRIG_PIN = 18;
const int ECHO_PIN = 19;

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
}

void loop() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  float cm = duration * 0.0343f / 2.0f;
  Serial.printf("Distance: %.1f cm\\n", cm);
  delay(200);
}`,

  codeExplain: [
    {
      code: 'const int TRIG_PIN = 18;',
      note: L('Names the pin once, so you change it in one place only.', 'تسمّي الدبوس مرة وحدة، فتغيّره من مكان واحد فقط.'),
    },
    {
      code: 'Serial.begin(115200);',
      note: L('Opens the USB serial link. Set the Serial Monitor to the same 115200 baud.', 'يفتح اتصال USB السيريال. اضبط مراقب السيريال على نفس السرعة 115200.'),
    },
    {
      code: 'digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10);',
      note: L('A 10 µs HIGH pulse tells the sensor to fire 8 bursts of 40 kHz sound.', 'نبضة HIGH مدتها 10 ميكروثانية تأمر الحساس بإطلاق 8 دفعات صوت بتردد 40 كيلوهرتز.'),
    },
    {
      code: 'pulseIn(ECHO_PIN, HIGH, 30000);',
      note: L('Measures how long ECHO stays HIGH, in µs. The 30000 µs timeout (about 5 m) stops the code waiting forever.', 'يقيس كم يبقى ECHO بحالة HIGH بالميكروثانية. المهلة 30000 (حوالي 5 م) تمنع الكود من الانتظار للأبد.'),
    },
    {
      code: 'float cm = duration * 0.0343f / 2.0f;',
      note: L('Sound travels 0.0343 cm per µs. Divide by 2 because the pulse goes out and back.', 'الصوت يقطع 0.0343 سم لكل ميكروثانية. نقسم على 2 لأن النبضة تذهب وتعود.'),
    },
  ],
}
