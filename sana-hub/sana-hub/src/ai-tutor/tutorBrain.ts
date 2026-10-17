import type { Localized } from '@/i18n/dictionaries'
import type { EvalResult } from '@/simulators/circuitEvaluator'
import type { ProjectTemplate } from '@/templates/types'

export interface TutorContext {
  result: EvalResult
  echoDivider: boolean
  template: ProjectTemplate
}

const L = (en: string, ar: string): Localized => ({ en, ar })

/** Lowercase, strip Arabic diacritics/tatweel, unify alef/ya/ta-marbuta so keywords match loosely */
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')

const kw = (...words: string[]) => words.map(norm)
const hasAny = (text: string, words: string[]) => words.some((w) => text.includes(w))

const WHY = kw('why', 'not working', "doesn't work", 'doesnt work', 'wrong', 'error', 'check', 'review', 'bug', 'problem', 'ليش', 'لماذا', 'ما يشتغل', 'مش شغال', 'لا يعمل', 'ما اشتغل', 'خطا', 'مشكله', 'افحص', 'راجع')
const ECHO = kw('echo', 'divider', 'voltage', '5v', '5 v', 'level shift', 'ايكو', 'الصدي', 'مقسم', 'جهد', 'فولت')
const TRIG = kw('trig', 'pulse', '10us', '10 us', 'microsecond', 'timing', 'نبضه', 'نبضة', 'ميكروثانيه', 'توقيت')
const PINS = kw('which pin', 'gpio', 'input only', 'input-only', 'strapping', 'pin choice', 'اي دبوس', 'ايش دبوس', 'اختيار', 'دبوس')
const CODE = kw('code', 'explain', 'sketch', 'pulsein', 'كود', 'اشرح', 'شرح', 'سطر')
const BLOCKS = kw('block', 'blocks', 'scratch', 'convert', 'c++', 'cpp', 'بلوك', 'بلوكات', 'حول', 'تحويل')
const HELLO = kw('hi', 'hello', 'hey', 'salam', 'مرحبا', 'هلا', 'السلام', 'اهلا')

function diagnose({ result, template }: TutorContext): Localized {
  if (result.complete) {
    return L(
      'Everything checks out: every step is wired correctly. Run the starter code from the template and watch it work.',
      'كل شيء سليم: كل الخطوات موصولة صح. شغّل الكود الأساسي من القالب وشوف النتيجة.',
    )
  }
  const real = result.issues.filter((i) => i.severity !== 'info').slice(0, 3)
  if (real.length === 0) {
    const next = template.steps.find((s) => result.steps[s.id] === 'todo') ?? template.steps[template.steps.length - 1]
    return L(
      `No faults so far. Next up: ${next.title.en}. ${next.body.en}`,
      `ما فيه أخطاء لين الحين. الخطوة الجاية: ${next.title.ar}. ${next.body.ar}`,
    )
  }
  return L(
    `I found ${real.length} thing${real.length > 1 ? 's' : ''} to fix:\n${real.map((i) => `• ${i.msg.en}\n  Fix: ${i.fix.en}`).join('\n')}`,
    `لقيت ${real.length} ${real.length > 2 ? 'نقاط' : 'نقطة'} تحتاج تصحيح:\n${real.map((i) => `• ${i.msg.ar}\n  الحل: ${i.fix.ar}`).join('\n')}`,
  )
}

const echoAnswer = (ctx: TutorContext): Localized =>
  L(
    `The HC-SR04 runs on 5 V, so ECHO swings up to 5 V. ESP32 pins are 3.3 V only and have no protection for 5 V.\n\nA divider fixes it: ECHO → 1 kΩ → GPIO pin → 2 kΩ → GND.\nVout = 5 V × 2 kΩ ÷ (1 kΩ + 2 kΩ) ≈ 3.3 V.\n\n${ctx.echoDivider ? 'You already ticked the divider box, nice.' : 'When you have built it, tick the box in the Project review tab.'}`,
    `حساس HC-SR04 يشتغل بـ 5 فولت، فإشارة ECHO توصل 5 فولت. دبابيس ESP32 تتحمل 3.3 فولت فقط وما فيها حماية من 5 فولت.\n\nالمقسّم يحل المشكلة: ECHO ← 1 كيلو أوم ← دبوس GPIO ← 2 كيلو أوم ← GND.\nالجهد الخارج = 5 × 2 ÷ (1 + 2) ≈ 3.3 فولت.\n\n${ctx.echoDivider ? 'علّمت مربع المقسّم من قبل، ممتاز.' : 'إذا ركّبته، علّم المربع في تبويب مراجعة المشروع.'}`,
  )

