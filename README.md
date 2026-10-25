# 🩸 Supervivencia

Variante de combate inspirada en la mecánica de personajes secretos de *Citadels*: 12 criaturas sobrenaturales, 7 vidas por jugador y cartas de Ataque y Armadura. El último en pie gana.

Se juega en el navegador del móvil, cada uno en el suyo, entrando en una sala con un código de 4 letras. Funciona por internet (wifi o datos móviles), sin cuentas: conexión P2P (PeerJS/WebRTC) y, si la red la bloquea, un repetidor público automático (MQTT).

## Archivos
- `index.html`: página principal
- `core.js`: salas, código y conexión
- `superviv.js`: el juego
- `styles.css`: estilos

## Reglas
- Cada jugador empieza con 7 vidas, 2 de oro y 4 cartas.
- Cartas de Ataque: Daga ⚔️1 (0 oro), Espada ⚔️2 (1), Hacha ⚔️3 (2), Lanza de fuego ⚔️4 (3).
- Cartas de Armadura: Escudo de madera 🛡️1 (0), Cota de malla 🛡️2 (1), Armadura de placas 🛡️3 (2). Máximo 6 de armadura.
- Cada ronda, empezando por el más herido, cada uno elige una criatura en secreto (con 2-3 jugadores, dos). Una queda oculta y otras fuera de juego a la vista.
- Las criaturas actúan por orden (1 → 12). En tu turno: coge 2 de oro o roba 2 cartas y quédate 1. Después puedes atacar 1 vez, equiparte 1 armadura y usar tu poder.
- El daño gasta primero la armadura y luego las vidas. A 0 vidas quedas eliminado.
- Desde la ronda 10, al final de cada ronda todos pierden 1 vida.

## Criaturas
1. 🐍 Medusa: petrifica a una criatura, que pierde su turno.
2. 👺 Goblin: al atacar, roba 1 de oro por cada punto de daño.
3. 👻 Fantasma: su ataque ignora la armadura, salvo contra el Cazador de Brujas.
4. 🗡️ Cazador de Brujas: cobra 2 de oro; si el Fantasma le ataca, el ataque falla y el Fantasma recibe 2 de daño.
5. 🧜 Sirena: canto, quita 1 vida directa a un jugador y le roba 1 carta al azar.
6. 🐺 Licántropo: después de atacar, gana 2 de armadura.
7. 🧛 Vampiro: al atacar, se cura lo que quite en vidas (máximo 2).
8. 🧙 Mago: roba 1 carta extra; al atacar, se cura 1 vida.
9. 😇 Ángel: revive a un caído con 2 vidas (una vez por jugador) o cura 2 vidas.
10. 👹 Demonio: su ataque golpea a 2 jugadores con todo el daño.
11. 🐉 Dragón: su ataque hace +2 de daño.
12. 🌊 Leviatán: maremoto, 2 de daño a todos los demás a cambio de perder 2 vidas.

Todos los números están juntos al principio de `superviv.js` (objeto `R`) para equilibrarlos fácilmente.
