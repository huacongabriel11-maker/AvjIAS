const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public')); // index.html + assets

app.post('/chat/:model', async (req, res) => {
  const model = req.params.model;
  const { message } = req.body;

  // Aquí llamas a la API correspondiente según el modelo
  let reply = '';

  switch(model) {
    case 'chatgpt':
      reply = `[ChatGPT 5.5] Respuesta simulada a: "${message}"`;
      break;
    case 'claude':
      reply = `[Claude 4.8] Respuesta simulada a: "${message}"`;
      break;
    case 'gemini':
      reply = `[Gemini 3.1] Respuesta simulada a: "${message}"`;
      break;
    default:
      reply = 'Modelo no soportado.';
  }

  res.json({ reply });
});

app.listen(port, () => console.log(`Servidor corriendo en http://localhost:${port}`));

