import express from "express";
import PublicRoutes from "./routes/public.js";
import PrivateRoutes from "./routes/private.js";
import adminAuth from "./middlewares/adminAuth.js";
import prisma from "./utils/prisma.js";
import cors from "cors";

const app = express();

// ✅ IMPORTANTE: Middleware para JSON
app.use(express.json());
app.use(cors());

// Usar as rotas públicas
app.use("/", PublicRoutes);
app.use("/", adminAuth, PrivateRoutes);

// Rota health check para o Render
app.get("/health", async (req, res) => {
  try {
    // Verifica se o banco está conectado
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      status: "OK",
      message: "Server is running",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: "ERROR",
      message: "Database connection failed",
      error: error.message,
    });
  }
});

// Conectar ao banco
prisma
  .$connect()
  .then(() => {
    console.log("Conectado ao banco com Prisma!");
  })
  .catch((e) => {
    console.error("Erro ao conectar:", e);
  });

// ✅ MUDANÇA CRÍTICA: Usar porta do ambiente
const PORT = process.env.PORT || 3000;

// Iniciar servidor
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}`);
});
