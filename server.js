import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Cargar variables de entorno desde el archivo .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// 1. MIDDLEWARES GLOBALES
// ==========================================
app.use(helmet()); // Seguridad en cabeceras HTTP
app.use(cors()); // Permitir peticiones cross-origin
app.use(express.json()); // Parsear JSON en el cuerpo de la petición
app.use(morgan('dev')); // Logger de peticiones en consola

// Rate Limiting: Prevenir abusos (50 peticiones cada 15 min por IP)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 50,
    message: { error: "Demasiadas peticiones desde esta IP. Intenta de nuevo más tarde." },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(apiLimiter);

// Middleware de Autenticación para tus clientes
const authenticateApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
        return res.status(401).json({ error: "Falta la API Key en el header 'x-api-key'." });
    }
    if (apiKey !== process.env.CLIENT_API_KEY) {
        return res.status(403).json({ error: "API Key inválida." });
    }
    next();
};

// ==========================================
// 2. SERVICIOS DE INTEGRACIÓN DE IA
// ==========================================
const callOpenAI = async (message) => {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: message }],
    });
    return response.choices[0].message.content;
};

const callClaude = async (message) => {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        messages: [{ role: "user", content: message }]
    });
    return response.content[0].text;
};

const callGemini = async (message) => {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    const result = await model.generateContent(message);
    return result.response.text();
};

const callDeepSeek = async (message) => {
    const deepseek = new OpenAI({ 
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: 'https://api.deepseek.com/v1'
    });
    const response = await deepseek.chat.completions.create({
        model: "deepseek-chat",
        messages: [{ role: "user", content: message }],
    });
    return response.choices[0].message.content;
};

// Orquestador Principal
const generateAIResponse = async (model, message) => {
    switch (model.toLowerCase()) {
        case 'gpt':
        case 'openai':
            return await callOpenAI(message);
        case 'claude':
        case 'anthropic':
            return await callClaude(message);
        case 'gemini':
        case 'google':
            return await callGemini(message);
        case 'deepseek':
            return await callDeepSeek(message);
        default:
            throw new Error(`Modelo '${model}' no soportado.`);
    }
};

// ==========================================
// 3. RUTAS Y CONTROLADORES
// ==========================================
app.post('/chat', authenticateApiKey, async (req, res, next) => {
    try {
        const { model, message } = req.body;

        if (!model || !message) {
            return res.status(400).json({ error: "Los campos 'model' y 'message' son obligatorios." });
        }

        const reply = await generateAIResponse(model, message);
        
        res.status(200).json({
            success: true,
            model: model,
            response: reply
        });
    } catch (error) {
        // Validación personalizada para modelos no soportados
        if (error.message.includes("no soportado")) {
            return res.status(400).json({ error: error.message });
        }
        // Pasar el error al manejador global
        next(error);
    }
});

// ==========================================
// 4. MANEJO DE ERRORES GLOBAL
// ==========================================
app.use((err, req, res, next) => {
    console.error(`[Error] ${err.message}`);
    res.status(err.status || 500).json({
        error: "Ocurrió un error interno en el servidor.",
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ==========================================
// 5. INICIAR EL SERVIDOR
// ==========================================
app.listen(PORT, () => {
    console.log(`🚀 Servidor SaaS AI unificado corriendo en el puerto ${PORT}`);
});
