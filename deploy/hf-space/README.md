---
title: SENDA Copilot
emoji: 🚀
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# SENDA Copilot: servidor del modelo (respaldo)

Servidor [Ollama](https://ollama.com) con `senda-copilot-v2` (Qwen3 1.7B ajustado con LoRA para SENDA).
El backend de SENDA lo usa cuando la laptop del equipo está apagada: primero intenta la laptop
(por un túnel de Cloudflare) y, si no responde, llama a este Space.

> Este README es también la configuración del Space (el bloque de arriba). Los pasos de abajo
> son para el equipo; en Hugging Face no molestan.

> ⚠️ **Desde 2026 los Spaces Docker requieren Hugging Face PRO** (las cuentas gratuitas solo crean
> Spaces estáticos). El `Dockerfile` sirve igual en cualquier servidor con Docker (p. ej. Oracle
> Cloud Always Free); ahí no hace falta el bloque de configuración ni el token de Hugging Face.

## Publicarlo (una vez)

1. En Hugging Face: **New Space** → nombre `senda-copilot` → SDK **Docker** → plantilla **Blank** →
   visibilidad **Private** (así solo el backend, con tu token, puede usarlo).
2. Copia el modelo junto a estos archivos con el nombre exacto `senda-copilot-v2.gguf`:
   ```powershell
   copy "$env:USERPROFILE\Downloads\senda-copilot-v2.Q4_K_M.gguf" deploy\hf-space\senda-copilot-v2.gguf
   ```
   (el `.gguf` no se sube al repositorio de SENDA: está en `.gitignore`)
3. Sube la carpeta al Space (pide un token con permiso **write** en huggingface.co/settings/tokens):
   ```powershell
   pip install -U huggingface_hub
   hf auth login
   hf upload TU_USUARIO/senda-copilot deploy/hf-space . --repo-type space
   ```
4. Espera a que el Space pase de *Building* a *Running* (~5 min la primera vez).

## Conectarlo al backend (Render → Environment)

| Variable | Valor |
|---|---|
| `SENDA_ASSISTANT_ENABLED` | `true` |
| `SENDA_LLM_MODEL` | `senda-copilot-v2` |
| `SENDA_LLM_THINK` | `false` |
| `SENDA_OLLAMA_URL` | URL del túnel a la laptop (`https://….trycloudflare.com`) |
| `SENDA_OLLAMA_FALLBACK_URL` | `https://TU_USUARIO-senda-copilot.hf.space` |
| `SENDA_OLLAMA_FALLBACK_TOKEN` | token de Hugging Face con permiso **read** |

Sin laptop (solo el Space), pon la URL del Space en `SENDA_OLLAMA_URL` y su token en `SENDA_OLLAMA_TOKEN`.

## Probarlo

```powershell
curl.exe -H "Authorization: Bearer hf_..." https://TU_USUARIO-senda-copilot.hf.space/api/tags
```
Debe listar `senda-copilot-v2:latest`. Si el Space estaba dormido, la primera llamada tarda ~1 min.

## Qué esperar

- **Gratis:** CPU básica (2 vCPU, 16 GB). Sin GPU: cada respuesta tarda bastante más que en la laptop.
- **Se duerme** tras 48 h sin uso; el backend lo despierta solo cuando alguien abre el copiloto.
- **Modelo nuevo:** reemplaza `senda-copilot-v2.gguf`, vuelve a subir la carpeta y el Space se reconstruye.
