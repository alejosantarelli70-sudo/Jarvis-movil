
const http = require("http");

const PORT = process.env.PORT || 3000;
const FRONTEND = "https://alejosantarelli70-sudo.github.io";
const MODEL = "gemini-3.8-flash";

const server = http.createServer(async (req, res) => {
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

      if (typeof message !== "string" || !message.trim()) {
        res.writeHead(400);
        res.end(JSON.stringify({
          error: "Tenés que enviar un mensaje."
        }));
        return;
      }

      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": process.env.GEMINI_API_KEY
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{
                text: "Tu nombre es JARVIS. Sos un asistente personal elegante, educado, sofisticado, tranquilo e inteligente. Hablás en español argentino natural. Tenés humor e ironía sutil cuando corresponde. Sos claro, profesional y respetuoso."
              }]
            },
            contents: [{
              role: "user",
              parts: [{ text: message.trim() }]
            }]
          })
        }
      );

      const result = await geminiResponse.json();

      if (!geminiResponse.ok) {
        console.error("Error de Gemini:", result);
        res.writeHead(502);
        res.end(JSON.stringify({
          error: "No pude obtener respuesta de Gemini. Revisaremos la conexión."
        }));
        return;
      }

      const answer = result.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();

      if (!answer) {
        res.writeHead(502);
        res.end(JSON.stringify({
          error: "Gemini no devolvió una respuesta válida."
        }));
        return;
      }

      res.writeHead(200);
      res.end(JSON.stringify({
        assistant: "JARVIS",
        reply: answer
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
          
