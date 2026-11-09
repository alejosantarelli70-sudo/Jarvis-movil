
const http = require("http");

const PORT = process.env.PORT || 3000;
const FRONTEND = "https://alejosantarelli70-sudo.github.io";
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "";

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

function sendJson(res, status, payload) {
  res.writeHead(status);
  res.end(JSON.stringify(payload));
}

async function verifySupabaseUser(accessToken) {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("La autenticación de Supabase no está configurada en el servidor.");
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: "GET",
    headers: {
      "apikey": SUPABASE_PUBLISHABLE_KEY,
      "Authorization": `Bearer ${accessToken}`
    },
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    return null;
  }

  const user = await response.json();

  if (!user || typeof user.id !== "string") {
    return null;
  }

  return user;
}

const server = http.createServer(async (req, res) => {
  const route = (req.url || "").split("?")[0];

  res.setHeader("Access-Control-Allow-Origin", FRONTEND);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.headers.origin && req.headers.origin !== FRONTEND) {
    sendJson(res, 403, { error: "Origen no autorizado." });
    return;
  }

  if (req.method === "GET" && route === "/health") {
    sendJson(res, 200, {
      status: "online",
      assistant: "JARVIS",
      authenticationConfigured: Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY),
      message: "El servidor está funcionando."
    });
    return;
  }

  if (req.method === "POST" && route === "/chat") {
    try {
      // Toda conversación requiere una sesión válida de Supabase.
      const authorization = req.headers.authorization || "";
      const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i);

      if (!tokenMatch) {
        sendJson(res, 401, {
          error: "Necesitás iniciar sesión para conversar con JARVIS."
        });
        return;
      }

      let authenticatedUser;

      try {
        authenticatedUser = await verifySupabaseUser(tokenMatch[1]);
      } catch (authError) {
        console.error("Error verificando sesión:", authError.message);
        sendJson(res, 503, {
          error: "No pude verificar tu sesión en este momento. Intentá nuevamente."
        });
        return;
      }

      if (!authenticatedUser) {
        sendJson(res, 401, {
          error: "La sesión no es válida o venció. Iniciá sesión nuevamente."
        });
        return;
      }

      if (!process.env.GEMINI_API_KEY) {
        sendJson(res, 500, {
          error: "La clave de Gemini no está configurada."
        });
        return;
      }

      let body = "";

      for await (const chunk of req) {
        body += chunk;

        if (body.length > 20000) {
          sendJson(res, 413, {
            error: "El mensaje es demasiado largo."
          });
          return;
        }
      }

      let data;

      try {
        data = JSON.parse(body || "{}");
      } catch {
        sendJson(res, 400, { error: "El mensaje no tiene un formato válido." });
        return;
      }

      const message = data.message;
      const previousId = data.previousInteractionId;

      if (typeof message !== "string" || !message.trim()) {
        sendJson(res, 400, {
          error: "Tenés que enviar un mensaje."
        });
        return;
      }

      // Reloj interno: hora de Argentina.
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

      const consultaHora = /\b(qué hora es|que hora es|decime la hora|dime la hora|hora actual|qué día es hoy|que dia es hoy|fecha de hoy)\b/i.test(message);

      if (consultaHora) {
        sendJson(res, 200, {
          assistant: "JARVIS",
          reply: `En este momento son las ${horaActual}, señor. Hoy es ${fechaActual}.`,
          interactionId: null,
          model: "reloj interno de JARVIS"
        });
        return;
      }

      let answer = "";
      let interactionId = null;
      let successfulModel = null;

      const uniqueModels = [...new Set(MODELS)];

      for (const model of uniqueModels) {
        try {
          console.log(`Usuario autenticado ${authenticatedUser.id}: intentando conectar con ${model}...`);

          const requestBody = {
            model,
            input:
              `\n[FECHA Y HORA ACTUAL: ${fechaActual}, ${horaActual}, zona horaria America/Argentina/Buenos_Aires.]\n` +
              `[MODELO DE INTELIGENCIA ACTUAL: ${model}. Si el jefe pregunta qué modelo estás utilizando, respondé con este nombre exacto. No inventes otro modelo.]\n\n` +
              message.trim(),
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

          // Si el identificador anterior venció, iniciar una conversación nueva.
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
        sendJson(res, 503, {
          error: "En este momento no puedo conectarme a mis sistemas de inteligencia. Por favor, inténtelo nuevamente en unos instantes."
        });
        return;
      }

      console.log(`Respuesta generada correctamente por ${successfulModel}`);

      sendJson(res, 200, {
        assistant: "JARVIS",
        reply: answer,
        interactionId,
        model: successfulModel
      });
    } catch (error) {
      console.error("Error en /chat:", error);
      sendJson(res, 500, {
        error: "Ocurrió un problema al procesar el mensaje."
      });
    }

    return;
  }

  sendJson(res, 404, { error: "Ruta no encontrada." });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`JARVIS escuchando en el puerto ${PORT}`);
});
