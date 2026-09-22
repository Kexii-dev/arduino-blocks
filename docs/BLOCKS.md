# Catalogue des blocs

Chaque bloc : type interne → code C++ généré. Les effets de préambule (`pinMode`, includes, `Serial.begin`) sont déduits automatiquement par `collectPreamble()`.

## ⚡ Action

| Bloc | Type | C++ généré | Préambule |
|---|---|---|---|
| LED intégrée allumée/éteinte | `arduino_led` | `digitalWrite(LED_BUILTIN, HIGH\|LOW);` | — |
| Mettre la broche N à HAUT/BAS | `arduino_digital_write` | `digitalWrite(N, HIGH\|LOW);` | `pinMode(N, OUTPUT);` |
| Mettre la broche N à la puissance V (PWM) | `arduino_analog_write` | `analogWrite(N, V);` (broches 3/5/6/9/10/11, 0-255) | — |
| Attendre N millisecondes | `arduino_delay` | `delay(N);` | — |

## 👀 Entrées

| Bloc | Type | C++ généré | Préambule |
|---|---|---|---|
| Lire la broche N | `arduino_digital_read` | `digitalRead(N)` (valeur) | `pinMode(N, INPUT);` |
| Lire la broche analogique Ax | `arduino_analog_read` | `analogRead(Ax)` (0-1023) | — |
| HAUT / BAS | `arduino_highlow` | `HIGH` / `LOW` | — |

## 🔊 Sons & servo

| Bloc | Type | C++ généré | Préambule |
|---|---|---|---|
| Jouer une tonalité | `arduino_tone` | `tone(N, FREQ);` (31-4000 Hz) | — |
| Stopper la tonalité | `arduino_notone` | `noTone(N);` | — |
| Moteur servo à D° | `arduino_servo` | `servo_N.write(D);` (broches 9/10, 0-180°) | `#include <Servo.h>`, `Servo servo_N;`, `servo_N.attach(N);` |

## 🧭 Contrôle

| Bloc | Type | C++ généré |
|---|---|---|
| Si … alors … sinon … | `arduino_if` | `if (cond) { … } else { … }` (branche sinon omise si vide) |
| Tant que / jusqu'à | `controls_whileUntil` | `while (cond) { … }` (`!cond` en mode UNTIL) |
| Répéter N fois | `controls_repeat` | `for (int _i = 0; _i < N; _i++) { … }` |

## ⚖️ Logique

| Bloc | Type | C++ généré |
|---|---|---|
| Comparer (=, ≠, <, ≤, >, ≥) | `logic_compare` | `a == b`, `a != b`, … |
| ET / OU | `logic_operation` | `a && b` / `a \|\| b` |
| Pas | `logic_negate` | `!a` |
| Vrai / Faux | `logic_boolean` | `true` / `false` |

## 🔢 Calculs

| Bloc | Type | C++ généré |
|---|---|---|
| Nombre | `math_number` | `42` |
| + − × ÷ puissance | `math_arithmetic` | `a + b` … `pow(a, b)` |
| Reste (modulo) | `math_modulo` | `a % b` |
| Aléatoire entre A et B | `math_random_int` | `random(A, B + 1)` |

## 💾 Variables (typées)

Déclarer d'abord avec **« créer la variable »**, puis les dropdowns listent dynamiquement les variables déclarées.

| Bloc | Type | C++ généré |
|---|---|---|
| Créer la variable X de type nombre/texte | `arduino_var_create` | préambule : `int X = 0;` ou `String X = "";` |
| Mettre X à V | `arduino_var_set` | `X = V;` |
| Augmenter X de D | `arduino_var_change` | `X += D;` (variables nombre uniquement) |
| Lire X | `arduino_var_get` | `X` (valeur) |

## 📡 Série

| Bloc | Type | C++ généré | Préambule |
|---|---|---|---|
| Démarrer la série à B bauds | `arduino_serial_init` | — | `Serial.begin(B);` en tête de `setup()` |
| Envoyer la ligne T | `arduino_serial_print` | `Serial.println(T);` | — |
| Lire un caractère | `arduino_serial_read` | `(int)Serial.read()` | — |
| Données disponibles ? | `arduino_serial_available` | `Serial.available()` | — |

## 🔤 Textes

| Bloc | Type | C++ généré |
|---|---|---|
| Texte "…" | `arduino_text` | `"…"` (guillemets échappés) |
| Ajouter le texte T à X | `arduino_text_append` | `X += T;` (variables texte) |
| Longueur du texte T | `arduino_text_length` | `T.length()` |
| Texte A égal à B | `arduino_text_equals` | `A == B` |

## 🧩 Fonctions

| Bloc | Type | C++ généré |
|---|---|---|
| Fonction F { corps } | `arduino_function` | `void F() { … }` — émise en global **avant** `setup()` (jamais dans `loop()`) |
| Appeler F | `arduino_function_call` | `F();` |

⚠️ Le dropdown « appeler » liste des noms fixes (`maFonction`, `clignoter`, `avancer`) — renommez la fonction ou ajoutez le nom dans la liste déroulante. Amélioration prévue : dropdown dynamique comme les variables.

## Exemple complet

```cpp
// Arduino Blocks — généré avec Blockly 13.3
int compteur = 0;

void setup() {
  Serial.begin(9600);
  pinMode(2, INPUT);
  pinMode(13, OUTPUT);
}

void loop() {
  if (digitalRead(2) == HIGH) {
    digitalWrite(LED_BUILTIN, HIGH);
    compteur += 1;
    Serial.println(compteur);
  }
  else {
    digitalWrite(LED_BUILTIN, LOW);
  }
  delay(100);
}
```
