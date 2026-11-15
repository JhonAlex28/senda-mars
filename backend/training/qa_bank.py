"""Preguntas sobre cómo funciona y cómo se usa SENDA, con respuestas fieles a data/knowledge.

Cada entrada: el tema que hay que consultar (explain_system), formas de preguntarlo en español
e inglés, y la respuesta en cada idioma. Las respuestas solo usan cifras que están en la
documentación, para que el modelo aprenda a explicar desde la herramienta y no de memoria.
Las frases NO coinciden con eval/cases.json (el examen mide generalización)."""
from __future__ import annotations

QA: list[dict] = [
    # ---------- cómo se usa: using_senda ----------
    {"topic": "using_senda",
     "es": ["¿Cómo empiezo a planificar?", "¿Por dónde empiezo?", "Explícame el flujo de SENDA",
            "¿Cuáles son los pasos para armar una misión?"],
     "en": ["Where do I start planning?", "Walk me through how SENDA works step by step",
            "What are the steps to build a mission?"],
     "a_es": "SENDA se usa en cuatro pasos, en la barra de arriba del mapa: Goals → Rover → Spacewalks → Start.\n"
             "1. Goals: toca rocas en el mapa para añadirlas a My goals y ordénalas por prioridad.\n"
             "2. Rover: pulsa Find rover routes y elige entre la ruta Safest, Science o Quickest.\n"
             "3. Spacewalks: en Rover stops elige un estacionamiento y pulsa Plan spacewalk (uno por parada).\n"
             "4. Start: revisa la tarjeta final y pulsa Start mission para simular.\n"
             "Si prefieres, dime cuánto tiempo tienes y lo preparo yo.",
     "a_en": "SENDA works in four steps, shown on the bar at the top of the map: Goals → Rover → Spacewalks → Start.\n"
             "1. Goals: tap rocks on the map to add them to My goals and order them by priority.\n"
             "2. Rover: press Find rover routes and pick the Safest, Science or Quickest route.\n"
             "3. Spacewalks: in Rover stops choose a parking spot and press Plan spacewalk (one per stop).\n"
             "4. Start: check the final card and press Start mission to run the simulation.\n"
             "Or just tell me how much time you have and I will prepare it."},
    {"topic": "using_senda",
     "es": ["¿Cómo agrego un objetivo?", "¿Cómo elijo las rocas que quiero visitar?", "¿Cómo quito un objetivo de la lista?",
            "¿Cómo cambio el orden de prioridad de los objetivos?"],
     "en": ["How do I add a target?", "How do I pick the rocks to visit?", "How can I reorder my goals?"],
     "a_es": "Con la herramienta Select, toca una roca en el mapa para ver su tarjeta y añádela; tócala otra vez para quitarla. "
             "La tarjeta My goals las muestra en orden: arrástralas para cambiar la prioridad (la primera es la más importante). "
             "Quick Demo, en la cabecera, carga 3 objetivos de una vez.",
     "a_en": "With the Select tool, tap a rock on the map to see its card and add it; tap it again to remove it. "
             "The My goals card lists them in order: drag them to change the priority (first is the most important). "
             "Quick Demo in the header loads 3 targets at once."},
    {"topic": "using_senda",
     "es": ["¿Cómo pongo un área peligrosa para que las rutas la eviten?", "¿Cómo evito una zona del mapa?",
            "¿Cómo borro las zonas de peligro?"],
     "en": ["How do I add a danger zone?", "How can I make routes avoid an area?", "How do I remove danger zones?"],
     "a_es": "En las herramientas a la izquierda del mapa elige Mark danger zone y toca el mapa: aparece un círculo que las rutas evitan. "
             "Tócalo otra vez para quitarlo, o usa Clear danger zones para borrarlos todos. "
             "Después pulsa Recalculate routes para que el plan las tenga en cuenta.",
     "a_en": "In the tools on the left of the map choose Mark danger zone and tap the map: a circle appears that routes avoid. "
             "Tap it again to remove it, or use Clear danger zones to remove all of them. "
             "Then press Recalculate routes so the plan takes them into account."},
    {"topic": "using_senda",
     "es": ["¿Cómo muevo la base?", "Quiero poner la base en otro sitio", "¿Se puede cambiar la ubicación de Base Alpha?"],
     "en": ["How do I move the base?", "Can I put the base somewhere else?"],
     "a_es": "Tienes dos formas: el botón Change en la tarjeta Base Alpha, o la herramienta Move base a la izquierda del mapa "
             "y tocar el punto donde la quieres. Al moverla, las rutas calculadas se borran: vuelve a pulsar Find rover routes.",
     "a_en": "Two ways: the Change button on the Base Alpha card, or the Move base tool on the left of the map, then tap where you want it. "
             "Moving it clears the computed routes, so press Find rover routes again."},
    {"topic": "using_senda",
     "es": ["¿Cómo calculo las rutas del rover?", "¿Dónde busco el camino del rover?", "¿Cómo elijo entre las rutas del rover?"],
     "en": ["How do I get the rover routes?", "How do I choose a rover route?"],
     "a_es": "Con al menos un objetivo en My goals, pulsa Find rover routes. SENDA propone los estacionamientos y tres rutas: "
             "Safest (evita pendientes), Science (pasa cerca de las rocas) y Quickest (menos tiempo). "
             "Elige una en la tarjeta de comparación y el mapa la dibuja. Ajusta antes la velocidad en Your vehicle si quieres.",
     "a_en": "With at least one goal in My goals, press Find rover routes. SENDA proposes parking spots and three routes: "
             "Safest (avoids slopes), Science (passes near the rocks) and Quickest (least time). "
             "Pick one in the comparison card and the map draws it. You can set the speed in Your vehicle first."},
    {"topic": "using_senda",
     "es": ["¿Cómo se planea la parte a pie?", "¿Cómo organizo las caminatas desde el rover?", "¿Qué hago después de elegir la ruta del rover?"],
     "en": ["How do I plan the walking part?", "What do I do after choosing the rover route?"],
     "a_es": "En la tarjeta Rover stops elige un estacionamiento y pulsa Plan spacewalk. Compara las tres rutas a pie y elige una; "
             "Next stop planifica la siguiente parada. Cada estacionamiento necesita su caminata antes de poder empezar.",
     "a_en": "In the Rover stops card choose a parking spot and press Plan spacewalk. Compare the three walking routes and pick one; "
             "Next stop plans the next one. Every parking spot needs a spacewalk before you can start."},
    {"topic": "using_senda",
     "es": ["¿Cómo arranco la misión?", "¿Cómo se usa la simulación?", "¿Qué hago si en la simulación aparece un problema?"],
     "en": ["How do I launch the mission?", "How does the simulation work?", "How do I simulate a problem during the trip?"],
     "a_es": "Cuando todas las caminatas están planificadas, la tarjeta final muestra el veredicto del clima, la batería y el oxígeno; "
             "pulsa Start mission. En la simulación tienes Pause / Resume y las velocidades 1x, 4x y 15x. "
             "Something changed? simula un problema (camino bloqueado, tormenta de polvo o fuga en el traje) y SENDA busca una ruta nueva. "
             "Return to rover y Return to base terminan antes.",
     "a_en": "Once every spacewalk is planned, the final card shows the weather verdict, battery and oxygen; press Start mission. "
             "In the simulation you have Pause / Resume and the 1x, 4x and 15x speeds. "
             "Something changed? simulates a problem (blocked path, dust storm or suit leak) and SENDA finds a new route. "
             "Return to rover and Return to base end it early."},
    {"topic": "using_senda",
     "es": ["¿Qué botón inicia la simulación?", "¿Cómo se empieza la simulación?", "¿Cómo lanzo la misión yo mismo?"],
     "en": ["Which button starts the simulation?", "How can I begin the simulation myself?"],
     "a_es": "Cuando todas las caminatas están planificadas aparece la tarjeta final con el clima, la batería y el oxígeno: "
             "pulsa Start mission. También puedes pulsar el paso Start en la barra de arriba del mapa. Si quieres, dime "
             "\"inicia la simulación\" y lo hago yo.",
     "a_en": "Once every spacewalk is planned, the final card shows the weather, battery and oxygen: press Start mission. "
             "You can also press the Start step on the bar at the top of the map. Or tell me \"start the simulation\" and I will do it."},
    {"topic": "using_senda",
     "es": ["¿Cómo cambio de ruta?", "¿Dónde elijo la ruta científica?", "¿Cómo comparo las rutas?"],
     "en": ["How do I switch routes?", "Where do I pick the science route?"],
     "a_es": "Después de Find rover routes aparece una tarjeta que compara las tres rutas (Safest, Science y Quickest) con su tiempo, "
             "seguridad y batería: toca la que quieras y el mapa la dibuja. En cada caminata hay una tarjeta igual. "
             "También puedes decirme \"cambia a la ruta científica\".",
     "a_en": "After Find rover routes, a card compares the three routes (Safest, Science and Quickest) with time, safety and battery: "
             "tap the one you want and the map draws it. Each spacewalk has the same card. You can also tell me \"switch to the science route\"."},
    {"topic": "using_senda",
     "es": ["¿Cómo guardo un plan para mañana?", "¿Dónde veo los planes guardados?", "¿Cómo abro un plan que guardé?"],
     "en": ["How do I save a plan for tomorrow?", "Where are my saved plans?"],
     "a_es": "En la tarjeta Mission calendar pulsa Save plan, ponle un nombre y elige Today o Tomorrow. My plans muestra los planes "
             "de hoy, de mañana o todos; desde ahí puedes abrirlos, marcarlos como hechos o borrarlos. "
             "También puedes decirme \"guarda este plan para mañana\".",
     "a_en": "In the Mission calendar card press Save plan, name it and choose Today or Tomorrow. My plans lists today's, "
             "tomorrow's or all plans; from there you can open them, mark them done or delete them. You can also tell me \"save this plan for tomorrow\"."},
    {"topic": "using_senda",
     "es": ["¿Dónde veo los procedimientos que ya hice?", "¿Se guarda un historial de las misiones?"],
     "en": ["Where can I see the procedures already done?", "Is there a mission history?"],
     "a_es": "Sí: al terminar las tareas científicas en la simulación se guardan en Procedure history, dentro de la tarjeta My goals, "
             "agrupadas por sitio. El Mission summary del final muestra objetivos hechos, batería y oxígeno usados.",
     "a_en": "Yes: completed science procedures in the simulation are saved in Procedure history, inside the My goals card, "
             "grouped by site. The Mission summary at the end shows goals done, battery and oxygen used."},
    {"topic": "using_senda",
     "es": ["¿Para qué sirve el botón Scout waypoint?", "¿Puedo ver un camino seguro hasta un punto cualquiera?"],
     "en": ["What does Scout waypoint do?", "Can I preview a safe path to any point?"],
     "a_es": "Scout waypoint, en las herramientas del mapa, te deja tocar cualquier punto y ver un camino seguro del rover desde la base hasta ahí. "
             "Es una vista previa: no cambia tu plan.",
     "a_en": "Scout waypoint, in the map tools, lets you tap any point and preview a safe rover path from the base to it. "
             "It is only a preview: it does not change your plan."},
    {"topic": "using_senda",
     "es": ["¿Qué hay en NASA Labs?", "¿Para qué es el botón Crew?"],
     "en": ["What is inside NASA Labs?", "What is the Crew button for?"],
     "a_es": "Crew, en la cabecera, sirve para poner los nombres de los astronautas, el nombre del equipo y ver la salud de los trajes. "
             "NASA Labs tiene herramientas extra: Monte Carlo del traje, radar de suelo, rack de muestras y el optimizador cuántico.",
     "a_en": "Crew, in the header, sets the astronaut names, the team name and shows suit health. "
             "NASA Labs has extra tools: suit Monte Carlo, ground radar, sample rack and the quantum optimizer."},
    # ---------- mapa y clima: map_and_weather ----------
    {"topic": "map_and_weather",
     "es": ["¿Cómo activo las imágenes reales de Marte?", "¿Dónde está la foto orbital?", "¿Cómo pongo el mapa satelital?"],
     "en": ["How do I turn on the real Mars imagery?", "Where is the orbital photo?"],
     "a_es": "En el panel Layers, a la izquierda, enciende Orbital photo: son imágenes reales de NASA Mars Trek (CTX, 6 m por píxel). "
             "Necesita internet. Baja la opacidad de Terrain para verla mejor.",
     "a_en": "In the Layers panel on the left, turn on Orbital photo: real NASA Mars Trek imagery (CTX, 6 m per pixel). "
             "It needs internet. Lower the Terrain opacity to see it better."},
    {"topic": "map_and_weather",
     "es": ["¿Qué significan los colores naranja y rojo del mapa?", "¿Qué muestra la capa Slope?"],
     "en": ["What do the orange and red colors on the map mean?", "What does the Slope layer show?"],
     "a_es": "Es la capa Slope, calculada del DEM real: naranja es más de 10 grados (precaución) y rojo más de 18 grados, "
             "demasiado empinado para el rover. El control de la capa oculta las pendientes suaves.",
     "a_en": "That is the Slope layer, computed from the real DEM: orange is steeper than 10 degrees (caution) and red steeper than 18 degrees, "
             "too steep for the rover. The layer slider hides gentle slopes."},
    {"topic": "map_and_weather",
     "es": ["¿El terreno del mapa es real?", "¿De dónde sale la elevación del mapa?"],
     "en": ["Is the terrain on the map real?", "Where does the elevation come from?"],
     "a_es": "Sí. La capa Terrain usa el DEM MSL Gale Merged del USGS, de 1 m, hecho con HiRISE, CTX y MOLA. "
             "Las rutas se calculan sobre ese mismo terreno.",
     "a_en": "Yes. The Terrain layer uses the USGS MSL Gale Merged DEM at 1 m, built from HiRISE, CTX and MOLA. "
             "Routes are computed on that same terrain."},
    {"topic": "map_and_weather",
     "es": ["¿Para qué sirve Try a scenario?", "¿Los valores del simulador de clima son reales?"],
     "en": ["What is Try a scenario for?", "Are the weather simulator values real?"],
     "a_es": "Try a scenario es un simulador de práctica: polvo, hora del día y destello solar. Sus cifras son estimaciones, no mediciones; "
             "cambian el chequeo final de salida (un destello solar fuerza NO GO) pero no las rutas. Los datos reales están en Right now.",
     "a_en": "Try a scenario is a practice simulator: dust, time of day and a solar flare. Its numbers are estimates, not measurements; "
             "they change the final launch check (a solar flare forces NO GO) but not the routes. The real data is under Right now."},
    {"topic": "map_and_weather",
     "es": ["¿Qué es la capa Minerals?", "¿La capa de refugio de radiación es una medición?"],
     "en": ["What is the Minerals layer?", "Is the radiation shelter layer measured?"],
     "a_es": "Minerals dibuja las unidades de roca de Mount Sharp por franjas de altura: es un modelo, no una medición. "
             "Radiation shelter marca paredes empinadas que bloquean parte de la radiación: también es una estimación.",
     "a_en": "Minerals draws the Mount Sharp rock units by elevation band: it is a model, not a measurement. "
             "Radiation shelter marks steep walls that block part of the radiation: also an estimate."},
    # ---------- el copiloto ----------
    {"topic": "copilot",
     "es": ["¿Qué sabes hacer?", "¿En qué me puedes ayudar?", "¿Quién eres?", "¿Cómo funcionas?"],
     "en": ["What can you do?", "How can you help me?", "Who are you?", "How do you work?"],
     "a_es": "Soy el copiloto de SENDA. Puedo preparar una salida completa (clima, objetivos, rover y caminatas) según el tiempo que tengas, "
             "cambiar la ruta o la pantalla, decirte el clima de ahora, describir el plan que tienes en pantalla, listar los objetivos "
             "y explicarte cómo usar cualquier parte de SENDA. Las cifras siempre salen del planificador.",
     "a_en": "I am the SENDA copilot. I can prepare a whole outing (weather, targets, rover and walks) for the time you have, "
             "switch the route or the screen, tell you the current weather, describe the plan on screen, list the targets "
             "and explain how to use any part of SENDA. Every figure comes from the planner."},
    {"topic": "copilot",
     "es": ["¿Usas internet o una API de pago?", "¿Qué modelo de IA eres?"],
     "en": ["Do you use a paid API?", "Which AI model are you?"],
     "a_es": "Funciono con un modelo abierto y gratuito (Qwen3) que corre con Ollama en la computadora del backend, sin APIs de pago. "
             "El modelo solo entiende tu pedido; las rutas, tiempos y recursos los calcula el planificador de SENDA.",
     "a_en": "I run on a free open model (Qwen3) served by Ollama on the backend computer, with no paid APIs. "
             "The model only understands your request; routes, times and resources come from SENDA's planner."},
    # ---------- técnico ----------
    {"topic": "route_profiles",
     "es": ["¿Cómo se calcula la seguridad de una ruta?", "¿Qué significa el porcentaje de seguridad?"],
     "en": ["How is route safety computed?", "What does the safety percentage mean?"],
     "a_es": "safety_pct = 100 × (1 − parte de la distancia con más de 10 grados) × (1 − 0,5 × riesgo de la pendiente máxima). "
             "El riesgo es 0 hasta 10 grados y sube hasta 1 en la pendiente máxima (18 grados para el rover, 20 a pie).",
     "a_en": "safety_pct = 100 × (1 − share of distance above 10 degrees) × (1 − 0.5 × slope risk of the max slope). "
             "The risk is 0 up to 10 degrees and grows to 1 at the maximum slope (18 degrees for the rover, 20 on foot)."},
    {"topic": "route_profiles",
     "es": ["¿En qué se diferencian las tres rutas?", "¿Qué hace la ruta rápida?", "¿Por qué la ruta segura es más larga?"],
     "en": ["What is the difference between the three routes?", "Why is the safe route longer?"],
     "a_es": "Las tres salen del algoritmo A* con costos distintos: fast solo mira el tiempo y acepta más pendiente; "
             "safe penaliza fuerte la pendiente (peso 6) y pasar a menos de 40 m de una zona de peligro, por eso suele ser más larga; "
             "scientific penaliza poco la pendiente (peso 1,5) y abarata pasar cerca de los objetivos.",
     "a_en": "All three come from A* with different costs: fast only looks at time and accepts steeper ground; "
             "safe strongly penalizes slope (weight 6) and passing within 40 m of a danger zone, so it is usually longer; "
             "scientific has a mild slope penalty (weight 1.5) and makes passing near the targets cheaper."},
    {"topic": "mobility_and_resources",
     "es": ["¿Cómo se calcula el oxígeno que se gasta caminando?", "¿Cuánto oxígeno lleva un traje?"],
     "en": ["How is walking oxygen use computed?", "How much oxygen does a suit carry?"],
     "a_es": "El traje lleva 300 L de oxígeno. El gasto sale de la ecuación de Pandolf (75 kg de cuerpo, 45 kg de carga) ajustada a la gravedad "
             "de Marte (0,38 g) con un factor 1,25 por el traje; oxígeno = energía / 20,1 kJ por litro. Cada tarea científica suma 220 W.",
     "a_en": "The suit carries 300 L of oxygen. Use comes from the Pandolf equation (75 kg body, 45 kg load) scaled to Mars gravity "
             "(0.38 g) with a 1.25 suit factor; oxygen = energy / 20.1 kJ per liter. Each science task adds 220 W."},
    {"topic": "mobility_and_resources",
     "es": ["¿Qué significa que una ruta no permite volver?", "¿Qué es return_ok?"],
     "en": ["What does return_ok mean?", "When is a route unable to come back?"],
     "a_es": "return_ok exige que el recurso usado × 1,3 (factor de seguridad) quede por debajo del 80 % de la capacidad, es decir, "
             "guardar un 20 % de reserva. Si es falso, esa ruta no se debe hacer así y SENDA la descarta.",
     "a_en": "return_ok requires the resource used × 1.3 (safety factor) to stay below 80% of capacity, keeping a 20% reserve. "
             "If it is false, that route must not be done as planned and SENDA discards it."},
    {"topic": "mobility_and_resources",
     "es": ["¿Cuánta batería tiene el rover?", "¿Cómo gasta energía el rover?"],
     "en": ["How big is the rover battery?", "How does the rover use energy?"],
     "a_es": "El modelo del rover tiene 30 kWh, va a 2,5 m/s nominales y gasta 0,35 kWh por km rodando, más la energía de subir pendientes "
             "(3000 kg, 80 % de eficiencia) y 0,4 kW de consumo de cabina.",
     "a_en": "The rover model has 30 kWh, a nominal 2.5 m/s and uses 0.35 kWh per km rolling, plus the energy to climb "
             "(3000 kg, 80% efficiency) and a 0.4 kW cabin load."},
    {"topic": "readiness",
     "es": ["¿Qué umbrales usa el veredicto del clima?", "¿Con cuánto viento no se puede salir?", "¿Qué decide si es GO o NO GO?"],
     "en": ["Which thresholds does the weather verdict use?", "How much wind stops an EVA?", "What decides GO or NO GO?"],
     "a_es": "El veredicto es el peor de cuatro chequeos: frío (precaución bajo −40 °C, NO GO bajo −60 °C, REMS), viento (10 y 20 m/s, REMS), "
             "polvo (tau 1,0 y 3,5, Mastcam) y radiación (1 y 10 mSv por sol, RAD). Es una foto del sol actual, no un pronóstico.",
     "a_en": "The verdict is the worst of four checks: cold (caution below −40 °C, NO GO below −60 °C, REMS), wind (10 and 20 m/s, REMS), "
             "dust (tau 1.0 and 3.5, Mastcam) and radiation (1 and 10 mSv per sol, RAD). It is a snapshot of the current sol, not a forecast."},
    {"topic": "parking",
     "es": ["¿Cómo elige SENDA dónde estacionar el rover?", "¿Por qué el rover no llega hasta las rocas?"],
     "en": ["How does SENDA choose where to park the rover?", "Why doesn't the rover drive up to the rocks?"],
     "a_es": "El rover no entra en los afloramientos. Los objetivos se agrupan en zonas de 300 m empezando por el de mayor prioridad, "
             "y para cada zona se busca, a menos de 250 m del centro, el punto más cercano plano (10 grados o menos), fuera de zonas de peligro "
             "y a 70 m o más de cada objetivo. Las paradas se llaman P1, P2...",
     "a_en": "The rover does not drive onto the outcrops. Targets are grouped into 300 m zones starting with the highest priority one, "
             "and for each zone the planner looks within 250 m of its centre for the closest flat cell (10 degrees or less), outside danger "
             "zones and at least 70 m from every target. Stops are named P1, P2..."},
    {"topic": "overview",
     "es": ["¿Qué es SENDA?", "¿Para qué sirve este sistema?"],
     "en": ["What is SENDA?", "What is this system for?"],
     "a_es": "SENDA planifica salidas tripuladas en Marte, en la unidad boxwork de Mount Sharp, cráter Gale. Responde tres preguntas: "
             "¿podemos salir hoy?, ¿dónde estacionar y qué objetivos visitar?, y ¿qué ruta tomar, cuánto tarda y cuánta batería u oxígeno queda? "
             "Cada plan tiene tres alternativas: segura, científica y rápida.",
     "a_en": "SENDA plans crewed outings on Mars at the Mount Sharp boxwork unit, Gale crater. It answers three questions: "
             "can we go out today?, where to park and which targets to visit?, and which route to take, how long and how much battery or oxygen is left? "
             "Every plan has three alternatives: safe, scientific and fast."},
]

