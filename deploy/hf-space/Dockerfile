# Servidor Ollama con senda-copilot-v2 para un Space de Hugging Face (respaldo de la laptop).
# Misma versión de Ollama que en la laptop, para que la plantilla de chat se comporte igual.
FROM ollama/ollama:0.40.16

# Los Spaces ejecutan el contenedor como el usuario 1000: los modelos van en una carpeta suya
ENV OLLAMA_MODELS=/data/ollama \
    OLLAMA_KEEP_ALIVE=24h \
    OLLAMA_NUM_PARALLEL=1

WORKDIR /build
COPY Modelfile senda-copilot-v2.gguf ./

# El modelo se registra al construir la imagen: al despertar, el Space ya lo tiene listo
RUN mkdir -p "$OLLAMA_MODELS" \
 && (OLLAMA_HOST=127.0.0.1:11434 ollama serve > /tmp/ollama.log 2>&1 &) \
 && for i in $(seq 1 60); do OLLAMA_HOST=127.0.0.1:11434 ollama list > /dev/null 2>&1 && break; sleep 1; done \
 && OLLAMA_HOST=127.0.0.1:11434 ollama create senda-copilot-v2 -f Modelfile \
 && rm -f senda-copilot-v2.gguf \
 && chown -R 1000:1000 "$OLLAMA_MODELS"

# Hugging Face enruta el tráfico al puerto 7860 (app_port en README.md)
ENV OLLAMA_HOST=0.0.0.0:7860
EXPOSE 7860
USER 1000
ENTRYPOINT ["/bin/ollama"]
CMD ["serve"]
