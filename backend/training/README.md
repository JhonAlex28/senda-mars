# Entrenamiento del SENDA Copilot

El copiloto es **Qwen3 1.7B** (abierto, Apache 2.0) servido por Ollama. Aquí se ajusta con LoRA
para que actúe como un miembro más del equipo: planificar salidas, cambiar la vista, dar el clima,
describir el plan en pantalla, explicar cómo se usa SENDA y negarse a lo que no es de la misión.

## Idea central

El modelo **no calcula nada**: decide qué herramienta usar y redacta con las cifras que le
devuelven. Por eso los datos de entrenamiento se generan con el **planificador real**:

```
orden del usuario  →  herramienta correcta  →  resultado REAL del planificador  →  respuesta con esas cifras
```

Ninguna cifra de los ejemplos está escrita a mano: si el planificador cambia, se regeneran.

## Flujo

| Paso | Dónde | Comando |
|---|---|---|
| 1. Medir el modelo actual | PC (Ollama) | `python eval/run_eval.py` |
| 2. Generar los datos | PC | `python training/generate_dataset.py` |
| 3. Entrenar (LoRA) y exportar a GGUF | Google Colab, GPU T4 gratis | `training/senda_copilot_colab.ipynb` |
| 4. Instalar en Ollama | PC | `python training/install_in_ollama.py senda-copilot.Q4_K_M.gguf` |
| 5. Medir de nuevo y comparar | PC | `python eval/run_eval.py --model senda-copilot` |
| 6. Usarlo en la app | `backend/.env` | `SENDA_LLM_MODEL=senda-copilot` |

Todos los comandos se ejecutan desde `backend/`.

## Qué contiene el conjunto de datos

`generate_dataset.py` arma 1662 conversaciones únicas (65 % español, 35 % inglés; 1529 de entrenamiento y 133 de validación) usando el mismo prompt de
sistema, las mismas herramientas y el mismo historial compactado que producción:

- **plan**: cientos de formas de pedir una salida (tiempo, día, tormenta, fuga, objetivos por id o
  nombre, perfil) → `plan_outing` con los argumentos correctos → resumen con las cifras reales.
- **plan con mal tiempo**: veredictos de precaución y NO GO → el modelo aprende a decir que no.
- **clima**, **objetivos**, **plan en pantalla** (`get_current_plan`), **cambiar la vista**
  (`adjust_view`, también sin plan cargado).
- **cómo se usa / cómo funciona** (`explain_system`): banco bilingüe en `qa_bank.py`, con respuestas
  fieles a `data/knowledge/`.
- **temas ajenos**: rechazo amable sin herramientas.
- **varios turnos**: planificar y luego ajustar o preguntar por el plan.

Las frases del examen (`eval/cases.json`) se excluyen: la nota mide si generaliza, no si memoriza.

## El examen (`eval/run_eval.py`)

42 casos en 8 categorías, calificados automáticamente:

- **routing**: llamó a la herramienta correcta (o a ninguna en temas ajenos)
- **args**: entendió la orden (180 min, tormenta 0.7, objetivos, perfil, tema de la documentación)
- **language**: respondió en el idioma del usuario
- **grounded**: los números de la respuesta salen de las herramientas (no inventa)

Resultado del modelo base `qwen3:1.7b` (punto de partida): **57 % de casos perfectos**;
routing 69 %, argumentos 44 %, cifras verificadas 91 %; cómo usar SENDA 33 %, plan en pantalla 25 %,
explicaciones con el tema correcto 0 %.

Antes de entrenar, el conjunto se audita con el mismo verificador del examen: 0 respuestas con
cifras que no salgan del planificador y 0 respuestas en un idioma distinto al del usuario.
Los informes quedan en `eval/results/` para comparar antes y después.

## Historial de rondas

| Ronda | Datos | Casos perfectos | Herramienta correcta | Entiende la orden | Nota |
|---|---|---|---|---|---|
| Base `qwen3:1.7b` | — | 57 % | 69 % | 44 % | punto de partida |
| 1 (`think: false`) | 1662 conv. | 48 % | 48 % | 39 % | casi no llamaba herramientas (formato) |
| 1 (`SENDA_LLM_THINK=auto`) | 1662 conv. | **69 %** | 71 % | 56 % | plan en pantalla 100 %, explicaciones 75 %; cambiar la vista 20 % |
| 2 | 2009 conv. + calendario | *pendiente* | | | formato idéntico al de Ollama |

**Lección de la ronda 1:** el modelo aprendió bien, pero se entrenó con un formato distinto al que usa
Ollama. Con `think: false`, Ollama pone un bloque vacío `<think></think>` antes de **cada** respuesta y
agrega ` /no_think` a la orden; en los datos ese bloque solo iba antes de la respuesta final, así que el
modelo aprendió "bloque vacío → responder con texto" y dejó de llamar herramientas. La ronda 2 entrena
cada turno del asistente con el prompt exacto de Ollama (verificado con la plantilla oficial de Qwen3).

Para usar el modelo de la ronda 1: `SENDA_LLM_MODEL=senda-copilot` y `SENDA_LLM_THINK=auto` en `backend/.env`.