const trigAnswer = (): Localized =>
  L(
    'A measurement works like this:\n1. TRIG goes HIGH for 10 µs.\n2. The sensor fires 8 bursts of 40 kHz sound.\n3. ECHO goes HIGH until the sound bounces back.\n4. Distance (cm) = pulse width (µs) × 0.0343 ÷ 2.\n\nExample: a 1166 µs pulse means about 20 cm.',
    'القياس يمشي كذا:\n1. يرتفع TRIG إلى HIGH لمدة 10 ميكروثانية.\n2. الحساس يطلق 8 دفعات صوت بتردد 40 كيلوهرتز.\n3. يبقى ECHO بحالة HIGH لين يرجع الصدى.\n4. المسافة (سم) = عرض النبضة (µs) × 0.0343 ÷ 2.\n\nمثال: نبضة 1166 ميكروثانية تعني حوالي 20 سم.',
  )

const pinsAnswer = (): Localized =>
  L(
    'Picking ESP32 pins:\n• GPIO34, 35, 36 and 39 are input-only: fine for ECHO, impossible for TRIG.\n• GPIO0, 2, 5, 12 and 15 are strapping pins: avoid anything that pulls them at boot.\n• GPIO1 and 3 are the USB serial pins: keep them free.\n• Safe choices for this project: TRIG on GPIO18, ECHO on GPIO19.',
    'اختيار دبابيس ESP32:\n• GPIO34 و35 و36 و39 دخل فقط: ممتازة لـ ECHO ولا تصلح لـ TRIG.\n• GPIO0 و2 و5 و12 و15 دبابيس إقلاع: تجنّب أي شيء يسحبها وقت التشغيل.\n• GPIO1 و3 هي دبابيس USB السيريال: اتركها فاضية.\n• خيارات آمنة لهذا المشروع: TRIG على GPIO18 وECHO على GPIO19.',
  )

function codeAnswer(template: ProjectTemplate): Localized {
  const en = template.codeExplain.map((c) => `• ${c.code}\n  ${c.note.en}`).join('\n')
  const ar = template.codeExplain.map((c) => `• ${c.code}\n  ${c.note.ar}`).join('\n')
  const fence = '```'
  return L(
    `Here is the starter sketch:\n${fence}${template.codeLang}\n${template.starterCode}\n${fence}\nKey lines:\n${en}`,
    `هذا الكود الأساسي:\n${fence}${template.codeLang}\n${template.starterCode}\n${fence}\nأهم الأسطر:\n${ar}`,
  )
}

function blocksAnswer(template: ProjectTemplate): Localized {
  const fence = '```'
  const blocks = `when ESP32 starts
  set pin 18 mode OUTPUT
  set pin 19 mode INPUT
forever
  set pin 18 LOW, wait 2 µs
  set pin 18 HIGH, wait 10 µs
  set pin 18 LOW
  duration = pulse length on pin 19 (HIGH)
  distance = duration × 0.0343 ÷ 2
  print "Distance" distance
  wait 200 ms`
  return L(
    `Each block maps to one C++ line. Your blocks:\n${fence}\n${blocks}\n${fence}\nbecome:\n${fence}${template.codeLang}\n${template.starterCode}\n${fence}\n"when ESP32 starts" is setup(), and "forever" is loop().`,
    `كل بلوك يقابل سطر C++. بلوكاتك:\n${fence}\n${blocks}\n${fence}\nتصير:\n${fence}${template.codeLang}\n${template.starterCode}\n${fence}\nالبلوك "when ESP32 starts" هو setup()، والبلوك "forever" هو loop().`,
  )
}

const hello = (): Localized =>
  L(
    'Hi there! Ask me about your wiring, the voltage divider, the pulse timing, or the code.',
    'هلا والله! اسألني عن التوصيل، مقسّم الجهد، توقيت النبضة، أو الكود.',
  )

const fallback = (): Localized =>
  L(
    'I can help with wiring checks, the voltage divider, pulse timing, pin choices, the code, and Blocks → C++. Try one of the quick questions below.',
    'أقدر أساعدك في فحص التوصيل، مقسّم الجهد، توقيت النبضة، اختيار الدبابيس، شرح الكود، وتحويل البلوكات إلى C++. جرّب أحد الأسئلة السريعة تحت.',
  )

/** Returns the reply in both languages so the chat can re-render if the user switches language. */
const genericBlocks = (): Localized =>
  L(
    'Block-to-code conversion for this project is coming soon. For now, open the starter code and tell me which line you want explained.',
    'تحويل البلوكات إلى كود لهذا المشروع قريبًا. حاليًا افتح الكود الأساسي وقل لي أي سطر تبي أشرحه.',
  )

export function tutorAnswer(question: string, ctx: TutorContext): Localized {
  const q = norm(question)
  const esp = ctx.template.layout === 'esp32-hcsr04'
  if (hasAny(q, BLOCKS)) return esp ? blocksAnswer(ctx.template) : genericBlocks()
  if (esp && hasAny(q, ECHO)) return echoAnswer(ctx)
  if (esp && hasAny(q, TRIG)) return trigAnswer()
  if (esp && hasAny(q, PINS)) return pinsAnswer()
  if (hasAny(q, CODE)) return codeAnswer(ctx.template)
  if (hasAny(q, WHY)) return diagnose(ctx)
  if (hasAny(q, HELLO)) return hello()
  return fallback()
}
