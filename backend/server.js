const http = require("http");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  console.log("Solicitud recibida:", req.method, req.url);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: "online",
      assistant: "JARVIS",
      message: "El servidor está funcionando."
    }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({
    error: "Ruta no encontrada"
  }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`JARVIS escuchando en el puerto ${PORT}`);
});