OFF_TOPIC = {
    "es": ["¿Qué hora es en Tokio?", "Cuéntame un chiste", "¿Cómo hago una pizza?", "Traduce 'hola' al francés",
           "¿Quién es el presidente de Perú?", "Hazme la tarea de matemáticas", "¿Qué opinas del último partido?",
           "Escríbeme una canción de amor", "¿Cuánto cuesta un iPhone?", "Dame consejos para dormir mejor",
           "¿Quién ganó la Champions?", "¿Cuál es el mejor equipo de fútbol?", "¿Va a llover en Lima mañana?",
           "Explícame la fotosíntesis", "Ayúdame con mi código de Python", "¿Qué series me recomiendas?"],
    "en": ["What time is it in Tokyo?", "Tell me a joke", "How do I make a pizza?", "Who won the last election?",
           "Write a love song", "Help me with my math homework", "What's the best phone to buy?",
           "Give me tips to sleep better", "Who won the World Cup?", "Will it rain in London tomorrow?",
           "Explain photosynthesis", "Fix my JavaScript code", "Recommend me a book"],
    "a_es": ["Solo puedo ayudarte con SENDA y esta misión en Marte. ¿Quieres que prepare una salida o que te explique algo del sistema?",
             "Eso queda fuera de lo que hago: soy el copiloto de SENDA. Puedo planificar rutas, darte el clima de la misión o explicarte la interfaz.",
             "No puedo ayudarte con eso. Mi trabajo es la misión en el cráter Gale: rutas, caminatas, clima y cómo usar SENDA."],
    "a_en": ["I can only help with SENDA and this Mars mission. Want me to prepare an outing or explain something about the system?",
             "That is outside what I do: I am the SENDA copilot. I can plan routes, give you the mission weather or explain the interface.",
             "I can't help with that. My job is the Gale crater mission: routes, walks, weather and how to use SENDA."],
}
