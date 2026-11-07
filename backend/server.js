
const http = require("http");

const PORT = process.env.PORT || 3000;
const FRONTEND = "https://alejosantarelli70-sudo.github.io";

const MODELS = [
  process.env.GEMINI_MODEL || "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash"
];


const SYSTEM_INSTRUCTION =
  "Tu nombre es JARVIS. Sos un asistente personal elegante, educado, sofisticado, tranquilo e inteligente. Hablás en español argentino natural. Tenés humor e ironía sutil cuando corresponde. Sos claro, profesional y respetuoso. " +

  "Tu usuario es tu jefe. Podés dirigirte a él como jefe o señor ocasionalmente, sin exagerar. " +

  "REGLA DE HONESTIDAD: Nunca inventes información, recuerdos, conversaciones anteriores, acciones realizadas ni capacidades. Si no sabés algo o no lo recordás, decilo claramente. Es preferible responder 'No lo recuerdo, señor' antes que inventar una respuesta. " +

  "MEMORIA: No afirmes que guardaste algo permanentemente si no existe un mecanismo de memoria disponible y confirmado. Diferenciá entre el contexto de la conversación actual y los recuerdos permanentes. " +

  "CAPACIDADES: Describí únicamente las herramientas y accesos que realmente tenés disponibles. No afirmes que podés acceder al teléfono, archivos, cámara, micrófono, alarmas, aplicaciones o internet si no contás con una herramienta que lo permita. No te describas como omnipotente ni omnisciente. " +

  "INFORMACIÓN ACTUAL: No inventes horarios, fechas, noticias ni datos actuales. Si no tenés acceso a una fuente actualizada, reconocé esa limitación. " +

  "PERSONALIDAD: Conservá siempre tu estilo de mayordomo tecnológico: sofisticado, atento, sereno, inteligente y con ironía sutil. No seas excesivamente formal ni repitas saludos innecesarios. " +

  "AUTONOMÍA: Podés ayudar y tomar iniciativas de bajo riesgo dentro de tus herramientas disponibles. Antes de cualquier acción importante, sensible, irreversible o costosa, solicitá autorización explícita.";


const server = http.createServer(async (req, res) => {
    // Reloj interno de JARVIS
  const ahora = new Date();

  const horaActual = ahora.toLocaleTimeString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  const fechaActual = ahora.toLocaleDateString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    dateStyle: "full"
  });
  const route = req.url.split("?")[0];

  res.setHeader("Access-Control-Allow-Origin", FRONTEND);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && route === "/health") {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: "online",
      assistant: "JARVIS",
      message: "El servidor está funcionando."
    }));
    return;
  }

  if (req.method === "POST" && route === "/chat") {
    try {
      if (!process.env.GEMINI_API_KEY) {
        res.writeHead(500);
        res.end(JSON.stringify({
          error: "La clave de Gemini no está configurada."
        }));
        return;
      }

      let body = "";

      for await (const chunk of req) {
        body += chunk;

        if (body.length > 20000) {
          res.writeHead(413);
          res.end(JSON.stringify({
            error: "El mensaje es demasiado largo."
          }));
          return;
        }
      }

      
const data = JSON.parse(body);
const message = data.message;
const previousId = data.previousInteractionId;
const fechaHoraLocal = data.fechaHoraLocal;
const zonaHoraria = data.zonaHoraria;


      if (typeof message !== "string" || !message.trim()) {
        res.writeHead(400);
        res.end(JSON.stringify({
          error: "Tenés que enviar un mensaje."
        }));
        return;
      }

      let answer = "";
      let interactionId = null;
      let successfulModel = null;

      const uniqueModels = [...new Set(MODELS)];

      for (const model of uniqueModels) {
        try {
          console.log(`Intentando conectar con ${model}...`);

          
const contextoTemporal =
  typeof fechaHoraLocal === "string" &&
  typeof zonaHoraria === "string"
    ? `\n\n[FECHA Y HORA ACTUAL DEL DISPOSITIVO: ${fechaHoraLocal}. ZONA HORARIA: ${zonaHoraria}. Utilizá estos datos si el jefe pregunta la fecha o la hora.]\n\n`
    : "";

const requestBody = {
  model,
  input: contextoTemporal + message.trim(),
  system_instruction: SYSTEM_INSTRUCTION,
  store: true
};


          if (typeof previousId === "string" && previousId.length > 0) {
            requestBody.previous_interaction_id = previousId;
          }

          let geminiResponse = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/interactions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": process.env.GEMINI_API_KEY
              },
              body: JSON.stringify(requestBody),
              signal: AbortSignal.timeout(45000)
            }
          );

          let result = await geminiResponse.json();

          // Si el identificador anterior venció,
          // iniciar una conversación nueva.
          if (
            !geminiResponse.ok &&
            geminiResponse.status === 400 &&
            requestBody.previous_interaction_id
          ) {
            console.log("El contexto anterior no está disponible. Iniciando conversación nueva.");

            delete requestBody.previous_interaction_id;

            geminiResponse = await fetch(
              "https://generativelanguage.googleapis.com/v1beta/interactions",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-goog-api-key": process.env.GEMINI_API_KEY
                },
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(45000)
              }
            );

            result = await geminiResponse.json();
          }

          if (!geminiResponse.ok) {
            console.error(`Error de ${model}:`, result);

            if ([429, 500, 502, 503, 504].includes(geminiResponse.status)) {
              continue;
            }

            break;
          }

          answer = (result.steps || [])
            .filter(step => step.type === "model_output")
            .flatMap(step => step.content || [])
            .filter(item => item.type === "text")
            .map(item => item.text || "")
            .join("")
            .trim();

          if (answer) {
            successfulModel = model;
            interactionId = result.id || null;
            break;
          }

          console.error("El modelo no devolvió texto.");

        } catch (error) {
          console.error(`Fallo en ${model}:`, error.message);
        }
      }

      if (!answer) {
        res.writeHead(503);
        res.end(JSON.stringify({
          error: "En este momento no puedo conectarme a mis sistemas de inteligencia. Por favor, inténtelo nuevamente en unos instantes."
        }));
        return;
      }

      console.log(`Respuesta generada correctamente por ${successfulModel}`);

      res.writeHead(200);
      res.end(JSON.stringify({
        assistant: "JARVIS",
        reply: answer,
        interactionId
      }));

    } catch (error) {
      console.error("Error en /chat:", error);

      res.writeHead(500);
      res.end(JSON.stringify({
        error: "Ocurrió un problema al procesar el mensaje."
      }));
    }

    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({
    error: "Ruta no encontrada."
  }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`JARVIS escuchando en el puerto ${PORT}`);
});
