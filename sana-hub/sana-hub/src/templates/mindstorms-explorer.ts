import type { Localized } from '@/i18n/dictionaries'
import type { ProjectTemplate } from './types'

const L = (en: string, ar: string): Localized => ({ en, ar })

export const mindstormsTemplate: ProjectTemplate = {
  id: 'mindstorms-obstacle-stopper',
  layout: 'mindstorms',
  codeLang: 'python',
  title: L('Obstacle stopper robot', 'روبوت يتوقف عند العائق'),
  summary: L(
    'A motor drives forward until the ultrasonic sensor sees something closer than 20 cm.',
    'محرك يتحرك للأمام إلى أن يرى الحساس فوق الصوتي شيئًا أقرب من 20 سم.',
  ),
  steps: [
    {
      id: 'motor',
      title: L('Plug in the motor', 'وصّل المحرك'),
      body: L('Motors go on the output ports. Use port A.', 'المحركات تروح لمنافذ الخرج. استخدم المنفذ A.'),
      pins: ['motor:CON', 'ev3:A'],
    },
    {
      id: 'ultra',
      title: L('Plug in the ultrasonic sensor', 'وصّل الحساس فوق الصوتي'),
      body: L('Sensors go on the input ports. Use port 1.', 'الحساسات تروح لمنافذ الدخل. استخدم المنفذ 1.'),
      pins: ['ultra:CON', 'ev3:1'],
    },
    {
      id: 'color',
      title: L('Plug in the color sensor', 'وصّل حساس اللون'),
      body: L('Use input port 2, so each sensor has its own port.', 'استخدم منفذ الدخل 2 حتى يكون لكل حساس منفذه.'),
      pins: ['color:CON', 'ev3:2'],
    },
  ],
  starterCode: `#!/usr/bin/env pybricks-micropython
from pybricks.ev3devices import Motor, UltrasonicSensor, ColorSensor
from pybricks.parameters import Port
from pybricks.tools import wait

motor = Motor(Port.A)
eyes = UltrasonicSensor(Port.S1)
color = ColorSensor(Port.S2)

while True:
    if eyes.distance() < 200:      # millimetres
        motor.stop()
    else:
        motor.run(360)             # degrees per second
    print(color.color())
    wait(50)`,
  codeExplain: [
    {
      code: 'motor = Motor(Port.A)',
      note: L('The port in code must match the port you plugged the cable into.', 'المنفذ في الكود لازم يطابق المنفذ اللي وصّلت فيه الكابل.'),
    },
    {
      code: 'eyes.distance() < 200',
      note: L('The sensor reports millimetres, so 200 means 20 cm.', 'الحساس يعطي القراءة بالملّيمتر، فـ 200 تعني 20 سم.'),
    },
    {
      code: 'motor.run(360)',
      note: L('Runs the motor at 360 degrees per second until you stop it.', 'يشغّل المحرك بسرعة 360 درجة في الثانية إلى أن توقفه.'),
    },
    {
      code: 'wait(50)',
      note: L('Pauses 50 ms so the loop does not hog the brick.', 'ينتظر 50 ميلّي ثانية حتى لا يستهلك الحلقة موارد الوحدة.'),
    },
  ],
}
