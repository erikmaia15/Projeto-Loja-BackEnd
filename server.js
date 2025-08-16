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

// Conectar ao banco
prisma
  .$connect()
  .then(() => {
    console.log("Conectado ao banco com Prisma!");
  })
  .catch((e) => {
    console.error("Erro ao conectar:", e);
  });

// Iniciar servidor
app.listen(3000, () => {
  console.log("Servidor rodando na porta 3000");
  console.log("Acesse: http://localhost:3000");
});
