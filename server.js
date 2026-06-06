import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: { error: "Demasiadas peticiones. Intenta más tarde." }
});

app.use(apiLimiter);

app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'AvjIAS API',
        version: '1.0',
        endpoints: {
            chat: '/chat'
        }
    });
});

const authenticateApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
        return res.status(401).json({ error: "Falta x-api-key." });
    }

    if (apiKey !== process.env.CLIENT_API_KEY) {
        return res.status(403).json({ error: "API Key inválida." });
    }

    next();
};

const callOpenAI = async (message) => {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: message }]
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
        messages: [{ role: "user", content: message }]
    });

    return response.choices[0].message.content;
};

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

app.post('/chat', authenticateApiKey, async (req, res, next) => {
    try {
        const { model, message } = req.body;

        if (!model || !message) {
            return res.status(400).json({
                error: "Los campos 'model' y 'message' son obligatorios."
            });
        }

        const reply = await generateAIResponse(model, message);

        res.status(200).json({
            success: true,
            model,
            response: reply
        });

    } catch (error) {
        if (error.message.includes("no soportado")) {
            return res.status(400).json({ error: error.message });
        }

        next(error);
    }
});

app.use((err, req, res, next) => {
    console.error(`[Error] ${err.message}`);

    res.status(err.status || 500).json({
        error: "Ocurrió un error interno en el servidor.",
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

app.listen(PORT, () => {
    console.log(`🚀 AvjIAS API corriendo en el puerto ${PORT}`);
});
